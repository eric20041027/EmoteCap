import re
from uuid import UUID
import pytest
from fastapi.testclient import TestClient
from emotecap_server import main
from emotecap_server.relay import LiveRelay
from emotecap_server.jobs.service import JobService
from job_support import settings_at,write_outputs
from live_support import ORIGIN,issue_session,connected,receive_frame,frame_text
@pytest.fixture
def client(tmp_path,monkeypatch):
    settings=settings_at(tmp_path);monkeypatch.setattr(main,'settings',settings)
    monkeypatch.setattr(main,'JobService',lambda _:JobService(settings,runner=write_outputs))
    monkeypatch.setattr(main,'relay',LiveRelay())
    with TestClient(main.app,base_url='http://localhost:8787',client=('127.0.0.1',50000)) as client:yield client
def test_session_has_independent_unlogged_role_secrets(client,caplog):
    s=issue_session(client);assert str(UUID(s['id'],version=4))==s['id']
    assert re.fullmatch(r'[A-Za-z0-9_-]{43}',s['sourceToken'])
    assert s['pairingCode'].startswith(s['id']+'.');token=s['pairingCode'].split('.')[1]
    assert re.fullmatch(r'[A-Za-z0-9_-]{43}',token) and token!=s['sourceToken']
    assert isinstance(s['expiresAt'],int) and s['sourceToken'] not in caplog.text and token not in caplog.text
def test_only_four_sessions_are_admitted(client):
    for _ in range(4):issue_session(client)
    assert client.post('/api/live-sessions',headers={'Origin':ORIGIN}).status_code==409
@pytest.mark.parametrize('origin',[None,'null','https://example.org','http://localhost.evil:5173','http://localhost:9999',
    'http://user@localhost:5173','http://localhost:5173/path'])
def test_missing_or_untrusted_origin_cannot_create_session(client,origin):
    assert client.post('/api/live-sessions',headers={} if origin is None else {'Origin':origin}).status_code==403
@pytest.mark.parametrize('host',['evil.example:8787','localhost.evil:8787','127.0.0.2:8787'])
def test_non_loopback_host_cannot_create_session(client,host):
    assert client.post('/api/live-sessions',headers={'Origin':ORIGIN,'Host':host}).status_code==403
def test_same_service_origin_is_supported(client):
    assert client.post('/api/live-sessions',headers={'Origin':'http://localhost:8787'}).status_code==201
def test_session_endpoint_refuses_request_payload(client):
    assert client.post('/api/live-sessions',headers={'Origin':ORIGIN},content=b'x').status_code==413
def test_source_secret_required_for_revoke_and_other_sessions_survive(client):
    s,other=issue_session(client),issue_session(client);path='/api/live-sessions/'+s['id']
    assert client.delete(path,headers={'Origin':ORIGIN,'Authorization':'Bearer '+s['pairingCode'].split('.')[1]}).status_code==403
    assert client.delete(path,headers={'Origin':ORIGIN,'Authorization':'Bearer '+s['sourceToken']}).status_code==204
    assert client.delete(path,headers={'Origin':ORIGIN,'Authorization':'Bearer '+s['sourceToken']}).status_code==404
    with connected(client,other,'sink') as sink,connected(client,other) as source:
        source.send_text(frame_text(0));assert receive_frame(sink)==frame_text(0)
def test_expiry_releases_admission_using_monotonic_clock(client,monkeypatch):
    clock=[0.0];monkeypatch.setattr(main.relay.sessions,'clock',lambda:clock[0])
    sessions=[issue_session(client) for _ in range(4)];clock[0]=3600
    fresh=issue_session(client);assert fresh['id'] not in [s['id'] for s in sessions]
    assert client.delete('/api/live-sessions/'+sessions[0]['id'],headers={'Origin':ORIGIN,
        'Authorization':'Bearer '+sessions[0]['sourceToken']}).status_code==404
def test_wrong_revoke_origin_does_not_invalidate_session(client):
    s=issue_session(client)
    assert client.delete('/api/live-sessions/'+s['id'],headers={'Origin':'http://evil.example',
        'Authorization':'Bearer '+s['sourceToken']}).status_code==403
    with connected(client,s):pass
