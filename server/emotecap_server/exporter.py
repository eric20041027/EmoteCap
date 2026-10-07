"""Export service: run Blender headless on a batch of clips and publish FBX + sidecar files.

clips -> data/jobs/<uuid>/clips.json -> Blender -> data/jobs/<uuid>/out/
      -> data/exports/<uuid>/ -> UNITY_EXPORT_DIR/<uuid>/ (optional)
"""
import json
import logging
import os
import re
import shutil
import subprocess
import uuid
from pathlib import Path

from .config import REPO_ROOT, Settings
from .contract import Clip, ExportedFile

logger = logging.getLogger(__name__)

EXPORT_SCRIPT = Path("server") / "blender" / "export_fbx.py"  # relative to REPO_ROOT
BLENDER_TIMEOUT_S: float = 120
STDERR_TAIL_LINES = 20
MAX_NAME_LENGTH = 24
FBX_SUFFIX = ".fbx"
SIDECAR_SUFFIX = ".emotecap.json"


class ExportError(Exception):
    """Export failed (Blender or publishing the files).

    `stderr_tail` holds the last 20 lines of Blender's combined stdout/stderr, if any.
    """

    def __init__(self, message: str, stderr_tail: str = "") -> None:
        super().__init__(message)
        self.message = message
        self.stderr_tail = stderr_tail


def unique_names(names: list[str]) -> list[str]:
    """["A", "A", "B", "A"] -> ["A", "A_2", "B", "A_3"]; results stay <= 24 chars.

    The first occurrence keeps its name. Later duplicates get the lowest `_<n>` suffix that is
    neither already assigned nor a name given explicitly elsewhere in `names`; the base is
    truncated to make room for the suffix.
    """
    explicit = {name.casefold() for name in names}
    taken: set[str] = set()
    result: list[str] = []
    for name in names:
        candidate, index = name, 1
        while candidate.casefold() in taken or (index > 1 and candidate.casefold() in explicit):
            index += 1
            candidate = _with_suffix(name, index)
        taken.add(candidate.casefold())
        result.append(candidate)
    return result


def _with_suffix(name: str, index: int) -> str:
    suffix = f"_{index}"
    return name[: MAX_NAME_LENGTH - len(suffix)] + suffix


def blender_command(settings: Settings, job_json: Path, out_dir: Path) -> list[str]:
    return [
        settings.blender_path, "-b", "--factory-startup",
        # Without this flag Blender exits 0 even when the export script raises.
        "--python-exit-code", "1",
        "-P", str(EXPORT_SCRIPT), "--",
        "--in", str(job_json.absolute()),
        "--out", str(out_dir.absolute()),
        "--bones", str(settings.bones_path.absolute()),
    ]
def run_blender(settings: Settings, job_json: Path, out_dir: Path) -> None:
    """Legacy source-call runner; the HTTP API uses the owned job worker."""
    command = blender_command(settings, job_json, out_dir)
    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=BLENDER_TIMEOUT_S,
            cwd=REPO_ROOT,
            check=False,
        )
    except OSError as exc:
        raise ExportError(f"Could not start Blender at {settings.blender_path}: {exc}") from exc
    except subprocess.TimeoutExpired as exc:
        tail = _output_tail(exc.stdout, exc.stderr)
        raise ExportError(f"Blender timed out after {BLENDER_TIMEOUT_S} s", tail) from exc
    tail = _output_tail(result.stdout, result.stderr)
    if result.returncode != 0:
        raise ExportError(f"Blender exited with code {result.returncode}", tail)
    logger.debug("Blender finished:\n%s", tail)


def _output_tail(stdout: str | bytes | None, stderr: str | bytes | None) -> str:
    """Last lines of stdout followed by stderr, so a Python traceback ends up in the tail."""
    lines = _as_text(stdout).splitlines() + _as_text(stderr).splitlines()
    return "\n".join(lines[-STDERR_TAIL_LINES:])


def _as_text(stream: str | bytes | None) -> str:
    # TimeoutExpired carries raw bytes even when subprocess.run was called with text=True.
    if stream is None:
        return ""
    return stream.decode(errors="replace") if isinstance(stream, bytes) else stream


def export_clips(clips: list[Clip], settings: Settings) -> list[ExportedFile]:
    """Export each clip to <data_dir>/exports (+ UNITY_EXPORT_DIR if set); return download URLs."""
    names = unique_names([clip.name for clip in clips])
    renamed = [
        clip.model_copy(update={"name": name}) for clip, name in zip(clips, names, strict=True)
    ]
    job_id = str(uuid.uuid4())
    job_dir = settings.data_dir / "jobs" / job_id
    job_json = write_job(job_dir, renamed)
    out_dir = job_dir / "out"
    run_blender(settings, job_json, out_dir)
    files, warning = publish_job(out_dir, settings, job_id, names)
    if warning:
        logger.warning('%s', warning)
    logger.info("Exported %s (job %s)", ", ".join(names), job_dir.name)
    return files


