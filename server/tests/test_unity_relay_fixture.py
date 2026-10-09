import importlib.util
import json
from pathlib import Path
import time

from fastapi.testclient import TestClient
import pytest
from emotecap_server.contract import BONES
from starlette.websockets import WebSocketDisconnect

spec=importlib.util.spec_from_file_location('unity_relay_fixture',Path(__file__).resolve().parents[2]/'scripts/unity-relay-test.py')
fixture=importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixture)

@pytest.fixture
def client():
    with TestClient(fixture.create_fixture_app(31337,'owned-unit-fixture'),base_url='http://127.0.0.1:31337') as client:
        yield client

def issue(client):
    response=client.post('/fixture/issue',json={})
    assert response.status_code==200
    return response.json()

def test_fixture_health_exposes_only_public_identity_and_bounded_state(client):
    response=client.get('/fixture/info')
    assert response.status_code==200
    data=response.json()
    assert data['instance']=='owned-unit-fixture'
    assert data['sessions']==data['sources']==data['sinks']==0
    assert len(data['fixtureSha256'])==64
    assert data['provider'] is False

def test_runner_rejects_parent_traversal_before_writing_any_output():
    with pytest.raises(ValueError):fixture.owned_path(str(fixture.WORK/'child/../../../../foreign-output'))

def test_runner_admits_only_the_selected_quality_workspace():
    workspace='2026-10-08-unity-quality'
    selected=fixture.ROOT/'.superpowers/sdd'/workspace/'project'
    assert fixture.owned_path(str(selected),workspace)==selected
    with pytest.raises(ValueError):fixture.owned_path(str(fixture.WORK/'project'),workspace)
    with pytest.raises(ValueError):fixture.owned_path(str(selected),'../../foreign')

def test_fixture_issues_sink_code_without_revealing_source_authorization(client):
    data=issue(client)
    assert set(data)=={'id','pairingCode','expiresAt'}
    assert len(data['pairingCode'])==80 and data['pairingCode'].startswith(data['id']+'.')
    assert 45000<data['expiresAt']-time.time()*1000<=60000

@pytest.mark.parametrize('ttl',[True,'1',0,61,None])
def test_fixture_cannot_issue_unbounded_or_coerced_lifetimes(client,ttl):
    assert client.post('/fixture/issue',json={'ttlSeconds':ttl}).status_code==422
    assert client.get('/fixture/info').json()['sessions']==0

def test_fixture_uses_the_production_native_sink_acknowledgement(client):
    data=issue(client)
    with client.websocket_connect('ws://127.0.0.1:31337/ws/live?role=sink') as sink:
        sink.send_json({'type':'hello','version':2,'bones':BONES,'sessionId':data['id'],'token':data['pairingCode'].split('.')[1]})
        hello=sink.receive_json()
        assert set(hello)=={'type','version','bones','sessionId','role','streamId','expiresAt'}
        assert hello['sessionId']==data['id'] and hello['role']=='sink' and hello['streamId'] is None
        assert client.get('/fixture/info').json()['sinks']==1

def test_fixture_reset_revokes_owned_native_sink_without_persisting_credentials(client):
    data=issue(client)
    with client.websocket_connect('ws://127.0.0.1:31337/ws/live?role=sink') as sink:
        sink.send_json({'type':'hello','version':2,'bones':BONES,'sessionId':data['id'],'token':data['pairingCode'].split('.')[1]})
        sink.receive_json()
        assert client.post('/fixture/reset',json={}).status_code==200
        with pytest.raises(WebSocketDisconnect) as caught:sink.receive_json()
        assert caught.value.code==1008
    info=client.get('/fixture/info').json()
    assert info['sessions']==info['sinks']==0
    assert data['pairingCode'] not in json.dumps(info)
