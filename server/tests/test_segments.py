"""clean_segments: post-validation of Gemini's raw segment list (pure function, no Gemini)."""
import copy
import itertools
import random
import re
from typing import Any

import pytest

from emotecap_server.contract import CLIP_NAME_PATTERN, Segment
from emotecap_server.segments import MIN_SEGMENT_S, clean_segments

DURATION = 30.0


def seg(name: Any = "Wave_Right", start: Any = 1.0, end: Any = 3.0, **extra: Any) -> dict[str, Any]:
    return {"name": name, "start": start, "end": end, "loop": False, "description": "", **extra}


def spans(segments: list[Segment]) -> list[tuple[float, float]]:
    return [(s.start, s.end) for s in segments]


def names(segments: list[Segment]) -> list[str]:
    return [s.name for s in segments]


# --- pass-through ------------------------------------------------------------


def test_valid_segments_pass_through_unchanged() -> None:
    raw = [
        {"name": "Idle_Breathing", "start": 2.0, "end": 6.5, "loop": True, "description": "Breathes."},
        {"name": "Sword_Slash", "start": 7.1, "end": 8.4, "loop": False, "description": "Slashes."},
    ]

    assert clean_segments(raw, DURATION) == [
        Segment(name="Idle_Breathing", start=2.0, end=6.5, loop=True, description="Breathes."),
        Segment(name="Sword_Slash", start=7.1, end=8.4, loop=False, description="Slashes."),
    ]


def test_does_not_mutate_input() -> None:
    raw = [seg("b b", 5.0, 9.0), seg("A", -1.0, 6.0), "junk"]
    snapshot = copy.deepcopy(raw)

    clean_segments(raw, DURATION)

    assert raw == snapshot


# --- times -------------------------------------------------------------------


def test_clamps_times_to_take() -> None:
    result = clean_segments([seg(start=-2.0, end=4.0), seg("Jump", 25.0, 99.0)], DURATION)

    assert spans(result) == [(0.0, 4.0), (25.0, DURATION)]


def test_drops_segments_outside_take() -> None:
    assert clean_segments([seg(start=31.0, end=35.0), seg(start=-5.0, end=-1.0)], DURATION) == []


@pytest.mark.parametrize(("start", "end"), [(5.0, 5.0), (6.0, 5.0), (5.0, 5.29)])
def test_drops_empty_inverted_and_too_short_segments(start: float, end: float) -> None:
    assert clean_segments([seg(start=start, end=end)], DURATION) == []


def test_keeps_segment_of_exactly_min_length_despite_float_error() -> None:
    # 0.7 - 0.4 == 0.29999999999999993 in binary floating point.
    assert spans(clean_segments([seg(start=0.4, end=0.7)], DURATION)) == [(0.4, 0.7)]
    assert MIN_SEGMENT_S == pytest.approx(0.3)


def test_sorts_by_start() -> None:
    raw = [seg("C", 20.0, 22.0), seg("A", 1.0, 2.0), seg("B", 10.0, 12.0)]

    assert names(clean_segments(raw, DURATION)) == ["A", "B", "C"]


@pytest.mark.parametrize(
    ("value", "expected"),
    [(3, 3.0), ("3.5", 3.5), (" 4 ", 4.0), ("0:04.5", 4.5), ("1:02.5", 62.5), ("0:01:03", 63.0)],
)
def test_accepts_numeric_strings_and_timestamps(value: Any, expected: float) -> None:
    [result] = clean_segments([seg(start=0.0, end=value)], 100.0)

    assert result.end == expected


@pytest.mark.parametrize("bad", [None, True, "soon", "1:xx", float("nan"), float("inf"), [1.0], {}])
def test_drops_segments_with_unusable_times(bad: Any) -> None:
    assert clean_segments([seg(start=bad), seg(end=bad)], DURATION) == []


# --- overlaps ----------------------------------------------------------------


def test_overlap_is_cut_at_its_midpoint() -> None:
    raw = [seg("Wave", 0.0, 5.2), seg("Jump", 5.0, 8.0)]

    assert spans(clean_segments(raw, DURATION)) == [(0.0, 5.1), (5.1, 8.0)]