def write_job(job_dir: Path, clips: list[Clip]) -> Path:
    job_json = job_dir / "clips.json"
    try:
        job_dir.mkdir(parents=True)
        job_json.write_text(json.dumps({"clips": [clip.model_dump() for clip in clips]}))
    except OSError as exc:
        raise ExportError(f"Could not write export job {job_json}: {exc}") from exc
    return job_json


def _files_for(name: str) -> tuple[str, str]:
    """Sidecar first: consumers must never see an FBX without its sidecar."""
    return f"{name}{SIDECAR_SUFFIX}", f"{name}{FBX_SUFFIX}"


def _linked(path: Path) -> bool:
    return path.is_symlink() or (hasattr(path, 'is_junction') and path.is_junction())


def publish_job(out_dir: Path, settings: Settings, job_id: str, names: list[str]) -> tuple[list[ExportedFile], str | None]:
    """Expose only a complete ordinary directory; never overwrite a prior result."""
    try:
        parsed = uuid.UUID(job_id)
    except (ValueError, AttributeError) as exc:
        raise ExportError('Invalid export job identity') from exc
    if parsed.version != 4 or str(parsed) != job_id:
        raise ExportError('Invalid export job identity')
    if not names or any(re.fullmatch(r'[A-Za-z0-9_]{1,24}', name) is None for name in names):
        raise ExportError('Invalid export output name')
    if len({name.casefold() for name in names}) != len(names):
        raise ExportError('Export output names collide')
    if _linked(out_dir) or any(_linked(parent) for parent in out_dir.parents):
        raise ExportError('Export output must be a regular directory')
    missing = [f for name in names for f in _files_for(name) if not (out_dir / f).is_file()]
    if missing:
        raise ExportError(f"Blender finished but did not produce: {', '.join(missing)}")
    expected = {f for name in names for f in _files_for(name)}
    if any(_linked(out_dir / f) for f in expected):
        raise ExportError('Export output must contain regular files')
    if {p.name for p in out_dir.iterdir()} != expected:
        raise ExportError('Blender produced unexpected output files')
    exports_dir = settings.data_dir / 'exports'
    destination = exports_dir / job_id
    try:
        exports_dir.mkdir(parents=True, exist_ok=True)
        if _linked(exports_dir) or any(_linked(p) for p in exports_dir.parents):
            raise ExportError('Export destination must be a regular directory')
        if destination.exists():
            raise ExportError('Export job directory already exists')
        os.rename(out_dir, destination)
    except OSError as exc:
        raise ExportError(f"Could not move exported files into {exports_dir}: {exc}") from exc
    warning = None
    if settings.unity_export_dir is not None:
        try:
            _copy_to_unity(destination, settings.unity_export_dir, job_id, names)
        except ExportError as exc:
            warning = exc.message
    return [ExportedFile(name=name, url=f'/files/{job_id}/{name}{FBX_SUFFIX}') for name in names], warning


def _copy_to_unity(exports_dir: Path, unity_dir: Path, job_id: str, names: list[str]) -> None:
    """Copy each sidecar, then its FBX, so Unity never imports an FBX without its sidecar."""
    try:
        unity_dir.mkdir(parents=True, exist_ok=True)
        if _linked(unity_dir) or any(_linked(p) for p in unity_dir.parents):
            raise ExportError('UNITY_EXPORT_DIR must be a regular directory')
        staging = unity_dir / f'.{job_id}.tmp'
        staging.mkdir()
        for name in names:
            for filename in _files_for(name):
                _atomic_copy(exports_dir / filename, staging / filename)
        destination = unity_dir / job_id
        if destination.exists():
            raise ExportError('UNITY_EXPORT_DIR job directory already exists')
        os.rename(staging, destination)
    except OSError as exc:
        raise ExportError(
            f"Exported, but copying to UNITY_EXPORT_DIR {unity_dir} failed: {exc}"
        ) from exc


def _atomic_copy(src: Path, dst: Path) -> None:
    """Copy through a hidden temp file (Unity ignores dot-files and *.tmp), then os.replace,
    so a reader never sees a half-written file."""
    tmp = dst.with_name(f".{dst.name}.{uuid.uuid4().hex[:8]}.tmp")
    try:
        shutil.copyfile(src, tmp)
        os.replace(tmp, dst)
    finally:
        tmp.unlink(missing_ok=True)
