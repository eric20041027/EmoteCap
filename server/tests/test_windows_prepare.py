"""Bounded archive/integrity behavior and isolated preparation ownership."""
import hashlib
import io
import json
import os
import subprocess
import sys
import tarfile
import zipfile
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts'))
import package_files as files
import prepare_windows as preparation


@pytest.mark.parametrize('name', ['../escape','/absolute','C:/secret','assets\\bad','CON.txt',
    'a./file','a /file','x//y','./x','a/../x','NUL','com1.log','lpt9','a\x00b','a:b','a/./b'])
def test_unsafe_names_fail(name):
    with pytest.raises(files.PackageError): files.safe_name(name)


def test_unicode_space_names_are_supported():
    assert files.safe_name('資料夾 with spaces/normal.py')=='資料夾 with spaces/normal.py'


def make_tar(path, entries):
    with tarfile.open(path,'w:gz') as archive:
        for name,kind,data in entries:
            entry=tarfile.TarInfo(name)
            if kind=='file': entry.size=len(data);archive.addfile(entry,io.BytesIO(data))
            elif kind=='dir': entry.type=tarfile.DIRTYPE;archive.addfile(entry)
            else:
                entry.type=tarfile.SYMTYPE if kind=='link' else tarfile.LNKTYPE
                entry.linkname='../private';archive.addfile(entry)


@pytest.mark.parametrize('entries', [
    [('python/../escape','file',b'private')],
    [('python/DLLs/CON.dll','file',b'private')],
    [('python/A.py','file',b'a'),('python/a.py','file',b'b')],
    [('python/a.py','file',b'a'),('python/a.py','file',b'b')],
    [('python/alias','link',b'')], [('python/alias','hardlink',b'')],
])
def test_unsafe_tar_never_writes_outside_destination(tmp_path,entries):
    incoming=tmp_path/'input.tar.gz';make_tar(incoming,entries)
    target=tmp_path/'output'
    with pytest.raises(files.PackageError): files.extract_tar(incoming,target,strip_prefix='python')
    assert not (tmp_path/'escape').exists()
    assert not target.exists() or not list(target.rglob('*'))


def test_valid_tar_prefix_and_bytes(tmp_path):
    incoming=tmp_path/'input.tar.gz'
    make_tar(incoming,[('python/Lib','dir',b''),('python/Lib/a.py','file',b'normal')])
    files.extract_tar(incoming,tmp_path/'output',strip_prefix='python')
    assert (tmp_path/'output/Lib/a.py').read_bytes()==b'normal'


@pytest.mark.parametrize('limit,value', [('MAX_FILES',1),('MAX_FILE_BYTES',1),('MAX_TOTAL_BYTES',3)])
def test_tar_limits_are_checked_before_file_writes(tmp_path,monkeypatch,limit,value):
    incoming=tmp_path/'input.tar.gz'
    make_tar(incoming,[('python/a','file',b'ab'),('python/b','file',b'cd')])
    monkeypatch.setattr(files,limit,value)
    with pytest.raises(files.PackageError): files.extract_tar(incoming,tmp_path/'output',strip_prefix='python')
    assert not (tmp_path/'output').exists() or not list((tmp_path/'output').rglob('*'))


@pytest.mark.parametrize('change',['changed','extra','missing'])
def test_changed_payload_is_rejected(tmp_path,change):
    (tmp_path/'normal').write_bytes(b'original');inventory=files.file_inventory(tmp_path)
    if change=='changed': (tmp_path/'normal').write_bytes(b'changed!')
    elif change=='extra': (tmp_path/'extra').write_bytes(b'extra')
    else: (tmp_path/'normal').unlink()
    with pytest.raises(files.PackageError): files.verify_inventory(tmp_path,inventory)


def test_inventory_rejects_a_link_even_if_inside_root(tmp_path,monkeypatch):
    alias=tmp_path/'alias';alias.write_text('private')
    original=Path.is_symlink
    monkeypatch.setattr(Path,'is_symlink',lambda path:path==alias or original(path))
    with pytest.raises(files.PackageError): files.file_inventory(tmp_path)

