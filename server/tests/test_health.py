from fastapi.testclient import TestClient

from emotecap_server.main import app


def test_health_reports_ok_with_capability_flags():
    res = TestClient(app).get("/api/health")

    assert res.status_code == 200
    body = res.json()
    assert body["ok"] is True
    assert set(body) == {"ok", "blender", "gemini", "exportJobs"}
    assert body['exportJobs']==1
