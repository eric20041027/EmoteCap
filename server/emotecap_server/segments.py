"""Post-validation of Gemini's segment list (phase 3): raw JSON in, contract Segments out.

`clean_segments` is pure. It never mutates its input and never raises on malformed data: anything
unusable is dropped. Its output is always:
- sorted by start, pairwise disjoint, inside [0, duration], each at least MIN_SEGMENT_S long;
- named per contracts/motion-v1.md (`^[A-Za-z0-9_]{1,24}$`), with duplicates suffixed `_2`, `_3`.
"""
import math
import re
import unicodedata
from dataclasses import dataclass, replace

from .contract import Segment
from .exporter import MAX_NAME_LENGTH, unique_names

MIN_SEGMENT_S = 0.3
MAX_DESCRIPTION_CHARS = 200
CUT_DECIMALS = 3  # overlap cuts are rounded to milliseconds
FALLBACK_NAME = "Clip_{:02d}"  # 1-based position in the cleaned list
_LENGTH_EPSILON_S = 1e-6  # float slack: 0.7 - 0.4 == 0.29999999999999993 still counts as 0.3 s
_INVALID_NAME_CHARS = re.compile(r"[^A-Za-z0-9_]+")
_TIMESTAMP = re.compile(r"(?:(\d+):)?(\d+):(\d+(?:\.\d+)?)")  # [H:]M:S[.f]


@dataclass(frozen=True)
class _Span:
    start: float
    end: float
    name: str  # sanitized; "" means "assign a fallback name"
    loop: bool
    description: str


def clean_segments(raw: object, duration: float) -> list[Segment]:
    """Turn Gemini's decoded JSON (ideally a list of Segment-like dicts) into valid Segments.

    Steps: clamp to [0, duration]; drop items with unusable times, end <= start, or shorter than
    MIN_SEGMENT_S; sort by start; resolve overlaps (see _resolve_overlaps); drop what a cut made
    too short; sanitize names (fallback Clip_NN) and make them unique.
    """
    if not duration > 0:  # also rejects NaN
        return []
    parsed = (_parse_item(item, duration) for item in _unwrap(raw))
    usable = [span for span in parsed if span is not None and _long_enough(span)]
    ordered = sorted(usable, key=lambda span: (span.start, -span.end))
    disjoint = [span for span in _resolve_overlaps(ordered) if _long_enough(span)]
    return _to_segments(disjoint)


def _unwrap(raw: object) -> list[object]:
    """Accept the schema's bare list, or a {"segments": [...]} wrapper some models emit."""
    items = raw.get("segments") if isinstance(raw, dict) else raw
    return list(items) if isinstance(items, list) else []


def _parse_item(item: object, duration: float) -> _Span | None:
    if not isinstance(item, dict):
        return None
    start = _parse_seconds(item.get("start"))
    end = _parse_seconds(item.get("end"))
    if start is None or end is None:
        return None
    return _Span(
        start=max(start, 0.0),
        end=min(end, duration),
        name=sanitize_name(item.get("name")),
        loop=_parse_loop(item.get("loop")),
        description=_clean_description(item.get("description")),
    )


def _parse_seconds(value: object) -> float | None:
    """12.4, "12.4", or a "1:02.5" / "0:01:02.5" timestamp -> seconds; None if unusable."""
    if isinstance(value, bool):
        return None
    try:
        if isinstance(value, int | float):
            seconds = float(value)
        elif isinstance(value, str):
            seconds = _parse_time_text(value.strip())
        else:
            return None
    except (ValueError, OverflowError):
        return None
    return seconds if math.isfinite(seconds) else None


def _parse_time_text(text: str) -> float:
    match = _TIMESTAMP.fullmatch(text)
    if match is None:
        return float(text)  # ValueError for anything that is not a number
    hours, minutes, seconds = match.groups()
    return int(hours or 0) * 3600 + int(minutes) * 60 + float(seconds)


def _parse_loop(value: object) -> bool:
    return value is True or (isinstance(value, str) and value.strip().lower() == "true")


def _clean_description(value: object) -> str:
    if not isinstance(value, str):
        return ""
    return " ".join(value.split())[:MAX_DESCRIPTION_CHARS]


def sanitize_name(value: object) -> str:
    """'sword slash!' -> 'Sword_Slash', 'Tänzchen' -> 'Tanzchen'; "" if nothing usable is left.

    Accents are folded to ASCII, every other invalid run becomes one `_`, words are capitalized
    (PascalCase_With_Underscores), and the result is cut to 24 chars without a trailing `_`.
    """
    if not isinstance(value, str):
        return ""
    decomposed = unicodedata.normalize("NFKD", value)
    folded = "".join(char for char in decomposed if not unicodedata.combining(char))
    words = [word for word in _INVALID_NAME_CHARS.sub("_", folded).split("_") if word]
    pascal = "_".join(word[:1].upper() + word[1:] for word in words)
    return pascal[:MAX_NAME_LENGTH].rstrip("_")


def _long_enough(span: _Span) -> bool:
    return span.end - span.start + _LENGTH_EPSILON_S >= MIN_SEGMENT_S


def _resolve_overlaps(ordered: list[_Span]) -> list[_Span]:
    """`ordered` is sorted by (start, -end). Returns sorted, pairwise-disjoint spans.

    - A span that ends inside the previous kept span is dropped: the container wins, which also
      removes exact duplicates (the longer span sorts first on a shared start).
    - A partial overlap is cut at its midpoint: the previous span ends and this one starts there.
    A cut can leave a span too short; the caller drops those afterwards.
    """
    kept: list[_Span] = []
    for span in ordered:
        previous = kept[-1] if kept else None
        if previous is None or span.start >= previous.end:
            kept = [*kept, span]
        elif span.end > previous.end:
            cut = round((span.start + previous.end) / 2, CUT_DECIMALS)
            kept = [*kept[:-1], replace(previous, end=cut), replace(span, start=cut)]
    return kept


def _to_segments(spans: list[_Span]) -> list[Segment]:
    wanted = [span.name or FALLBACK_NAME.format(index) for index, span in enumerate(spans, start=1)]
    return [
        Segment(name=name, start=span.start, end=span.end, loop=span.loop, description=span.description)
        for span, name in zip(spans, unique_names(wanted), strict=True)
    ]
