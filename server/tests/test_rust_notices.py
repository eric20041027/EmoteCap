"""Recipient Rust evidence must stay bound to source, native and license bytes."""
import copy
import hashlib
import json

import pytest

from test_windows_package import build_inputs,builder,files,git
import package_notices as notices

def write(path,value):
    path.write_text(json.dumps(value,sort_keys=True,indent=2)+'\n',encoding='utf-8',newline='\n')

def record(path,relative):
    return {'path':relative,'size':path.stat().st_size,'sha256':files.sha256_file(path)}

def refresh(repo,prepared,index,data):
    receipt=json.loads((prepared/'prepared.json').read_bytes())
    receipt['files']=files.file_inventory(prepared/'payload')
    receipt['serverSourceHashes']['uv.lock']=files.sha256_file(repo/'server/uv.lock')
    write(prepared/'prepared.json',receipt)
    digest=files.sha256_file(prepared/'prepared.json')
    index['context']['preparedReceiptSha256']=digest
    index['context']['sourceLockSha256']['server/uv.lock']=files.sha256_file(repo/'server/uv.lock')
    index['nativeBinaryFiles']=[r for r in receipt['files'] if r['path'].endswith('.pyd')]
    data['context']['preparedReceiptSha256']=digest
    data['context']['serverUvLockSha256']=files.sha256_file(repo/'server/uv.lock')
    save(repo,index,data)

def save(repo,index,data):
    path=repo/'third_party/rust-source-evidence.json';write(path,data)
    owner=next((c for c in index['components'] if 'rustSourceEvidence' in c),None)
    if owner:owner['rustSourceEvidence']=record(path,path.name)
    write(repo/'third_party/inventory.json',index)

@pytest.fixture
def rust_inputs(build_inputs):
    repo,prepared=build_inputs;index=json.loads((repo/'third_party/inventory.json').read_bytes())
    native=prepared/'payload/deps/watchfiles/_rust_notify.pyd';native.parent.mkdir();native.write_bytes(b'Owned nonexecutable Rust native fixture')
    source={'url':'https://files.pythonhosted.org/packages/owned/watchfiles-1.3.0.tar.gz','hash':'sha256:'+'a'*64,'size':123}
    wheel={'url':'https://files.pythonhosted.org/packages/owned/watchfiles-1.3.0-cp310-abi3-win_amd64.whl','hash':'sha256:'+'b'*64,'size':456}
    lock='[[package]]\nname = "watchfiles"\nversion = "1.3.0"\n'
    lock+='sdist = '+json.dumps(source).replace(': ',' = ')+'\nwheels = ['+json.dumps(wheel).replace(': ',' = ')+']\n'
    # TOML inline tables have bare keys, unlike JSON object keys.
    lock=lock.replace('"url"','url').replace('"hash"','hash').replace('"size"','size')
    (repo/'server/uv.lock').write_text(lock,encoding='utf-8',newline='\n')
    commit='1'*40;compiler=[];owned=[]
    def text(relative,body):
        target=repo/'third_party'/relative;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(body)
        index['files'].append({**record(target,relative),'origin':{'kind':'owned-fixture','input':relative}})
        owned.append(relative);return target
    license_path=text('licenses/rust-crates/owned-crate-1.0.0/LICENSE',b'Owned unchanged licensing terms\r\n')
    for name in ('LICENSE-MIT','LICENSE-APACHE','COPYRIGHT'):
        target=text('licenses/rust-standard-library/'+commit+'/'+name,('Owned compiler '+name+'\n').encode())
        compiler.append({'commit':commit,'path':name,'url':f'https://raw.githubusercontent.com/rust-lang/rust/{commit}/{name}',
            'size':target.stat().st_size,'sha256':files.sha256_file(target)})
    member={'archiveMember':'owned-crate-1.0.0/LICENSE','size':license_path.stat().st_size,'sha256':files.sha256_file(license_path)}
    data={'schema':'emotecap-rust-source-evidence-v1','assessment':'source-material-collected-not-redistribution-approval',
        'context':{'inspectionSourceCommit':git(repo,'rev-parse','HEAD'),'serverUvLockSha256':'','preparedReceiptSha256':''},
        'scope':'Superset of owned source locks; includes build, development and other-target dependencies.',
        'binaryDependencyEnumerationComplete':False,'candidateIntegrationComplete':True,'projectLicenseApproved':False,
        'packages':[{'name':'watchfiles','version':'1.3.0','sourceArchive':source,'officialWheel':wheel,
            'nativeMembers':[record(native,'deps/watchfiles/_rust_notify.pyd')],'nativeMembersMatchOfficialWheel':True,
            'observedNativeCrateVersionTokens':['owned-crate-1.0.0'],'compilerSourceCommits':[commit],
            'sourceCargoLocks':[{'member':'watchfiles-1.3.0/Cargo.lock','registryPackages':1,'sha256':'c'*64}]}],
        'compilerSourceFiles':compiler,
        'registryCrates':[{'name':'owned-crate','version':'1.0.0','sourceArchiveUrl':'https://static.crates.io/crates/owned-crate/owned-crate-1.0.0.crate',
            'sourceArchiveSha256':'d'*64,'sourceLockReferences':['watchfiles/watchfiles-1.3.0/Cargo.lock'],
            'declaredLicense':'(MIT OR Apache-2.0) AND Unicode-3.0','declaredLicenseFile':None,'collectionStatus':'collected','suppliedLicensingFiles':[member]}],
        'summary':{'nativeExtensionsMatched':1,'nativeCrateVersionTokensMapped':1,'registrySourceArchivesVerified':1,
            'suppliedLicensingTextsVerified':1,'sourceManifestsWithoutSuppliedLicenseText':0,'rustCompilerSourceFilesVerified':3}}
    index['components'].append({'name':'Rust source licensing evidence','kind':'native-source-evidence','version':'1',
        'status':'native-and-vendor-coverage-pending','suppliedLicenses':owned,'rustSourceEvidence':{}})
    index['files'].sort(key=lambda r:r['path']);refresh(repo,prepared,index,data)
    return repo,prepared,index,data

