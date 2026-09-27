import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from emotecap_server.contract import BONES, Clip

FIXTURES = Path(__file__).resolve().parents[2] / "contracts" / "fixtures"


def test_bones_lists_48_driven_bones_starting_at_hips():
    assert len(BONES) == 48
    assert BONES[0] == "Hips"


@pytest.mark.parametrize("filename", ["tpose.clip.json", "raise-right-arm.clip.json"])
def test_fixture_clips_validate(filename):
    Clip.model_validate(json.loads((FIXTURES / filename).read_text()))


def test_clip_rejects_bad_name():
    clip = json.loads((FIXTURES / "tpose.clip.json").read_text())
    clip["name"] = "bad name!"
    with pytest.raises(ValidationError):
        Clip.model_validate(clip)