def test_midpoint_has_no_float_noise() -> None:
    raw = [seg("A", 0.0, 0.2 + 0.4), seg("B", 0.1 + 0.2, 5.0)]  # 0.6000000000000001, 0.30000000000000004

    [first, second] = clean_segments(raw, DURATION)

    assert first.end == second.start == 0.45


def test_chain_of_overlaps_stays_ordered_and_disjoint() -> None:
    raw = [seg("A", 0.0, 10.0), seg("B", 5.0, 12.0), seg("C", 6.0, 13.0)]

    # A|B cut at 7.5; C starts before B's new start, but its cut (9.0) still lands inside B.
    assert spans(clean_segments(raw, DURATION)) == [(0.0, 7.5), (7.5, 9.0), (9.0, 13.0)]


def test_segment_inside_another_is_dropped() -> None:
    raw = [seg("Idle", 0.0, 10.0), seg("Blink", 2.0, 4.0)]

    assert names(clean_segments(raw, DURATION)) == ["Idle"]


def test_duplicate_range_keeps_the_first_and_the_longer_one_wins_on_shared_start() -> None:
    raw = [seg("Short", 1.0, 3.0), seg("Long", 1.0, 6.0), seg("Copy", 1.0, 6.0)]

    assert [(s.name, s.start, s.end) for s in clean_segments(raw, DURATION)] == [("Long", 1.0, 6.0)]


def test_segment_made_too_short_by_a_cut_is_dropped() -> None:
    raw = [seg("Tiny", 0.0, 0.4), seg("Walk", 0.1, 5.0)]

    # Cut at 0.25 leaves Tiny with 0.25 s < 0.3 s; Walk keeps its trimmed range.
    assert [(s.name, s.start, s.end) for s in clean_segments(raw, DURATION)] == [("Walk", 0.25, 5.0)]


def test_short_segments_are_dropped_before_they_can_cut_others() -> None:
    raw = [seg("Walk", 0.0, 5.0), seg("Glitch", 4.9, 5.1)]

    assert spans(clean_segments(raw, DURATION)) == [(0.0, 5.0)]


# --- names -------------------------------------------------------------------


@pytest.mark.parametrize(
    ("raw_name", "expected"),
    [
        ("Wave Right!", "Wave_Right"),
        ("sword slash", "Sword_Slash"),
        ("jump_inPlace", "Jump_InPlace"),
        ("  Kick -- Front  ", "Kick_Front"),
        ("Crouch__Down", "Crouch_Down"),
        ("Tänzchen", "Tanzchen"),
        ("Wave→Right", "Wave_Right"),
        ("日本", "Clip_01"),
        ("A_Very_Long_Animation_Clip_Name", "A_Very_Long_Animation_Cl"),
        ("Twenty_Three_Characters_", "Twenty_Three_Characters"),
    ],
)
def test_sanitizes_names(raw_name: str, expected: str) -> None:
    [result] = clean_segments([seg(raw_name)], DURATION)

    assert result.name == expected
    assert re.fullmatch(CLIP_NAME_PATTERN, result.name)


def test_trimming_never_leaves_a_trailing_underscore() -> None:
    [result] = clean_segments([seg("Abcdefghijklmnopqrstuvw_xyz")], DURATION)  # cut lands on "_"

    assert result.name == "Abcdefghijklmnopqrstuvw"


@pytest.mark.parametrize("bad", [None, "", "!!!", "   ", 42, ["Wave"]])
def test_unusable_names_fall_back_to_clip_number(bad: Any) -> None:
    raw = [seg("Idle", 0.0, 2.0), seg(bad, 3.0, 5.0)]

    assert names(clean_segments(raw, DURATION)) == ["Idle", "Clip_02"]