def validate(repo,prepared):return notices.validate_notices(repo,prepared,files.file_inventory(repo/'web/dist'))

def test_source_license_native_counts_and_recipient_bytes(rust_inputs,tmp_path):
    repo,prepared,_,data=rust_inputs;validated=validate(repo,prepared)
    assert {k:validated['summary'][k] for k in ('rustSourceCrates','rustLicensingTexts','rustNativeBindings','rustManifestOnlyCrates')}=={
        'rustSourceCrates':1,'rustLicensingTexts':4,'rustNativeBindings':1,'rustManifestOnlyCrates':0}
    staged=tmp_path/'staged';files.copy_tree(prepared/'payload',staged)
    notices.copy_notices(repo,staged,validated,git(repo,'rev-parse','HEAD'))
    assert (staged/'notices/third_party/rust-source-evidence.json').read_bytes()==(repo/'third_party/rust-source-evidence.json').read_bytes()
    notice=(staged/'notices/RUST-SOURCE-ACCESS.txt').read_text(encoding='utf-8')
    assert '(MIT OR Apache-2.0) AND Unicode-3.0' in notice and data['registryCrates'][0]['sourceArchiveUrl'] in notice
    assert 'source-lock superset' in notice and 'pending' in notice and 'RUST-SOURCE-ACCESS.txt' in (staged/'notices/README.txt').read_text()

@pytest.mark.parametrize('change',['missing-file','missing-owner','wrong-owned','native-bytes','native-record','false-approval',
    'false-coverage','false-delivery','duplicate-crate','case-crate','bad-source-url','bad-wheel-pin','bad-source-pin','stale-context',
    'member-traversal','member-case','duplicate-compiler','compiler-url','false-summary','manifest-only-with-text','many-crates',
    'many-packages','many-compiler','bool-size','license-hash','foreign-owner','unknown-field','bad-token'])
