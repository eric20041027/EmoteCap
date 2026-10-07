import pytest
from pydantic import ValidationError

from emotecap_server.jobs.models import JobSubmission
from emotecap_server.jobs.repository import Repository
from job_support import settings_at,submission


def test_input_and_status_roundtrip_are_durable(tmp_path):
    root=settings_at(tmp_path).data_dir;repo=Repository(root);source=submission();status=repo.create(source)
    source.clips[0].name='Changed'
    reopened=Repository(root)
    assert reopened.get(status.id)==status
    assert reopened.read_input(status).clips[0].name=='Wave'
    assert len(status.inputSha256)==64 and status.inputSha256!='0'*64


def test_tampered_input_is_rejected_before_validation(tmp_path):
    root=settings_at(tmp_path).data_dir;repo=Repository(root);status=repo.create(submission())
    (root/'jobs'/status.id/'input.json').write_text('{}')
    with pytest.raises(ValueError,match='digest'):repo.read_input(status)


@pytest.mark.parametrize('patch',[{'snapshot':{'projectId':'bad','takeId':'bad','clipRevision':1}},
    {'unknown':True},{'snapshot':{'projectId':'a91b8760-4e75-4e11-b237-7f9eb79dd455','takeId':'a91b8760-4e75-4e11-b237-7f9eb79dd455','clipRevision':-1}}])
def test_invalid_snapshot_or_extra_envelope_is_rejected(patch):
    value=submission().model_dump(mode='json');value.update(patch)
    with pytest.raises(ValidationError):JobSubmission.model_validate(value)


def test_aggregate_frame_limit_is_applied(monkeypatch):
    import emotecap_server.jobs.models as models
    monkeypatch.setattr(models,'MAX_JOB_FRAMES',0,raising=False)
    with pytest.raises(ValidationError,match='aggregate'):JobSubmission.model_validate(submission().model_dump(mode='json'))


def test_failed_metadata_insert_does_not_leave_an_orphan_input(tmp_path,monkeypatch):
    root=settings_at(tmp_path).data_dir;repo=Repository(root)
    def failure():raise OSError('metadata disk full')
    monkeypatch.setattr(repo,'_connect',failure)
    with pytest.raises(OSError,match='disk full'):repo.create(submission())
    assert list((root/'jobs').glob('*/input.json'))==[]
