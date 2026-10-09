import {expect,test} from '@playwright/test';
import {sample} from './helpers';
const id='10000000-0000-4000-8000-000000000001',streamId='20000000-0000-4000-8000-000000000001';
test.beforeEach(async({page})=>{
  await page.route('**/api/health',r=>r.fulfill({json:{ok:true,blender:false,gemini:false,exportJobs:1}}));
  await page.route('**/api/export-jobs',r=>r.fulfill({json:{jobs:[]}}));
  await page.addInitScript(({id,streamId})=>{
    const state={sockets:[] as FakeSocket[],allowAck:false,cameras:0};
    class FakeSocket {
      readyState=0;bufferedAmount=0;onopen:(()=>void)|null=null;onclose:((event:{code:number;reason:string})=>void)|null=null;
      onerror:(()=>void)|null=null;onmessage:((event:{data:string})=>void)|null=null;lastHello:unknown=null;
      constructor(readonly url:string){state.sockets.push(this);setTimeout(()=>{this.readyState=1;this.onopen?.();},0);}
      send(text:string){const message=JSON.parse(text);if(message.type==='hello'){this.lastHello=message;if(state.allowAck)this.ack();}}
      ack(){const hello=this.lastHello as {bones:string[]}|null;if(hello)this.onmessage?.({data:JSON.stringify({type:'hello',version:2,bones:hello.bones,
        sessionId:id,role:'source',streamId,expiresAt:(window as unknown as {__pairExpiry:number}).__pairExpiry})});}
      close(){this.readyState=3;this.onclose?.({code:1000,reason:''});}
    }
    Object.defineProperty(window,'WebSocket',{value:FakeSocket});
    Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async()=>{state.cameras++;throw new Error('Pairing never opens a camera');}});
    (window as unknown as {__liveTest:typeof state}).__liveTest=state;
  },{id,streamId});
});
test('Live Link stays off for sample; explicit pairing waits for ack and Stop revokes',async({page})=>{
  let creates=0,deletes=0,models=0;const expiresAt=Date.now()+3600000;
  await page.addInitScript(expiresAt=>(window as unknown as {__pairExpiry:number}).__pairExpiry=expiresAt,expiresAt);
  await page.route('**/models/**',r=>{models++;return r.abort();});await page.route('**/mediapipe/**',r=>{models++;return r.abort();});
  await page.route('**/api/live-sessions',r=>{creates++;return r.fulfill({status:201,json:{id,sourceToken:'s'.repeat(43),pairingCode:id+'.'+'p'.repeat(43),expiresAt}});});
  await page.route('**/api/live-sessions/*',r=>{deletes++;expect(r.request().method()).toBe('DELETE');return r.fulfill({status:204});});
  await sample(page);expect(creates).toBe(0);expect(models).toBe(0);
  await page.getByRole('button',{name:'Live Link off',exact:true}).click();
  const panel=page.getByRole('region',{name:'Unity Live Link'});await expect(panel.getByLabel('Unity pairing code')).toHaveValue(id+'.'+'p'.repeat(43));
  await expect(page.getByRole('button',{name:'Live Link connecting…',exact:true})).toBeVisible();expect(creates).toBe(1);
  await expect.poll(()=>page.evaluate(()=>{
    const state=(window as unknown as {__liveTest:{sockets:{url:string;lastHello:unknown}[]}}).__liveTest;
    return state.sockets.some(socket=>socket.url.endsWith('/ws/live?role=source')&&socket.lastHello!==null);
  })).toBe(true);
  await page.evaluate(()=>{const state=(window as unknown as {__liveTest:{sockets:{url:string;ack():void}[]}}).__liveTest;
    state.sockets.find(socket=>socket.url.endsWith('/ws/live?role=source'))!.ack();});
  await expect(page.getByRole('button',{name:'Live Link streaming',exact:true})).toBeVisible();
  await panel.getByLabel('Unity pairing code').focus();await page.keyboard.press('Control+A');
  await page.getByRole('button',{name:'Live Link streaming',exact:true}).click();await expect.poll(()=>deletes).toBe(1);
  await expect(page.getByRole('button',{name:'Live Link off',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>(window as unknown as {__liveTest:{cameras:number}}).__liveTest.cameras)).toBe(0);expect(models).toBe(0);
});
test('pairing admission failure is visible and does not start a camera',async({page})=>{
  await page.route('**/api/live-sessions',r=>r.fulfill({status:409,json:{detail:'Four pairing sessions are active'}}));
  await sample(page);await page.getByRole('button',{name:'Live Link off',exact:true}).click();
  await expect(page.getByRole('region',{name:'Unity Live Link'})).toContainText('HTTP 409');
  await expect(page.getByRole('button',{name:'Live Link failed',exact:true})).toBeVisible();
});