def test_invalid_rust_material_cannot_be_admitted(rust_inputs,change):
    repo,prepared,index,data=rust_inputs;crate=data['registryCrates'][0];package=data['packages'][0]
    if change=='missing-owner':index['components'][-1].pop('rustSourceEvidence')
    elif change=='wrong-owned':
        first=index['components'][0]['suppliedLicenses'][0];right=index['components'][-1]['suppliedLicenses'][0]
        index['components'][0]['suppliedLicenses']=[right];index['components'][-1]['suppliedLicenses'][0]=first
    elif change=='native-bytes':(prepared/'payload/deps/watchfiles/_rust_notify.pyd').write_bytes(b'Changed native after admission')
    elif change=='native-record':package['nativeMembers'][0]['sha256']='0'*64
    elif change=='false-approval':data['projectLicenseApproved']=True
    elif change=='false-coverage':data['binaryDependencyEnumerationComplete']=True
    elif change=='false-delivery':data['candidateIntegrationComplete']=False
    elif change=='duplicate-crate':data['registryCrates'].append(copy.deepcopy(crate))
    elif change=='case-crate':data['registryCrates'].append({**crate,'name':'OWNED-CRATE'})
    elif change=='bad-source-url':crate['sourceArchiveUrl']+='?private=owned'
    elif change=='bad-wheel-pin':package['officialWheel']['hash']='sha256:'+'e'*64
    elif change=='bad-source-pin':package['sourceArchive']['size']+=1
    elif change=='stale-context':data['context']['serverUvLockSha256']='0'*64
    elif change=='member-traversal':crate['suppliedLicensingFiles'][0]['archiveMember']='../outside/LICENSE'
    elif change=='member-case':crate['suppliedLicensingFiles'].append({**crate['suppliedLicensingFiles'][0],'archiveMember':'owned-crate-1.0.0/license'})
    elif change=='duplicate-compiler':data['compilerSourceFiles'].append(copy.deepcopy(data['compilerSourceFiles'][0]))
    elif change=='compiler-url':data['compilerSourceFiles'][0]['url']='https://example.invalid/unrelated'
    elif change=='false-summary':data['summary']['rustCompilerSourceFilesVerified']=2
    elif change=='manifest-only-with-text':crate['collectionStatus']='source-manifest-only-no-supplied-license-text'
    elif change=='many-crates':data['registryCrates']*=257
    elif change=='many-packages':data['packages']*=4
    elif change=='many-compiler':data['compilerSourceFiles']*=41
    elif change=='bool-size':crate['suppliedLicensingFiles'][0]['size']=True
    elif change=='license-hash':crate['suppliedLicensingFiles'][0]['sha256']='0'*64
    elif change=='foreign-owner':index['components'][-1]['suppliedLicenses']=[]
    elif change=='unknown-field':data['privateField']='owned'
    elif change=='bad-token':package['observedNativeCrateVersionTokens']=['absent-1.0.0']
    save(repo,index,data)
    if change=='missing-file':(repo/'third_party/rust-source-evidence.json').unlink()
    with pytest.raises(files.PackageError):validate(repo,prepared)

@pytest.mark.parametrize('change',['duplicate-json','deep-json','oversized-json'])
def test_unreadable_unbounded_metadata_is_rejected(rust_inputs,change):
    repo,prepared,index,_=rust_inputs;target=repo/'third_party/rust-source-evidence.json'
    target.write_bytes(b'{"schema":1,"schema":2}' if change=='duplicate-json' else b'['*1200+b']'*1200 if change=='deep-json' else b'x'*(2*1024*1024+1))
    index['components'][-1]['rustSourceEvidence']=record(target,target.name);write(repo/'third_party/inventory.json',index)
    with pytest.raises(files.PackageError):validate(repo,prepared)

@pytest.mark.parametrize('change',['metadata','prepared-native','staged-native','added-native'])
def test_copy_revalidates_current_metadata_and_native(rust_inputs,tmp_path,change):
    repo,prepared,_,_=rust_inputs;validated=validate(repo,prepared);staged=tmp_path/'staged';files.copy_tree(prepared/'payload',staged)
    if change=='metadata':target=repo/'third_party/rust-source-evidence.json'
    elif change=='added-native':
        target=staged/'deps/pydantic_core/_pydantic_core.cp312-win_amd64.pyd';target.parent.mkdir()
    else:target=(prepared/'payload' if change=='prepared-native' else staged)/'deps/watchfiles/_rust_notify.pyd'
    target.write_bytes(b'Owned change after admission')
    with pytest.raises(files.PackageError):notices.copy_notices(repo,staged,validated,git(repo,'rev-parse','HEAD'))

