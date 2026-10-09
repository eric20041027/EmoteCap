"""Owned synthetic relay fixture and actual Unity qualification runner.

Fixture controls never enter the product app; pairing secrets remain in memory.
"""
import argparse
import asyncio
from contextlib import asynccontextmanager
from datetime import datetime,timezone
import hashlib
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import time
from urllib.request import ProxyHandler,build_opener,Request
import uuid

ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT/'.superpowers/sdd/2026-10-07-unity-receiver'
WORKSPACES=('2026-10-07-unity-receiver','2026-10-08-unity-quality')
sys.path.insert(0,str(ROOT/'server'))
sys.path.insert(0,str(ROOT/'scripts'))
from emotecap_owned_process import OwnedProcess
from fastapi import FastAPI,HTTPException,WebSocket
from pydantic import BaseModel,ConfigDict,Field
import uvicorn
from websockets.asyncio.client import connect
from websockets.exceptions import ConnectionClosed
from emotecap_server.contract import BONES
from emotecap_server.relay import LiveRelay

FIXTURE={'schema':'emotecap-unity-synthetic-fixture-v1','bones':BONES,
         'frame':{'type':'frame','t':1,'h':[0,.95,0],'r':[0,0,0,1]*48}}
FIXTURE_BYTES=json.dumps(FIXTURE,sort_keys=True,separators=(',',':')).encode()
FIXTURE_SHA=hashlib.sha256(FIXTURE_BYTES).hexdigest()

class Issue(BaseModel):
    model_config=ConfigDict(extra='forbid')
    ttlSeconds:float=Field(default=60,strict=True,allow_inf_nan=False,ge=.1,le=60)

class FrameInput(BaseModel):
    model_config=ConfigDict(extra='forbid')
    t:float=Field(strict=True,allow_inf_nan=False,ge=0,le=1000000)
    height:float=Field(default=.95,strict=True,allow_inf_nan=False,ge=0,le=2)

def create_fixture_app(port:int,instance:str)->FastAPI:
    relay=LiveRelay();sources={};base=f'http://127.0.0.1:{port}'
    def session(identifier):
        value=relay.sessions._sessions.get(identifier)
        if value is None or not relay.sessions.live(value):raise HTTPException(404,'Fixture pairing unavailable')
        return value
    async def stop_source(identifier):
        source=sources.pop(identifier,None)
        if source is not None:await source.close()
    async def reset():
        await relay.aclose()
        await asyncio.gather(*(stop_source(identifier) for identifier in list(sources)))
    async def prune():
        while True:
            await relay.prune();await asyncio.sleep(.05)
    @asynccontextmanager
    async def lifespan(app):
        task=asyncio.create_task(prune())
        try:yield
        finally:
            task.cancel()
            try:await task
            except asyncio.CancelledError:pass
            await reset()
    app=FastAPI(lifespan=lifespan);app.state.relay=relay
    @app.websocket('/ws/live')
    async def native_socket(socket:WebSocket,role:str):
        await relay.serve(socket,role)
    @app.get('/fixture/info')
    async def info():
        return {'instance':instance,'pid':os.getpid(),'parentPid':os.getppid(),'sessions':len(relay.sessions._sessions),
                'sinks':relay.sink_count,'sources':sum(s.source is not None for s in relay.sessions._sessions.values()),
                'fixtureSha256':FIXTURE_SHA,'provider':False}
    @app.post('/fixture/issue')
    async def issue(request:Issue):
        await relay.prune()
        if len(relay.sessions._sessions)>=4:raise HTTPException(409,'Owned fixture capacity')
        value=relay.sessions.issue();value.deadline=relay.sessions.clock()+request.ttlSeconds
        value.expires_at=int((relay.sessions.wall_clock()+request.ttlSeconds)*1000)
        return {'id':value.id,'pairingCode':value.id+'.'+value.sink_token,'expiresAt':value.expires_at}
    async def open_source(value):
        source=await connect(f'ws://127.0.0.1:{port}/ws/live?role=source',origin=base,proxy=None,open_timeout=2,close_timeout=1,max_size=16384)
        try:
            await source.send(json.dumps({'type':'hello','version':2,'bones':BONES,'sessionId':value.id,'token':value.source_token}))
            ack=json.loads(await asyncio.wait_for(source.recv(),2))
            if ack.get('role')!='source' or ack.get('sessionId')!=value.id:raise RuntimeError('Fixture source acknowledgement failed')
            return source
        except BaseException:
            await source.close();raise
    @app.post('/fixture/source/{identifier}/start')
    async def start_source(identifier:str):
        value=session(identifier)
        if identifier in sources:raise HTTPException(409,'Fixture source already active')
        sources[identifier]=await open_source(value);return {'started':True}
    @app.post('/fixture/source/{identifier}/frame')
    async def source_frame(identifier:str,request:FrameInput):
        session(identifier);source=sources.get(identifier)
        if source is None:raise HTTPException(409,'Fixture source is not active')
        frame={**FIXTURE['frame'],'t':request.t,'h':[0,request.height,0]}
        await source.send(json.dumps(frame,separators=(',',':')));return {'sent':True}
    @app.post('/fixture/source/{identifier}/stop')
    async def source_stop(identifier:str):
        session(identifier);await stop_source(identifier);return {'stopped':True}
    @app.post('/fixture/source/{identifier}/compete')
    async def competing_source(identifier:str):
        value=session(identifier)
        try:extra=await open_source(value)
        except ConnectionClosed as error:return {'rejected':error.rcvd is not None and error.rcvd.code==1008}
        await extra.close();return {'rejected':False}
    @app.post('/fixture/revoke/{identifier}')
    async def revoke(identifier:str):
        value=session(identifier);relay.sessions.revoke(identifier,value.source_token)
        await relay.close_session(value);await stop_source(identifier);return {'revoked':True}
    @app.post('/fixture/drop/{identifier}')
    async def drop(identifier:str):
        value=session(identifier)
        await asyncio.gather(*(relay._close(delivery.socket,1011,'Owned fixture ordinary disconnect') for delivery in tuple(value.sinks)))
        return {'dropped':True}
    @app.post('/fixture/reset')
    async def reset_all():
        await reset();return {'reset':True}
    @app.post('/fixture/shutdown')
    async def shutdown():
        await reset()
        server=getattr(app.state,'fixture_server',None)
        if server is not None:server.should_exit=True
        return {'stopping':server is not None}
    return app