def test_duplicate_names_get_numbered_suffixes() -> None:
    raw = [seg("Punch", 0.0, 1.0), seg("Punch", 2.0, 3.0), seg("Kick", 4.0, 5.0), seg("punch", 6.0, 7.0)]

    assert names(clean_segments(raw, DURATION)) == ["Punch", "Punch_2", "Kick", "Punch_3"]


def test_suffix_keeps_duplicate_long_names_within_24_chars() -> None:
    raw = [seg("Victory_Dance_Spin_Around", 0.0, 1.0), seg("Victory_Dance_Spin_Around", 2.0, 3.0)]

    assert names(clean_segments(raw, DURATION)) == ["Victory_Dance_Spin_Aroun", "Victory_Dance_Spin_Aro_2"]


# --- loop and description ------------------------------------------------------


@pytest.mark.parametrize(("value", "expected"), [(True, True), (False, False), ("true", True),
                                                  ("False", False), (1, False), (None, False)])
def test_loop_is_true_only_for_true_or_the_string_true(value: Any, expected: bool) -> None:
    [result] = clean_segments([seg(loop=value)], DURATION)

    assert result.loop is expected


def test_description_is_trimmed_collapsed_and_capped() -> None:
    raw = [seg("A", 0.0, 1.0, description="  Waves\n  the   right hand. "),
           seg("B", 2.0, 3.0, description=None),
           seg("C", 4.0, 5.0, description="x" * 500)]

    [a, b, c] = clean_segments(raw, DURATION)

    assert a.description == "Waves the right hand."
    assert b.description == ""
    assert len(c.description) <= 200


def test_missing_loop_and_description_get_defaults() -> None:
    [result] = clean_segments([{"name": "Bow", "start": 1.0, "end": 2.5}], DURATION)

    assert result == Segment(name="Bow", start=1.0, end=2.5, loop=False, description="")


# --- malformed containers ------------------------------------------------------


@pytest.mark.parametrize("raw", [None, "segments", 42, {"clips": []}, {"segments": "nope"}])
def test_non_list_input_gives_no_segments(raw: Any) -> None:
    assert clean_segments(raw, DURATION) == []


def test_unwraps_segments_object() -> None:
    assert names(clean_segments({"segments": [seg("Jump")]}, DURATION)) == ["Jump"]


def test_skips_items_that_are_not_objects() -> None:
    raw = ["Wave", 3, None, [1, 2], seg("Jump", 4.0, 5.0)]

    assert names(clean_segments(raw, DURATION)) == ["Jump"]


@pytest.mark.parametrize("duration", [0.0, -1.0, float("nan")])
def test_non_positive_duration_gives_no_segments(duration: float) -> None:
    assert clean_segments([seg()], duration) == []


# --- invariants on random garbage ---------------------------------------------


def random_item(rng: random.Random, duration: float) -> Any:
    def time() -> Any:
        options = [rng.uniform(-5, duration + 5), rng.uniform(0, duration), None, "x",
                   str(rng.uniform(0, duration))]
        return rng.choice(options)

    long_name = f"Very_Long_Clip_Name_Number_{rng.randint(0, 9)}"
    name = rng.choice(["Wave", "Wave", "jump in place", "", None, "Ä" * 30, long_name])
    return rng.choice([
        {"name": name, "start": time(), "end": time(), "loop": rng.choice([True, False, "true"])},
        {"name": name, "start": (s := rng.uniform(0, duration)), "end": s + rng.uniform(0, 8)},
        "garbage",
    ])


@pytest.mark.parametrize("seed", range(200))
def test_output_invariants_hold_for_random_input(seed: int) -> None:
    rng = random.Random(seed)
    duration = rng.uniform(1, 60)
    raw = [random_item(rng, duration) for _ in range(rng.randint(0, 12))]

    result = clean_segments(raw, duration)

    for current in result:
        assert 0.0 <= current.start < current.end <= duration
        assert current.end - current.start >= MIN_SEGMENT_S - 1e-6
        assert re.fullmatch(CLIP_NAME_PATTERN, current.name)
    for previous, current in itertools.pairwise(result):
        assert previous.end <= current.start
    assert len(set(names(result))) == len(result)
