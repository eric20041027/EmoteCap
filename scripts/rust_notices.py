"""Bound recipient source evidence; never execute or fetch dependencies."""
import hashlib
import json
from pathlib import Path
import re
import tomllib
from urllib.parse import urlsplit

from package_files import PackageError,ordinary_path,safe_name,sha256_file

DATA_PATH='rust-source-evidence.json'
MAX_JSON=2*1024*1024
NATIVE={
    'cryptography':('50.0.1','deps/cryptography/hazmat/bindings/_rust.pyd'),
    'pydantic-core':('2.46.5','deps/pydantic_core/_pydantic_core.cp312-win_amd64.pyd'),
    'watchfiles':('1.3.0','deps/watchfiles/_rust_notify.pyd'),
}
ROOT_LICENSES={'LICENSE-MIT','LICENSE-APACHE','COPYRIGHT'}

def _fields(value,names):
    if not isinstance(value,dict) or set(value)!=set(names):raise PackageError('Invalid Rust source-evidence fields')

def _list(value,limit,minimum=0):
    if not isinstance(value,list) or not minimum<=len(value)<=limit:raise PackageError('Rust source-evidence count exceeds its bounds')
    return value

def _string(value,limit=240):
    if not isinstance(value,str) or not value or len(value)>limit or any(ord(c)<32 for c in value):
        raise PackageError('Invalid Rust source-evidence string')
    return value

def _digest(value,length=64):
    if not isinstance(value,str) or not re.fullmatch('[0-9a-f]{'+str(length)+'}',value):raise PackageError('Invalid Rust source-evidence digest')

def _size(value,limit):
    if type(value) is not int or not 0<=value<=limit:raise PackageError('Invalid Rust source-evidence size')

def _record(value,path_key='path',limit=MAX_JSON):
    _fields(value,(path_key,'size','sha256'));safe_name(value[path_key]);_size(value['size'],limit);_digest(value['sha256'])

def _read(path):
    path=ordinary_path(path)
    if not path.is_file() or path.stat().st_nlink!=1 or path.stat().st_size>MAX_JSON:raise PackageError('Rust input is not a bounded ordinary file')
    with path.open('rb') as source:data=source.read(MAX_JSON+1)
    if len(data)>MAX_JSON:raise PackageError('Rust input grew beyond its budget')
    return data

def _pairs(pairs):
    result={}
    for key,value in pairs:
        if key in result:raise PackageError('Duplicate Rust JSON key')
        result[key]=value
    return result

def _artifact(value):
    if not isinstance(value,dict) or set(value)-{'url','hash','size','upload-time'} or not {'url','hash','size'}<=set(value):
        raise PackageError('Invalid frozen Rust source artifact')
    url=_string(value['url'],2048);parts=urlsplit(url)
    if parts.scheme!='https' or parts.netloc!='files.pythonhosted.org' or not parts.path.startswith('/packages/') or parts.query or parts.fragment:
        raise PackageError('Rust source artifact has an unexpected URL')
    if not isinstance(value['hash'],str) or not value['hash'].startswith('sha256:'):raise PackageError('Rust source artifact has no SHA256')
    _digest(value['hash'][7:]);_size(value['size'],32*1024*1024)
    return {key:value[key] for key in ('url','hash','size')}

