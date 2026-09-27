"""POST /api/export tests with the export service faked (no Blender)."""
import json
from typing import Any

import pytest
from fastapi.testclient import TestClient

from emotecap_server import exporter
from emotecap_server.config import REPO_ROOT, Settings
from emotecap_server.contract import Clip, ExportedFile
from emotecap_server.main import app

FIXTURE = REPO_ROOT / "contracts" / "fixtures" / "raise-right-arm.clip.json"


def fixture_clip(**changes: Any) -> dict[str, Any]:
    return {**json.loads(FIXTURE.read_text()), **changes}


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def export_calls(monkeypatch: pytest.MonkeyPatch) -> list[list[str]]:
    """Fake export_clips that records the clip names it receives."""
    calls: list[list[str]] = []

    def fake_export_clips(clips: list[Clip], settings: Settings) -> list[ExportedFile]:
        calls.append([clip.name for clip in clips])
        return [ExportedFile(name=clip.name, url=f"/files/{clip.name}.fbx") for clip in clips]

    monkeypatch.setattr(exporter, "export_clips", fake_export_clips)
    return calls


def test_export_returns_file_urls(client: TestClient, export_calls: list[list[str]]) -> None:
    res = client.post("/api/export", json={"clips": [fixture_clip()]})

    assert res.status_code == 200
    assert res.json() == {
        "files": [{"name": "Raise_Right_Arm", "url": "/files/Raise_Right_Arm.fbx"}]
    }
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
    def failing_export_clips(clips: list[Clip], settings: Settings) -> list[ExportedFile]:
        raise exporter.ExportError("Blender exited with code 1", "Traceback\nKeyError: 'Hips'")

    monkeypatch.setattr(exporter, "export_clips", failing_export_clips)

    res = client.post("/api/export", json={"clips": [fixture_clip()]})

    assert res.status_code == 500
    assert res.json()["detail"] == {
        "message": "Blender exited with code 1",
        "stderr": "Traceback\nKeyError: 'Hips'",
    }
