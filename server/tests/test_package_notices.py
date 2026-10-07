"""Notice admission must reject unsafe or stale material without copying it."""
import json
import os
import subprocess
from pathlib import Path
import pytest

from test_windows_package import build_inputs, git, files
import package_notices as notices

def test_valid_material_is_bound_to_exact_source_and_notice_bytes(build_inputs):
    repo,prepared=build_inputs
    result=notices.validate_notices(repo,prepared,files.file_inventory(repo/'web/dist'))
    assert result['summary']['assessment']=='pending'
    assert result['summary']['textFiles']==1
    assert result['summary']['sourceIndexSha256']==files.sha256_file(repo/'third_party/inventory.json')

@pytest.mark.parametrize('unsafe',['link','hardlink','oversized','many-records','metadata-key',
    'component-status','private-path','deep-json'])
def test_unsafe_material_rejected_at_admission(build_inputs,tmp_path,unsafe):
    repo,prepared=build_inputs;index=repo/'third_party/inventory.json'
    value=json.loads(index.read_bytes());notice=repo/'third_party/licenses/owned/LICENSE'
    if unsafe in ('link','hardlink'):
        external=tmp_path/'external-owned-license';external.write_bytes(notice.read_bytes());notice.unlink()
        if unsafe=='link':
            try:notice.symlink_to(external)
            except (OSError,NotImplementedError):pytest.skip('Platform cannot create owned test symlink')
        else:os.link(external,notice)
    elif unsafe=='oversized':notice.write_bytes(b'x'*(2*1024*1024+1))
    elif unsafe=='deep-json':index.write_text('['*1200+']'*1200)
    else:
        if unsafe=='many-records':value['files']=value['files']*513
        elif unsafe=='metadata-key':value['files'][0]['unapprovedPrivateField']='owned sentinel'
        elif unsafe=='component-status':value['components'][0]['status']='approved'
        elif unsafe=='private-path':value['context']['machinePath']='C:/Users/owned-fixture/private.env'
        index.write_text(json.dumps(value),encoding='utf-8')
    with pytest.raises(files.PackageError):
        notices.validate_notices(repo,prepared,files.file_inventory(repo/'web/dist'))

def test_package_copy_keeps_exact_files_and_source_identity(build_inputs,tmp_path):
    repo,prepared=build_inputs;staged=tmp_path/'owned-staged';staged.mkdir()
    validated=notices.validate_notices(repo,prepared,files.file_inventory(repo/'web/dist'))
    result=notices.copy_notices(repo,staged,validated,git(repo,'rev-parse','HEAD'))
    assert result['assessment']=='pending'
    assert (staged/'notices/third_party/licenses/owned/LICENSE').read_bytes()==b'Owned license fixture\r\n'
    assert git(repo,'rev-parse','HEAD') in (staged/'notices/README.txt').read_text()

@pytest.mark.parametrize('change',['text','index'])
def test_changed_material_between_admission_and_copy_is_not_accepted(build_inputs,tmp_path,change):
    repo,prepared=build_inputs
    validated=notices.validate_notices(repo,prepared,files.file_inventory(repo/'web/dist'))
    target=repo/'third_party'/('licenses/owned/LICENSE' if change=='text' else 'inventory.json')
    target.write_bytes(target.read_bytes()+b'\nOwned change after admission\n')
    staged=tmp_path/'owned-staged';staged.mkdir()
    with pytest.raises(files.PackageError):notices.copy_notices(repo,staged,validated,git(repo,'rev-parse','HEAD'))

@pytest.mark.skipif(os.name!='nt',reason='NTFS directory junction is Windows-specific')
def test_notice_directory_junction_is_rejected_without_following_it(build_inputs,tmp_path):
    repo,prepared=build_inputs;directory=repo/'third_party/licenses/owned'
    data=(directory/'LICENSE').read_bytes();(directory/'LICENSE').unlink();directory.rmdir()
    target=tmp_path/'external-owned-folder';target.mkdir();(target/'LICENSE').write_bytes(data)
    assert directory.resolve().is_relative_to(repo.resolve()) and target.resolve().is_relative_to(tmp_path.resolve())
    result=subprocess.run(['cmd','/c','mklink','/J',str(directory),str(target)],capture_output=True)
    assert result.returncode==0,'Owned NTFS junction fixture could not be created'
    with pytest.raises(files.PackageError):notices.validate_notices(repo,prepared,files.file_inventory(repo/'web/dist'))
    assert (target/'LICENSE').read_bytes()==data
