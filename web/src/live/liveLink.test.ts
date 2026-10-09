import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {CONTRACT_VERSION,DRIVEN_BONES,tposeFrame} from '../motion';
import {LiveLinkSender,type SocketLike} from './liveLink';
import type {PairingSession} from './sessionsApi';
const id='10000000-0000-4000-8000-000000000001',streamId='20000000-0000-4000-8000-000000000001';
const session=():PairingSession=>({id,sourceToken:'s'.repeat(43),pairingCode:id+'.'+'p'.repeat(43),expiresAt:Date.now()+3600000});
const ack=(s:PairingSession)=>({type:'hello',version:CONTRACT_VERSION,bones:DRIVEN_BONES,sessionId:s.id,role:'source',streamId,expiresAt:s.expiresAt});
class FakeSocket implements SocketLike {
  static instances:FakeSocket[]=[];readyState=0;bufferedAmount=0;sent:string[]=[];
  onopen:(()=>void)|null=null;onclose:((event:{code:number;reason:string})=>void)|null=null;
  onerror:(()=>void)|null=null;onmessage:((event:{data:unknown})=>void)|null=null;
  constructor(readonly url:string){FakeSocket.instances.push(this);}
  send(data:string){this.sent.push(data);}
  close(code=1000,reason=''){this.readyState=3;this.onclose?.({code,reason});}
  open(){this.readyState=1;this.onopen?.();}
  message(value:unknown){this.onmessage?.({data:typeof value==='string'?value:JSON.stringify(value)});}
}
const owners:LiveLinkSender[]=[];
const tick=()=>vi.advanceTimersByTimeAsync(0);
function setup(options:Partial<ConstructorParameters<typeof LiveLinkSender>[0]>={}){
  const value=session(),createSession=vi.fn(async()=>value),revokeSession=vi.fn(async()=>{}),statuses:string[]=[];
  const sender=new LiveLinkSender({url:'ws://localhost:8787/ws/live?role=source',createSocket:url=>new FakeSocket(url),
    createSession,revokeSession,now:()=>1000,...options},status=>statuses.push(status));owners.push(sender);
  return {sender,value,createSession,revokeSession,statuses};
}
describe('paired LiveLinkSender',()=>{
  beforeEach(()=>{FakeSocket.instances=[];vi.useFakeTimers();});
  afterEach(async()=>{owners.splice(0).forEach(s=>s.stop());await tick();vi.useRealTimers();});
  it('does nothing until explicit Start and sends a source-secret hello on open',async()=>{
    const {sender,value,createSession}=setup();expect(createSession).not.toHaveBeenCalled();expect(FakeSocket.instances).toHaveLength(0);
    sender.start();await tick();const socket=FakeSocket.instances[0];socket.open();const hello=JSON.parse(socket.sent[0]);
    expect(hello).toEqual({type:'hello',version:2,bones:DRIVEN_BONES,sessionId:value.id,token:value.sourceToken});
    expect(socket.url).not.toContain(value.sourceToken);expect(socket.url).not.toContain(value.pairingCode);
  });
  it('waits for a matching acknowledgement before sending a full pose',async()=>{
    const {sender,value}=setup();sender.start();await tick();const socket=FakeSocket.instances[0];socket.open();
    expect(sender.send(tposeFrame(1.25))).toBe(false);expect(sender.getSnapshot().status).toBe('connecting');
    socket.message(ack(value));expect(sender.getSnapshot().status).toBe('live');expect(sender.send(tposeFrame(1.25))).toBe(true);
    const pose=JSON.parse(socket.sent[1]);expect(pose).toMatchObject({type:'frame',t:0});expect(pose.r).toHaveLength(192);expect(pose.h).toHaveLength(3);
  });
  it('drops frames while closed, unacknowledged, backed up or malformed',async()=>{
    const {sender,value}=setup();sender.start();expect(sender.send(tposeFrame())).toBe(false);await tick();const socket=FakeSocket.instances[0];socket.open();
    socket.message(ack(value));socket.bufferedAmount=1_000_000;expect(sender.send(tposeFrame())).toBe(false);socket.bufferedAmount=0;
    expect(sender.send({...tposeFrame(),r:[0,0,0,2]})).toBe(false);expect(sender.send({...tposeFrame(),h:[NaN,1,0]})).toBe(false);
    expect(socket.sent).toHaveLength(1);
  });
  it('uses increasing connection time without mutating playback timestamps',async()=>{
    let now=1000;const {sender,value}=setup({now:()=>now});sender.start();await tick();const socket=FakeSocket.instances[0];socket.open();socket.message(ack(value));
    const original=tposeFrame(170);sender.send(original);now=1200;sender.send(tposeFrame(0));sender.send(tposeFrame(0));
    const times=socket.sent.slice(1).map(text=>JSON.parse(text).t);expect(times[0]).toBe(0);expect(times[1]).toBe(.2);expect(times[2]).toBeGreaterThan(.2);expect(original.t).toBe(170);
  });
  it('preserves valid tolerance-boundary quaternions on the wire',async()=>{
    const {sender,value}=setup();sender.start();await tick();const socket=FakeSocket.instances[0];socket.open();socket.message(ack(value));
    const frame=tposeFrame(),component=.9800002/Math.sqrt(2);frame.r.splice(0,4,component,component,0,0);
    expect(sender.send(frame)).toBe(true);const r=JSON.parse(socket.sent[1]).r;expect(Math.hypot(...r.slice(0,4))).toBeGreaterThanOrEqual(.98);
  });
  it('reconnects normally after2seconds and waits for a new matching ack',async()=>{
    const {sender,value,createSession,statuses}=setup();sender.start();await tick();FakeSocket.instances[0].open();FakeSocket.instances[0].message(ack(value));
    FakeSocket.instances[0].close();await vi.advanceTimersByTimeAsync(2000);expect(FakeSocket.instances).toHaveLength(2);expect(createSession).toHaveBeenCalledTimes(1);
    FakeSocket.instances[1].open();expect(sender.send(tposeFrame())).toBe(false);FakeSocket.instances[1].message(ack(value));expect(sender.send(tposeFrame())).toBe(true);
    expect(statuses).toEqual(['connecting','live','connecting','live']);
  });
  it.each([{version:1},{bones:[]},{sessionId:streamId},{role:'sink'},{streamId:null},{token:'unexpected'}])('rejects incompatible acknowledgement %j',async changes=>{
    const {sender,value}=setup();sender.start();await tick();const socket=FakeSocket.instances[0];socket.open();socket.message({...ack(value),...changes});
    expect(sender.getSnapshot().status).toBe('error');expect(sender.send(tposeFrame())).toBe(false);await vi.advanceTimersByTimeAsync(6000);expect(FakeSocket.instances).toHaveLength(1);
  });
  it('stops policy-rejection retries and never displays the raw token-bearing reason',async()=>{
    const {sender,value}=setup();sender.start();await tick();const socket=FakeSocket.instances[0];socket.open();socket.close(1008,value.sourceToken);
    expect(sender.getSnapshot().status).toBe('error');expect(sender.getSnapshot().error).not.toContain(value.sourceToken);
    await vi.advanceTimersByTimeAsync(6000);expect(FakeSocket.instances).toHaveLength(1);
  });
  it('bounds the acknowledgement deadline',async()=>{
    const {sender}=setup();sender.start();await tick();FakeSocket.instances[0].open();await vi.advanceTimersByTimeAsync(5001);
    expect(sender.getSnapshot()).toMatchObject({status:'error',error:expect.stringMatching(/handshake/i)});expect(sender.send(tposeFrame())).toBe(false);
  });
  it('bounds a socket that never opens',async()=>{
    const {sender}=setup();sender.start();await tick();await vi.advanceTimersByTimeAsync(5001);
    expect(sender.getSnapshot().status).toBe('error');expect(sender.send(tposeFrame())).toBe(false);
  });
  it('does not erase uncertain creation warnings after another successful cleanup',async()=>{
    let resolve!:(value:PairingSession)=>void,reject!:(error:Error)=>void;const value=session();
    const create=vi.fn(()=>new Promise<PairingSession>((yes,no)=>{resolve=yes;reject=no;}));
    const {sender}=setup({createSession:create});sender.start();sender.stop();sender.start();reject(new Error('Unconfirmed response'));await tick();
    expect(sender.getSnapshot().cleanupWarning).toMatch(/not confirmed/i);resolve(value);await tick();sender.stop();await tick();
    expect(sender.getSnapshot().cleanupWarning).toMatch(/not confirmed/i);
  });
  it('Stop synchronously closes and revokes; stale callbacks cannot reactivate it',async()=>{
    const {sender,value,revokeSession}=setup();sender.start();await tick();const socket=FakeSocket.instances[0];socket.open();socket.message(ack(value));
    const lateOpen=socket.onopen,lateMessage=socket.onmessage;sender.stop();lateOpen?.();lateMessage?.({data:JSON.stringify(ack(value))});await tick();
    expect(socket.readyState).toBe(3);expect(revokeSession).toHaveBeenCalledWith(value);expect(sender.getSnapshot()).toMatchObject({status:'off',pairingCode:null});
    await vi.advanceTimersByTimeAsync(6000);expect(FakeSocket.instances).toHaveLength(1);expect(sender.send(tposeFrame())).toBe(false);
  });
  it('revokes creation confirmed after Stop and serializes a rapid restart',async()=>{
    const value=session();let resolve!:(value:PairingSession)=>void;
    const create=vi.fn(()=>new Promise<PairingSession>(done=>resolve=done)),revoke=vi.fn(async()=>{});
    const {sender}=setup({createSession:create,revokeSession:revoke});sender.start();sender.stop();sender.start();await tick();expect(create).toHaveBeenCalledTimes(1);
    resolve(value);await tick();expect(revoke).toHaveBeenCalledWith(value);expect(create).toHaveBeenCalledTimes(2);expect(FakeSocket.instances).toHaveLength(0);
    sender.stop();resolve(value);await tick();expect(FakeSocket.instances).toHaveLength(0);expect(sender.getSnapshot().status).toBe('off');
  });
  it('keeps a failed-revocation warning visible across restarting',async()=>{
    const {sender,value}=setup({revokeSession:async()=>{throw new Error('Could not revoke');}});sender.start();await tick();FakeSocket.instances[0].open();FakeSocket.instances[0].message(ack(value));
    sender.stop();sender.start();await tick();expect(sender.getSnapshot().cleanupWarning).toMatch(/revok/i);
    expect(sender.getSnapshot().pairingCode).toBe(value.pairingCode);
  });
});
