"""Export service tests. Blender is faked except in the run_blender error-path tests."""
import dataclasses
import json
import os
from pathlib import Path

import pytest

from emotecap_server import exporter
from emotecap_server.config import REPO_ROOT, Settings, load_settings
from emotecap_server.contract import Clip, ExportedFile
from emotecap_server.exporter import ExportError, export_clips, run_blender, unique_names

FIXTURE = REPO_ROOT / "contracts" / "fixtures" / "raise-right-arm.clip.json"
FIXTURE_SIDECAR = {"name": "Raise_Right_Arm", "loop": False, "fps": 30}


def fixture_clip(name: str | None = None) -> Clip:
    clip = Clip.model_validate(json.loads(FIXTURE.read_text()))
    return clip if name is None else clip.model_copy(update={"name": name})


def make_settings(tmp_path: Path, **overrides: object) -> Settings:
    """Settings isolated in tmp_path; never copies into a real Unity project from .env."""
    changes = {"data_dir": tmp_path / "data", "unity_export_dir": None, **overrides}
    return dataclasses.replace(load_settings(), **changes)


def fake_run_blender(settings: Settings, job_json: Path, out_dir: Path) -> None:
    """Stand-in for Blender: writes a dummy FBX + sidecar for every clip in the job file."""
    out_dir.mkdir(parents=True, exist_ok=True)
    for clip in json.loads(job_json.read_text())["clips"]:
        name = clip["name"]
        (out_dir / f"{name}.fbx").write_bytes(f"FBX {name}".encode())
        sidecar = {"name": name, "loop": clip["loop"], "fps": clip["fps"]}
        (out_dir / f"{name}.emotecap.json").write_text(json.dumps(sidecar))


def write_fake_blender(tmp_path: Path, shell_body: str) -> str:
    script = tmp_path / "fake-blender"
    script.write_text(f"#!/bin/sh\n{shell_body}\n")
    script.chmod(0o755)
    return str(script)