def test_inventory_rejects_hardlinked_file_aliases(tmp_path):
    original=tmp_path/'original';original.write_bytes(b'private')
    os.link(original,tmp_path/'alias')
    with pytest.raises(files.PackageError): files.file_inventory(tmp_path)


def test_copy_does_not_overwrite_or_follow_links(tmp_path,monkeypatch):
    source=tmp_path/'source';source.mkdir();(source/'normal').write_bytes(b'original')
    target=tmp_path/'target';target.mkdir();(target/'normal').write_bytes(b'keep')
    with pytest.raises(files.PackageError): files.copy_tree(source,target)
    assert (target/'normal').read_bytes()==b'keep'
    alias=source/'alias';alias.write_text('private')
    original=Path.is_symlink
    monkeypatch.setattr(Path,'is_symlink',lambda path:path==alias or original(path))
    with pytest.raises(files.PackageError): files.copy_tree(source,tmp_path/'new')


def test_zip_is_deterministic_and_exclusive(tmp_path):
    source=tmp_path/'source';source.mkdir();(source/'b').write_bytes(b'b');(source/'a').write_bytes(b'a')
    a=tmp_path/'a.zip';b=tmp_path/'b.zip'
    assert files.zip_payload(source,a)==files.zip_payload(source,b)
    assert a.read_bytes()==b.read_bytes()
    with zipfile.ZipFile(a) as archive:
        assert archive.namelist()==['a','b']
        assert all(info.date_time==(1980,1,1,0,0,0) for info in archive.infolist())
    before=a.read_bytes()
    with pytest.raises(files.PackageError): files.zip_payload(source,a)
    assert a.read_bytes()==before

def test_zip_rejects_same_size_changed_input(tmp_path,monkeypatch):
    source=tmp_path/'source';source.mkdir();(source/'normal').write_bytes(b'original')
    original=files.file_inventory
    def changed(root):
        inventory=original(root);(root/'normal').write_bytes(b'changed!');return inventory
    monkeypatch.setattr(files,'file_inventory',changed)
    with pytest.raises(files.PackageError): files.zip_payload(source,tmp_path/'changed.zip')


def test_json_is_bounded_finite_and_exclusive(tmp_path,monkeypatch):
    target=tmp_path/'record.json';files.write_json(target,{'safe':True})
    with pytest.raises(files.PackageError): files.write_json(target,{'replace':True})
    assert json.loads(target.read_text())=={'safe':True}
    with pytest.raises(files.PackageError): files.write_json(tmp_path/'nan.json',{'bad':float('nan')})
    monkeypatch.setattr(files,'MAX_MANIFEST_BYTES',2)
    with pytest.raises(files.PackageError): files.write_json(tmp_path/'large.json',{'large':'value'})
    assert not (tmp_path/'large.json').exists()


def preparation_fixture(tmp_path):
    root=tmp_path/'repo';(root/'server').mkdir(parents=True);(root/'packaging').mkdir()
    (root/'server/pyproject.toml').write_text('[project]\nname="fixture"\nversion="0.1.0"')
    (root/'server/uv.lock').write_text('synthetic frozen lock')
    cache=tmp_path/'cache';cache.mkdir()
    runtime=cache/'runtime.tar.gz';make_tar(runtime,[('python/python.exe','file',b'synthetic runtime'),
        ('python/LICENSE.txt','file',b'synthetic license')])
    full=cache/'full.tar.zst';full.write_bytes(b'synthetic full metadata archive')
    def pin(path): return {'file':path.name,'size':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
                          'url':'https://example.invalid/'+path.name}
    (root/'packaging/python-runtime.json').write_text(json.dumps({'version':'3.12.14','build':'20260825',
        'target':'x86_64-pc-windows-msvc','runtime':pin(runtime),'full':pin(full)}))
    return root,cache,tmp_path/'prepared',tmp_path/'uv.exe'


