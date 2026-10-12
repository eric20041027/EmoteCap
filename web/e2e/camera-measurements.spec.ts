import {createHash,randomUUID} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {expect,test,type Page} from '@playwright/test';
import {tpose,toMediaPipe} from '../src/motion/poses.testutil';
import type {CameraReceipt} from '../src/evaluation/cameraMeasurements';
const world=toMediaPipe(tpose()),image=world.map(p=>({x:.5+p.x/2,y:.95+p.y/2,z:0,visibility:1}));
const root=path.resolve(process.env.EMOTECAP_E2E_ARTIFACT_DIR??`../.superpowers/e2e/camera-${randomUUID()}`);
async function controlled(page:Page){
  await page.addInitScript(()=>{
    Reflect.set(window,'cameraRequests',0);Reflect.set(window,'cameraDetects',0);Reflect.set(window,'cameraCloses',0);Reflect.set(window,'cameraStops',0);
    const originalSet=window.setTimeout.bind(window),originalClear=window.clearTimeout.bind(window);
    const probeTimers=new Set<number>();
    window.setTimeout=((handler:TimerHandler,timeout?:number,...args:unknown[])=>{
      const id=originalSet(handler,timeout,...args);if(timeout===180000){probeTimers.add(id);Reflect.set(window,'expireCameraMeasurement',handler);}return id;
    }) as typeof window.setTimeout;
    Object.defineProperty(window,'clearTimeout',{value:(id?:number)=>{if(id!==undefined&&probeTimers.delete(id))Reflect.set(window,'cameraTimerCleared',true);originalClear(id);}});
    Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async()=>{
      Reflect.set(window,'cameraRequests',Number(Reflect.get(window,'cameraRequests'))+1);
      const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;const ctx=canvas.getContext('2d')!;let n=0;
      const draw=()=>{ctx.fillStyle=n++%2?'#234567':'#345678';ctx.fillRect(0,0,1280,720);};draw();const timer=setInterval(draw,33);
      const stream=canvas.captureStream(30),track=stream.getVideoTracks()[0],stop=track.stop.bind(track);
      let declaredRate=30;const settings=track.getSettings.bind(track);
      track.getSettings=()=>({...settings(),frameRate:declaredRate});
      Reflect.set(window,'changeCameraConditions',(width:number,rate:number)=>{canvas.width=width;declaredRate=rate;draw();});
      track.stop=()=>{clearInterval(timer);Reflect.set(window,'cameraStops',Number(Reflect.get(window,'cameraStops'))+1);stop();};
      window.addEventListener('pagehide',()=>{clearInterval(timer);stream.getTracks().forEach(track=>track.stop());},{once:true});return stream;
    }});
  });
  await page.route('**/src/capture/landmarkers.ts',route=>route.fulfill({contentType:'text/javascript',body:`
    export class CaptureError extends Error {}
    const world=${JSON.stringify(world)},image=${JSON.stringify(image)};
    export async function createLandmarkers(){return {poseDelegate:window.cameraUnknownDelegate?undefined:'GPU',handDelegate:'CPU',
      pose:{detectForVideo(){window.cameraDetects++;if(window.cameraFault==='detector')throw new Error('controlled detector failure');
        return window.cameraFault==='no-pose'||window.cameraDetects%5===0?{worldLandmarks:[],landmarks:[]}:{worldLandmarks:[world],landmarks:[image]};},close(){window.cameraCloses++;}},
      hands:{detectForVideo(){if(window.cameraFault==='hand')throw new Error('controlled hand failure');return {worldLandmarks:[],landmarks:[],handedness:[]};},close(){window.cameraCloses++;}}};}
    export function closeLandmarkers(value){value?.pose.close();value?.hands?.close();}
  `}));
  await page.route('**/api/health',route=>route.fulfill({json:{ok:true,blender:false}}));
}
async function declarations(page:Page){
  await page.getByLabel('Source commit',{exact:true}).fill('a'.repeat(40));
  for(const [label,value] of [['Device model','Owned synthetic canvas'],['Operating system','Synthetic Windows'],['CPU','Synthetic CPU'],['GPU','Synthetic GPU'],['Browser','Synthetic Edge 154']])
    await page.getByLabel(label,{exact:true}).fill(value);
  await page.getByLabel('I have permission to process this camera session locally',{exact:true}).check();
}
async function camera(page:Page){await page.getByRole('checkbox',{name:'Allow MediaPipe performance and usage metrics'}).check();
  await page.getByRole('button',{name:'Start camera',exact:true}).click();
  await expect(page.getByRole('button',{name:'Start measurement',exact:true})).toBeEnabled();}
