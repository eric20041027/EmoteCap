"""Send a local take video through the same Gemini slicing as POST /api/takes; print the segments.

    cd server && uv run python scripts/try_gemini.py path/to/take.webm --duration 42.5 [--json]
    cd server && uv run python scripts/try_gemini.py --list-models   # is GEMINI_MODEL available?

Reads GEMINI_API_KEY (required) and GEMINI_MODEL (optional) from the repo-root .env.
Exit codes: 0 success, 1 Gemini failed (the web app would fall back), 2 bad input.
"""
import argparse
import json
import logging
import mimetypes
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # make emotecap_server importable

from google.genai import types

from emotecap_server.config import REPO_ROOT, load_settings
from emotecap_server.contract import Segment
from emotecap_server.gemini import GeminiError, make_client, slice_take, video_mime_type
from emotecap_server.takes import MAX_TAKE_SECONDS

logger = logging.getLogger("try_gemini")

EXIT_OK = 0
EXIT_GEMINI_FAILED = 1
EXIT_BAD_INPUT = 2
MODELS_PAGE_SIZE = 100


def parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Slice one continuous take into named clips with Gemini."
    )
    parser.add_argument("video", type=Path, nargs="?", help="video of the take (webm, mp4, mov)")
    parser.add_argument("--duration", type=float, help="length of the take in seconds")
    parser.add_argument("--model", help="Gemini model id (default: GEMINI_MODEL from .env)")
    parser.add_argument(
        "--json", action="store_true", help="print the segments as JSON instead of a table"
    )
    parser.add_argument(
        "--list-models", action="store_true", help="list models that support generateContent"
    )
    return parser.parse_args(argv)


def format_table(segments: list[Segment]) -> str:
    header = f"{'#':>2}  {'start':>6}  {'end':>6}  {'loop':<4}  {'name':<24}  description"
    rows = [
        f"{index:>2}  {s.start:>6.1f}  {s.end:>6.1f}  {'yes' if s.loop else 'no':<4}  "
        f"{s.name:<24}  {s.description}"
        for index, s in enumerate(segments, start=1)
    ]
    return "\n".join([header, *rows])


def list_models(api_key: str) -> int:
    try:
        with make_client(api_key) as client:
            pager = client.models.list(config=types.ListModelsConfig(page_size=MODELS_PAGE_SIZE))
            names = sorted(
                (model.name or "").removeprefix("models/")
                for model in pager
                if "generateContent" in (model.supported_actions or [])
            )
    except Exception as exc:  # noqa: BLE001 - report any SDK failure and exit non-zero
        logger.error("Could not list Gemini models: %s: %s", type(exc).__name__, exc)
        return EXIT_GEMINI_FAILED
    print("\n".join(names))
    return EXIT_OK


def slice_video(args: argparse.Namespace, api_key: str, default_model: str) -> int:
    if args.video is None or args.duration is None:
        logger.error("Give a video file and --duration (or use --list-models)")
        return EXIT_BAD_INPUT
    if not args.video.is_file():
        logger.error("No such file: %s", args.video)
        return EXIT_BAD_INPUT
    if not 0 < args.duration <= MAX_TAKE_SECONDS:
        logger.error("--duration must be in (0, %g] seconds", MAX_TAKE_SECONDS)
        return EXIT_BAD_INPUT
    mime_type = video_mime_type(mimetypes.guess_type(args.video.name)[0])
    if mime_type is None:
        logger.error("Not a video file (by extension): %s", args.video)
        return EXIT_BAD_INPUT

    model = args.model or default_model
    logger.info("Slicing %s (%s, %.1f s) with %s ...", args.video.name, mime_type, args.duration, model)
    try:
        segments = slice_take(args.video, mime_type, args.duration, api_key=api_key, model=model)
    except GeminiError as exc:
        logger.error("Gemini failed (the web app would use its motion-energy fallback): %s", exc)
        return EXIT_GEMINI_FAILED

    if args.json:
        print(json.dumps([segment.model_dump() for segment in segments], indent=2))
    else:
        print(format_table(segments))
    return EXIT_OK


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(name)s - %(message)s")
    args = parse_args(argv)
    settings = load_settings()
    if settings.gemini_api_key is None:
        logger.error("GEMINI_API_KEY is not set in %s", REPO_ROOT / ".env")
        return EXIT_BAD_INPUT
    if args.list_models:
        return list_models(settings.gemini_api_key)
    return slice_video(args, settings.gemini_api_key, settings.gemini_model)


if __name__ == "__main__":
    sys.exit(main())
