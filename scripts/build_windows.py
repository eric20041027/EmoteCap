"""Build a source-linked internal Windows candidate; never publish."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
import uuid
import zipfile

from package_files import (MAX_MANIFEST_BYTES, MAX_TOTAL_BYTES, PackageError, copy_tree, extract_tar,
                          file_inventory, ordinary_path, safe_name, sha256_file, verify_inventory,
                          write_json, zip_payload,MAX_FILE_BYTES,MAX_FILES)
from package_notices import copy_notices, validate_notices

PENDING_GATES = ['Owner MIT/contributor/all-four-media rights','Complete native/vendor redistribution assessment',
    'Actual SDK inference/network qualification',
    'Actual Unity receiver compilation and two redistributable rigs','Authorized physical capture qualification',
    'Target-laptop performance qualification','Actual clean-machine startup','Five new Unity users acceptance',
    'Owner-approved public source/tag/release']
ARCHIVE_PATHS = ['server/emotecap_server','server/blender','contracts/bones.json','packaging/windows',
    'packaging/python-runtime.json','server/uv.lock','server/pyproject.toml','web/package-lock.json',
    'web/scripts/mediapipe-assets.json','third_party/inventory.json','third_party/licenses']
PUBLIC_PREFIXES = {'assets','models','mediapipe','samples'}
PUBLIC_SUFFIXES = {'.js','.mjs','.css','.wasm','.task','.emotecap','.png','.jpg','.jpeg','.svg','.woff','.woff2'}


def _json(path: Path) -> dict:
    ordinary_path(path)
    if not path.is_file() or path.stat().st_size > MAX_MANIFEST_BYTES:
        raise PackageError('Required package metadata is missing or oversized')
    return json.loads(path.read_bytes())


def _git(repo: Path, *args: str) -> bytes:
    try:
        result = subprocess.run(['git','-C',str(repo),*args],stdout=subprocess.PIPE,
                                stderr=subprocess.DEVNULL,timeout=60)
        if result.returncode or len(result.stdout)>MAX_MANIFEST_BYTES:
            raise PackageError('Cannot read clean committed source metadata')
        return result.stdout
    except (OSError, subprocess.TimeoutExpired):
        raise PackageError('Git source inspection did not complete') from None


def _validate_public(public: Path, assets: list[dict]) -> list[dict]:
    inventory = file_inventory(public)
    if not any(entry['path']=='index.html' for entry in inventory):
        raise PackageError('Production Web build is missing its index')
    for entry in inventory:
        name = entry['path']
        if name=='index.html':
            continue
        parts = name.split('/')
        if parts[0] not in PUBLIC_PREFIXES or Path(name).suffix.lower() not in PUBLIC_SUFFIXES or any(part.startswith('.') for part in parts):
            raise PackageError('Web build contains an unsupported/private file')
    if not isinstance(assets,list) or not 1<=len(assets)<=16:
        raise PackageError('Model asset pins are invalid')
    for asset in assets:
        name = safe_name(asset['file'])
        if '/' in name or sha256_file(public/'models'/name)!=asset['sha256']:
            raise PackageError('Web model asset failed its committed SHA256 pin')
    return inventory


def _verify_archive(path: Path, expected: list[dict]) -> str:
    ordinary_path(path)
    if not path.is_file() or path.stat().st_nlink!=1 or path.stat().st_size>MAX_TOTAL_BYTES:
        raise PackageError('Completed package archive is not a bounded ordinary file')
    records={entry['path']:entry for entry in expected}
    if len(records)!=len(expected) or len(records)>MAX_FILES:raise PackageError('Frozen package inventory is ambiguous')
    try:
        with zipfile.ZipFile(path) as archive:
            entries=archive.infolist()
            if [entry.filename for entry in entries]!=sorted(records):raise PackageError('Archive differs from the frozen package paths')
            for entry in entries:
                record=records[entry.filename]
                if entry.is_dir() or entry.flag_bits&1 or entry.file_size!=record['size'] or entry.file_size>MAX_FILE_BYTES:
                    raise PackageError('Archive member differs from the frozen package record')
                digest=hashlib.sha256();count=0
                with archive.open(entry) as incoming:
                    while chunk:=incoming.read(min(1024*1024,record['size']-count+1)):
                        count+=len(chunk)
                        if count>record['size']:raise PackageError('Archive member exceeds its frozen size')
                        digest.update(chunk)
                if count!=record['size'] or digest.hexdigest()!=record['sha256']:
                    raise PackageError('Archive bytes differ from admitted source/payload/notices')
        digest=hashlib.sha256()
        with path.open('rb') as incoming:
            while chunk:=incoming.read(1024*1024):digest.update(chunk)
        return digest.hexdigest()
    except (OSError,ValueError,RuntimeError,zipfile.BadZipFile,NotImplementedError):
        raise PackageError('Completed archive does not match the frozen admitted package') from None

def build(repo: Path, prepared: Path, destination: Path, archive: Path) -> dict:
    repo=ordinary_path(repo);prepared=ordinary_path(prepared)
    destination=ordinary_path(destination);archive=ordinary_path(archive)
    receipt_path=archive.with_name(archive.name+'.receipt.json')
    ordinary_path(receipt_path)
    if destination.exists() or archive.exists() or receipt_path.exists() or archive.is_relative_to(destination):
        raise PackageError('Choose fresh separate candidate/archive outputs')
    try:
        if _git(repo,'status','--porcelain','-z','--untracked-files=normal'):
            raise PackageError('Commit/review the source first; candidate builds require a clean checkout')
        head=_git(repo,'rev-parse','HEAD').decode('ascii').strip()
        if not re.fullmatch('[0-9a-f]{40}',head):
            raise PackageError('Source HEAD is not a fixed commit')
        receipt=_json(prepared/'prepared.json')
        if receipt.get('schema')!='emotecap-prepared-windows-v1' or receipt.get('releaseGate')!='pending':
            raise PackageError('Unsupported or falsely approved preparation')
        verify_inventory(prepared/'payload',receipt['files'])
        for name in ('pyproject.toml','uv.lock'):
            if sha256_file(repo/'server'/name)!=receipt['serverSourceHashes'][name]:
                raise PackageError('Prepared dependencies do not match this committed server lock')
        if _json(repo/'packaging/python-runtime.json')!=receipt['runtime']:
            raise PackageError('Prepared runtime pins do not match the source')
        public_inventory=_validate_public(repo/'web/dist',_json(repo/'web/scripts/mediapipe-assets.json'))
        work=destination.with_name(destination.name+'.build-'+str(uuid.uuid4()))
        ordinary_path(work);work.mkdir(parents=True)
        source_archive=work/'source.tar'
        rust_source='third_party/rust-source-evidence.json'
        rust_tracked=_git(repo,'ls-files','-z','--',rust_source)
        if rust_tracked not in (b'',(rust_source+'\0').encode()):raise PackageError('Rust source path is ambiguous')
        archive_paths=ARCHIVE_PATHS+([rust_source] if rust_tracked else [])
        with source_archive.open('xb') as output:
            result=subprocess.run(['git','-C',str(repo),'archive','--format=tar',head,*archive_paths],
                stdout=output,stderr=subprocess.DEVNULL,timeout=60)
        if result.returncode or source_archive.stat().st_size>MAX_TOTAL_BYTES:
            raise PackageError('Fixed source archive is incomplete or oversized')
        snapshot=work/'source';extract_tar(source_archive,snapshot)
        snapshot_files=file_inventory(snapshot)
        for entry in snapshot_files:
            name=entry['path']
            if name.startswith(('server/emotecap_server/','server/blender/')) and not name.endswith('.py'):
                raise PackageError('Server source allowlist contains an unsupported file')
            if name.startswith('contracts/') and Path(name).suffix not in ('.json','.md'):
                raise PackageError('Contract source allowlist contains an unsupported file')
            if any(part.startswith('.') or part=='__pycache__' for part in name.split('/')):
                raise PackageError('Fixed source archive contains private/cache files')
        staged=work/'candidate.staged'
        material=validate_notices(snapshot,prepared,public_inventory)
        copy_tree(prepared/'payload',staged)
        incomplete=staged/'.incomplete'
        with incomplete.open('xb') as marker:
            marker.write(b'Build incomplete: archive and receipt must succeed before publication.\n')
        marker_record={'path':'.incomplete','size':incomplete.stat().st_size,'sha256':sha256_file(incomplete)}
        frozen=[dict(entry) for entry in receipt['files']]
        for name in ('server/emotecap_server','server/blender','contracts'):
            frozen.extend({**entry,'path':'app/'+entry['path']} for entry in snapshot_files if entry['path'].startswith(name+'/'))
        frozen.extend({**entry,'path':'app/web/dist/'+entry['path']} for entry in public_inventory)
        source_records={entry['path']:entry for entry in snapshot_files}
        for name in ('server/emotecap_server','server/blender','contracts'):
            copy_tree(snapshot/name,staged/'app'/name)
        copy_tree(repo/'web/dist',staged/'app/web/dist')
        verify_inventory(staged/'app/web/dist',public_inventory)
        licensing_summary=copy_notices(snapshot,staged,material,head)
        frozen.extend({**entry,'path':'notices/'+entry['path']} for entry in material['noticeFiles'])
        for name in ('bootstrap.py','start.cmd','START-HERE.txt'):
            source=snapshot/'packaging/windows'/name
            with source.open('rb') as incoming,(staged/name).open('xb') as output:
                output.write(incoming.read())
            frozen.append({**source_records['packaging/windows/'+name],'path':name})
        if _git(repo,'rev-parse','HEAD').decode('ascii').strip()!=head or _git(repo,'status','--porcelain','-z','--untracked-files=normal'):
            raise PackageError('Source checkout changed during candidate construction')
        locks={name:sha256_file(snapshot/name) for name in ('server/uv.lock','server/pyproject.toml','web/package-lock.json')}
        frozen=sorted(frozen,key=lambda entry:entry['path'])
        verify_inventory(staged,[*frozen,marker_record])
        manifest={'schema':'emotecap-windows-candidate-v1','platform':'windows11-x64','sourceCommit':head,
            'runtime':receipt['runtime'],'sourceLocks':locks,'licensingMaterial':licensing_summary,
            'webBuildSha256':hashlib.sha256(json.dumps(public_inventory,sort_keys=True,separators=(',',':')).encode()).hexdigest(),
            'files':frozen,
            'releaseGate':'pending','pendingGates':PENDING_GATES}
        write_json(staged/'manifest.json',manifest)
        manifest_path=staged/'manifest.json'
        manifest_record={'path':'manifest.json','size':manifest_path.stat().st_size,'sha256':sha256_file(manifest_path)}
        completed_files=[*frozen,manifest_record]
        verify_inventory(staged,[*completed_files,marker_record])
        archive_sha=zip_payload(staged,archive,omit_incomplete_marker=True)
        if _verify_archive(archive,completed_files)!=archive_sha:raise PackageError('Archive digest changed after construction')
        verify_inventory(staged,[*completed_files,marker_record])
        result={'manifest':manifest,'archiveSha256':archive_sha,'archiveBytes':archive.stat().st_size}
        write_json(receipt_path,{'schema':'emotecap-candidate-receipt-v1','sourceCommit':head,
            'archiveSha256':archive_sha,'archiveBytes':result['archiveBytes'],'releaseGate':'pending'})
        # Both resolved endpoints are confined to the caller's selected parent
        # before the owned recursive directory move. Never replace an output.
        ordinary_path(work);ordinary_path(destination.parent)
        if staged.resolve().parent!=work.resolve() or destination.exists() or destination.resolve().parent!=work.resolve().parent:
            raise PackageError('Candidate publication target changed or already exists')
        staged.rename(destination)
        (destination/'.incomplete').unlink()
        return result
    except (OSError,ValueError,KeyError,TypeError,subprocess.TimeoutExpired):
        raise PackageError('Candidate is incomplete; preserve partial outputs and inspect the selected inputs') from None

def main(argv=None) -> int:
    parser=argparse.ArgumentParser(description='Build a local internal Windows candidate; no publication')
    for name in ('repo','prepared','output','zip'):parser.add_argument('--'+name,type=Path,required=True)
    args=parser.parse_args(argv)
    try:
        result=build(args.repo,args.prepared,args.output,args.zip)
        print(json.dumps({'status':'built-local-development-candidate','sourceCommit':result['manifest']['sourceCommit'],
            'files':len(result['manifest']['files']),'archiveBytes':result['archiveBytes'],
            'archiveSha256':result['archiveSha256'],'releaseGate':'pending'}))
        return 0
    except PackageError as error:
        print(str(error),file=sys.stderr);return 1

if __name__=='__main__':raise SystemExit(main())