def test_bad_archive_hash_never_executes_or_extracts(tmp_path,monkeypatch):
    root,cache,output,uv=preparation_fixture(tmp_path)
    with (cache/'runtime.tar.gz').open('ab') as changed: changed.write(b'changed')
    invoked=[]
    monkeypatch.setattr(subprocess,'run',lambda *a,**kw:invoked.append(a))
    with pytest.raises(files.PackageError): preparation.prepare(root,cache,output,uv)
    assert not invoked and not (output/'payload').exists() and not (output/'prepared.json').exists()


def test_existing_preparation_is_preserved(tmp_path):
    root,cache,output,uv=preparation_fixture(tmp_path);output.mkdir();(output/'keep').write_text('owned elsewhere')
    with pytest.raises(files.PackageError): preparation.prepare(root,cache,output,uv)
    assert (output/'keep').read_text()=='owned elsewhere'


def fake_runner(calls,fail_install=False,version=b'uv 0.12.6\n'):
    def run(command,**kwargs):
        calls.append((command,kwargs))
        if '--version' in command: data=version
        elif '-xOf' in command:
            selected=command[-1]
            data=json.dumps({'python_version':'3.12.14','target_triple':'x86_64-pc-windows-msvc'}).encode() if selected.endswith('PYTHON.json') else b'supplied companion license'
        elif 'export' in command:
            Path(command[command.index('--output-file')+1]).write_text('tinyprod==1.0 --hash=sha256:synthetic\n');data=b''
        elif 'install' in command:
            if fail_install: return subprocess.CompletedProcess(command,1,None,None)
            deps=Path(command[command.index('--target')+1]);meta=deps/'tinyprod-1.0.dist-info';meta.mkdir(parents=True)
            (meta/'METADATA').write_text('Metadata-Version: 2.4\nName: tinyprod\nVersion: 1.0\n')
            (deps/'tinyprod.py').write_text('synthetic = True');data=b''
        else: data=b'{"python":"3.12.14","imports":"ok"}\n'
        kwargs['stdout'].write(data)
        return subprocess.CompletedProcess(command,0,None,None)
    return run


def test_install_failure_leaves_no_final_receipt_or_host_install(tmp_path,monkeypatch):
    root,cache,output,uv=preparation_fixture(tmp_path);calls=[]
    monkeypatch.setattr(subprocess,'run',fake_runner(calls,fail_install=True))
    with pytest.raises(files.PackageError): preparation.prepare(root,cache,output,uv)
    assert not (output/'prepared.json').exists()
    installs=[command for command,kw in calls if 'install' in command]
    assert len(installs)==1 and '--target' in installs[0] and '--system' not in installs[0]


def test_preparation_records_missing_licenses_and_removes_uv_configuration(tmp_path,monkeypatch):
    root,cache,output,uv=preparation_fixture(tmp_path);calls=[]
    monkeypatch.setenv('UV_INDEX_URL','https://private-index.invalid')
    monkeypatch.setattr(subprocess,'run',fake_runner(calls))
    receipt=preparation.prepare(root,cache,output,uv)
    assert receipt['schema']=='emotecap-prepared-windows-v1'
    inventory=json.loads((output/'payload/dependency-inventory.json').read_text())
    assert inventory['distributions'][0]['name']=='tinyprod'
    assert inventory['distributions'][0]['licensingStatus']=='pending'
    files.verify_inventory(output/'payload',receipt['files'])
    for command,kwargs in calls:
        assert not any(key.startswith('UV_') for key in kwargs['env'])
        if 'install' in command:
            assert '--require-hashes' in command and '--no-deps' in command and '--only-binary' in command
            assert command[command.index('--link-mode')+1]=='copy'
            assert command[command.index('--default-index')+1]=='https://pypi.org/simple'

@pytest.mark.parametrize('version',[b'uv 0.12.60\n',b'uv 0.12.6b\n'])
def test_similar_unpinned_uv_version_does_not_prepare(tmp_path,monkeypatch,version):
    root,cache,output,uv=preparation_fixture(tmp_path);calls=[]
    monkeypatch.setattr(subprocess,'run',fake_runner(calls,version=version))
    with pytest.raises(files.PackageError,match='pinned'): preparation.prepare(root,cache,output,uv)
    assert not (output/'prepared.json').exists()