async function start(page:Page){await controlled(page);await page.goto('/camera-measurements.html');await declarations(page);await camera(page);
  await page.getByRole('button',{name:'Start measurement',exact:true}).click();}
async function receipt(page:Page,name:string){
  const pending=page.waitForEvent('download');await page.getByRole('link',{name:'Download camera receipt',exact:true}).click();
  const download=await pending,stream=await download.createReadStream(),parts:Buffer[]=[];for await(const part of stream!)parts.push(Buffer.from(part));
  const bytes=Buffer.concat(parts);mkdirSync(root,{recursive:true});writeFileSync(path.join(root,name),bytes,{flag:'wx'});
  expect(bytes.length).toBeLessThan(32*1024*1024);return JSON.parse(bytes.toString()) as CameraReceipt;
}
test('requires explicit SDK, camera and local actor actions; measures actual Studio rendering',async({page,browser})=>{
  await controlled(page);let external=0;page.on('request',r=>{if(r.url().startsWith('http')&&new URL(r.url()).origin!=='http://127.0.0.1:4175')external++;});
  await page.goto('/camera-measurements.html');await expect(page.getByRole('heading',{name:'Studio camera measurements'})).toBeVisible();
  expect(await page.evaluate(()=>Reflect.get(window,'cameraRequests'))).toBe(0);
  await page.getByRole('checkbox',{name:'Allow MediaPipe performance and usage metrics'}).check();
  expect(await page.evaluate(()=>Reflect.get(window,'cameraRequests'))).toBe(0);
  await page.getByRole('button',{name:'Start camera',exact:true}).click();
  await expect(page.getByRole('button',{name:'Start measurement',exact:true})).toBeDisabled();
  await declarations(page);await page.getByRole('button',{name:'Start measurement',exact:true}).click();
  await expect(page.getByLabel('CPU',{exact:true})).toBeDisabled();
  await expect.poll(()=>page.evaluate(()=>Number(Reflect.get(window,'cameraDetects')))).toBeGreaterThan(15);
  await page.getByRole('button',{name:'Measure next-frame response',exact:true}).click();
  await expect(page.getByRole('status',{name:'Measurement status'})).toContainText('Response observed');
  await page.getByRole('button',{name:'Stop measurement',exact:true}).click();
  const report=await receipt(page,'camera-completed.json');
  expect(report).toMatchObject({schema:'emotecap-camera-measurement-v1',qualification:'pending',outcome:'completed',fast720pLaptopCandidate:false,
    latencyDefinition:'detection-to-render-call',metadata:{classification:'synthetic'},setup:{width:1280,height:720,poseDelegate:'GPU',handDelegate:'CPU'}});
  expect(report.summary!.renderedCount).toBeGreaterThan(0);expect(report.summary!.failureRate).toBeGreaterThan(0);
  expect(report.summary!.inputIdentityAvailable).toBe(true);
  expect(report.inputFrameDefinition).toBe('video-frame-callback-presented-frames');
  expect(report.summary!.inputCounterProgress).toBe('advancing');
  expect(report.summary!.renderedOutputCount).toBe(report.summary!.renderedCount!);
  const uniqueRendered=new Set(report.attempts.filter(a=>a.status==='ok'&&a.renderedMs!==null).map(a=>a.inputFrame));
  expect(report.summary!.renderedCount).toBe(uniqueRendered.size);
  expect(report.attempts.some(a=>a.handState==='ran')).toBe(true);expect(report.attempts.some(a=>a.handState==='reused')).toBe(true);
  expect(report.interactions).toHaveLength(1);
  for(const [key,file] of [['App','src/App.tsx'],['usePose','src/capture/usePose.ts'],['PreviewCanvas','src/preview/PreviewCanvas.tsx'],['cameraMeasurements','src/evaluation/cameraMeasurements.ts'],['videoFrameLoop','src/capture/videoFrameLoop.ts']])
    expect(report.metadata.sourceDigests[key]).toBe(createHash('sha256').update(readFileSync(file)).digest('hex'));
  const serialized=JSON.stringify(report);for(const value of ['"cameraKey"','"deviceId"','worldLandmarks','"r":','"h":','pairingCode'])expect(serialized).not.toContain(value);
  expect(external).toBe(0);console.log(`Camera controls qualified in ${browser.version()}, synthetic only`);
  await page.getByRole('button',{name:'Stop camera',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>Number(Reflect.get(window,'cameraCloses')))).toBe(2);
  expect(await page.evaluate(()=>Reflect.get(window,'cameraTimerCleared'))).toBe(true);
  await page.setViewportSize({width:320,height:844});
  await page.screenshot({path:path.join(root,'camera-narrow.png'),fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('settings change preserves a partial receipt and invalid declarations preserve the previous download',async({page})=>{
  await start(page);await page.getByRole('button',{name:'Portrait crop',exact:true}).click();
  await expect(page.getByRole('status',{name:'Measurement status'})).toContainText('capture-context-changed');
  const report=await receipt(page,'camera-settings-partial.json');expect(report).toMatchObject({outcome:'incomplete',summary:null});
  await page.getByLabel('Source commit',{exact:true}).fill('bad');await expect(page.getByRole('button',{name:'Start measurement',exact:true})).toBeDisabled();
  const previous=await receipt(page,'camera-preserved-previous.json');expect(previous).toEqual(report);
});
test('withdrawal synchronously stops diagnostics and releases the actual owned capture resources',async({page})=>{
  await start(page);await expect.poll(()=>page.evaluate(()=>Number(Reflect.get(window,'cameraDetects')))).toBeGreaterThan(5);
  await page.getByRole('checkbox',{name:'Allow MediaPipe performance and usage metrics'}).uncheck();
  await expect(page.getByRole('status',{name:'Measurement status'})).toContainText('permission-withdrawn');
  const report=await receipt(page,'camera-withdrawn.json');expect(report).toMatchObject({outcome:'incomplete',summary:null});
  await expect.poll(()=>page.evaluate(()=>Number(Reflect.get(window,'cameraCloses')))).toBe(2);
  expect(await page.evaluate(()=>Number(Reflect.get(window,'cameraStops')))).toBeGreaterThan(0);
  await expect(page.getByRole('button',{name:'Start camera',exact:true})).toBeDisabled();
});
test('retains fatal detector evidence and all-no-pose completed zero results',async({page})=>{
  await start(page);await page.evaluate(()=>Reflect.set(window,'cameraFault','detector'));
  await expect(page.getByRole('status',{name:'Measurement status'})).toContainText('camera-failed');
  const failed=await receipt(page,'camera-detector-failed.json');expect(failed.attempts.at(-1)?.status).toBe('detector-error');expect(failed.summary).toBeNull();
  await page.evaluate(()=>Reflect.set(window,'cameraFault','no-pose'));await page.getByRole('button',{name:'Retry',exact:true}).click();
  await expect(page.getByRole('button',{name:'Start measurement',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Start measurement',exact:true}).click();
  const before=await page.evaluate(()=>Number(Reflect.get(window,'cameraDetects')));
  await expect.poll(()=>page.evaluate(()=>Number(Reflect.get(window,'cameraDetects')))).toBeGreaterThan(before+5);
  await page.getByRole('button',{name:'Stop measurement',exact:true}).click();const empty=await receipt(page,'camera-no-pose.json');
  expect(empty.summary).toMatchObject({effectiveRenderedFps:0,failureRate:1,p95DetectionToRenderCallMs:null});
});
test('hand degradation stops comparable collection while ordinary body capture keeps working',async({page})=>{
  await start(page);await page.evaluate(()=>Reflect.set(window,'cameraFault','hand'));
  await expect(page.getByRole('status',{name:'Measurement status'})).toContainText('camera-setup-changed');
  const report=await receipt(page,'camera-hands-partial.json');expect(report).toMatchObject({outcome:'incomplete',summary:null});
  expect(report.attempts.at(-1)?.handState).toBe('unavailable');
  const before=await page.evaluate(()=>Number(Reflect.get(window,'cameraDetects')));
  await expect.poll(()=>page.evaluate(()=>Number(Reflect.get(window,'cameraDetects')))).toBeGreaterThan(before+3);
  await expect(page.getByRole('button',{name:'Record',exact:true})).toBeEnabled();
});
test('owned wall timer ends a stalled camera and visibility/unmount release the timer',async({page})=>{
  await start(page);await page.evaluate(()=>document.querySelector('video')!.pause());
  await expect.poll(()=>page.evaluate(()=>typeof Reflect.get(window,'expireCameraMeasurement'))).toBe('function');
  await page.evaluate(()=>(Reflect.get(window,'expireCameraMeasurement') as ()=>void)());
  await expect(page.getByRole('status',{name:'Measurement status'})).toContainText('wall-timeout');
  expect(await receipt(page,'camera-stalled.json')).toMatchObject({outcome:'incomplete',summary:null});
  await page.getByRole('button',{name:'Start measurement',exact:true}).click();
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{get:()=>true,configurable:true});document.dispatchEvent(new Event('visibilitychange'));});
  await expect(page.getByRole('status',{name:'Measurement status'})).toContainText('page-hidden');
  expect(await receipt(page,'camera-hidden.json')).toMatchObject({outcome:'incomplete',summary:null});
  expect(await page.evaluate(()=>Reflect.get(window,'cameraTimerCleared'))).toBe(true);
});
test('observer failures close only diagnostics and unknown delegates never gain a candidate claim',async({page})=>{
  await controlled(page);await page.goto('/camera-measurements.html');await declarations(page);
  await page.evaluate(()=>Reflect.set(window,'cameraUnknownDelegate',true));await camera(page);
  await page.evaluate(async()=>{const moduleURL='/src/evaluation/cameraMeasurements.ts',module=await import(moduleURL);
    module.CameraMeasurements.prototype.begin=()=>{throw new Error('controlled observer failure');};});
  await page.getByRole('button',{name:'Start measurement',exact:true}).click();
  await expect(page.getByRole('status',{name:'Measurement status'})).toContainText('observer-failed');
  const report=await receipt(page,'camera-observer-failed.json');expect(report).toMatchObject({outcome:'incomplete',summary:null,fast720pLaptopCandidate:false,setup:{poseDelegate:null}});
  await expect(page.getByRole('button',{name:'Record',exact:true})).toBeEnabled();
});
for(const change of [{name:'delivered width concealed by portrait crop',width:1920,rate:30},{name:'frame-rate hint without dimension change',width:1280,rate:15}]){
  test(`capture drift ends a partial receipt: ${change.name}`,async({page})=>{
    await controlled(page);await page.goto('/camera-measurements.html');await declarations(page);await camera(page);
    await page.getByRole('button',{name:'Portrait crop',exact:true}).click();
    await page.getByRole('button',{name:'Start measurement',exact:true}).click();
    await page.evaluate(({width,rate})=>(Reflect.get(window,'changeCameraConditions') as (w:number,r:number)=>void)(width,rate),change);
    await expect(page.getByRole('status',{name:'Measurement status'})).toContainText('camera-setup-changed');
    const report=await receipt(page,`camera-drift-${change.width}-${change.rate}.json`);
    expect(report).toMatchObject({outcome:'incomplete',reason:'camera-setup-changed',summary:null,setup:{width:1280,height:720,frameRate:30}});
    const before=await page.evaluate(()=>Number(Reflect.get(window,'cameraDetects')));
    await expect.poll(()=>page.evaluate(()=>Number(Reflect.get(window,'cameraDetects')))).toBeGreaterThan(before+3);
    await expect(page.getByRole('button',{name:'Record',exact:true})).toBeEnabled();
  });
}
test('actual WebGL loss ends diagnostics and preserves ordinary camera capture',async({page})=>{
  await start(page);
  await page.getByRole('region',{name:'3D preview',exact:true}).locator('canvas').evaluate(async element=>{
    const canvas=element as HTMLCanvasElement,gl=canvas.getContext('webgl2')??canvas.getContext('webgl');
    const extension=gl?.getExtension('WEBGL_lose_context');if(!extension)throw new Error('Actual context-loss test is unavailable');
    Reflect.set(window,'restoreControlledPreview',()=>extension.restoreContext());
    const lost=new Promise<void>(resolve=>canvas.addEventListener('webglcontextlost',()=>resolve(),{once:true}));extension.loseContext();await lost;
  });
  await expect(page.getByRole('status',{name:'Measurement status'})).toContainText('preview-unavailable');
  const report=await receipt(page,'camera-webgl-lost.json');expect(report).toMatchObject({outcome:'incomplete',reason:'preview-unavailable',summary:null});
  await expect(page.getByRole('button',{name:'Start measurement',exact:true})).toBeDisabled();
  const before=await page.evaluate(()=>Number(Reflect.get(window,'cameraDetects')));
  await expect.poll(()=>page.evaluate(()=>Number(Reflect.get(window,'cameraDetects')))).toBeGreaterThan(before+3);
  await expect(page.getByRole('button',{name:'Record',exact:true})).toBeEnabled();
  await page.getByRole('region',{name:'3D preview',exact:true}).locator('canvas').evaluate(element=>new Promise<void>(resolve=>{
    element.addEventListener('webglcontextrestored',()=>resolve(),{once:true});
    setTimeout(()=>(Reflect.get(window,'restoreControlledPreview') as ()=>void)(),1200);
  }));
  await expect(page.getByRole('button',{name:'Start measurement',exact:true})).toBeEnabled();
});
