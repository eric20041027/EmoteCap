"""Export service: run Blender headless on a batch of clips and publish FBX + sidecar files.

clips -> data/jobs/<uuid>/clips.json -> Blender -> data/jobs/<uuid>/out/
      -> data/exports/ (served at /files) -> UNITY_EXPORT_DIR (optional)
"""
import json
import logging
import os
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
    explicit = set(names)
    taken: set[str] = set()
    result: list[str] = []
    for name in names:
        candidate, index = name, 1
        while candidate in taken or (index > 1 and candidate in explicit):
            index += 1
            candidate = _with_suffix(name, index)
        taken.add(candidate)
        result.append(candidate)
    return result


def _with_suffix(name: str, index: int) -> str:
    suffix = f"_{index}"
    return name[: MAX_NAME_LENGTH - len(suffix)] + suffix


def run_blender(settings: Settings, job_json: Path, out_dir: Path) -> None:
    """Run server/blender/export_fbx.py headless on `job_json`, writing into `out_dir`.

    Raise ExportError on non-zero exit, timeout, or missing Blender.
    """
    command = [
        settings.blender_path, "-b", "--factory-startup",
        # Without this flag Blender exits 0 even when the export script raises.
        "--python-exit-code", "1",
        "-P", str(EXPORT_SCRIPT), "--",
        "--in", str(job_json.absolute()),
        "--out", str(out_dir.absolute()),
        "--bones", str(settings.bones_path.absolute()),
    ]
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
    job_dir = settings.data_dir / "jobs" / uuid.uuid4().hex
    job_json = _write_job(job_dir, renamed)
    out_dir = job_dir / "out"
    run_blender(settings, job_json, out_dir)
    exports_dir = settings.data_dir / "exports"
    _publish(out_dir, exports_dir, names)
    if settings.unity_export_dir is not None:
        _copy_to_unity(exports_dir, settings.unity_export_dir, names)
    logger.info("Exported %s (job %s)", ", ".join(names), job_dir.name)
    return [ExportedFile(name=name, url=f"/files/{name}{FBX_SUFFIX}") for name in names]


def _write_job(job_dir: Path, clips: list[Clip]) -> Path:
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


def _publish(out_dir: Path, exports_dir: Path, names: list[str]) -> None:
    """Move Blender's output into exports_dir, overwriting older exports with the same name."""
    missing = [f for name in names for f in _files_for(name) if not (out_dir / f).is_file()]
    if missing:
        raise ExportError(f"Blender finished but did not produce: {', '.join(missing)}")
    try:
        exports_dir.mkdir(parents=True, exist_ok=True)
        for name in names:
            for filename in _files_for(name):
                os.replace(out_dir / filename, exports_dir / filename)
    except OSError as exc:
        raise ExportError(f"Could not move exported files into {exports_dir}: {exc}") from exc


def _copy_to_unity(exports_dir: Path, unity_dir: Path, names: list[str]) -> None:
    """Copy each sidecar, then its FBX, so Unity never imports an FBX without its sidecar."""
    try:
        unity_dir.mkdir(parents=True, exist_ok=True)
        for name in names:
            for filename in _files_for(name):
                _atomic_copy(exports_dir / filename, unity_dir / filename)
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
