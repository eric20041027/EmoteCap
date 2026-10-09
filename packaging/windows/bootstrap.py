"""Isolated, stdlib-only entry for an internal Windows candidate."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import sys

PACKAGE_ROOT = Path(__file__).absolute().parent
MAX_FILES=20000
MAX_FILE_BYTES=64*1024*1024
MAX_TOTAL_BYTES=512*1024*1024
MAX_MANIFEST_BYTES=2*1024*1024

class PackageError(RuntimeError):
    """Incomplete internal candidate; do not import its application."""

def _ordinary(path):
    for selected in (*reversed(path.absolute().parents),path.absolute()):
        if selected.is_symlink() or getattr(selected,'is_junction',lambda:False)():
            raise PackageError('Linked package paths are unsupported')

def _name(name):
    if not isinstance(name,str) or not name or len(name)>240:
        raise PackageError('Invalid package path')
    for part in name.split('/'):
        if (not part or part in ('.','..') or part.endswith((' ','.')) or
            any(ord(c)<32 or c in '\\:*?"<>|' for c in part) or
            re.fullmatch(r'(CON|PRN|AUX|NUL|COM[1-9¹²³]|LPT[1-9¹²³])',part.split('.')[0].upper())):
            raise PackageError('Unsafe package path')
    return name

def _object(pairs):
    result={}
    for name,value in pairs:
        if name in result:raise PackageError('Duplicate manifest property')
        result[name]=value
    return result

def _constant(value):
    raise PackageError('Nonfinite manifest value')

def validate_package(root: Path) -> dict:
    root=root.absolute();_ordinary(root)
    manifest=root/'manifest.json';_ordinary(manifest)
    try:
        if (root/'.incomplete').exists():
            raise PackageError('Candidate build is incomplete')
        if not manifest.is_file() or manifest.stat().st_size>MAX_MANIFEST_BYTES:
            raise PackageError('Package manifest is missing or oversized')
        record=json.loads(manifest.read_bytes(),object_pairs_hook=_object,parse_constant=_constant)
        if (record.get('schema')!='emotecap-windows-candidate-v1' or record.get('platform')!='windows11-x64'
                or record.get('releaseGate')!='pending' or not re.fullmatch('[0-9a-f]{40}',record.get('sourceCommit',''))
                or not isinstance(record.get('pendingGates'),list) or len(record['pendingGates'])<6):
            raise PackageError('Unsupported or falsely approved development package')
        entries=record.get('files')
        if not isinstance(entries,list) or not 1<=len(entries)<=MAX_FILES:
            raise PackageError('Invalid bounded payload inventory')
        expected={};identities={};total=0
        for entry in entries:
            if not isinstance(entry,dict) or set(entry)!={'path','size','sha256'}:
                raise PackageError('Invalid package file record')
            name=_name(entry['path']);size=entry['size'];digest=entry['sha256']
            if name=='manifest.json' or name.casefold() in identities or type(size)is not int or not 0<=size<=MAX_FILE_BYTES or not isinstance(digest,str) or not re.fullmatch('[0-9a-f]{64}',digest):
                raise PackageError('Invalid duplicate/size/hash record')
            identities[name.casefold()]=name;expected[name]=entry;total+=size
        if total>MAX_TOTAL_BYTES:
            raise PackageError('Package exceeds its payload budget')
        required={'bootstrap.py','start.cmd','python/python.exe','app/server/emotecap_server/__init__.py',
            'app/server/emotecap_server/launcher.py','app/web/dist/index.html','app/contracts/bones.json'}
        if not required.issubset(expected):
            raise PackageError('Package is missing a required runtime/application file')
        actual=set();visited=0
        def failed_walk(error):raise error
        for directory,dirs,names in os.walk(root,followlinks=False,onerror=failed_walk):
            for name in dirs+names:
                selected=Path(directory)/name;_ordinary(selected)
                relative=_name(selected.relative_to(root).as_posix());info=selected.stat()
                visited+=1
                if visited>MAX_FILES*2:raise PackageError('Package contains too many entries')
                if stat.S_ISDIR(info.st_mode):continue
                if not stat.S_ISREG(info.st_mode) or info.st_nlink!=1:
                    raise PackageError('Package contains an unsupported file alias')
                if relative=='manifest.json':continue
                entry=expected.get(relative)
                if entry is None or info.st_size!=entry['size']:
                    raise PackageError('Package is missing/changed or contains extra files')
                digest=hashlib.sha256();count=0
                with selected.open('rb') as incoming:
                    while chunk:=incoming.read(min(1024*1024,entry['size']-count+1)):
                        count+=len(chunk)
                        if count>entry['size']:raise PackageError('Package changed during verification')
                        digest.update(chunk)
                if count!=entry['size'] or digest.hexdigest()!=entry['sha256']:
                    raise PackageError('Package file failed its SHA256 check')
                actual.add(relative)
        if actual!=set(expected):raise PackageError('Package is missing required inventory files')
        return record
    except (OSError,ValueError,TypeError,KeyError,AttributeError):
        raise PackageError('Cannot read a valid complete package manifest') from None

def main(argv=None) -> int:
    parser=argparse.ArgumentParser(description='Start the local development candidate',allow_abbrev=False)
    base=Path(os.getenv('LOCALAPPDATA',str(Path.home()/'AppData/Local')))/'EmoteCap'
    parser.add_argument('--data-dir',type=Path,default=base/'data')
    parser.add_argument('--env-file',type=Path,default=base/'settings.env')
    parser.add_argument('--port',default='8787')
    parser.add_argument('--blender')
    parser.add_argument('--no-browser',action='store_true')
    args=parser.parse_args(argv)
    try:
        validate_package(PACKAGE_ROOT)
        if any(selected.resolve().is_relative_to(PACKAGE_ROOT.resolve()) for selected in (args.data_dir,args.env_file)):
            raise PackageError('Choose private data and settings outside the verified package folder')
        if not sys.flags.isolated or not sys.flags.no_site or not sys.flags.dont_write_bytecode:
            raise PackageError('Use start.cmd to select the isolated site-disabled bundled runtime')
        sys.dont_write_bytecode=True
        sys.path=[path for path in sys.path if not path.replace('\\','/').lower().endswith('/site-packages')]
        sys.path[:0]=[str(PACKAGE_ROOT/'app/server'),str(PACKAGE_ROOT/'deps')]
        from emotecap_server.launcher import main as launch
        selected=['--web-dir',str(PACKAGE_ROOT/'app/web/dist'),'--data-dir',str(args.data_dir),
            '--env-file',str(args.env_file),'--port',args.port]
        if args.blender:selected+=['--blender',args.blender]
        if args.no_browser:selected+=['--no-browser']
        return launch(selected)
    except PackageError as error:
        print(f'EmoteCap package could not start: {error}. Obtain a complete verified candidate again.',file=sys.stderr)
        return 1

if __name__ == '__main__':
    raise SystemExit(main())
