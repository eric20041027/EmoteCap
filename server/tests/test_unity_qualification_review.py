"""Watched regressions for the single final Unity quality correction pass."""
import importlib.util
import argparse
import json
import os
from pathlib import Path
import subprocess
import shutil
import sys
import time
import xml.etree.ElementTree as ET
import pytest

ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('review_quality',ROOT/'scripts/unity-quality.py')
quality=importlib.util.module_from_spec(spec);spec.loader.exec_module(quality)
MANIFEST=json.loads((ROOT/'scripts/unity-required-cases.json').read_text())

def xml_file(tmp_path,mode,remove=None,duplicate=False,summary_delta=0):
    cases=MANIFEST['modes'][mode]
    cases=[case for case in cases if case['fullname']!=remove]
    if duplicate:cases=cases+[cases[0]]
    root=ET.Element('test-run',result='Passed',failed='0',skipped='0',passed=str(len(cases)+summary_delta),total=str(len(cases)))
    for case in cases:ET.SubElement(root,'test-case',**case,result='Passed')
    path=tmp_path/(mode+'.xml');ET.ElementTree(root).write(path,encoding='utf-8')
    return path,list(dict.fromkeys(case['classname'] for case in cases))

FAMILIES=[(mode,classname) for mode,cases in MANIFEST['modes'].items()
    for classname in dict.fromkeys(case['classname'] for case in cases) if '.Samples.' in classname]

@pytest.mark.parametrize('mode,classname',FAMILIES)
def test_missing_one_mandatory_case_rejects_each_new_acceptance_family(tmp_path,mode,classname):
    removed=next(case['fullname'] for case in MANIFEST['modes'][mode] if case['classname']==classname)
    path,classes=xml_file(tmp_path,mode,removed)
    with pytest.raises(ValueError):quality.assert_xml(path,classes)

@pytest.mark.parametrize('duplicate,delta',[(True,0),(False,1)])
def test_duplicate_identity_or_inconsistent_summary_cannot_qualify(tmp_path,duplicate,delta):
    path,classes=xml_file(tmp_path,'EditMode',duplicate=duplicate,summary_delta=delta)
    with pytest.raises(ValueError):quality.assert_xml(path,classes)

@pytest.mark.parametrize('relative',['server/blender/export_fbx.py','contracts/bones.json',
    'contracts/fixtures/raise-right-arm.clip.json','scripts/unity-quality.py','scripts/unity-relay-test.py',
    'scripts/test-unity.ps1','scripts/unity-required-cases.json'])
def test_consumed_source_change_rejects_after_snapshot(tmp_path,monkeypatch,relative):
    path=tmp_path/relative;path.parent.mkdir(parents=True);path.write_bytes(b'original consumed source')
    monkeypatch.setattr(quality,'ROOT',tmp_path)
    frozen=quality.freeze_sources([relative])
    path.write_bytes(b'changed consumed source')
    with pytest.raises(ValueError):quality.verify_sources(frozen)

def test_added_or_removed_package_source_rejects(tmp_path,monkeypatch):
    folder=tmp_path/'unity/com.emotecap.mocap';folder.mkdir(parents=True);(folder/'original.cs').write_bytes(b'original')
    monkeypatch.setattr(quality,'ROOT',tmp_path)
    frozen=quality.freeze_sources(['unity/com.emotecap.mocap'])
    (folder/'new.cs').write_bytes(b'new unadmitted source')
    with pytest.raises(ValueError):quality.verify_sources(frozen)

@pytest.mark.parametrize('relative',['server/blender/export_fbx.py','contracts/bones.json',
    'scripts/unity-relay-test.py','scripts/test-unity.ps1','scripts/emotecap_owned_process.py'])
def test_mid_stage_source_mutation_prevents_success_receipt(tmp_path,monkeypatch,relative):
    # Deliberately simulated external stage; never counted as Blender/Unity acceptance.
    for source in quality.SOURCE_PATHS:
        path=ROOT/source;target=tmp_path/source
        target.parent.mkdir(parents=True,exist_ok=True)
        if path.is_dir():shutil.copytree(path,target,ignore=shutil.ignore_patterns('__pycache__'))
        else:shutil.copyfile(path,target)
    output=tmp_path/'evidence/run'
    monkeypatch.setattr(quality,'ROOT',tmp_path);monkeypatch.setattr(quality,'WORK',output.parent)
    monkeypatch.setattr(quality,'git_identity',lambda:{'commit':'simulated-unit-source','status':''})
    stages=[]
    def simulated(command,result,name,timeout,environment):
        stages.append(name)
        executed=Path(command[command.index('-P')+1])
        assert executed.is_relative_to(output/'frozen-sources')
        assert executed.read_bytes()==(tmp_path/'server/blender/export_fbx.py').read_bytes()
        path=tmp_path/relative;path.write_bytes(path.read_bytes()+b'\ncontrolled mid-stage source change\n')
    monkeypatch.setattr(quality,'run_owned',simulated)
    with pytest.raises(ValueError,match='source inventory changed'):
        quality.run(argparse.Namespace(output=str(output),unity=sys.executable,blender=sys.executable,powershell=sys.executable))
    assert stages==['blender'] and not (output/'complete.json').exists()

