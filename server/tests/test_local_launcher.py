"""Source-launcher ownership/static tests and real fresh-process API checks."""
import json
import os
import socket
import subprocess
import sys
import threading
import time
from pathlib import Path
from types import SimpleNamespace
from urllib.error import HTTPError,URLError
from urllib.request import ProxyHandler,Request,build_opener

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from emotecap_server import launcher
from emotecap_server.studio_files import attach_studio

ROOT=Path(__file__).resolve().parents[2]

def public_tree(tmp_path):
    public=tmp_path/'公共 Studio build';public.mkdir();(public/'index.html').write_text('built Studio')
    for path,data in {'assets/main.js':b'console.log(1)','assets/main.css':b'body{}',
        'mediapipe/wasm/tiny.wasm':b'wasm','models/tiny.task':b'task','samples/sample.emotecap':b'zip',
        '.env':b'private configuration','assets/.env':b'private configuration','private.txt':b'private',
        'assets/secret.env':b'private configuration'}.items():
        destination=public/path;destination.parent.mkdir(parents=True,exist_ok=True);destination.write_bytes(data)
    return public

def static_client(public):
    app=FastAPI();app.get('/api/health')(lambda:{'ok':True})
    attach_studio(app,public)
    return TestClient(app,base_url='http://127.0.0.1:8787')

def test_static_root_and_api_precedence(tmp_path):
    client=static_client(public_tree(tmp_path))
    assert client.get('/').text=='built Studio'
    assert client.get('/api/health').json()=={'ok':True}
    assert client.get('/api/missing').status_code==404
    response=client.get('/');assert response.headers['cache-control']=='no-store'
    assert response.headers['x-frame-options']=='DENY'
    assert response.headers['x-content-type-options']=='nosniff'

@pytest.mark.parametrize('path,mime',[
    ('/assets/main.js','text/javascript'),('/assets/main.css','text/css'),
    ('/mediapipe/wasm/tiny.wasm','application/wasm'),('/models/tiny.task','application/octet-stream'),
    ('/samples/sample.emotecap','application/octet-stream')])
def test_static_asset_mime(tmp_path,path,mime):
    response=static_client(public_tree(tmp_path)).get(path)
    assert response.status_code==200 and response.headers['content-type'].startswith(mime)

@pytest.mark.parametrize('path',['/.env','/assets/.env','/private.txt','/assets/secret.env','/assets/%2e%2e/.env'])
def test_static_private_and_unknown_paths_are_denied(tmp_path,path):
    assert static_client(public_tree(tmp_path)).get(path).status_code==404

def test_static_rejects_nonloopback_host(tmp_path):
    client=static_client(public_tree(tmp_path))
    assert client.get('/api/health',headers={'Host':'attacker.invalid'}).status_code==400

def test_static_does_not_follow_links_even_to_a_hidden_internal_file(tmp_path,monkeypatch):
    public=public_tree(tmp_path);alias=public/'assets/alias.js';alias.write_text('private alias')
    original=Path.is_symlink
    monkeypatch.setattr(Path,'is_symlink',lambda p:p==alias or original(p))
    assert static_client(public).get('/assets/alias.js').status_code==404

def test_valid_unicode_public_root_and_private_data(tmp_path):
    public=public_tree(tmp_path)
    assert launcher.validate_web_root(public,tmp_path/'私有 data',tmp_path/'私有 settings.env')==public.resolve()

def test_missing_build_fails_without_creating_data(tmp_path):
    data=tmp_path/'data'
    with pytest.raises(launcher.StartupError,match='build'):launcher.validate_web_root(tmp_path/'missing',data,tmp_path/'settings.env')
    assert not data.exists()

@pytest.mark.parametrize('kind',['data-inside','public-inside-data','config-inside'])
def test_private_public_overlap_is_rejected(tmp_path,kind):
    public=public_tree(tmp_path);data=tmp_path/'data';config=tmp_path/'settings.env'
    if kind=='data-inside':data=public/'private'
    elif kind=='public-inside-data':data=tmp_path
    else:config=public/'settings.env'
    with pytest.raises(launcher.StartupError):launcher.validate_web_root(public,data,config)

def test_listener_is_loopback_owned_and_busy_port_is_not_replaced():
    with socket.socket() as occupied:
        occupied.bind(('127.0.0.1',0));port=occupied.getsockname()[1]
        with pytest.raises(launcher.StartupError):launcher.open_listener(port)
    listener=launcher.open_listener(port)
    try:assert listener.getsockname()==('127.0.0.1',port)
    finally:listener.close()

def test_browser_is_not_opened_before_readiness():
    called=[];stop=threading.Event()
    assert not launcher.open_when_ready(SimpleNamespace(started=False),'http://127.0.0.1:8787',stop,
        opener=lambda url:called.append(url),wait_seconds=.01)
    assert not called

def test_ready_without_browser_and_browser_failure_keep_service_available(capsys):
    server=SimpleNamespace(started=True);stop=threading.Event();called=[]
    assert launcher.open_when_ready(server,'http://127.0.0.1:8787',stop,open_browser=False,opener=lambda u:called.append(u))
    assert not called
    def fail(url):raise OSError('browser unavailable')
    assert launcher.open_when_ready(server,'http://127.0.0.1:8787',stop,opener=fail)
    assert server.started and 'http://127.0.0.1:8787' in capsys.readouterr().out

