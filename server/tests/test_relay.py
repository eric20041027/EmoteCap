"""Granted local sockets, exact motion text and isolated owner behavior."""
import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect
from emotecap_server import main
from emotecap_server.relay import LiveRelay
from emotecap_server.jobs.service import JobService
from job_support import settings_at,write_outputs
from live_support import ORIGIN,issue_session,hello,frame_text,connected,receive_frame
@pytest.fixture
def relay(monkeypatch):
    fresh=LiveRelay();monkeypatch.setattr(main,'relay',fresh);return fresh
@pytest.fixture
def client(relay,tmp_path,monkeypatch):
    settings=settings_at(tmp_path);monkeypatch.setattr(main,'settings',settings)
    monkeypatch.setattr(main,'JobService',lambda _:JobService(settings,runner=write_outputs))
    with TestClient(main.app,base_url='http://localhost:8787',client=('127.0.0.1',50000)) as client:yield client

def test_source_message_reaches_paired_sink_unchanged(client):
    s=issue_session(client);message=frame_text(1/30)
    with connected(client,s,'sink') as sink,connected(client,s) as source:
        source.send_text(message);assert receive_frame(sink)==message

def test_source_messages_reach_every_paired_sink_in_order(client):
    s=issue_session(client)
    with connected(client,s,'sink') as a,connected(client,s,'sink') as b,connected(client,s) as source:
        for message in [frame_text(0),frame_text(1/30),frame_text(181)]:
            source.send_text(message);assert receive_frame(a)==message;assert receive_frame(b)==message

def test_sink_disconnect_does_not_break_source(client,relay):
    s=issue_session(client)
    with connected(client,s,'sink') as survivor,connected(client,s) as source:
        with connected(client,s,'sink') as leaver:
            source.send_text(frame_text(0));assert receive_frame(leaver)==frame_text(0);assert receive_frame(survivor)==frame_text(0)
        source.send_text(frame_text(1));assert receive_frame(survivor)==frame_text(1);assert relay.sink_count==1

def test_sink_transmission_is_rejected_without_relaying_it(client):
    s=issue_session(client)
    with connected(client,s,'sink') as listener,connected(client,s) as source:
        with pytest.raises(WebSocketDisconnect) as closed,connected(client,s,'sink') as chatty:
            chatty.send_text('sinks are listen-only');chatty.receive_text()
        assert closed.value.code==1008
        source.send_text(frame_text(0));assert receive_frame(listener)==frame_text(0)

@pytest.mark.parametrize('url',['/ws/live?role=spectator','/ws/live'])
def test_invalid_or_missing_role_is_closed_with_1008(client,relay,url):
    with pytest.raises(WebSocketDisconnect) as closed,client.websocket_connect('ws://localhost:8787'+url,headers={'Origin':ORIGIN}) as ws:ws.receive_text()
    assert closed.value.code==1008 and relay.sink_count==0

def test_second_source_never_replaces_owner(client):
    s=issue_session(client)
    with connected(client,s,'sink') as sink,connected(client,s) as owner:
        with pytest.raises(WebSocketDisconnect) as closed,connected(client,s):pass
        assert closed.value.code==1008
        owner.send_text(frame_text(181));assert receive_frame(sink)==frame_text(181)

def test_separate_pairings_do_not_mix_frames(client):
    a,b=issue_session(client),issue_session(client)
    with connected(client,a,'sink') as sa,connected(client,b,'sink') as sb,connected(client,a) as oa,connected(client,b) as ob:
        oa.send_text(frame_text(1));ob.send_text(frame_text(2));assert receive_frame(sa)==frame_text(1);assert receive_frame(sb)==frame_text(2)

def test_reconnect_sends_new_hello_before_new_timeline(client):
    s=issue_session(client)
    with connected(client,s,'sink') as sink:
        with connected(client,s) as first:
            before=sink.receive_json();assert before['streamId']
            first.send_text(frame_text(190));assert receive_frame(sink)==frame_text(190)
        with connected(client,s) as second:
            after=sink.receive_json()
            if after['streamId'] is None:after=sink.receive_json()
            assert after['type']=='hello' and after['streamId']!=before['streamId']
            second.send_text(frame_text(0));assert receive_frame(sink)==frame_text(0)

