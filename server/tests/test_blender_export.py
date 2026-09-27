"""Smoke test: the real Blender exporter turns the raise-right-arm fixture into FBX + sidecar."""
import json
import shutil
import subprocess
from pathlib import Path

import pytest

from emotecap_server.config import REPO_ROOT, load_settings

FIXTURE = REPO_ROOT / "contracts" / "fixtures" / "raise-right-arm.clip.json"
MIN_FBX_BYTES = 10 * 1024
BLENDER_TIMEOUT_S = 120
STDERR_TAIL_CHARS = 2000


def run_export(clips: list[dict], tmp_path: Path) -> Path:
    settings = load_settings()
    if shutil.which(settings.blender_path) is None:
        pytest.skip(f"Blender not found at {settings.blender_path}")
    job_json = tmp_path / "job.json"
    job_json.write_text(json.dumps({"clips": clips}))
    out_dir = tmp_path / "out"
    result = subprocess.run(
        [
            settings.blender_path, "-b", "--factory-startup",
            "--python-exit-code", "1",  # a Python exception in the script must fail the run
            "-P", "server/blender/export_fbx.py", "--",
            "--in", str(job_json), "--out", str(out_dir), "--bones", "contracts/bones.json",
        ],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        timeout=BLENDER_TIMEOUT_S,
    )
    assert result.returncode == 0, result.stderr[-STDERR_TAIL_CHARS:]
    return out_dir


@pytest.mark.slow
def test_blender_exports_fixture_to_fbx_and_sidecar(tmp_path: Path) -> None:
    out_dir = run_export([json.loads(FIXTURE.read_text())], tmp_path)

    fbx = out_dir / "Raise_Right_Arm.fbx"
    assert fbx.is_file()
    assert fbx.stat().st_size > MIN_FBX_BYTES
    sidecar = json.loads((out_dir / "Raise_Right_Arm.emotecap.json").read_text())
    assert sidecar == {"name": "Raise_Right_Arm", "loop": False, "fps": 30}


@pytest.mark.slow
def test_body_skeleton_exports_without_finger_bones(tmp_path: Path) -> None:
    full = json.loads(FIXTURE.read_text())
    body = {**full, "name": "Body_Only", "skeleton": "body"}
    out_dir = run_export([full, body], tmp_path)

    assert b"LeftHandIndex1" in (out_dir / "Raise_Right_Arm.fbx").read_bytes()
    body_fbx = (out_dir / "Body_Only.fbx").read_bytes()
    assert b"LeftHandIndex1" not in body_fbx
    assert b"LeftHand" in body_fbx