@pytest.fixture
def fake_blender(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(exporter, "run_blender", fake_run_blender)


# --- unique_names -----------------------------------------------------------


def test_unique_names_suffixes_duplicates_in_order() -> None:
    assert unique_names(["A", "A", "B", "A"]) == ["A", "A_2", "B", "A_3"]
    assert unique_names(["Idle", "Walk"]) == ["Idle", "Walk"]
    assert unique_names([]) == []


def test_unique_names_truncates_base_to_stay_within_24_chars() -> None:
    long = "X" * 24

    names = unique_names([long] * 10)

    assert names[:3] == [long, "X" * 22 + "_2", "X" * 22 + "_3"]
    assert names[9] == "X" * 21 + "_10"
    assert all(len(name) <= 24 for name in names)


def test_unique_names_never_collides_with_explicit_or_truncated_names() -> None:
    assert unique_names(["A", "A", "A_2"]) == ["A", "A_3", "A_2"]
    base_b, base_c = "Y" * 23 + "B", "Y" * 23 + "C"  # truncate to the same 22-char base

    names = unique_names([base_b, base_b, base_c, base_c])

    assert names == [base_b, "Y" * 22 + "_2", base_c, "Y" * 22 + "_3"]


# --- export_clips -----------------------------------------------------------


def test_export_clips_moves_files_to_exports_and_returns_urls(
    tmp_path: Path, fake_blender: None
) -> None:
    settings = make_settings(tmp_path)

    files = export_clips([fixture_clip()], settings)

    assert files == [ExportedFile(name="Raise_Right_Arm", url="/files/Raise_Right_Arm.fbx")]
    exports = settings.data_dir / "exports"
    assert (exports / "Raise_Right_Arm.fbx").read_bytes() == b"FBX Raise_Right_Arm"
    assert json.loads((exports / "Raise_Right_Arm.emotecap.json").read_text()) == FIXTURE_SIDECAR
    assert list((settings.data_dir / "jobs").glob("*/out/*")) == []  # moved, not copied


def test_export_clips_renames_duplicates_on_copies_not_inputs(
    tmp_path: Path, fake_blender: None
) -> None:
    settings = make_settings(tmp_path)
    clips = [fixture_clip("Wave"), fixture_clip("Wave")]

    files = export_clips(clips, settings)

    assert [file.url for file in files] == ["/files/Wave.fbx", "/files/Wave_2.fbx"]
    assert [clip.name for clip in clips] == ["Wave", "Wave"]
    sidecar = json.loads((settings.data_dir / "exports" / "Wave_2.emotecap.json").read_text())
    assert sidecar["name"] == "Wave_2"


def test_export_clips_overwrites_an_existing_export(tmp_path: Path, fake_blender: None) -> None:
    settings = make_settings(tmp_path)
    exports = settings.data_dir / "exports"
    exports.mkdir(parents=True)
    (exports / "Raise_Right_Arm.fbx").write_bytes(b"old")

    export_clips([fixture_clip()], settings)

    assert (exports / "Raise_Right_Arm.fbx").read_bytes() == b"FBX Raise_Right_Arm"


def test_export_clips_copies_sidecar_then_fbx_to_unity_dir(
    tmp_path: Path, fake_blender: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    unity_dir = tmp_path / "UnityProject" / "Assets" / "EmoteCap"  # does not exist yet
    settings = make_settings(tmp_path, unity_export_dir=unity_dir)
    real_replace = os.replace
    landed: list[str] = []

    def spy_replace(src: str | os.PathLike[str], dst: str | os.PathLike[str]) -> None:
        real_replace(src, dst)
        if Path(dst).parent == unity_dir:
            landed.append(Path(dst).name)

    monkeypatch.setattr(os, "replace", spy_replace)

    export_clips([fixture_clip()], settings)

    assert landed == ["Raise_Right_Arm.emotecap.json", "Raise_Right_Arm.fbx"]
    assert sorted(path.name for path in unity_dir.iterdir()) == sorted(landed)  # no temp files
    assert (unity_dir / "Raise_Right_Arm.fbx").read_bytes() == b"FBX Raise_Right_Arm"
    assert json.loads((unity_dir / "Raise_Right_Arm.emotecap.json").read_text()) == FIXTURE_SIDECAR
    assert (settings.data_dir / "exports" / "Raise_Right_Arm.fbx").is_file()


def test_export_clips_propagates_export_error_unchanged(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    settings = make_settings(tmp_path)
    error = ExportError("Blender exited with code 1", "Traceback (most recent call last):")

    def failing_run_blender(settings: Settings, job_json: Path, out_dir: Path) -> None:
        raise error

    monkeypatch.setattr(exporter, "run_blender", failing_run_blender)

    with pytest.raises(ExportError) as excinfo:
        export_clips([fixture_clip()], settings)

    assert excinfo.value is error
    assert not (settings.data_dir / "exports" / "Raise_Right_Arm.fbx").exists()


def test_export_clips_raises_when_blender_produced_no_fbx(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(exporter, "run_blender", lambda settings, job_json, out_dir: None)

    with pytest.raises(ExportError, match="Raise_Right_Arm.fbx"):
        export_clips([fixture_clip()], make_settings(tmp_path))


def test_export_clips_raises_when_unity_dir_cannot_be_created(
    tmp_path: Path, fake_blender: None
) -> None:
    blocker = tmp_path / "not-a-dir"
    blocker.write_text("file in the way")
    settings = make_settings(tmp_path, unity_export_dir=blocker / "EmoteCap")

    with pytest.raises(ExportError, match="UNITY_EXPORT_DIR"):
        export_clips([fixture_clip()], settings)


# --- run_blender error paths --------------------------------------------------


def test_run_blender_raises_export_error_when_blender_is_missing(tmp_path: Path) -> None:
    settings = make_settings(tmp_path, blender_path="/nonexistent")

    with pytest.raises(ExportError, match="/nonexistent"):
        run_blender(settings, tmp_path / "clips.json", tmp_path / "out")


def test_run_blender_raises_with_last_20_output_lines_on_nonzero_exit(tmp_path: Path) -> None:
    blender = write_fake_blender(
        tmp_path, 'echo "Blender 5.1"\nfor i in $(seq 1 30); do echo "err $i" >&2; done\nexit 3'
    )
    settings = make_settings(tmp_path, blender_path=blender)

    with pytest.raises(ExportError, match="code 3") as excinfo:
        run_blender(settings, tmp_path / "clips.json", tmp_path / "out")

    assert excinfo.value.stderr_tail.splitlines() == [f"err {i}" for i in range(11, 31)]


def test_run_blender_raises_export_error_on_timeout(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(exporter, "BLENDER_TIMEOUT_S", 0.5)
    settings = make_settings(tmp_path, blender_path=write_fake_blender(tmp_path, "exec sleep 5"))

    with pytest.raises(ExportError, match="timed out"):
        run_blender(settings, tmp_path / "clips.json", tmp_path / "out")