@pytest.mark.parametrize('change',[{'version':1},{'version':True},{'bones':[]},{'token':'x'*43},
    {'sessionId':'00000000-0000-0000-0000-000000000000'},{'unexpected':1}])
def test_invalid_hello_never_claims_source(client,relay,change):
    s=issue_session(client)
    with pytest.raises(WebSocketDisconnect) as closed,connected(client,s,**change):pass
    assert closed.value.code==1008
    with connected(client,s):pass

def test_source_and_sink_secrets_cannot_be_substituted(client):
    s=issue_session(client)
    for role,token in [('source',s['pairingCode'].split('.')[1]),('sink',s['sourceToken'])]:
        with pytest.raises(WebSocketDisconnect) as closed,connected(client,s,role,token=token):pass
        assert closed.value.code==1008

@pytest.mark.parametrize('payload',[frame_text(),b'bytes'])
def test_frame_or_binary_before_hello_is_rejected(client,payload):
    issue_session(client)
    with pytest.raises(WebSocketDisconnect) as closed,client.websocket_connect('ws://localhost:8787/ws/live?role=source',headers={'Origin':ORIGIN}) as ws:
        if isinstance(payload,bytes):ws.send_bytes(payload)
        else:ws.send_text(payload)
        ws.receive_text()
    assert closed.value.code==1008

@pytest.mark.parametrize('origin',[None,'http://evil.example'])
def test_browser_source_requires_trusted_origin(client,origin):
    s=issue_session(client)
    with pytest.raises(WebSocketDisconnect) as closed,client.websocket_connect('ws://localhost:8787/ws/live?role=source',headers={} if origin is None else {'Origin':origin}) as ws:
        ws.send_text(hello(s));ws.receive_text()
    assert closed.value.code==1008

def test_native_sink_can_omit_origin_but_still_needs_secret(client):
    s=issue_session(client)
    with client.websocket_connect('ws://localhost:8787/ws/live?role=sink') as ws:
        ws.send_text(hello(s,'sink'));assert ws.receive_json()['role']=='sink'

def test_fifth_sink_is_rejected(client,relay):
    from contextlib import ExitStack
    s=issue_session(client)
    with ExitStack() as stack:
        for _ in range(4):stack.enter_context(connected(client,s,'sink'))
        with pytest.raises(WebSocketDisconnect) as closed,connected(client,s,'sink'):pass
        assert closed.value.code==1008 and relay.sink_count==4

def test_revoke_closes_owned_source_and_sink(client,relay):
    s=issue_session(client)
    with connected(client,s,'sink') as sink,connected(client,s) as source:
        assert sink.receive_json()['streamId']
        assert client.delete('/api/live-sessions/'+s['id'],headers={'Origin':ORIGIN,
            'Authorization':'Bearer '+s['sourceToken']}).status_code==204
        for socket in (source,sink):
            with pytest.raises(WebSocketDisconnect):socket.receive_text()
        assert relay.sink_count==0

def test_missing_hello_has_a_bounded_deadline(client,relay):
    issue_session(client);relay.hello_timeout=.02
    with pytest.raises(WebSocketDisconnect) as closed,client.websocket_connect('ws://localhost:8787/ws/live?role=source',headers={'Origin':ORIGIN}) as ws:
        ws.receive_text()
    assert closed.value.code==1008

def test_invalid_pose_does_not_drive_sink_and_owner_can_reconnect(client):
    s=issue_session(client)
    with connected(client,s,'sink') as sink:
        with pytest.raises(WebSocketDisconnect) as closed,connected(client,s) as source:
            source.send_text(frame_text(0,r=[0,0,0,2]*48));source.receive_text()
        assert closed.value.code==1008
        with connected(client,s) as owner:
            owner.send_text(frame_text(1));assert receive_frame(sink)==frame_text(1)

def test_expired_connected_source_cannot_deliver_another_frame(client,relay,monkeypatch):
    clock=[0.0];monkeypatch.setattr(relay.sessions,'clock',lambda:clock[0]);s=issue_session(client)
    with pytest.raises(WebSocketDisconnect) as closed,connected(client,s) as source:
        clock[0]=3600;source.send_text(frame_text(0));source.receive_text()
    assert closed.value.code==1008
