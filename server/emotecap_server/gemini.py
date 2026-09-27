"""Gemini auto-slicing (phase 3): one continuous webcam take in, named animation segments out.

    slice_take(video) -> request_segments (Gemini, JSON schema) -> segments.clean_segments

Every failure (SDK error, timeout, unusable answer) raises GeminiError, whose message is safe to
show in the UI; the web app then falls back to its local motion-energy slicer.
"""
import json
import logging
import re
import time
from dataclasses import dataclass
from pathlib import Path

import httpx
from google import genai
from google.genai import errors as genai_errors
from google.genai import types
from pydantic import BaseModel, Field

from .contract import Segment
from .segments import clean_segments

logger = logging.getLogger(__name__)

GEMINI_TIMEOUT_S = 30.0  # total budget per take: upload + processing + answer
# Tried in order when the configured model is overloaded (503 UNAVAILABLE), within the same budget.
FALLBACK_MODELS = ("gemini-3.6-flash", "gemini-3.5-flash")
VIDEO_FPS = 5  # frames Gemini samples per second of video (its default is 1)
# Inline requests are capped at 20 MB, and the video travels base64-encoded (+33 %) with the prompt,
# so only videos up to 15 MB go inline; bigger ones go through the Files API.
INLINE_MAX_BYTES = 15 * 1024 * 1024
FILE_POLL_INTERVAL_S = 1.0
FILE_DELETE_TIMEOUT_MS = 5_000
MAX_ERROR_CHARS = 300
REDACTED = "***"
GEMINI_VIDEO_TYPES = frozenset(
    {"video/mp4", "video/mpeg", "video/mov", "video/avi", "video/x-flv", "video/mpg", "video/webm",
     "video/wmv", "video/3gpp"}
)
DEFAULT_VIDEO_TYPE = "video/webm"  # MediaRecorder output; Chrome may label it video/x-matroska
_VIDEO_TYPE_ALIASES = {"video/quicktime": "video/mov"}
_TIMEOUT_STATUSES = frozenset({"DEADLINE_EXCEEDED"})
_TIMEOUT_CODES = frozenset({408, 504})
_CODE_FENCE = re.compile(r"```(?:json)?\s*(.*?)\s*```", re.DOTALL)

SYSTEM_PROMPT = """\
You are a motion-capture editor for video games. You turn raw webcam takes into named animation \
clips that a game developer drops straight onto a character.

The video is ONE continuous webcam take of a single actor performing several distinct moves, one \
after another, for game-animation motion capture. It is a raw, un-mirrored camera feed.

Return one segment per distinct action the actor performs on purpose.

Skip everything that is not a performance:
- The setup at the start: walking into frame, adjusting the camera, stepping back, getting into position.
- The end: walking back to the computer, reaching toward the camera or keyboard to stop recording.
- Pauses, fidgeting, and transitions between moves.
- Standing still only counts as an action when the actor deliberately holds an idle pose as a \
performance, such as a relaxed breathing idle for several seconds.

How to cut:
- One segment per distinct action. Never return the same action twice: if the actor repeats a move \
several times, back to back or with rests in between, return ONE segment. For a one-shot action \
(wave, peace sign, punch, jump) choose the single clearest, most complete repetition; for a looping \
action (idle, dance, walking in place) cover all repetitions together. Only a clearly different \
variation gets its own segment, with a name that says how it differs (Wave_Right_Big).
- Use the granularity a game animator wants: a whole dance routine is one clip, not one clip per \
step; a flowing punch-punch-kick combo is one clip (Combo_Punch_Kick).
- Segments are in chronological order and do not overlap. If a short action happens in the middle \
of a longer one, end the longer segment before it and start a new segment after it.
- Cut tight: start when the body leaves the rest pose, end when it is back at rest. For a looping \
action, cover whole cycles. Every segment lasts at least half a second.
- Times are seconds from the start of the video, as numbers with one decimal: write 1:12.4 as 72.4.

Fields:
- name: a short game-animation clip name in PascalCase_With_Underscores, such as Idle_Breathing, \
Wave_Right, Sword_Slash, Jump_InPlace, Victory_Dance, Punch_Left, Kick_Front. At most 24 \
characters, only letters, digits, and underscores. Left and Right always mean the actor's own \
left and right: the actor faces the camera, so their right hand is on the left side of the image.
- loop: true for actions that naturally repeat and play as a seamless loop in a game: idle or \
breathing, walking or running in place, dance loops, cheering. false for one-shot actions: waves, \
jumps, attacks, punches, kicks, bows, falls.
- description: one short sentence about what the body does, for example "Raises the right arm \
overhead and waves side to side three times."

If the actor performs no deliberate action, return an empty list.
"""

USER_PROMPT = "This take is {duration:.1f} seconds long. List every distinct action as a segment."


