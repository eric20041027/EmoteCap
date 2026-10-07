import copy
import json
from pathlib import Path

import pytest
from pydantic import ValidationError
from emotecap_server.contract import Clip

FIXTURE = Path(__file__).resolve().parents[2] / "contracts/fixtures/tpose.clip.json"


def valid_clip() -> dict:
    clip = json.loads(FIXTURE.read_text(encoding="utf-8"))
    frame = clip["frames"][0]
    clip["fps"] = 30
    clip["frames"] = [dict(copy.deepcopy(frame), t=t) for t in [0, 1 / 30]]
    return clip


@pytest.mark.parametrize("field", ["t", "h", "r"])
@pytest.mark.parametrize("value", [float("nan"), float("inf"), -float("inf")])
def test_rejects_non_finite_motion(field, value):
    clip = valid_clip()
    if field == "t":
        clip["frames"][0][field] = value
    else:
        clip["frames"][0][field][0] = value
    with pytest.raises(ValidationError):
        Clip.model_validate(clip)


@pytest.mark.parametrize("times", [[0, 0], [0, 2, 1], [1, 2], [0, 180.001]])
def test_rejects_invalid_clip_times(times):
    clip = valid_clip()
    frame = clip["frames"][0]
    clip["frames"] = [dict(copy.deepcopy(frame), t=t) for t in times]
    with pytest.raises(ValidationError):
        Clip.model_validate(clip)


@pytest.mark.parametrize("rotation", [[0, 0, 0, 0], [0, 0, 0, 1.03], [0, 0, 0, 0.979999]])
def test_rejects_invalid_quaternion_norm(rotation):
    clip = valid_clip()
    clip["frames"][0]["r"][:4] = rotation
    with pytest.raises(ValidationError):
        Clip.model_validate(clip)


@pytest.mark.parametrize("axis", [0, 2])
def test_rejects_horizontal_root_translation(axis):
    clip = valid_clip()
    clip["frames"][0]["h"][axis] = 0.1
    with pytest.raises(ValidationError):
        Clip.model_validate(clip)


@pytest.mark.parametrize("w", [0.98, 1.01, 1.02, -1.02])
def test_accepts_rounding_and_body_export_with_full_wire_frame(w):
    clip = valid_clip()
    clip["skeleton"] = "body"
    clip["frames"][0]["r"][:4] = [0, 0, 0, w]
    assert Clip.model_validate(clip).skeleton == "body"


def test_accepts_inclusive_180_second_120_fps_boundary():
    clip = valid_clip()
    frame = clip["frames"][0]
    clip["fps"] = 120
    clip["frames"] = [dict(frame, t=i / 120) for i in range(21601)]
    result = Clip.model_validate(clip)
    assert len(result.frames) == 21601
    assert result.frames[-1].t == 180
