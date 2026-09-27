"""Take uploads (phase 3): store the webcam video of a take as data/takes/<takeId>.webm."""
import uuid
from pathlib import Path
from typing import BinaryIO

MAX_UPLOAD_MB = 100
MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024
MAX_TAKE_SECONDS = 180.0
TAKE_SUFFIX = ".webm"
COPY_CHUNK_BYTES = 1024 * 1024


class TakeTooLargeError(Exception):
    """The upload is larger than MAX_UPLOAD_BYTES."""


def new_take_id() -> str:
    return uuid.uuid4().hex


def store_upload(source: BinaryIO, takes_dir: Path, take_id: str) -> Path:
    """Copy `source` to <takes_dir>/<take_id>.webm and return that path.

    Raise TakeTooLargeError once more than MAX_UPLOAD_BYTES arrive; no partial file is left behind,
    whatever goes wrong.
    """
    limit = MAX_UPLOAD_BYTES  # read once: tests shrink it
    takes_dir.mkdir(parents=True, exist_ok=True)
    path = takes_dir / f"{take_id}{TAKE_SUFFIX}"
    try:
        with path.open("xb") as target:
            copied = 0
            while chunk := source.read(COPY_CHUNK_BYTES):
                copied += len(chunk)
                if copied > limit:
                    raise TakeTooLargeError(f"Video is larger than {MAX_UPLOAD_MB} MB")
                target.write(chunk)
    except BaseException:
        path.unlink(missing_ok=True)
        raise
    return path
