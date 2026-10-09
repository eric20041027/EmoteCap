"""Packaged manifest rejection before application imports/private state."""
import importlib.util
import json
import os
import re
import subprocess
import sys
from pathlib import Path

import pytest

from test_windows_package import build_inputs
import build_windows as builder

ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('candidate_bootstrap',ROOT/'packaging/windows/bootstrap.py')
bootstrap=importlib.util.module_from_spec(spec);spec.loader.exec_module(bootstrap)

@pytest.fixture
def candidate(build_inputs,tmp_path):
    repo,prepared=build_inputs;root=tmp_path/'package with 空白'
    builder.build(repo,prepared,root,tmp_path/'package.zip')
    return root

def test_valid_package_accepts_complete_inventory(candidate):
    assert bootstrap.validate_package(candidate)['schema']=='emotecap-windows-candidate-v1'

@pytest.mark.parametrize('change',['changed','extra','missing','duplicate','unsafe','invalid-size','wrong-schema','approved-release'])
def test_invalid_package_fails_integrity_before_app_import(candidate,change):
    manifest=candidate/'manifest.json';record=json.loads(manifest.read_bytes())
    if change=='changed': (candidate/'app/server/emotecap_server/__init__.py').write_text('changed')
    elif change=='extra': (candidate/'private.env').write_text('private')
    elif change=='missing': (candidate/'python/python.exe').unlink()
    elif change=='duplicate': record['files'].append(record['files'][0])
    elif change=='unsafe': record['files'][0]['path']='../escape'
    elif change=='invalid-size': record['files'][0]['size']=True
    elif change=='wrong-schema': record['schema']='other'
    else: record['releaseGate']='approved'
    if change not in ('changed','extra','missing'):manifest.write_text(json.dumps(record))
    with pytest.raises(bootstrap.PackageError): bootstrap.validate_package(candidate)

def test_corrupt_package_main_never_creates_private_data(candidate,monkeypatch,capsys):
    (candidate/'app/web/dist/index.html').write_text('changed')
    monkeypatch.setattr(bootstrap,'PACKAGE_ROOT',candidate)
    data=candidate.parent/'private-data'
    assert bootstrap.main(['--data-dir',str(data),'--no-browser'])==1
    assert not data.exists() and 'ready at' not in capsys.readouterr().out

@pytest.mark.parametrize('option',['--web-dir','--web-dir=elsewhere','--web-d'])
def test_web_override_is_denied_before_import(candidate,monkeypatch,option):
    monkeypatch.setattr(bootstrap,'PACKAGE_ROOT',candidate)
    with pytest.raises(SystemExit) as failure: bootstrap.main([option])
    assert failure.value.code==2

def test_isolated_bootstrap_selects_private_paths_and_ignores_pythonpath(build_inputs,tmp_path):
    repo,prepared=build_inputs
    launcher=repo/'server/emotecap_server/launcher.py'
    launcher.write_text('import json,sys\ndef main(argv):\n print(json.dumps({"args":argv,"paths":sys.path}));return 0\n')
    subprocess.run(['git','-C',str(repo),'add','.'],check=True,capture_output=True)
    subprocess.run(['git','-C',str(repo),'commit','-qm','spy launcher'],check=True,capture_output=True)
    root=tmp_path/'package 空白';builder.build(repo,prepared,root,tmp_path/'package.zip')
    poison=tmp_path/'poison';poison.mkdir();(poison/'emotecap_server.py').write_text('raise RuntimeError("poisoned Python path")')
    private=tmp_path/'user private'
    result=subprocess.run([sys.executable,'-I','-S','-B',str(root/'bootstrap.py'),'--no-browser'],
        env={**os.environ,'PYTHONPATH':str(poison),'LOCALAPPDATA':str(private)},capture_output=True,timeout=10)
    assert result.returncode==0,result.stderr.decode(errors='replace')
    selected=json.loads(result.stdout)
    assert str(poison) not in selected['paths']
    assert selected['args'][selected['args'].index('--web-dir')+1]==str(root/'app/web/dist')
    assert selected['args'][selected['args'].index('--data-dir')+1]==str(private/'EmoteCap/data')
    assert selected['args'][selected['args'].index('--env-file')+1]==str(private/'EmoteCap/settings.env')
    assert not private.exists()

@pytest.mark.parametrize('flag',['--data-dir','--env-file'])
def test_private_paths_inside_verified_package_are_rejected(build_inputs,tmp_path,flag):
    repo,prepared=build_inputs
    (repo/'server/emotecap_server/launcher.py').write_text('def main(argv):\n print("unexpected application import");return 0\n')
    subprocess.run(['git','-C',str(repo),'add','.'],check=True,capture_output=True)
    subprocess.run(['git','-C',str(repo),'commit','-qm','spy launcher'],check=True,capture_output=True)
    root=tmp_path/'package';builder.build(repo,prepared,root,tmp_path/'package.zip')
    selected=root/'private-user-data'
    result=subprocess.run([sys.executable,'-I','-S','-B',str(root/'bootstrap.py'),flag,str(selected),'--no-browser'],
        capture_output=True,timeout=10)
    assert result.returncode!=0 and b'unexpected application import' not in result.stdout
    assert not selected.exists()

@pytest.mark.parametrize('poison',['sitecustomize','pth'])
def test_actual_entry_flags_block_site_execution_before_manifest_rejection(tmp_path,poison):
    runtime=tmp_path/'owned-venv'
    subprocess.run([sys.executable,'-m','venv','--without-pip',str(runtime)],check=True,capture_output=True,timeout=30)
    python=runtime/('Scripts/python.exe' if os.name=='nt' else 'bin/python')
    site=runtime/('Lib/site-packages' if os.name=='nt' else f'lib/python{sys.version_info.major}.{sys.version_info.minor}/site-packages')
    marker=tmp_path/'unexpected-stateful-import.txt'
    body=f'import pathlib; pathlib.Path({str(marker)!r}).write_text("unexpected import")\n'
    (site/('sitecustomize.py' if poison=='sitecustomize' else 'poison.pth')).write_text(body,encoding='utf-8')
    package=tmp_path/'invalid-package';package.mkdir()
    (package/'bootstrap.py').write_bytes((ROOT/'packaging/windows/bootstrap.py').read_bytes())
    (package/'manifest.json').write_text('{}')
    wrapper=(ROOT/'packaging/windows/start.cmd').read_text(encoding='utf-8')
    flags=re.search(r'python\.exe"\s+(.+?)\s+"%~dp0bootstrap\.py"',wrapper).group(1).split()
    result=subprocess.run([str(python),*flags,str(package/'bootstrap.py'),'--no-browser'],
        cwd=package,capture_output=True,timeout=15)
    assert result.returncode==1 and not marker.exists(), 'Site initialization ran before integrity validation'
