import threading

import pytest

from emotecap_server.exporter import ExportError
from emotecap_server.jobs.service import JobService,QueueFull,InvalidAction,ServiceUnavailable
from job_support import BlockingRunner,settings_at,submission,write_outputs


@pytest.fixture
def lane(tmp_path):
    services=[]
    def create(runner=write_outputs,**kwargs):
        service=JobService(settings_at(tmp_path),runner=runner,**kwargs);service.start();services.append(service);return service
    yield create
    for service in reversed(services):service.close()


def test_queue_limit_and_cancel_preserve_running_input(lane):
    runner=BlockingRunner();service=lane(runner);first=service.submit(submission());assert runner.started.wait(2)
    queued=[service.submit(submission()) for _ in range(4)]
    with pytest.raises(QueueFull):service.submit(submission())
    assert service.cancel(queued[0].id).state=='cancelled'
    assert service.get(first.id).state=='running'
    runner.release.set();assert service.wait(first.id,2).state=='succeeded'


def test_one_worker_and_same_name_outputs_are_distinct(lane):
    runner=BlockingRunner();service=lane(runner);first=service.submit(submission());assert runner.started.wait(2)
    second=service.submit(submission());runner.release.set()
    a=service.wait(first.id,2);b=service.wait(second.id,2)
    assert a.state==b.state=='succeeded' and runner.maximum==1
    assert a.files[0].url!=b.files[0].url
    assert a.files[0].sidecar.endswith('/Wave.emotecap.json')


def test_retry_keeps_original_digest_and_snapshot(lane):
    def failure(*args):raise ExportError('bad export','diagnostic tail')
    service=lane(failure);original=submission();first=service.submit(original)
    assert service.wait(first.id,2).state=='failed'
    second=service.retry(first.id)
    assert second.id!=first.id and second.retryOf==first.id
    assert second.inputSha256==first.inputSha256 and second.snapshot==original.snapshot


def test_running_cancel_stops_job_and_no_files_are_exposed(lane):
    runner=BlockingRunner();service=lane(runner);job=service.submit(submission());assert runner.started.wait(2)
    service.cancel(job.id);result=service.wait(job.id,2)
    assert result.state=='cancelled' and result.files==[]
    assert not (service.settings.data_dir/'exports'/job.id).exists()


def test_cancel_before_publication_wins(lane):
    staged=threading.Event();finish=threading.Event()
    def runner(settings,json_path,out,cancel,progress):
        write_outputs(settings,json_path,out,cancel,progress);staged.set();assert finish.wait(2)
    service=lane(runner);job=service.submit(submission());assert staged.wait(2)
    service.cancel(job.id);finish.set()
    assert service.wait(job.id,2).state=='cancelled'
    assert not (service.settings.data_dir/'exports'/job.id).exists()


def test_restart_recovers_queued_and_running_without_starting_them(tmp_path):
    from emotecap_server.jobs.repository import Repository
    repo=Repository(settings_at(tmp_path).data_dir);first=repo.create(submission());second=repo.create(submission())
    repo.save(first.model_copy(update={'state':'running','phase':'Exporting'}))
    runner=BlockingRunner();service=JobService(settings_at(tmp_path),runner=runner);service.start()
    try:
        assert {j.state for j in service.list()}=={'interrupted'}
        assert not runner.started.is_set()
        retried=service.retry(second.id);assert retried.inputSha256==second.inputSha256
    finally:service.close()


def test_second_manager_refuses_same_data_directory(lane,tmp_path):
    lane();other=JobService(settings_at(tmp_path))
    with pytest.raises(ServiceUnavailable,match='already'):other.start()
    other.close()


def test_terminal_delete_and_history_limit(lane):
    service=lane(max_records=2)
    first=service.submit(submission());service.wait(first.id,2)
    second=service.submit(submission());service.wait(second.id,2)
    with pytest.raises(QueueFull,match='Delete'):service.submit(submission())
    service.delete(first.id);assert len(service.list())==1
    assert not (service.settings.data_dir/'exports'/first.id).exists()
    assert service.submit(submission()).id not in {first.id,second.id}


def test_delete_and_retry_active_job_are_rejected(lane):
    runner=BlockingRunner();service=lane(runner);job=service.submit(submission());assert runner.started.wait(2)
    with pytest.raises(InvalidAction):service.delete(job.id)
    with pytest.raises(InvalidAction):service.retry(job.id)


@pytest.mark.parametrize('content',[None,b'corrupt'])
def test_missing_or_corrupt_queued_input_fails_without_running(lane,content):
    runner=BlockingRunner();service=lane(runner);first=service.submit(submission());assert runner.started.wait(2)
    second=service.submit(submission());path=service.settings.data_dir/'jobs'/second.id/'input.json'
    if content is None:path.unlink()
    else:path.write_bytes(content)
    runner.release.set();service.wait(first.id,2);result=service.wait(second.id,2)
    assert result.state=='failed' and result.error
    assert runner.calls==1


def test_failed_acceptance_never_appears_queued(lane,monkeypatch):
    service=lane()
    def fail(*args,**kwargs):raise OSError('disk full')
    monkeypatch.setattr(service.repository,'create',fail)
    with pytest.raises(ServiceUnavailable,match='disk full'):service.submit(submission())
    assert service.list()==[]


def test_post_close_operations_reject_and_owned_worker_finishes(lane):
    runner=BlockingRunner();service=lane(runner);job=service.submit(submission());assert runner.started.wait(2)
    service.close();assert runner.active==0
    with pytest.raises(ServiceUnavailable):service.submit(submission())


def test_parallel_admission_remains_bounded_and_serial(lane):
    from concurrent.futures import ThreadPoolExecutor
    runner=BlockingRunner();service=lane(runner);first=service.submit(submission());assert runner.started.wait(2)
    def admit(_):
        try:return service.submit(submission())
        except QueueFull:return None
    with ThreadPoolExecutor(max_workers=8) as pool:results=list(pool.map(admit,range(8)))
    accepted=[job for job in results if job is not None];assert len(accepted)==4
    runner.release.set()
    for job in [first,*accepted]:assert service.wait(job.id,2).state=='succeeded'
    assert runner.maximum==1


def test_retry_rejects_tampered_original_instead_of_rebuilding(lane):
    def failure(*args):raise ExportError('failed')
    service=lane(failure);job=service.submit(submission());service.wait(job.id,2)
    (service.settings.data_dir/'jobs'/job.id/'input.json').write_text('{}')
    with pytest.raises(InvalidAction,match='digest'):service.retry(job.id)
    assert len(service.list())==1
