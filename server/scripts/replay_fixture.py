"""Replay a Clip JSON file into the Live Link relay, standing in for the browser source.

    cd server && uv run python scripts/replay_fixture.py ../contracts/fixtures/raise-right-arm.clip.json --loop

Sends {"type":"hello","version":1,"bones":[...]} once, then {"type":"frame", **frame} for each
frame at the clip's fps (contracts/motion-v1.md, "Live Link WebSocket"). Ctrl+C stops a --loop.
"""
import argparse
import asyncio
import itertools
import json
import logging
import sys
from pathlib import Path
from typing import Any

from websockets.asyncio.client import connect
from websockets.exceptions import ConnectionClosed, InvalidHandshake, InvalidURI

logger = logging.getLogger("replay_fixture")

DEFAULT_URL = "ws://localhost:8787/ws/live?role=source"
BONES_PATH = Path(__file__).resolve().parents[2] / "contracts" / "bones.json"
PROTOCOL_VERSION = 1
HIPS_FLOATS = 3
QUATERNION_FLOATS = 4
SERVER_HINT = "is the server running? cd server && uv run uvicorn emotecap_server.main:app --port 8787"


class ClipError(ValueError):
    """The clip or bones file cannot be read or does not match the motion contract."""


def load_bones() -> list[str]:
    try:
        return json.loads(BONES_PATH.read_text())["driven"]
    except (OSError, ValueError, KeyError) as exc:
        raise ClipError(f"Cannot read driven bones from {BONES_PATH}: {exc!r}") from exc


def load_clip(path: Path, bone_count: int) -> tuple[int, list[dict[str, Any]]]:
    """(fps, frames) of a Clip JSON file, checked enough that Unity will accept every frame."""
    try:
        clip = json.loads(path.read_text())
    except (OSError, ValueError) as exc:  # ValueError covers JSON and UTF-8 decode errors
        raise ClipError(f"Cannot read clip {path}: {exc}") from exc
    if not isinstance(clip, dict):
        raise ClipError(f"{path}: expected a Clip object")
    fps, frames = clip.get("fps"), clip.get("frames")
    if not isinstance(fps, int) or isinstance(fps, bool) or fps < 1:
        raise ClipError(f"{path}: 'fps' must be a positive integer, got {fps!r}")
    if not isinstance(frames, list) or not frames:
        raise ClipError(f"{path}: 'frames' must be a non-empty list")
    for index, frame in enumerate(frames):
        if not _is_frame(frame, bone_count):
            raise ClipError(
                f"{path}: frame {index} needs 't', {HIPS_FLOATS} 'h' and "
                f"{bone_count * QUATERNION_FLOATS} 'r' numbers"
            )
    return fps, frames


def _is_frame(frame: Any, bone_count: int) -> bool:
    return (
        isinstance(frame, dict)
        and isinstance(frame.get("t"), int | float)
        and isinstance(frame.get("h"), list)
        and len(frame["h"]) == HIPS_FLOATS
        and isinstance(frame.get("r"), list)
        and len(frame["r"]) == bone_count * QUATERNION_FLOATS
    )


def _dumps(message: dict[str, Any]) -> str:
    return json.dumps(message, separators=(",", ":"))


async def replay(url: str, bones: list[str], fps: int, frames: list[dict[str, Any]], loop: bool) -> int:
    """Send hello, then the frames at `fps` (forever if `loop`); return the number of frames sent."""
    async with connect(url) as websocket:
        logger.info("Connected to %s", url)
        await websocket.send(_dumps({"type": "hello", "version": PROTOCOL_VERSION, "bones": bones}))
        clock = asyncio.get_running_loop()
        start = clock.time()
        sent = 0
        for frame in itertools.cycle(frames) if loop else frames:
            # Absolute schedule: frame n goes out at start + n / fps, so timing never drifts.
            await asyncio.sleep(max(0.0, start + sent / fps - clock.time()))
            await websocket.send(_dumps({"type": "frame", **frame}))
            sent += 1
        return sent


def parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Stream a Clip JSON file to the Live Link relay.")
    parser.add_argument("clip", type=Path, help="Clip JSON file, e.g. ../contracts/fixtures/raise-right-arm.clip.json")
    parser.add_argument("--loop", action="store_true", help="repeat the clip until Ctrl+C")
    parser.add_argument("--url", default=DEFAULT_URL, help=f"relay URL including ?role=source (default {DEFAULT_URL})")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    try:
        bones = load_bones()
        fps, frames = load_clip(args.clip, len(bones))
    except ClipError as exc:
        logger.error("%s", exc)
        return 2
    mode = "looping, Ctrl+C to stop" if args.loop else "once"
    logger.info("Streaming %s: %d frames at %d fps (%s)", args.clip.name, len(frames), fps, mode)
    try:
        sent = asyncio.run(replay(args.url, bones, fps, frames, args.loop))
    except KeyboardInterrupt:
        logger.info("Stopped.")
        return 0
    except ConnectionClosed as exc:
        logger.error("Relay closed the connection: %s", exc)
        return 1
    except InvalidURI as exc:
        logger.error("Bad --url: %s", exc)
        return 2
    except (OSError, InvalidHandshake) as exc:
        logger.error("Could not connect to %s: %s (%s)", args.url, exc, SERVER_HINT)
        return 1
    logger.info("Done: sent %d frames.", sent)
    return 0


if __name__ == "__main__":
    sys.exit(main())