def kill_owned(pid):
    if os.name=='nt':
        import ctypes
        from ctypes import wintypes
        api=ctypes.WinDLL('kernel32',use_last_error=True)
        api.OpenProcess.argtypes=[wintypes.DWORD,wintypes.BOOL,wintypes.DWORD];api.OpenProcess.restype=wintypes.HANDLE
        api.TerminateProcess.argtypes=[wintypes.HANDLE,wintypes.UINT];api.WaitForSingleObject.argtypes=[wintypes.HANDLE,wintypes.DWORD]
        api.CloseHandle.argtypes=[wintypes.HANDLE]
        handle=api.OpenProcess(0x00100001,False,pid)
        if handle:
            try:api.TerminateProcess(handle,1);api.WaitForSingleObject(handle,5000)
            finally:api.CloseHandle(handle)
    else:
        try:os.kill(pid,9)
        except ProcessLookupError:pass

def alive(pid):
    if os.name=='nt':
        import ctypes
        from ctypes import wintypes
        api=ctypes.WinDLL('kernel32',use_last_error=True);api.OpenProcess.argtypes=[wintypes.DWORD,wintypes.BOOL,wintypes.DWORD]
        api.OpenProcess.restype=wintypes.HANDLE;api.WaitForSingleObject.argtypes=[wintypes.HANDLE,wintypes.DWORD];api.CloseHandle.argtypes=[wintypes.HANDLE]
        handle=api.OpenProcess(0x00100000,False,pid)
        if not handle:return False
        try:return api.WaitForSingleObject(handle,0)==258
        finally:api.CloseHandle(handle)
    try:os.kill(pid,0);return True
    except ProcessLookupError:return False

def test_timeout_stops_actual_owned_descendant(tmp_path):
    file=tmp_path/'child.json'
    command=[sys._base_executable,'-c',
        'import subprocess,sys,time,json;from pathlib import Path;'
        'child=subprocess.Popen([sys.executable,"-c","import time;time.sleep(30)"]);'
        'Path(sys.argv[1]).write_text(json.dumps({"child":child.pid}));time.sleep(30)',str(file)]
    pid=None
    try:
        with pytest.raises(RuntimeError):quality.run_owned(command,tmp_path,'timeout',1,dict(os.environ))
        pid=json.loads(file.read_text())['child']
        assert not alive(pid),'The owned descendant must be terminal before timeout returns'
    finally:
        if file.exists():kill_owned(json.loads(file.read_text())['child'])

def test_interrupt_stops_actual_direct_child(tmp_path,monkeypatch):
    original=subprocess.Popen;processes=[]
    class Interrupted(original):
        def wait(self,timeout=None):
            if not getattr(self,'injected',False):self.injected=True;raise KeyboardInterrupt('controlled wait interruption')
            return super().wait(timeout=timeout)
    def create(*args,**kwargs):
        process=Interrupted(*args,**kwargs);processes.append(process);return process
    monkeypatch.setattr(quality.subprocess,'Popen',create)
    try:
        with pytest.raises(KeyboardInterrupt):quality.run_owned([sys._base_executable,'-c','import time;time.sleep(30)'],tmp_path,'interrupt',5,dict(os.environ))
        assert processes and processes[0].poll() is not None,'Interrupted owned child must already be terminal'
    finally:
        for process in processes:
            if process.poll() is None:process.kill()
            process.wait(timeout=5)

def test_post_launch_ownership_write_failure_stops_child(tmp_path,monkeypatch):
    original=subprocess.Popen;processes=[];writer=quality.write_json
    def create(*args,**kwargs):
        process=original(*args,**kwargs);processes.append(process);return process
    def fail(path,value):
        if path.name.endswith('-ownership.json'):raise OSError('controlled receipt failure')
        return writer(path,value)
    monkeypatch.setattr(quality.subprocess,'Popen',create);monkeypatch.setattr(quality,'write_json',fail)
    try:
        with pytest.raises(OSError):quality.run_owned([sys._base_executable,'-c','import time;time.sleep(30)'],tmp_path,'receipt',5,dict(os.environ))
        assert processes and processes[0].poll() is not None
    finally:
        for process in processes:
            if process.poll() is None:process.kill()
            process.wait(timeout=5)