def test_stopped_readiness_thread_never_opens_browser():
    stop=threading.Event();stop.set();called=[]
    assert not launcher.open_when_ready(SimpleNamespace(started=True),'http://127.0.0.1:8787',stop,
        opener=lambda url:called.append(url))
    assert not called

def args(public,tmp_path,port):
    return ['--web-dir',str(public),'--data-dir',str(tmp_path/'data'),'--env-file',str(tmp_path/'settings.env'),
            '--port',str(port),'--no-browser']

def test_busy_port_fails_before_stateful_app_import(tmp_path,monkeypatch):
    public=public_tree(tmp_path);called=[]
    monkeypatch.setattr(launcher,'_load_application',lambda *a:called.append(1))
    with socket.socket() as occupied:
        occupied.bind(('127.0.0.1',0))
        assert launcher.main(args(public,tmp_path,occupied.getsockname()[1]))==1
    assert not called and not (tmp_path/'data').exists()

def available_port():
    with socket.socket() as probe:
        probe.bind(('127.0.0.1',0));return probe.getsockname()[1]

def test_failed_app_import_releases_only_the_owned_listener(tmp_path,monkeypatch):
    public=public_tree(tmp_path);port=available_port()
    def fail(*args):raise launcher.StartupError('Synthetic import failure')
    monkeypatch.setattr(launcher,'_load_application',fail)
    assert launcher.main(args(public,tmp_path,port))==1
    with socket.socket() as probe:probe.bind(('127.0.0.1',port))
    assert not (tmp_path/'data').exists()

def test_failed_startup_releases_listener_and_readiness_thread(tmp_path,monkeypatch):
    public=public_tree(tmp_path);port=available_port()
    monkeypatch.setattr(launcher,'_load_application',lambda *args:FastAPI())
    class FailedServer:
        started=False
        def __init__(self,config):pass
        def run(self,**kwargs):pass
    monkeypatch.setattr(launcher.uvicorn,'Server',FailedServer)
    assert launcher.main(args(public,tmp_path,port))==1
    with socket.socket() as probe:probe.bind(('127.0.0.1',port))
    assert not any(thread.name=='emotecap-studio-ready' for thread in threading.enumerate())

def stop_owned(process):
    if process.poll() is not None:return
    process.terminate()
    try:process.wait(timeout=5)
    except subprocess.TimeoutExpired:process.kill();process.wait(timeout=5)

def test_fresh_launcher_process_serves_real_api_and_static_bytes(tmp_path):
    public=public_tree(tmp_path);port=available_port();url=f'http://127.0.0.1:{port}'
    env={**os.environ,'GEMINI_API_KEY':'','BLENDER_PATH':str(tmp_path/'missing-blender')}
    log=tmp_path/'launcher.log'
    with log.open('wb') as output:
        process=subprocess.Popen([sys.executable,'-m','emotecap_server.launcher',*args(public,tmp_path,port)],
            cwd=ROOT/'server',env=env,stdout=output,stderr=subprocess.STDOUT)
        try:
            opener=build_opener(ProxyHandler({}));deadline=time.monotonic()+15
            while True:
                assert process.poll() is None,'Owned launcher exited before startup; inspect retained log'
                try:
                    with opener.open(url+'/api/health',timeout=.5) as response:health=json.load(response)
                    break
                except (URLError,TimeoutError):
                    if time.monotonic()>deadline:raise AssertionError('Owned launcher did not become ready')
                    time.sleep(.05)
            assert health=={'ok':True,'blender':False,'gemini':False,'exportJobs':1}
            with opener.open(url,timeout=2) as response:assert response.read()==b'built Studio'
            with opener.open(url+'/api/export-jobs',timeout=2) as response:assert json.load(response)=={'jobs':[]}
            with opener.open(url+'/mediapipe/wasm/tiny.wasm',timeout=2) as response:
                assert response.headers['content-type']=='application/wasm' and response.read()==b'wasm'
            with opener.open(url+'/models/tiny.task',timeout=2) as response:assert response.read()==b'task'
            with pytest.raises(HTTPError) as error:opener.open(Request(url+'/api/health',headers={'Host':'attacker.invalid'}),timeout=2)
            assert error.value.code==400
            assert (tmp_path/'data').is_dir()
        finally:stop_owned(process)
    assert process.poll() is not None

def test_fresh_missing_build_process_is_nonzero_and_leaves_private_data_absent(tmp_path):
    result=subprocess.run([sys.executable,'-m','emotecap_server.launcher',*args(tmp_path/'missing',tmp_path,available_port())],
        cwd=ROOT/'server',capture_output=True,timeout=10)
    assert result.returncode!=0 and not (tmp_path/'data').exists()
    assert b'build' in result.stderr.lower()+result.stdout.lower()

def test_empty_optional_env_override_keeps_legacy_root_env():
    script='''import dotenv
seen=[]
dotenv.load_dotenv=lambda selected:seen.append(selected)
from emotecap_server import config
assert seen==[config.REPO_ROOT/".env"], "Empty optional override lost the legacy source env"
'''
    result=subprocess.run([sys.executable,'-c',script],cwd=ROOT/'server',
        env={**os.environ,'EMOTECAP_ENV_FILE':''},capture_output=True,timeout=10)
    assert result.returncode==0,'Optional empty env selector changed the legacy default'
