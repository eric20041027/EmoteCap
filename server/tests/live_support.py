"""Local granted socket test helpers; no camera/Unity/provider."""
import json
from contextlib import contextmanager
from emotecap_server.contract import BONES,BONE_COUNT
ORIGIN='http://localhost:5173'
def issue_session(client):
    result=client.post('/api/live-sessions',headers={'Origin':ORIGIN})
    assert result.status_code==201,result.text
    return result.json()
def hello(session,role='source',**changes):
    data={'type':'hello','version':2,'bones':BONES,'sessionId':session['id'],
          'token':session['sourceToken'] if role=='source' else session['pairingCode'].split('.')[1]}
    return json.dumps({**data,**changes})
def frame_text(t=0,**changes):
    return json.dumps({'type':'frame','t':t,'h':[0,.95,0],'r':[0,0,0,1]*BONE_COUNT,**changes})
@contextmanager
def connected(client,session,role='source',**changes):
    with client.websocket_connect('ws://localhost:8787/ws/live?role='+role,headers={'Origin':ORIGIN}) as socket:
        socket.send_text(hello(session,role,**changes));ack=socket.receive_json()
        assert ack['type']=='hello' and ack['version']==2 and ack['bones']==BONES
        assert ack['sessionId']==session['id'] and ack['role']==role
        assert 'token' not in ack and 'sourceToken' not in ack and 'pairingCode' not in ack
        yield socket
def receive_frame(socket):
    while True:
        text=socket.receive_text()
        if json.loads(text)['type']=='frame':return text