class GeminiSegment(BaseModel):
    """What Gemini fills in, in this order: describing the action first helps name and time it."""

    description: str = Field(description="One short sentence about what the body does.")
    start: float = Field(description="Start time in seconds from the start of the video, one decimal.")
    end: float = Field(description="End time in seconds from the start of the video, one decimal.")
    name: str = Field(
        description="PascalCase_With_Underscores game clip name, max 24 chars, e.g. Wave_Right."
    )
    loop: bool = Field(description="True if the action naturally repeats as a seamless loop.")


RESPONSE_SCHEMA = list[GeminiSegment]


class GeminiError(Exception):
    """Gemini failed or answered with nothing usable. The message never contains the API key."""


class GeminiTimeoutError(GeminiError):
    """Gemini did not answer within the time budget."""


@dataclass(frozen=True)
class _Deadline:
    budget_s: float
    expires_at: float  # time.monotonic()

    @classmethod
    def start(cls, budget_s: float) -> "_Deadline":
        return cls(budget_s=budget_s, expires_at=time.monotonic() + budget_s)

    def remaining_s(self) -> float:
        return self.expires_at - time.monotonic()

    def http_options(self) -> types.HttpOptions:
        """Per-request options: the request may use whatever is left of the budget."""
        remaining_ms = int(self.remaining_s() * 1000)
        if remaining_ms <= 0:
            raise self.expired()
        return types.HttpOptions(timeout=remaining_ms)

    def expired(self) -> GeminiTimeoutError:
        return GeminiTimeoutError(f"Gemini did not answer within {self.budget_s:g} s")


def video_mime_type(content_type: str | None) -> str | None:
    """MIME type to send Gemini for an upload's Content-Type; None if it is not a video."""
    base = (content_type or "").split(";", 1)[0].strip().lower()
    kind, _, subtype = base.partition("/")
    if kind != "video" or not subtype:
        return None
    base = _VIDEO_TYPE_ALIASES.get(base, base)
    return base if base in GEMINI_VIDEO_TYPES else DEFAULT_VIDEO_TYPE


def make_client(api_key: str) -> genai.Client:
    """The one place a real Gemini client is built (tests replace it). One attempt, no retries:
    the SDK only retries when HttpOptions.retry_options is set."""
    return genai.Client(
        api_key=api_key, http_options=types.HttpOptions(timeout=int(GEMINI_TIMEOUT_S * 1000))
    )


def slice_take(
    video: Path, mime_type: str, duration: float, *, api_key: str, model: str
) -> list[Segment]:
    """Ask Gemini to split the take into named clips and return the validated segments."""
    raw = request_segments(video, mime_type, duration, api_key=api_key, model=model)
    segments = clean_segments(raw, duration)
    if not segments:
        raise GeminiError("Gemini found no usable segments in this take")
    logger.info(
        "Gemini sliced %s into %d segments: %s",
        video.name, len(segments), ", ".join(segment.name for segment in segments),
    )
    return segments


def request_segments(
    video: Path,
    mime_type: str,
    duration: float,
    *,
    api_key: str,
    model: str,
    timeout_s: float = GEMINI_TIMEOUT_S,
) -> object:
    """Send the video to Gemini and return its decoded JSON answer, not yet validated.

    Videos up to INLINE_MAX_BYTES go inline; bigger ones are uploaded with the Files API, polled
    until ACTIVE, and deleted afterwards. The whole exchange shares one `timeout_s` budget.
    """
    deadline = _Deadline.start(timeout_s)
    inline_bytes = video.read_bytes() if video.stat().st_size <= INLINE_MAX_BYTES else None
    started = time.monotonic()
    try:
        with make_client(api_key) as client:
            if inline_bytes is not None:
                blob = types.Blob(data=inline_bytes, mime_type=mime_type)
                response, model = _ask_first_available(
                    client, _video_part(inline_data=blob), duration, model, deadline
                )
            else:
                response, model = _ask_with_upload(client, video, mime_type, duration, model, deadline)
        raw = _decode(response)
    except GeminiError:
        raise
    except Exception as exc:  # every SDK or transport failure becomes a GeminiError
        logger.debug("Gemini request for %s failed", video.name, exc_info=True)
        raise _as_gemini_error(exc, api_key, deadline) from exc
    logger.info("Gemini (%s) answered for %s in %.1f s", model, video.name, time.monotonic() - started)
    return raw


def _video_part(
    *, inline_data: types.Blob | None = None, file_data: types.FileData | None = None
) -> types.Part:
    return types.Part(
        inline_data=inline_data, file_data=file_data, video_metadata=types.VideoMetadata(fps=VIDEO_FPS)
    )


def _ask(
    client: genai.Client, video_part: types.Part, duration: float, model: str, deadline: _Deadline
) -> types.GenerateContentResponse:
    prompt = types.Part(text=USER_PROMPT.format(duration=duration))
    return client.models.generate_content(
        model=model,
        contents=[types.Content(role="user", parts=[video_part, prompt])],
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            response_mime_type="application/json",
            response_schema=RESPONSE_SCHEMA,
            # No tools: skip the SDK's function-calling loop and its per-call log noise.
            automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
            http_options=deadline.http_options(),
        ),
    )


