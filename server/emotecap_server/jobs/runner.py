"""Own one Blender process with bounded output and explicit cancellation."""
import re
import subprocess
import threading
import time
from collections.abc import Callable
from pathlib import Path

from ..config import REPO_ROOT, Settings
from ..exporter import ExportError, blender_command

TIMEOUT_SECONDS = 120
OUTPUT_BYTES = 64 * 1024
_PROGRESS = re.compile(rb'EMOTECAP_PROGRESS:(\d{1,3}):(\d{1,3})')


class JobCancelled(Exception):
    """The caller cancelled this owned job."""


def _stop(process: subprocess.Popen[bytes]) -> None:
    if process.poll() is not None:
        return
    process.terminate()
    try:
        process.wait(timeout=2)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=2)


def run_job(settings: Settings, job_json: Path, out_dir: Path,
            cancel: threading.Event, progress: Callable[[int], None]) -> None:
    if cancel.is_set():
        raise JobCancelled('Export cancelled')
    try:
        process = subprocess.Popen(blender_command(settings, job_json, out_dir), cwd=REPO_ROOT,
                                   stdout=subprocess.PIPE, stderr=subprocess.STDOUT, shell=False)
    except OSError as exc:
        raise ExportError(f'Could not start Blender at {settings.blender_path}: {exc}') from exc
    tail = bytearray()
    read_errors: list[Exception] = []

    def read_output() -> None:
        line = bytearray()
        assert process.stdout is not None
        try:
            while chunk := process.stdout.read1(4096):
                tail.extend(chunk)
                if len(tail) > OUTPUT_BYTES:
                    del tail[:-OUTPUT_BYTES]
                for part in chunk.splitlines(keepends=True):
                    line.extend(part)
                    if part.endswith(b'\n'):
                        match = _PROGRESS.fullmatch(bytes(line).strip())
                        if match:
                            done, total = map(int, match.groups())
                            if 1 <= total <= 50 and 0 <= done <= total:
                                progress(done * 100 // total)
                        line.clear()
                    elif len(line) > 256:
                        line.clear()
        except Exception as exc:
            read_errors.append(exc)

    reader = threading.Thread(target=read_output, name='emotecap-blender-output', daemon=True)
    reader.start()
    deadline = time.monotonic() + TIMEOUT_SECONDS
    failure: str | None = None
    cancelled = False
    try:
        while process.poll() is None:
            if read_errors:
                _stop(process)
                break
            if cancel.wait(.05):
                cancelled = True
                _stop(process)
                break
            if time.monotonic() >= deadline:
                failure = f'Blender timed out after {TIMEOUT_SECONDS} s'
                _stop(process)
                break
        reader.join(timeout=2)
        if reader.is_alive():
            raise ExportError('Blender output pipe did not close')
        if cancel.is_set() or cancelled:
            raise JobCancelled('Export cancelled')
        output = bytes(tail).decode('utf-8', errors='replace')
        output = output.encode('utf-8')[-OUTPUT_BYTES:].decode('utf-8', errors='ignore')
        if read_errors:
            raise ExportError(f'Could not read Blender output: {read_errors[0]}', output)
        if failure:
            raise ExportError(failure, output)
        if process.returncode != 0:
            raise ExportError(f'Blender exited with code {process.returncode}', output)
    finally:
        _stop(process)
        if not reader.is_alive() and process.stdout is not None:
            process.stdout.close()