def validate_rust_notices(components,receipt,payload,material,license_records,source_lock,receipt_sha256):
    try:
        payload=ordinary_path(payload);material=ordinary_path(material);path=ordinary_path(material/DATA_PATH)
        owners=[c for c in components if 'rustSourceEvidence' in c]
        if not owners and not path.exists():
            return {'dataFile':None,'text':'','summary':{'rustSourceCrates':0,'rustLicensingTexts':0,'rustNativeBindings':0,'rustManifestOnlyCrates':0}}
        if len(owners)!=1:raise PackageError('Rust source evidence has no unique owning component')
        owner=owners[0]
        if owner.get('name')!='Rust source licensing evidence' or owner.get('kind')!='native-source-evidence':
            raise PackageError('Rust source evidence has an unexpected owner')
        descriptor=owner['rustSourceEvidence'];_record(descriptor)
        if descriptor['path']!=DATA_PATH:raise PackageError('Unexpected Rust source-evidence file location')
        raw=_read(path)
        if len(raw)!=descriptor['size'] or hashlib.sha256(raw).hexdigest()!=descriptor['sha256']:
            raise PackageError('Rust source-evidence bytes changed')
        data=json.loads(raw.decode('utf-8'),object_pairs_hook=_pairs)
        _fields(data,('schema','assessment','context','scope','binaryDependencyEnumerationComplete','candidateIntegrationComplete',
            'projectLicenseApproved','packages','compilerSourceFiles','registryCrates','summary'))
        if data['schema']!='emotecap-rust-source-evidence-v1' or data['assessment']!='source-material-collected-not-redistribution-approval':
            raise PackageError('Unsupported Rust source assessment')
        if data['binaryDependencyEnumerationComplete'] is not False or data['projectLicenseApproved'] is not False or data['candidateIntegrationComplete'] is not True:
            raise PackageError('Rust delivery cannot confer binary or licensing approval')
        scope=_string(data['scope'],1024)
        if not scope.startswith('Superset of ') or not scope.endswith('includes build, development and other-target dependencies.'):
            raise PackageError('Rust source-superset scope must remain explicit')
        context=data['context'];_fields(context,('inspectionSourceCommit','serverUvLockSha256','preparedReceiptSha256'))
        _digest(context['inspectionSourceCommit'],40)
        locked_bytes=_read(source_lock)
        if context['serverUvLockSha256']!=hashlib.sha256(locked_bytes).hexdigest() or context['preparedReceiptSha256']!=receipt_sha256:
            raise PackageError('Rust source/prepared context is stale')
        frozen=tomllib.loads(locked_bytes.decode('utf-8'))
        inventory={entry['path']:entry for entry in receipt['files']}
        actual_native={name for _,name in NATIVE.values() if ordinary_path(payload/name).exists()}
        recorded_native={name for _,name in NATIVE.values() if name in inventory}
        if actual_native!=recorded_native:raise PackageError('Current Rust native paths differ from the receipt')
        bindings=set();package_names=set();tokens=set();commits=set();native_lines=[]
        for package in _list(data['packages'],3,1):
            _fields(package,('name','version','sourceArchive','officialWheel','nativeMembers','nativeMembersMatchOfficialWheel',
                'observedNativeCrateVersionTokens','compilerSourceCommits','sourceCargoLocks'))
            name=package['name']
            if name not in NATIVE or name in package_names or package['version']!=NATIVE[name][0] or package['nativeMembersMatchOfficialWheel'] is not True:
                raise PackageError('Rust native version/association requires reassessment')
            package_names.add(name)
            matches=[p for p in frozen['package'] if p['name']==name and p['version']==package['version']]
            if len(matches)!=1:raise PackageError('Rust source package is absent from the frozen lock')
            locked=matches[0]
            if _artifact(package['sourceArchive'])!=_artifact(locked['sdist']) or _artifact(package['officialWheel']) not in [_artifact(w) for w in locked['wheels']]:
                raise PackageError('Rust source/wheel artifact differs from the frozen lock')
            if not package['officialWheel']['url'].endswith('-win_amd64.whl'):raise PackageError('Rust source wheel is not Windows x64')
            members=_list(package['nativeMembers'],1,1)
            for member in members:
                _record(member,limit=64*1024*1024);native=member['path']
                if native!=NATIVE[name][1] or inventory.get(native)!=member or native in bindings:
                    raise PackageError('Rust native member differs from the prepared receipt')
                target=ordinary_path(payload/native)
                if not target.is_file() or target.stat().st_size!=member['size'] or sha256_file(target)!=member['sha256']:
                    raise PackageError('Rust native bytes changed')
                bindings.add(native);native_lines.append(f'{name} {package["version"]}: {native}; SHA256 {member["sha256"]}')
            observed=_list(package['observedNativeCrateVersionTokens'],256)
            if len(observed)!=len(set(observed)):raise PackageError('Duplicate observed Rust source token')
            for token in observed:tokens.add(_string(token))
            compiler_commits=_list(package['compilerSourceCommits'],4,1)
            if len(compiler_commits)!=len(set(compiler_commits)):raise PackageError('Duplicate Rust compiler association')
            for commit in compiler_commits:_digest(commit,40);commits.add(commit)
            for lock in _list(package['sourceCargoLocks'],8,1):
                _fields(lock,('member','registryPackages','sha256'));safe_name(lock['member']);_size(lock['registryPackages'],256);_digest(lock['sha256'])
        if bindings!=recorded_native:raise PackageError('Rust source declarations omit native members')
        owned=set(owner['suppliedLicenses']+owner.get('supplementaryLicenses',[]));expected_licenses={};source_lines=[]
        def licensing(name,entry):
            if name in expected_licenses or name not in owned:raise PackageError('Rust licensing ownership is missing or duplicated')
            target=license_records.get(name)
            if target is None or (target['size'],target['sha256'])!=(entry['size'],entry['sha256']):
                raise PackageError('Rust licensing record differs from source evidence')
            body=_read(material/name)
            if len(body)!=entry['size'] or hashlib.sha256(body).hexdigest()!=entry['sha256']:
                raise PackageError('Rust licensing bytes changed')
            expected_licenses[name]=entry
            if len(expected_licenses)>512 or sum(r['size'] for r in expected_licenses.values())>16*1024*1024:
                raise PackageError('Rust licensing material exceeds its aggregate budget')
        identities=set();crate_texts=manifest_only=0
        for crate in _list(data['registryCrates'],256,1):
            _fields(crate,('name','version','sourceArchiveUrl','sourceArchiveSha256','sourceLockReferences','declaredLicense',
                'declaredLicenseFile','collectionStatus','suppliedLicensingFiles'))
            name=_string(crate['name'],80);version=_string(crate['version'],80)
            if not re.fullmatch('[a-z0-9_-]+',name) or not re.fullmatch(r'[0-9]+(?:\.[0-9]+){2}(?:[-+][0-9A-Za-z.+-]+)?',version):
                raise PackageError('Invalid Rust source identity')
            identity=name+'-'+version
            if identity.casefold() in identities:raise PackageError('Duplicate Rust source identity')
            identities.add(identity.casefold());_digest(crate['sourceArchiveSha256'])
            if crate['sourceArchiveUrl']!=f'https://static.crates.io/crates/{name}/{identity}.crate':
                raise PackageError('Rust source archive URL does not correspond to its identity')
            terms=_string(crate['declaredLicense'],256)
            for reference in _list(crate['sourceLockReferences'],16,1):safe_name(_string(reference))
            declared=crate['declaredLicenseFile']
            if declared is not None:safe_name(_string(declared))
            records=_list(crate['suppliedLicensingFiles'],64)
            if crate['collectionStatus']=='source-manifest-only-no-supplied-license-text':
                if records:raise PackageError('Manifest-only Rust source unexpectedly supplies licensing text')
                manifest_only+=1
            elif crate['collectionStatus']!='collected' or not records:raise PackageError('Rust source licensing collection is incomplete')
            members=set()
            for entry in records:
                _record(entry,'archiveMember');member=entry['archiveMember']
                if not member.startswith(identity+'/') or member.casefold() in members:raise PackageError('Rust licensing archive member is foreign or duplicated')
                members.add(member.casefold());licensing('licenses/rust-crates/'+member,entry);crate_texts+=1
            if declared is not None and (identity+'/'+declared).casefold() not in members:
                raise PackageError('Rust declared licensing file is absent')
            locations=', '.join('third_party/licenses/rust-crates/'+entry['archiveMember'] for entry in records)
            source_lines.extend([f'{identity}: declared terms {terms}',f'Source archive: {crate["sourceArchiveUrl"]}',
                f'Source SHA256: {crate["sourceArchiveSha256"]}',f'Supplied licensing: {locations or "manifest declaration only; licensing text unresolved"}',''])
        if not {token.casefold() for token in tokens}<=identities:raise PackageError('Observed Rust source tokens are unrepresented')
        compiler_identities=set();root_licenses={commit:set() for commit in commits}
        for entry in _list(data['compilerSourceFiles'],40,1):
            _fields(entry,('commit','path','url','size','sha256'));_digest(entry['commit'],40)
            member=safe_name(entry['path']);_size(entry['size'],MAX_JSON);_digest(entry['sha256']);identity=(entry['commit'],member.casefold())
            if entry['commit'] not in commits or identity in compiler_identities:
                raise PackageError('Compiler source record is foreign or duplicated')
            compiler_identities.add(identity)
            if entry['url']!=f'https://raw.githubusercontent.com/rust-lang/rust/{entry["commit"]}/{member}':
                raise PackageError('Compiler source URL differs from its commit/path')
            if member in ROOT_LICENSES:
                root_licenses[entry['commit']].add(member)
                licensing('licenses/rust-standard-library/'+entry['commit']+'/'+member,entry)
        if any(names!=ROOT_LICENSES for names in root_licenses.values()):raise PackageError('Compiler licensing/copyright records are incomplete')
        if owned!=set(expected_licenses):raise PackageError('Rust source licensing references contain unrelated text')
        summary={'nativeExtensionsMatched':len(bindings),'nativeCrateVersionTokensMapped':len(tokens),'registrySourceArchivesVerified':len(identities),
            'suppliedLicensingTextsVerified':crate_texts,'sourceManifestsWithoutSuppliedLicenseText':manifest_only,
            'rustCompilerSourceFilesVerified':len(compiler_identities)}
        if data['summary']!=summary or any(type(v) is not int for v in data['summary'].values()):raise PackageError('Rust source summary differs from verified records')
        text=['EmoteCap Rust source access and supplied licensing evidence','',
            'This is a source-lock superset including build, development and other-target entries.',
            'Complete linked-component, native/SDK/Microsoft/owner redistribution assessment remains pending.',
            'These records do not adopt a project license or approve public release.','',*sorted(native_lines),'',*source_lines]
        for commit in sorted(commits):
            text.extend([f'Rust compiler/library source: https://github.com/rust-lang/rust/tree/{commit}',
                'Compiler terms/copyright: '+', '.join(f'third_party/licenses/rust-standard-library/{commit}/{name}' for name in sorted(ROOT_LICENSES)),''])
        return {'dataFile':descriptor,'text':'\n'.join(text),
            'summary':{'rustSourceCrates':len(identities),'rustLicensingTexts':len(expected_licenses),'rustNativeBindings':len(bindings),'rustManifestOnlyCrates':manifest_only}}
    except (OSError,ValueError,KeyError,TypeError,RecursionError):
        raise PackageError('Rust source, native or licensing evidence is incomplete or invalid') from None
