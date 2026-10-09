"""Prepare owned, pinned Windows runtime inputs; no host installation."""
import argparse
from email.parser import BytesParser
import json
import os
import re
from pathlib import Path
import subprocess
import sys

from package_files import (MAX_MANIFEST_BYTES, PackageError, extract_tar, file_inventory,
                           ordinary_path, safe_name, sha256_file, write_json)

COMPANION_LICENSES = ('bdb','bzip2','cpython','expat','libX11','libXau','libedit','libffi',
    'liblzma','libuuid','libxcb','mpdecimal','ncurses','openssl-1.1','openssl-3','sqlite','tcl','tix','zlib')


def _run(command: list[str], environment: dict, logs: Path, *, timeout=60) -> bytes:
    selected = logs / f'{len(list(logs.glob("command-*.log"))):03d}'
    log = selected.with_name('command-' + selected.name + '.log')
    try:
        with log.open('xb') as output:
            result = subprocess.run(command, env=environment, stdout=output,
                                    stderr=subprocess.DEVNULL, timeout=timeout)
        if result.returncode != 0 or log.stat().st_size > MAX_MANIFEST_BYTES:
            raise PackageError('Owned preparation command failed; inspect the retained finite log')
        return log.read_bytes()
    except (OSError, subprocess.TimeoutExpired):
        raise PackageError('Owned preparation command could not complete') from None


def _pin_inputs(root: Path, cache: Path) -> dict:
    pin_path = ordinary_path(root / 'packaging/python-runtime.json')
    try:
        if pin_path.stat().st_size > MAX_MANIFEST_BYTES:
            raise PackageError('Runtime pins exceed their budget')
        pins = json.loads(pin_path.read_bytes())
        if (pins['version'], pins['build'], pins['target']) != ('3.12.14','20260825','x86_64-pc-windows-msvc'):
            raise PackageError('Unsupported portable runtime pin')
        for kind in ('runtime','full'):
            selected = pins[kind]
            name = safe_name(selected['file'])
            if '/' in name:
                raise PackageError('Runtime cache names must be ordinary basenames')
            path = ordinary_path(cache / name)
            if type(selected['size']) is not int or path.stat().st_size != selected['size'] or sha256_file(path) != selected['sha256']:
                raise PackageError('Runtime archive failed its size/SHA256 pin; preserve it and obtain the exact pinned input')
        return pins
    except (OSError, ValueError, KeyError, TypeError):
        raise PackageError('Cannot validate the runtime pins and both cached archives') from None


def _dependency_inventory(deps: Path) -> dict:
    payload = file_inventory(deps)
    distributions = []
    for info in sorted(deps.glob('*.dist-info')):
        metadata = BytesParser().parsebytes((info / 'METADATA').read_bytes())
        name = metadata.get('Name', '')
        version = metadata.get('Version', '')
        if not name or not version or name.casefold() in ('pytest','pluggy','iniconfig','pygments'):
            raise PackageError('Production dependency inventory is invalid or contains developer-only tools')
        supplied = [entry for entry in payload if entry['path'].startswith(info.name + '/') and
                    any(term in Path(entry['path']).name.upper() for term in ('LICENSE','NOTICE','COPYING'))]
        declaration = metadata.get('License-Expression') or metadata.get('License') or ''
        declaration = str(declaration)[:4096]
        distributions.append({'name': name, 'version': version, 'licenseDeclaration': declaration,
            'licenseFiles': supplied,
            'licensingStatus': 'supplied-files-not-assessed' if declaration and supplied else 'pending'})
    if not distributions:
        raise PackageError('No production wheel distributions were installed')
    return {'schema':'emotecap-python-dependencies-v1', 'distributions':distributions,
        'assessment':'Supplied package metadata/texts only. Native/transitive redistribution coverage remains pending.'}

