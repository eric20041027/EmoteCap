import pytest
from fastapi.testclient import TestClient

from emotecap_server import main
from emotecap_server.jobs.service import JobService
from job_support import settings_at,submission,write_outputs


@pytest.fixture
def client(tmp_path,monkeypatch):
    monkeypatch.setattr(main,'JobService',lambda _:JobService(settings_at(tmp_path),runner=write_outputs),raising=False)
    with TestClient(main.app) as browser:yield browser


def test_submit_list_and_download_links(client):
    response=client.post('/api/export-jobs',json=submission().model_dump(mode='json'))
    assert response.status_code==202
    job=response.json();assert job['snapshot']['clipRevision']==7 and job['schemaVersion']==1
    result=main.app.state.jobs.wait(job['id'],2)
    assert result.state=='succeeded'
    body=client.get(f"/api/export-jobs/{job['id']}").json()
    assert body['files'][0]['url'].startswith(f"/files/{job['id']}/")
    assert body['files'][0]['sidecar'].endswith('.emotecap.json')
    assert client.get('/api/export-jobs').json()['jobs'][0]['id']==job['id']


def test_delete_terminal_job_and_unknown_identity(client):
    response=client.post('/api/export-jobs',json=submission().model_dump(mode='json'));assert response.status_code==202
    job=response.json();main.app.state.jobs.wait(job['id'],2)
    assert client.delete(f"/api/export-jobs/{job['id']}").status_code==204
    assert client.get(f"/api/export-jobs/{job['id']}").status_code==404
    assert client.get('/api/export-jobs/not-a-uuid').status_code==422


@pytest.mark.parametrize('body',[{}, {'clips':[]}, {'clips':[], 'unknown':'field'}, {'clips':'bad'}])
def test_invalid_submission_returns_safe_validation_errors(client,body):
    response=client.post('/api/export-jobs',json=body)
    assert response.status_code==422
    assert all(set(e)=={'loc','msg','type'} for e in response.json()['detail'])


def test_size_rejected_before_decoding(client,monkeypatch):
    from emotecap_server.jobs import api
    monkeypatch.setattr(api,'MAX_REQUEST_BYTES',8)
    assert client.post('/api/export-jobs',content=b'x'*9,headers={'content-type':'application/json'}).status_code==413


def test_chunked_size_limit_is_enforced_before_json(client,monkeypatch):
    from emotecap_server.jobs import api
    monkeypatch.setattr(api,'MAX_REQUEST_BYTES',8)
    response=client.post('/api/export-jobs',content=iter([b'12345',b'67890']),headers={'content-type':'application/json'})
    assert response.status_code==413


def test_legacy_adapter_uses_the_same_lane_and_isolated_urls(client):
    response=client.post('/api/export',json={'clips':submission().model_dump(mode='json')['clips']})
    assert response.status_code==200
    jobs=client.get('/api/export-jobs').json()['jobs'];assert len(jobs)==1
    assert response.json()['files'][0]['url'].startswith(f"/files/{jobs[0]['id']}/")


def test_missing_lifespan_is_visible_unavailable(monkeypatch):
    monkeypatch.delattr(main.app.state,'jobs',raising=False)
    assert TestClient(main.app).post('/api/export-jobs',json=submission().model_dump(mode='json')).status_code==503


def test_legacy_wait_includes_healthy_queued_exports(client,monkeypatch):
    """Three simulated100second jobs, using Events instead of a300second sleep."""
    import threading
    import time
    from types import SimpleNamespace
    from emotecap_server.jobs import service as service_module
    from emotecap_server.jobs.runner import JobCancelled
    service=main.app.state.jobs;started=[threading.Event() for _ in range(3)];release=[threading.Event() for _ in range(3)]
    calls=[];clock=[0.0]
    def runner(settings,path,out,cancel,progress):
        index=len(calls);calls.append(path);started[index].set()
        while not release[index].wait(.01):
            if cancel.is_set():raise JobCancelled('Cancelled')
        write_outputs(settings,path,out,cancel,progress)
    service.runner=runner
    monkeypatch.setattr(service_module,'time',SimpleNamespace(monotonic=lambda:clock[0],time=time.time))
    original_wait=service._condition.wait
    def controlled_wait(timeout=None):
        if timeout is not None:
            for index in range(3):
                if started[index].is_set() and not release[index].is_set():
                    clock[0]+=100;release[index].set();break
        return original_wait(None if timeout is None else .03)
    monkeypatch.setattr(service._condition,'wait',controlled_wait)
    service.submit(submission());assert started[0].wait(2);service.submit(submission())
    try:
        result=client.post('/api/export',json={'clips':submission().model_dump(mode='json')['clips']})
        assert result.status_code==200,result.text
        assert clock[0]==300 and len(calls)==3
    finally:
        for event in release:event.set()


def test_legacy_unconfirmed_wait_returns_the_accepted_job_identity(client,monkeypatch):
    from emotecap_server.jobs.service import ServiceUnavailable
    def unavailable(*args):raise ServiceUnavailable('Export is still running; check its job status')
    monkeypatch.setattr(main.app.state.jobs,'wait',unavailable)
    response=client.post('/api/export',json={'clips':submission().model_dump(mode='json')['clips']})
    assert response.status_code==503
    detail=response.json()['detail'];assert detail['statusUrl']==f"/api/export-jobs/{detail['jobId']}"
    assert client.get(detail['statusUrl']).status_code==200