def owned_path(value:str,workspace_name:str=WORKSPACES[0])->Path:
    if workspace_name not in WORKSPACES:raise ValueError('Unknown Unity qualification workspace')
    work=(ROOT/'.superpowers/sdd'/workspace_name).absolute()
    raw=Path(value).absolute()
    for item in (raw,*raw.parents):
        if item.is_symlink() or item.is_junction():raise ValueError('Owned fixture paths cannot use links')
    candidate=Path(os.path.abspath(value))
    if not candidate.is_relative_to(work) or candidate==work:raise ValueError('Use paths inside the Unity plan workspace')
    return candidate

def write_json(path:Path,value):
    with path.open('x',encoding='utf-8',newline='\n') as output:json.dump(value,output,indent=2)

def request(base:str,path:str,method='GET'):
    incoming=Request(base+path,data=b'{}' if method=='POST' else None,method=method,headers={'Content-Type':'application/json'})
    with build_opener(ProxyHandler({})).open(incoming,timeout=2) as response:raw=response.read(16385)
    if len(raw)>16384:raise ValueError('Fixture response is too large')
    return json.loads(raw)

def run(args):
    workspace_name=getattr(args,'workspace_name',WORKSPACES[0])
    output=owned_path(args.output,workspace_name);project=owned_path(args.project,workspace_name);output.mkdir(parents=True,exist_ok=False)
    if not (project/'Packages/manifest.json').is_file():raise ValueError('Explicit isolated project required')
    with socket.socket() as unused:
        unused.bind(('127.0.0.1',0));port=unused.getsockname()[1]
    instance=str(uuid.uuid4());base=f'http://127.0.0.1:{port}'
    environment=dict(os.environ);environment['EMOTECAP_TEST_RELAY_URL']=base
    relay=None;relay_owned=None;ready=False;completed={};original_error=None;server_pid=None
    with (output/'relay.log').open('xb') as log:
        try:
            relay_owned=OwnedProcess([sys.executable,str(Path(__file__).resolve()),'--serve','--port',str(port),'--instance',instance],
                cwd=ROOT,env=environment,stdin=subprocess.DEVNULL,stdout=log,stderr=log)
            relay=relay_owned.process
            write_json(output/'ownership.json',{'pid':relay.pid,'port':port,'instance':instance,'fixtureSha256':FIXTURE_SHA,
                'sourceCommit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),
                'startedUtc':datetime.now(timezone.utc).isoformat()})
            (output/'fixture-public.json').write_bytes(FIXTURE_BYTES)
            deadline=time.monotonic()+15
            while time.monotonic()<deadline:
                if relay.poll() is not None:raise RuntimeError('Owned fixture server exited before ready')
                try:
                    info=request(base,'/fixture/info')
                    if info['instance']==instance and (info['pid']==relay.pid or info['parentPid']==relay.pid) and info['fixtureSha256']==FIXTURE_SHA:
                        ready=True;server_pid=info['pid'];write_json(output/'server-identity.json',info);break
                except (OSError,ValueError):pass
                time.sleep(.1)
            if not ready:raise RuntimeError('Owned fixture did not become ready')
            modes=('EditMode','PlayMode') if args.mode=='both' else (args.mode,)
            for mode in modes:
                results=output/(mode+'.xml')
                with (output/(mode+'-command.log')).open('xb') as command_log:
                    command=[args.powershell,'-NoProfile','-File',str(ROOT/'scripts/test-unity.ps1'),'-Mode',mode,
                        '-ProjectPath',str(project),'-ResultsPath',str(results),'-UnityPath',args.unity,'-WorkspaceName',workspace_name]
                    if args.filter:command+=['-Filter',args.filter]
                    if getattr(args,'graphics',False):command+=['-EnableGraphics']
                    with OwnedProcess(command,cwd=ROOT,env=environment,stdin=subprocess.DEVNULL,stdout=command_log,stderr=command_log) as child:
                        try:code=child.wait(timeout=600)
                        except subprocess.TimeoutExpired:raise RuntimeError('Owned test helper timed out')
                completed[mode]={'exitCode':code,'results':str(results)}
                if code:raise RuntimeError('Actual Unity tests failed; XML and logs retained')
            info=request(base,'/fixture/info');write_json(output/'final-fixture-state.json',info)
            if info['sinks'] or info['sources'] or info['sessions']:raise RuntimeError('Unity fixture did not release its pairings')
        except BaseException as error:original_error=error
        finally:
            if relay is not None:
                if ready and relay.poll() is None:
                    try:request(base,'/fixture/shutdown','POST')
                    except (OSError,ValueError):pass
                try:
                    if original_error is None:relay.wait(timeout=10)
                except subprocess.TimeoutExpired:pass
                finally:relay_owned.close()
                write_json(output/'completion.json',{'pid':relay.pid,'serverPid':server_pid,'port':port,'exitCode':relay.returncode,
                    'ownedProcessTerminal':relay.poll() is not None,'ownedProcessTreeTerminal':relay_owned.closed,
                    'completedUtc':datetime.now(timezone.utc).isoformat(),'modes':completed})
    if original_error is not None:raise original_error
    print(json.dumps({'status':'actual-unity-relay-tests-passed','modes':completed,'fixtureSha256':FIXTURE_SHA,'ownedRelayTerminal':True}))

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--serve',action='store_true');parser.add_argument('--port',type=int);parser.add_argument('--instance')
    for option in ('project','output','unity','powershell','filter'):parser.add_argument('--'+option)
    parser.add_argument('--workspace-name',choices=WORKSPACES,default=WORKSPACES[0])
    parser.add_argument('--graphics',action='store_true')
    parser.add_argument('--mode',choices=('EditMode','PlayMode','both'),default='both');args=parser.parse_args()
    if args.serve:
        if args.port is None or not 1<=args.port<=65535 or not args.instance:parser.error('Owned serve needs port and instance')
        app=create_fixture_app(args.port,args.instance)
        server=uvicorn.Server(uvicorn.Config(app,host='127.0.0.1',port=args.port,access_log=False,log_level='warning'))
        app.state.fixture_server=server;server.run()
    else:
        if any(not getattr(args,name) for name in ('project','output','unity','powershell')):parser.error('Project/output/unity/powershell paths required')
        run(args)

if __name__=='__main__':main()
