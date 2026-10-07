import dataclasses
import pytest
from fastapi.testclient import TestClient

from emotecap_server import gemini,main
from emotecap_server.contract import Segment
from emotecap_server.jobs.service import JobService
from job_support import settings_at,write_outputs
from test_media_consent import TAKE_ID,payload

VIDEO=b'video'

@pytest.fixture
def client(tmp_path,monkeypatch):
    configured=dataclasses.replace(settings_at(tmp_path),gemini_api_key='test-key-not-real')
    monkeypatch.setattr(main,'settings',configured)
    monkeypatch.setattr(main,'JobService',lambda _:JobService(configured,runner=write_outputs))
    with TestClient(main.app) as browser:yield browser

@pytest.fixture
def calls(monkeypatch):
    recorded=[]
    def fake(path,mime,duration,**kwargs):
        recorded.append((path,path.read_bytes(),mime,duration))
        return [Segment(name='Wave',start=0,end=2,loop=False,description='Synthetic')]
    monkeypatch.setattr(gemini,'slice_take',fake)
    def refuse(*args,**kwargs):raise AssertionError('No real Gemini in tests')
    monkeypatch.setattr(gemini,'make_client',refuse)
    return recorded

def grant(client,**changes):
    result=client.post('/api/cloud-consent',json=payload(**changes));assert result.status_code==200,result.text
    return result.json()['token']

def send(client,token=None,**changes):
    return client.post('/api/takes',headers={'X-EmoteCap-Consent':token} if token else {},
        files={'video':('take.webm',VIDEO,changes.get('mime','video/webm'))},
        data={'duration':changes.get('duration','2'),'takeId':changes.get('takeId',TAKE_ID)})

def test_configured_key_never_implies_consent(client,calls):
    assert send(client).status_code==403
    assert calls==[]

def test_grant_checked_before_multipart_parsing(client,calls):
    response=client.post('/api/takes',content=b'invalid',headers={'content-type':'text/plain'})
    assert response.status_code==403 and calls==[]

def test_one_use_grant_then_success_cleanup_and_no_replay(client,calls):
    token=grant(client);first=send(client,token);second=send(client,token)
    assert first.status_code==200,first.text
    assert second.status_code==403 and len(calls)==1
    assert first.json()['cleanup']['localVideo']=='deleted'
    assert not calls[0][0].exists()

@pytest.mark.parametrize('changes',[{'takeId':'a91b8760-4e75-4e11-b237-7f9eb79dd455'},{'duration':'3'},{'mime':'video/mp4'}])
def test_grant_source_metadata_must_match(client,calls,changes):
    assert send(client,grant(client),**changes).status_code==403
    assert calls==[]

def test_payload_extra_or_missing_allow_upload_is_rejected(client,calls):
    assert client.post('/api/cloud-consent',json=payload(extra=True)).status_code==422
    assert client.post('/api/cloud-consent',json=payload(allowUpload=False)).status_code==422
    assert calls==[]

def test_multipart_bound_precedes_provider(client,calls,monkeypatch):
    from emotecap_server.media import api
    token=grant(client);monkeypatch.setattr(api,'MAX_MULTIPART_BYTES',20)
    assert send(client,token).status_code==413 and calls==[]

def test_provider_error_still_removes_local_temporary_video(client,monkeypatch):
    paths=[]
    def fail(path,*args,**kwargs):paths.append(path);raise gemini.GeminiTimeoutError('Timed out')
    monkeypatch.setattr(gemini,'slice_take',fail)
    response=send(client,grant(client));assert response.status_code==502
    assert paths and not paths[0].exists()
    assert response.json()['detail']['cleanup']['localVideo']=='deleted'


def test_actual_file_bytes_cannot_exceed_the_permission(client,calls):
    assert send(client,grant(client,size=4)).status_code==403 and calls==[]


def test_non_json_consent_cannot_issue_permissions(client,calls):
    import json
    response=client.post('/api/cloud-consent',content=json.dumps(payload()),headers={'content-type':'text/plain'})
    assert response.status_code==415 and calls==[]


def test_streamed_ingress_deadline_closes_partial_multipart_files(monkeypatch):
    import asyncio
    from fastapi import HTTPException
    from starlette.requests import Request
    from emotecap_server.media import api
    parsers=[];original=api.GrantedMultipartParser
    class ObservedParser(original):
        def __init__(self,*args,**kwargs):super().__init__(*args,**kwargs);parsers.append(self)
    monkeypatch.setattr(api,'GrantedMultipartParser',ObservedParser);monkeypatch.setattr(api,'INGRESS_SECONDS',.01)
    part=b'--bound\r\nContent-Disposition: form-data; name="video"; filename="take.webm"\r\nContent-Type: video/webm\r\n\r\nvideo'
    messages=[{'type':'http.request','body':part,'more_body':True}]
    async def receive():
        if messages:return messages.pop()
        await asyncio.sleep(1);return {'type':'http.request','body':b'','more_body':False}
    async def attempt():
        request=Request({'type':'http','method':'POST','headers':[(b'content-type',b'multipart/form-data; boundary=bound')]},receive)
        with pytest.raises(HTTPException) as caught:
            async with api.upload_form(request,5):pass
        assert caught.value.status_code==408
    asyncio.run(attempt());assert parsers and parsers[0]._files_to_close_on_error
    assert all(file.closed for file in parsers[0]._files_to_close_on_error)


def test_chunked_multipart_cannot_bypass_the_total_byte_limit(client,calls,monkeypatch):
    from emotecap_server.media import api
    token=grant(client)
    original=client.build_request('POST','/api/takes',files={'video':('take.webm',VIDEO,'video/webm')},data={'takeId':TAKE_ID,'duration':'2'})
    body=original.read();monkeypatch.setattr(api,'MAX_MULTIPART_BYTES',20)
    result=client.post('/api/takes',content=iter([body[:12],body[12:]]),headers={
        'content-type':original.headers['content-type'],'X-EmoteCap-Consent':token})
    assert result.status_code==413 and calls==[]


def test_remote_cleanup_warning_reaches_successful_suggestions(client,monkeypatch):
    def fake(path,mime,duration,cleanup=None,**kwargs):
        if cleanup:cleanup.remoteFiles='failed';cleanup.warning='Google file deletion could not be confirmed'
        return [Segment(name='Wave',start=0,end=2,loop=False)]
    monkeypatch.setattr(gemini,'slice_take',fake)
    response=send(client,grant(client));assert response.status_code==200
    assert response.json()['cleanup'].get('remoteFiles')=='failed'
    assert response.json()['cleanup'].get('remoteWarning')


def test_remote_cleanup_warning_does_not_replace_the_original_failure(client,monkeypatch):
    def fake(path,mime,duration,cleanup=None,**kwargs):
        if cleanup:cleanup.remoteFiles='unknown';cleanup.warning='Upload cleanup is unknown'
        raise gemini.GeminiError('Original request failed')
    monkeypatch.setattr(gemini,'slice_take',fake)
    response=send(client,grant(client));assert response.status_code==502
    detail=response.json()['detail'];assert detail['message']=='Original request failed'
    assert detail['cleanup'].get('remoteFiles')=='unknown'