@pytest.mark.parametrize('autocrlf',['false','true','input'])
def test_builder_delivers_metadata_and_all_notices(rust_inputs,tmp_path,autocrlf):
    repo,prepared,_,_=rust_inputs
    git(repo,'config','core.autocrlf',autocrlf)
    git(repo,'add','.');git(repo,'commit','-qm','Owned Rust material')
    result=builder.build(repo,prepared,tmp_path/'candidate',tmp_path/'candidate.zip')
    assert result['manifest']['licensingMaterial']['rustNativeBindings']==1
    assert (tmp_path/'candidate/notices/third_party/rust-source-evidence.json').read_bytes()==(repo/'third_party/rust-source-evidence.json').read_bytes()
    assert (tmp_path/'candidate/notices/RUST-SOURCE-ACCESS.txt').is_file()


@pytest.mark.parametrize('changed',['native','license','metadata','rust-notice','readme'])
@pytest.mark.parametrize('interval',['after-copy','before-zip','after-zip'])
def test_builder_rejects_correspondence_changes_at_publication(rust_inputs,tmp_path,monkeypatch,changed,interval):
    repo,prepared,_,_=rust_inputs;git(repo,'add','.');git(repo,'commit','-qm','Owned Rust publication fixture')
    paths={'native':'deps/watchfiles/_rust_notify.pyd','license':'notices/third_party/licenses/rust-crates/owned-crate-1.0.0/LICENSE',
        'metadata':'notices/third_party/rust-source-evidence.json','rust-notice':'notices/RUST-SOURCE-ACCESS.txt','readme':'notices/README.txt'}
    def corrupt(staged):
        path=staged/paths[changed];path.write_bytes(path.read_bytes()+b'\nOwned late mutation\n')
    if interval=='after-copy':
        original=builder.copy_notices
        def copying(snapshot,staged,validated,commit):
            summary=original(snapshot,staged,validated,commit);corrupt(staged);return summary
        monkeypatch.setattr(builder,'copy_notices',copying)
    else:
        original=builder.zip_payload
        def zipping(staged,archive,**kwargs):
            if interval=='before-zip':corrupt(staged)
            digest=original(staged,archive,**kwargs)
            if interval=='after-zip':corrupt(staged)
            return digest
        monkeypatch.setattr(builder,'zip_payload',zipping)
    output=tmp_path/'candidate';archive=tmp_path/'candidate.zip'
    with pytest.raises(files.PackageError):builder.build(repo,prepared,output,archive)
    assert not output.exists() and not archive.with_suffix('.zip.receipt.json').exists()


@pytest.mark.parametrize('change',['unknown-reference','duplicate-reference','duplicate-project-lock','incorrect-count','omitted-unresolved'])
def test_source_lock_membership_cannot_be_forged_or_omitted(rust_inputs,tmp_path,change):
    repo,prepared,index,data=rust_inputs;crate=data['registryCrates'][0];package=data['packages'][0]
    missing=copy.deepcopy(crate)
    missing.update(name='owned-manifest-only',version='2.0.0',sourceArchiveUrl='https://static.crates.io/crates/owned-manifest-only/owned-manifest-only-2.0.0.crate',
        collectionStatus='source-manifest-only-no-supplied-license-text',suppliedLicensingFiles=[],declaredLicense='MPL-2.0')
    data['registryCrates'].append(missing);package['sourceCargoLocks'][0]['registryPackages']=2
    data['summary']['registrySourceArchivesVerified']=2;data['summary']['sourceManifestsWithoutSuppliedLicenseText']=1
    save(repo,index,data);control=validate(repo,prepared)['summary']
    assert control['rustSourceCrates']==2 and control['rustManifestOnlyCrates']==1
    if change=='unknown-reference':crate['sourceLockReferences']=['not-a-declared-package/not-a-lock']
    elif change=='duplicate-reference':crate['sourceLockReferences']*=2
    elif change=='duplicate-project-lock':package['sourceCargoLocks'].append(copy.deepcopy(package['sourceCargoLocks'][0]))
    elif change=='incorrect-count':package['sourceCargoLocks'][0]['registryPackages']=3
    else:
        data['registryCrates'].pop();data['summary']['registrySourceArchivesVerified']=1;data['summary']['sourceManifestsWithoutSuppliedLicenseText']=0
    save(repo,index,data);git(repo,'add','.');git(repo,'commit','-qm','Owned inconsistent source-lock fixture')
    output=tmp_path/'candidate';archive=tmp_path/'candidate.zip'
    with pytest.raises(files.PackageError):builder.build(repo,prepared,output,archive)
    assert not output.exists() and not archive.with_suffix('.zip.receipt.json').exists()
