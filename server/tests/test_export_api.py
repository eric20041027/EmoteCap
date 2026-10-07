"""POST /api/export tests with the export service faked (no Blender)."""
import json
from typing import Any

import pytest
from fastapi.testclient import TestClient

from emotecap_server import exporter,main
from emotecap_server.config import REPO_ROOT, Settings
from emotecap_server.contract import Clip, ExportedFile
from emotecap_server.main import app
from emotecap_server.jobs.service import JobService
from job_support import settings_at,write_outputs

FIXTURE = REPO_ROOT / "contracts" / "fixtures" / "raise-right-arm.clip.json"


def fixture_clip(**changes: Any) -> dict[str, Any]:
    return {**json.loads(FIXTURE.read_text()), **changes}


@pytest.fixture
def client(tmp_path,monkeypatch) -> TestClient:
    monkeypatch.setattr(main,'settings',settings_at(tmp_path))
    monkeypatch.setattr(main,'JobService',lambda _:JobService(settings_at(tmp_path),runner=write_outputs))
    with TestClient(app) as browser:yield browser


@pytest.fixture
def export_calls(monkeypatch: pytest.MonkeyPatch) -> list[list[str]]:
    """The queue's fake runner records names, without physical Blender."""
    calls: list[list[str]] = []

    def fake_runner(settings,json_path,out,cancel,progress):
        calls.append([clip['name'] for clip in json.loads(json_path.read_text())['clips']])
        write_outputs(settings,json_path,out,cancel,progress)

    app.state.jobs.runner=fake_runner
    return calls


def test_export_returns_file_urls(client: TestClient, export_calls: list[list[str]]) -> None:
    res = client.post("/api/export", json={"clips": [fixture_clip()]})

    assert res.status_code == 200
    job=app.state.jobs.list()[0]
    assert res.json() == {"files": [{"name": "Raise_Right_Arm", "url": f"/files/{job.id}/Raise_Right_Arm.fbx"}]}
    assert export_calls == [["Raise_Right_Arm"]]


def test_export_rejects_invalid_clip_name_with_422(
    client: TestClient, export_calls: list[list[str]]
) -> None:
    res = client.post("/api/export", json={"clips": [fixture_clip(name="bad name!")]})

    assert res.status_code == 422
    assert export_calls == []


def test_export_maps_export_error_to_500_with_stderr(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    def failing_runner(*args):
        raise exporter.ExportError("Blender exited with code 1", "Traceback\nKeyError: 'Hips'")

    app.state.jobs.runner=failing_runner

    res = client.post("/api/export", json={"clips": [fixture_clip()]})

    assert res.status_code == 500
    assert res.json()["detail"] == {
        "message": "Blender exited with code 1",
        "stderr": "Traceback\nKeyError: 'Hips'",
    }


@pytest.mark.parametrize("overflow", [False, True])
def test_bad_motion_returns_json_422_without_starting_export(
    client: TestClient, export_calls: list[list[str]], overflow: bool
) -> None:
    clip = fixture_clip()
    if overflow:
        clip["frames"][0]["r"][0] = "FINITE_OVERFLOW"
        raw = json.dumps({"clips": [clip]}).replace('"FINITE_OVERFLOW"', '1e999')
    else:
        clip["frames"][0]["r"][:4] = [0, 0, 0, 0]
        raw = json.dumps({"clips": [clip]})
    response = client.post("/api/export", content=raw,
                           headers={"content-type": "application/json"})
    assert response.status_code == 422
    assert export_calls == []
    detail = response.json()["detail"]
    assert detail and all(set(item) == {"loc", "msg", "type"} for item in detail)