def prepare(root: Path, cache: Path, destination: Path, uv: Path) -> dict:
    root = ordinary_path(root)
    cache = ordinary_path(cache)
    destination = ordinary_path(destination)
    if destination.exists():
        raise PackageError('Preparation exists; choose a fresh output folder')
    pins = _pin_inputs(root, cache)
    try:
        destination.mkdir(parents=True)
        logs = destination / 'logs'
        logs.mkdir()
        payload = destination / 'payload'
        payload.mkdir()
        environment = {key:value for key,value in os.environ.items() if not key.upper().startswith('UV_')}
        version = _run([str(uv), '--version'], environment, logs).decode('utf-8').strip()
        if not re.fullmatch(r'uv 0\.12\.6(?: \([^\r\n]*\))?', version):
            raise PackageError('Use the pinned developer uv0.12.6')
        extract_tar(cache / pins['runtime']['file'], payload / 'python', strip_prefix='python')
        tar = str(Path(environment.get('SystemRoot', r'C:\Windows')) / 'System32/tar.exe')
        full = str(cache / pins['full']['file'])
        metadata_bytes = _run([tar, '-xOf', full, 'python/PYTHON.json'], environment, logs)
        metadata = json.loads(metadata_bytes)
        if metadata.get('python_version') != pins['version'] or metadata.get('target_triple') != pins['target']:
            raise PackageError('Runtime metadata does not match the verified installation')
        notices = payload / 'notices/runtime'
        notices.mkdir(parents=True)
        write_json(notices / 'PYTHON.json', metadata)
        for component in COMPANION_LICENSES:
            name = f'LICENSE.{component}.txt'
            text = _run([tar, '-xOf', full, 'python/licenses/' + name], environment, logs)
            if not text:
                raise PackageError('A supplied runtime license text is missing')
            with (notices / name).open('xb') as output:
                output.write(text)
        snapshot = destination / 'source/server'
        snapshot.mkdir(parents=True)
        source_hashes = {}
        for name in ('pyproject.toml','uv.lock'):
            source = ordinary_path(root / 'server' / name)
            source_hashes[name] = sha256_file(source)
            with source.open('rb') as incoming, (snapshot / name).open('xb') as output:
                output.write(incoming.read())
        requirements = payload / 'requirements.txt'
        _run([str(uv),'export','--directory',str(snapshot),'--frozen','--no-dev','--no-emit-project',
              '--no-config','--no-header','--output-file',str(requirements)],environment,logs,timeout=120)
        python = payload / 'python/python.exe'
        deps = payload / 'deps'
        _run([str(uv),'pip','install','--python',str(python),'--target',str(deps),'--require-hashes',
              '--no-deps','--only-binary',':all:','--no-python-downloads','--no-config',
              '--link-mode','copy',
              '--default-index','https://pypi.org/simple','-r',str(requirements)],environment,logs,timeout=600)
        probe = ('import json,sys;sys.path=[p for p in sys.path if not p.replace("\\\\","/").lower().endswith("/site-packages")];'
                 'sys.path.insert(0,sys.argv[1]);import fastapi,uvicorn,google.genai,multipart,dotenv,ssl,sqlite3;'
                 'assert sys.version_info[:3]==(3,12,14);print(json.dumps({"python":"3.12.14","imports":"ok"}))')
        result = json.loads(_run([str(python),'-I','-S','-B','-c',probe,str(deps)],environment,logs))
        if result != {'python':'3.12.14','imports':'ok'}:
            raise PackageError('Portable production dependency imports were not qualified')
        write_json(payload / 'dependency-inventory.json', _dependency_inventory(deps))
        write_json(payload / 'runtime-source.json', pins)
        receipt = {'schema':'emotecap-prepared-windows-v1', 'runtime':pins, 'serverSourceHashes':source_hashes,
            'runtimeProbe':result, 'files':file_inventory(payload),
            'releaseGate':'pending', 'pending':['Complete native/vendor redistribution assessment','Owner rights and formal release acceptance']}
        write_json(destination / 'prepared.json', receipt)
        return receipt
    except (OSError, ValueError, KeyError, TypeError):
        raise PackageError('Preparation is incomplete; preserve this partial output and choose a new folder for retry') from None

def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description='Prepare an owned pinned Windows development runtime candidate')
    for flag in ('repo','cache','output','uv'):
        parser.add_argument('--'+flag, type=Path, required=True)
    args = parser.parse_args(argv)
    try:
        result = prepare(args.repo, args.cache, args.output, args.uv)
        print(json.dumps({'status':'prepared-development-inputs','files':len(result['files']),
                          'python':result['runtime']['version'],'releaseGate':'pending'}))
        return 0
    except PackageError as error:
        print(str(error), file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
