"""Guard the shared wire order; this does not replace Unity runtime tests."""
import json
import re
from pathlib import Path

from emotecap_server.contract import BONES

ROOT = Path(__file__).resolve().parents[2]


def test_v2_wire_order_matches_unity_and_server() -> None:
    bones = json.loads((ROOT / "contracts/bones.json").read_text(encoding="utf-8"))
    source = (ROOT / "unity/com.emotecap.mocap/Runtime/EmoteCapContract.cs").read_text(
        encoding="utf-8"
    )
    version = re.search(r"public const int Version\s*=\s*(\d+)", source)
    assert version is not None
    assert int(version.group(1)) == bones["version"] == 2
    assert re.findall(r"HumanBodyBones\.(\w+)", source) == bones["driven"] == BONES
    assert len(bones["driven"]) == 48
    assert len(bones["skeleton"]) == 52
    assert bones["hipsRestHeight"] == 0.95
