from io import BytesIO
from pathlib import Path
import pytest

from emotecap_server.media.consent import ConsentGrants
from emotecap_server.media.storage import MediaStorage,MediaStorageError
from test_media_consent import payload

def permission():
    grants=ConsentGrants();return grants.consume(grants.issue(payload()).token)


def test_owned_temporary_video_is_finally_removed_and_legacy_is_untouched(tmp_path):
    root=tmp_path/'data';legacy=root/'takes'/('a'*32+'.webm')
    legacy.parent.mkdir(parents=True);legacy.write_bytes(b'legacy')
    storage=MediaStorage(root);media=storage.begin(permission(),BytesIO(b'video'))
    assert media.path.read_bytes()==b'video'
    result=storage.cleanup(media);assert result.localVideo=='deleted' and not media.path.exists()
    assert legacy.read_bytes()==b'legacy'
    storage.delete('legacy-'+'a'*32);assert not legacy.exists()


def test_failed_copy_leaves_no_untracked_partial_video(tmp_path):
    storage=MediaStorage(tmp_path)
    with pytest.raises(MediaStorageError,match='consent'):storage.begin(permission(),BytesIO(b'wrong-size'))
    assert storage.inventory()==[]


def test_cleanup_failure_is_visible_and_explicitly_retryable(tmp_path,monkeypatch):
    storage=MediaStorage(tmp_path);media=storage.begin(permission(),BytesIO(b'video'));original=Path.unlink
    def deny(path,*args,**kwargs):
        if path==media.path:raise PermissionError('file is in use')
        return original(path,*args,**kwargs)
    with monkeypatch.context() as scoped:
        scoped.setattr(Path,'unlink',deny)
        result=storage.cleanup(media);assert result.localVideo=='failed' and result.warning
    items=storage.inventory();assert items[0].id==media.id
    storage.delete(media.id);assert storage.inventory()==[]


def test_pending_raw_budget_blocks_new_copy(tmp_path):
    storage=MediaStorage(tmp_path,max_bytes=5);first=storage.begin(permission(),BytesIO(b'video'))
    with pytest.raises(MediaStorageError,match='budget'):storage.begin(permission(),BytesIO(b'video'))
    storage.cleanup(first)


@pytest.mark.parametrize('id',['../other','..\\jobs','not-a-uuid','legacy-../secret'])
def test_unknown_or_escaping_delete_never_targets_arbitrary_data(tmp_path,id):
    storage=MediaStorage(tmp_path);foreign=tmp_path/'other';foreign.write_bytes(b'original')
    with pytest.raises(MediaStorageError):storage.delete(id)
    assert foreign.read_bytes()==b'original'


def test_active_source_cannot_be_deleted_while_provider_uses_it(tmp_path):
    storage=MediaStorage(tmp_path);media=storage.begin(permission(),BytesIO(b'video'))
    with pytest.raises(MediaStorageError,match='active'):storage.delete(media.id)
    assert media.path.exists();storage.cleanup(media)


def test_empty_directory_cleanup_failure_remains_inventoryable(tmp_path,monkeypatch):
    storage=MediaStorage(tmp_path);media=storage.begin(permission(),BytesIO(b'video'));original=Path.rmdir
    def deny(path):
        if path==media.path.parent:raise PermissionError('directory in use')
        return original(path)
    with monkeypatch.context() as scoped:
        scoped.setattr(Path,'rmdir',deny);assert storage.cleanup(media).localVideo=='failed'
    assert storage.inventory()[0].id==media.id
    storage.delete(media.id);assert storage.inventory()==[]