def _is_overloaded(exc: Exception) -> bool:
    return isinstance(exc, genai_errors.APIError) and (exc.code == 503 or exc.status == "UNAVAILABLE")


def _ask_first_available(
    client: genai.Client, video_part: types.Part, duration: float, model: str, deadline: _Deadline
) -> tuple[types.GenerateContentResponse, str]:
    """Ask `model`, then each fallback in turn while the models answer "overloaded"; returns the
    answer and the model that gave it. Any other error is raised at once."""
    candidates = [model, *(fallback for fallback in FALLBACK_MODELS if fallback != model)]
    for index, candidate in enumerate(candidates):
        try:
            return _ask(client, video_part, duration, candidate, deadline), candidate
        except genai_errors.APIError as exc:
            if not _is_overloaded(exc) or index == len(candidates) - 1:
                raise
            logger.warning("Gemini %s is overloaded; trying %s", candidate, candidates[index + 1])
    raise AssertionError("unreachable: the loop returns or raises")


def _ask_with_upload(
    client: genai.Client, video: Path, mime_type: str, duration: float, model: str, deadline: _Deadline
) -> tuple[types.GenerateContentResponse, str]:
    uploaded = client.files.upload(
        file=video,
        config=types.UploadFileConfig(
            mime_type=mime_type, display_name=video.name, http_options=deadline.http_options()
        ),
    )
    try:
        active = _wait_until_active(client, uploaded, deadline)
        file_data = types.FileData(file_uri=active.uri, mime_type=mime_type)
        return _ask_first_available(client, _video_part(file_data=file_data), duration, model, deadline)
    finally:
        _delete_quietly(client, uploaded)


def _wait_until_active(client: genai.Client, file: types.File, deadline: _Deadline) -> types.File:
    current = file
    while current.state != types.FileState.ACTIVE:
        if current.state == types.FileState.FAILED:
            reason = current.error.message if current.error and current.error.message else "unknown"
            raise GeminiError(f"Gemini could not process the video: {reason}")
        if deadline.remaining_s() <= FILE_POLL_INTERVAL_S:
            raise deadline.expired()
        time.sleep(FILE_POLL_INTERVAL_S)
        current = client.files.get(
            name=file.name, config=types.GetFileConfig(http_options=deadline.http_options())
        )
    return current


def _delete_quietly(client: genai.Client, file: types.File) -> None:
    """Best effort: an upload that is not deleted expires on its own after 48 h."""
    if not file.name:
        return
    delete_options = types.HttpOptions(timeout=FILE_DELETE_TIMEOUT_MS)
    try:
        client.files.delete(
            name=file.name, config=types.DeleteFileConfig(http_options=delete_options)
        )
    except Exception as exc:  # noqa: BLE001 - cleanup must never hide the real result
        logger.warning("Could not delete Gemini upload %s (%s)", file.name, type(exc).__name__)


def _decode(response: types.GenerateContentResponse) -> object:
    text = response.text
    if not text or not text.strip():
        raise GeminiError(f"Gemini gave no answer (finish reason: {_finish_reason(response)})")
    stripped = text.strip()
    fenced = _CODE_FENCE.fullmatch(stripped)
    try:
        return json.loads(fenced.group(1) if fenced else stripped)
    except json.JSONDecodeError as exc:
        raise GeminiError(f"Gemini's answer is not valid JSON ({exc.msg} at char {exc.pos})") from exc


def _finish_reason(response: types.GenerateContentResponse) -> str:
    feedback = response.prompt_feedback
    if feedback is not None and feedback.block_reason is not None:
        return f"prompt blocked, {getattr(feedback.block_reason, 'name', feedback.block_reason)}"
    if response.candidates and response.candidates[0].finish_reason is not None:
        reason = response.candidates[0].finish_reason
        return str(getattr(reason, "name", reason))
    return "unknown"


def _as_gemini_error(exc: Exception, api_key: str, deadline: _Deadline) -> GeminiError:
    if _is_timeout(exc):
        return deadline.expired()
    if isinstance(exc, genai_errors.APIError):
        detail = f"{exc.code} {exc.status}: {exc.message or 'no message'}"
    else:
        detail = f"{type(exc).__name__}: {exc}"
    message = f"Gemini request failed: {detail}"
    if api_key:
        message = message.replace(api_key, REDACTED)  # redact before truncating
    return GeminiError(message[:MAX_ERROR_CHARS])


def _is_timeout(exc: Exception) -> bool:
    if isinstance(exc, httpx.TimeoutException | TimeoutError):
        return True
    return isinstance(exc, genai_errors.APIError) and (
        exc.code in _TIMEOUT_CODES or exc.status in _TIMEOUT_STATUSES
    )
