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
    # The fixture must preserve source pins and license bytes just like the product.
    tree={'.gitattributes':(ROOT/'.gitattributes').read_text(encoding='utf-8'),
        'server/emotecap_server/__init__.py':'','server/emotecap_server/launcher.py':'pass',
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
        path=repo/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_text(text,encoding='utf-8',newline='\n')
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
    notice=repo/'third_party/licenses/owned/LICENSE';notice.parent.mkdir(parents=True)
    notice.write_bytes(b'Owned license fixture\r\n')
    sdk=repo/'web/dist/mediapipe/wasm/vision.wasm';sdk.parent.mkdir(parents=True)
    sdk.write_bytes(b'owned wasm fixture')
    context_paths=('server/pyproject.toml','server/uv.lock','web/package-lock.json',
        'web/scripts/mediapipe-assets.json','packaging/python-runtime.json')
    material={'schema':'emotecap-third-party-material-v1','assessment':'draft-supplied-evidence-not-redistribution-approval',
        'context':{'sourceLockSha256':{name:files.sha256_file(repo/name) for name in context_paths},
            'preparedReceiptSha256':files.sha256_file(prepared/'prepared.json'),'runtimeSource':pins},
        'files':[{'path':'licenses/owned/LICENSE','size':notice.stat().st_size,'sha256':files.sha256_file(notice),
            'origin':{'kind':'owned-synthetic-fixture','input':'owned/LICENSE'}}],
        'components':[{'name':'owned SDK fixture','version':'1','kind':'web-runtime',
            'status':'supplied-material-assessment-pending','suppliedLicenses':['licenses/owned/LICENSE'],
            'prebuiltSdkFiles':[{'path':'web/node_modules/@mediapipe/tasks-vision/wasm/vision.wasm',
                'size':sdk.stat().st_size,'sha256':files.sha256_file(sdk)}]}],
        'nativeBinaryFiles':[],'pending':['Owned fixture has no redistribution approval']}
    files.write_json(repo/'third_party/inventory.json',material)
    git(repo,'add','.');git(repo,'commit','-qm','owned licensing fixture')
    return repo,prepared

def test_candidate_preserves_exact_notice_bytes_and_pending_summary(build_inputs,tmp_path):
    repo,prepared=build_inputs;output=tmp_path/'candidate'
    result=builder.build(repo,prepared,output,tmp_path/'candidate.zip')
    assert (output/'notices/third_party/licenses/owned/LICENSE').read_bytes()==b'Owned license fixture\r\n'
    assert (output/'notices/third_party/inventory.json').read_bytes()==(repo/'third_party/inventory.json').read_bytes()
    summary=result['manifest']['licensingMaterial']
    assert summary['assessment']=='pending' and summary['textFiles']==1
    assert summary['sourceIndexSha256']==files.sha256_file(repo/'third_party/inventory.json')
    assert git(repo,'rev-parse','HEAD') in (output/'notices/README.txt').read_text()


def commit_project_license(repo, body=None):
    (repo/'LICENSE').write_bytes((ROOT/'LICENSE').read_bytes() if body is None else body)
    git(repo,'add','LICENSE');git(repo,'commit','-qm','owner-approved project license')


def test_project_license_is_delivered_and_source_bound(build_inputs,tmp_path):
    repo,prepared=build_inputs;commit_project_license(repo)
    output=tmp_path/'candidate';archive=tmp_path/'candidate.zip'
    result=builder.build(repo,prepared,output,archive)
    expected=(ROOT/'LICENSE').read_bytes()
    assert (output/'LICENSE').read_bytes()==expected
    record=result['manifest']['licensingMaterial']['projectLicense']
    assert record=={'path':'LICENSE','size':len(expected),'sha256':hashlib.sha256(expected).hexdigest(),'spdx':'MIT'}
    assert {k:v for k,v in record.items() if k!='spdx'} in result['manifest']['files']
    import zipfile
    with zipfile.ZipFile(archive) as package:assert package.read('LICENSE')==expected
    assert 'Project-owned material is licensed under MIT' in (output/'notices/README.txt').read_text()
    assert 'No project LICENSE is adopted' not in (output/'notices/README.txt').read_text()
    assert 'Owner MIT/contributor/all-four-media rights' not in result['manifest']['pendingGates']
    assert 'Complete native/vendor redistribution assessment' in result['manifest']['pendingGates']
    assert result['manifest']['releaseGate']=='pending'


def test_project_license_absence_preserves_historical_pending_state(build_inputs,tmp_path):
    repo,prepared=build_inputs;output=tmp_path/'candidate'
    result=builder.build(repo,prepared,output,tmp_path/'candidate.zip')
    assert result['manifest']['licensingMaterial'].get('projectLicense') is None
    assert not (output/'LICENSE').exists()
    assert 'No project LICENSE is adopted' in (output/'notices/README.txt').read_text()
    assert 'Owner MIT/contributor/all-four-media rights' in result['manifest']['pendingGates']


@pytest.mark.parametrize('autocrlf',['false','true','input'])
def test_project_license_git_checkout_preserves_approved_bytes(build_inputs,autocrlf):
    repo,_=build_inputs;commit_project_license(repo)
    path=repo/'unity/com.emotecap.mocap/LICENSE.md';path.parent.mkdir(parents=True)
    path.write_bytes((ROOT/'LICENSE').read_bytes())
    git(repo,'add','.');git(repo,'commit','-qm','standalone package MIT')
    git(repo,'config','core.autocrlf',autocrlf)
    (repo/'LICENSE').unlink();path.unlink()
    git(repo,'checkout-index','--force','--all')
    assert (repo/'LICENSE').read_bytes()==(ROOT/'LICENSE').read_bytes()
    assert path.read_bytes()==(ROOT/'LICENSE').read_bytes()


def test_project_license_noncanonical_text_is_rejected(build_inputs,tmp_path):
    repo,prepared=build_inputs;commit_project_license(repo,b'MIT plus unapproved changed terms')
    with pytest.raises(files.PackageError):builder.build(repo,prepared,tmp_path/'candidate',tmp_path/'candidate.zip')
    assert not (tmp_path/'candidate').exists() and not (tmp_path/'candidate.zip.receipt.json').exists()


def test_project_license_ignored_by_git_is_rejected(build_inputs,tmp_path):
    repo,prepared=build_inputs
    with (repo/'.gitignore').open('a') as ignore:ignore.write('LICENSE\n')
    git(repo,'add','.gitignore');git(repo,'commit','-qm','ignored license fixture')
    (repo/'LICENSE').write_bytes((ROOT/'LICENSE').read_bytes())
    assert git(repo,'status','--porcelain')==''
    with pytest.raises(files.PackageError):builder.build(repo,prepared,tmp_path/'candidate',tmp_path/'candidate.zip')
    assert not (tmp_path/'candidate').exists()


def test_project_license_changed_after_notice_validation_is_rejected(build_inputs,tmp_path,monkeypatch):
    repo,prepared=build_inputs;commit_project_license(repo)
    original=builder.copy_notices
    def change(snapshot,staged,material,head):
        result=original(snapshot,staged,material,head)
        (snapshot/'LICENSE').write_bytes(b'changed after admission')
        return result
    monkeypatch.setattr(builder,'copy_notices',change)
    with pytest.raises(files.PackageError):builder.build(repo,prepared,tmp_path/'candidate',tmp_path/'candidate.zip')
    assert not (tmp_path/'candidate').exists() and not (tmp_path/'candidate.zip.receipt.json').exists()


def test_project_license_missing_from_committed_snapshot_cannot_downgrade(build_inputs,tmp_path,monkeypatch):
    repo,prepared=build_inputs;commit_project_license(repo)
    original=builder.validate_notices
    def drop(snapshot,prepared,public):
        (snapshot/'LICENSE').unlink()
        return original(snapshot,prepared,public)
    monkeypatch.setattr(builder,'validate_notices',drop)
    with pytest.raises(files.PackageError):builder.build(repo,prepared,tmp_path/'candidate',tmp_path/'candidate.zip')
    assert not (tmp_path/'candidate').exists() and not (tmp_path/'candidate.zip.receipt.json').exists()


def test_project_license_dropped_from_archive_is_rejected(build_inputs,tmp_path,monkeypatch):
    repo,prepared=build_inputs;commit_project_license(repo)
    original=builder.zip_payload
    def drop(staged,archive,**options):
        if (staged/'LICENSE').exists():(staged/'LICENSE').unlink()
        return original(staged,archive,**options)
    monkeypatch.setattr(builder,'zip_payload',drop)
    with pytest.raises(files.PackageError):builder.build(repo,prepared,tmp_path/'candidate',tmp_path/'candidate.zip')
    assert not (tmp_path/'candidate').exists() and not (tmp_path/'candidate.zip.receipt.json').exists()

@pytest.mark.parametrize('change',['missing-index','text','source-pin','extra-text','case-duplicate',
    'traversal','approved','unreferenced','native','wasm','extra-wasm','binary'])
def test_invalid_notice_material_is_rejected_before_complete_candidate(build_inputs,tmp_path,change):
    repo,prepared=build_inputs;index=repo/'third_party/inventory.json'
    value=json.loads(index.read_bytes());notice=repo/'third_party/licenses/owned/LICENSE'
    if change=='missing-index':index.unlink()
    elif change=='text':notice.write_bytes(b'changed but source-committed')
    elif change=='extra-text':(notice.parent/'extra.txt').write_text('extra')
    elif change=='wasm':(repo/'web/dist/mediapipe/wasm/vision.wasm').write_bytes(b'changed')
    elif change=='extra-wasm':(repo/'web/dist/mediapipe/wasm/extra.wasm').write_bytes(b'owned unrecorded SDK')
    else:
        if change=='source-pin':value['context']['sourceLockSha256']['web/package-lock.json']='0'*64
        elif change=='case-duplicate':value['files'].append({**value['files'][0],'path':'licenses/OWNED/LICENSE'})
        elif change=='traversal':value['files'][0]['path']='licenses/../outside/LICENSE'
        elif change=='approved':value['assessment']='approved'
        elif change=='unreferenced':value['components'][0]['suppliedLicenses']=[]
        elif change=='native':value['nativeBinaryFiles']=[{'path':'deps/fake.dll','size':1,'sha256':'0'*64}]
        elif change=='binary':
            notice.write_bytes(b'\0owned binary')
            value['files'][0].update(size=notice.stat().st_size,sha256=files.sha256_file(notice))
        index.write_text(json.dumps(value),encoding='utf-8')
    git(repo,'add','.')
    if git(repo,'status','--porcelain'):git(repo,'commit','-qm','owned invalid material')
    output=tmp_path/'candidate'
    with pytest.raises(files.PackageError):builder.build(repo,prepared,output,tmp_path/'candidate.zip')
    assert not output.exists() and not (tmp_path/'candidate.zip.receipt.json').exists()

def test_two_builds_have_identical_zip_bytes(build_inputs,tmp_path):
    repo,prepared=build_inputs
    one=builder.build(repo,prepared,tmp_path/'one',tmp_path/'one.zip')
    two=builder.build(repo,prepared,tmp_path/'two',tmp_path/'two.zip')
    assert one['archiveSha256']==two['archiveSha256']
    assert (tmp_path/'one.zip').read_bytes()==(tmp_path/'two.zip').read_bytes()

@pytest.mark.parametrize('autocrlf',['false','true','input'])
def test_candidate_is_source_linked_private_free_and_pending(build_inputs,tmp_path,autocrlf):
    repo,prepared=build_inputs
    git(repo,'config','core.autocrlf',autocrlf)
    result=builder.build(repo,prepared,tmp_path/'candidate',tmp_path/'candidate.zip')
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

def test_development_contract_fixtures_are_not_runtime_payload(build_inputs,tmp_path):
    repo,prepared=build_inputs;fixture=repo/'contracts/fixtures';fixture.mkdir()
    (fixture/'make_fixtures.py').write_text('developer fixture generator')
    (fixture/'sample-project.emotecap').write_bytes(b'synthetic development fixture')
    git(repo,'add','.');git(repo,'commit','-qm','development fixtures')
    builder.build(repo,prepared,tmp_path/'output',tmp_path/'output.zip')
    assert (tmp_path/'output/app/contracts/bones.json').exists()
    assert not (tmp_path/'output/app/contracts/fixtures').exists()

def test_zip_uses_fixed_level_nine(tmp_path,monkeypatch):
    import zlib
    source=tmp_path/'source';source.mkdir();(source/'normal').write_bytes(b'normal'*100)
    original=zlib.compressobj;levels=[]
    def selected(level,*a,**kw):levels.append(level);return original(level,*a,**kw)
    monkeypatch.setattr(zlib,'compressobj',selected)
    files.zip_payload(source,tmp_path/'fixed.zip')
    assert levels==[9]

def test_parent_segments_cannot_put_archive_inside_candidate(build_inputs,tmp_path):
    repo,prepared=build_inputs;(tmp_path/'side').mkdir()
    output=tmp_path/'candidate';archive=tmp_path/'side/../candidate/candidate.zip'
    with pytest.raises(files.PackageError):builder.build(repo,prepared,output,archive)
    assert not output.exists()

def test_ntfs_stream_is_not_a_new_ordinary_archive(tmp_path):
    source=tmp_path/'source';source.mkdir();(source/'normal').write_bytes(b'normal')
    host=tmp_path/'existing-host-file.txt';host.write_bytes(b'keep')
    stream=Path(str(host)+':candidate.zip')
    with pytest.raises(files.PackageError):files.zip_payload(source,stream)
    assert host.read_bytes()==b'keep' and not stream.exists()

@pytest.mark.parametrize('failure',['missing-zip-parent','zip','receipt'])
def test_late_build_failure_never_publishes_a_complete_candidate(build_inputs,tmp_path,monkeypatch,failure):
    repo,prepared=build_inputs;output=tmp_path/'candidate';archive=tmp_path/'candidate.zip'
    if failure=='missing-zip-parent':archive=tmp_path/'absent/candidate.zip'
    elif failure=='zip':
        def failed(*a,**kw):raise files.PackageError('Synthetic ZIP failure')
        monkeypatch.setattr(builder,'zip_payload',failed)
    else:
        original=builder.write_json
        def failed(path,value):
            if path.name.endswith('.receipt.json'):raise files.PackageError('Synthetic receipt failure')
            return original(path,value)
        monkeypatch.setattr(builder,'write_json',failed)
    with pytest.raises(files.PackageError):builder.build(repo,prepared,output,archive)
    assert not output.exists(), 'Failed build published its consumer-visible candidate directory'
    staged=next(tmp_path.glob('candidate.build-*/candidate.staged'))
    assert (staged/'.incomplete').is_file()
