"""Source attribution, exclusion, immutable outputs and deterministic archives."""
import hashlib
import json
import subprocess
import sys
from pathlib import Path

import pytest

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'scripts'))
import build_windows as builder
import package_files as files

def git(repo,*args):
    return subprocess.run(['git','-C',str(repo),*args],check=True,capture_output=True).stdout.decode().strip()

@pytest.fixture
def build_inputs(tmp_path):
    repo=tmp_path/'source';repo.mkdir()
    pins=json.loads((ROOT/'packaging/python-runtime.json').read_bytes())
    tree={'server/emotecap_server/__init__.py':'','server/emotecap_server/launcher.py':'pass',
        'server/blender/export_fbx.py':'pass','contracts/bones.json':'{}',
        'server/uv.lock':'frozen synthetic lock','server/pyproject.toml':'synthetic project',
        'web/package-lock.json':'{}','packaging/python-runtime.json':json.dumps(pins),
        'packaging/windows/bootstrap.py':(ROOT/'packaging/windows/bootstrap.py').read_text(encoding='utf-8'),
        'packaging/windows/start.cmd':'@echo off\n','packaging/windows/START-HERE.txt':'Internal development candidate',
        'web/scripts/mediapipe-assets.json':json.dumps([{'file':'tiny.task','url':'https://example.invalid/model',
            'sha256':hashlib.sha256(b'synthetic model').hexdigest()}]),
        '.gitignore':'web/dist/\n.env\nserver/data/\n',
        '.env':'synthetic private settings','server/data/private.txt':'synthetic private data',
        'web/dist/index.html':'built Studio','web/dist/models/tiny.task':'synthetic model'}
    for name,text in tree.items():
        path=repo/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_text(text,encoding='utf-8')
    git(repo,'init','-q');git(repo,'config','user.name','Package Fixture');git(repo,'config','user.email','fixture@example.invalid')
    git(repo,'add','.');git(repo,'commit','-qm','synthetic candidate source')
    prepared=tmp_path/'prepared';payload=prepared/'payload'
    for name,data in {'python/python.exe':b'synthetic exe','deps/normal.py':b'normal = True',
        'requirements.txt':b'synthetic requirements','runtime-source.json':json.dumps(pins).encode(),
        'dependency-inventory.json':b'{"schema":"fixture"}'}.items():
        path=payload/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)
    files.write_json(prepared/'prepared.json',{'schema':'emotecap-prepared-windows-v1','runtime':pins,
        'serverSourceHashes':{name:files.sha256_file(repo/'server'/name) for name in ('uv.lock','pyproject.toml')},
        'files':files.file_inventory(payload),'releaseGate':'pending'})
    return repo,prepared

def test_two_builds_have_identical_zip_bytes(build_inputs,tmp_path):
    repo,prepared=build_inputs
    one=builder.build(repo,prepared,tmp_path/'one',tmp_path/'one.zip')
    two=builder.build(repo,prepared,tmp_path/'two',tmp_path/'two.zip')
    assert one['archiveSha256']==two['archiveSha256']
    assert (tmp_path/'one.zip').read_bytes()==(tmp_path/'two.zip').read_bytes()

def test_candidate_is_source_linked_private_free_and_pending(build_inputs,tmp_path):
    repo,prepared=build_inputs;result=builder.build(repo,prepared,tmp_path/'candidate',tmp_path/'candidate.zip')
    manifest=result['manifest']
    assert manifest['sourceCommit']==git(repo,'rev-parse','HEAD')
    assert manifest['sourceLocks']['server/uv.lock']==files.sha256_file(repo/'server/uv.lock')
    assert manifest['releaseGate']=='pending' and len(manifest['pendingGates'])>=6
    assert not (tmp_path/'candidate/.env').exists() and not (tmp_path/'candidate/app/server/data').exists()
    assert not (tmp_path/'candidate/.git').exists()
    assert (tmp_path/'candidate/app/web/dist/index.html').read_text()=='built Studio'
    assert (tmp_path/'candidate/bootstrap.py').read_bytes()==(repo/'packaging/windows/bootstrap.py').read_bytes()

@pytest.mark.parametrize('change',['dirty','prepared','model','source-lock'])
def test_invalid_inputs_produce_no_completed_package(build_inputs,tmp_path,change):
    repo,prepared=build_inputs
    if change=='dirty': (repo/'server/emotecap_server/launcher.py').write_text('changed')
    elif change=='prepared': (prepared/'payload/deps/normal.py').write_text('changed')
    elif change=='model': (repo/'web/dist/models/tiny.task').write_text('changed')
    else:
        (repo/'server/uv.lock').write_text('different frozen lock');git(repo,'add','.');git(repo,'commit','-qm','new lock')
    with pytest.raises(files.PackageError): builder.build(repo,prepared,tmp_path/'output',tmp_path/'output.zip')
    assert not (tmp_path/'output/manifest.json').exists() and not (tmp_path/'output.zip.receipt.json').exists()

@pytest.mark.parametrize('existing',['folder','archive'])
def test_existing_outputs_are_preserved(build_inputs,tmp_path,existing):
    repo,prepared=build_inputs;output=tmp_path/'output';archive=tmp_path/'output.zip'
    if existing=='folder': output.mkdir();(output/'keep').write_text('keep')
    else: archive.write_bytes(b'keep')
    with pytest.raises(files.PackageError): builder.build(repo,prepared,output,archive)
    assert (output/'keep').read_text()=='keep' if existing=='folder' else archive.read_bytes()==b'keep'

def test_archive_inside_payload_is_rejected(build_inputs,tmp_path):
    repo,prepared=build_inputs
    with pytest.raises(files.PackageError): builder.build(repo,prepared,tmp_path/'output',tmp_path/'output/result.zip')

def test_zip_uses_fixed_level_nine(tmp_path,monkeypatch):
    import zlib
    source=tmp_path/'source';source.mkdir();(source/'normal').write_bytes(b'normal'*100)
    original=zlib.compressobj;levels=[]
    def selected(level,*a,**kw):levels.append(level);return original(level,*a,**kw)
    monkeypatch.setattr(zlib,'compressobj',selected)
    files.zip_payload(source,tmp_path/'fixed.zip')
    assert levels==[9]
