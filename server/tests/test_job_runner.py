"""Real owned Python children stand in for Blender; no external process is killed."""
import dataclasses
import subprocess
import sys
import threading
import time
from pathlib import Path

import pytest

from emotecap_server.config import REPO_ROOT,load_settings
from emotecap_server.exporter import ExportError
from emotecap_server.jobs import runner


def child(tmp_path:Path,monkeypatch:pytest.MonkeyPatch,body:str):
    script=tmp_path/'owned child.py';script.write_text(body,encoding='utf-8')
    real=subprocess.Popen;processes=[]
    def start(command,**kwargs):
        assert kwargs.get('shell',False) is False
        assert kwargs['cwd']==REPO_ROOT
        process=real([sys.executable,'-u',str(script)],**kwargs);processes.append(process);return process
    monkeypatch.setattr(runner.subprocess if hasattr(runner,'subprocess') else subprocess,'Popen',start)
    return dataclasses.replace(load_settings(),data_dir=tmp_path/'data',unity_export_dir=None),processes


def test_actual_child_reports_completed_clip_progress(tmp_path,monkeypatch):
    settings,processes=child(tmp_path,monkeypatch,"print('EMOTECAP_PROGRESS:1:2')\nprint('EMOTECAP_PROGRESS:2:2')\n")
    progress=[];runner.run_job(settings,tmp_path/'clips.json',tmp_path/'out',threading.Event(),progress.append)
    assert progress==[50,100]
    assert processes[0].poll()==0


def test_cancel_terminates_only_the_owned_child(tmp_path,monkeypatch):
    settings,processes=child(tmp_path,monkeypatch,"import time\nprint('started')\ntime.sleep(10)\n")
    cancel=threading.Event();timer=threading.Timer(.2,cancel.set);timer.start()
    try:
        with pytest.raises(runner.JobCancelled):
            runner.run_job(settings,tmp_path/'clips.json',tmp_path/'out',cancel,lambda _:None)
        assert len(processes)==1 and processes[0].poll() is not None
    finally:
        timer.cancel()
        for process in processes:
            if process.poll() is None:process.kill();process.wait(timeout=2)


def test_pre_cancel_never_launches_a_child(tmp_path,monkeypatch):
    settings,processes=child(tmp_path,monkeypatch,"print('unexpected')")
    cancel=threading.Event();cancel.set()
    with pytest.raises(runner.JobCancelled):
        runner.run_job(settings,tmp_path/'clips.json',tmp_path/'out',cancel,lambda _:None)
    assert processes==[]


def test_timeout_cleans_up_the_owned_child(tmp_path,monkeypatch):
    settings,processes=child(tmp_path,monkeypatch,"import time\nprint('started')\ntime.sleep(10)")
    monkeypatch.setattr(runner,'TIMEOUT_SECONDS',.2,raising=False)
    try:
        with pytest.raises(ExportError,match='timed out'):
            runner.run_job(settings,tmp_path/'clips.json',tmp_path/'out',threading.Event(),lambda _:None)
        assert processes[0].poll() is not None
    finally:
        for process in processes:
            if process.poll() is None:process.kill();process.wait(timeout=2)


def test_failure_output_is_bounded_and_keeps_the_tail(tmp_path,monkeypatch):
    settings,_=child(tmp_path,monkeypatch,"import sys\nprint('x'*100000)\nprint('lastline')\nsys.exit(7)")
    with pytest.raises(ExportError,match='code 7') as caught:
        runner.run_job(settings,tmp_path/'clips.json',tmp_path/'out',threading.Event(),lambda _:None)
    assert caught.value.stderr_tail.splitlines()[-1]=='lastline'
    assert len(caught.value.stderr_tail.encode())<=65536


def test_multibyte_output_tail_is_within_the_byte_limit(tmp_path,monkeypatch):
    settings,_=child(tmp_path,monkeypatch,"import sys\nsys.stdout.buffer.write(('字'*40000).encode('utf-8'))\nsys.exit(7)")
    with pytest.raises(ExportError) as caught:
        runner.run_job(settings,tmp_path/'clips.json',tmp_path/'out',threading.Event(),lambda _:None)
    assert len(caught.value.stderr_tail.encode('utf-8'))<=65536


def test_progress_persistence_error_stops_owned_process_promptly(tmp_path,monkeypatch):
    settings,processes=child(tmp_path,monkeypatch,"import time\nprint('EMOTECAP_PROGRESS:1:2')\ntime.sleep(10)")
    monkeypatch.setattr(runner,'TIMEOUT_SECONDS',2)
    def failed_progress(_):raise OSError('progress save failed')
    started=time.monotonic()
    with pytest.raises(ExportError,match='progress save failed'):
        runner.run_job(settings,tmp_path/'clips.json',tmp_path/'out',threading.Event(),failed_progress)
    assert time.monotonic()-started<1
    assert processes[0].poll() is not None
