import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { BlobReader, TextWriter, ZipReader } from '@zip.js/zip.js';
import { download, projectId, sample, saved, storedProject } from './helpers';
import { tpose, toMediaPipe } from '../src/motion/poses.testutil';

const choice='Allow MediaPipe performance and usage metrics';
test.beforeEach(async({page})=>{
  await page.addInitScript(()=>{
    Reflect.set(window,'sdkCameraRequests',0);
    Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async()=>{
      Reflect.set(window,'sdkCameraRequests',Number(Reflect.get(window,'sdkCameraRequests'))+1);
      throw new DOMException('Owned test has no physical camera','NotAllowedError');
    }});
  });
  await page.route('**/api/health',route=>route.fulfill({json:{ok:true,blender:false}}));
  await page.route('**/api/export-jobs',route=>route.fulfill({json:{jobs:[]}}));
});

async function syntheticSdk(page:import('@playwright/test').Page,pending=false){
  const world=toMediaPipe(tpose()),image=world.map(p=>({x:0.5+p.x/2,y:0.95+p.y/2,z:0,visibility:1}));
  await page.addInitScript(()=>{
    Reflect.set(window,'sdkFrames',0);Reflect.set(window,'sdkClosed',0);Reflect.set(window,'sdkModels',0);Reflect.set(window,'sdkStopped',0);
    Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async()=>{
      Reflect.set(window,'sdkCameraRequests',Number(Reflect.get(window,'sdkCameraRequests'))+1);
      const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;const context=canvas.getContext('2d')!;let n=0;
      const timer=setInterval(()=>{context.fillStyle=n++%2?'#123456':'#234567';context.fillRect(0,0,640,480);},33);
      const stream=canvas.captureStream(30);const track=stream.getVideoTracks()[0];const stop=track.stop.bind(track);
      track.stop=()=>{clearInterval(timer);Reflect.set(window,'sdkStopped',Number(Reflect.get(window,'sdkStopped'))+1);stop();};
      window.addEventListener('pagehide',()=>{clearInterval(timer);stream.getTracks().forEach(track=>track.stop());},{once:true});
      return stream;
    }});
  });
  await page.route('**/src/capture/landmarkers.ts',route=>route.fulfill({contentType:'text/javascript',body:`
    export class CaptureError extends Error{}
    const world=${JSON.stringify(world)},image=${JSON.stringify(image)};
    const bundle=()=>({pose:{detectForVideo(){window.sdkFrames++;return {worldLandmarks:[world],landmarks:[image]}},close(){window.sdkClosed++}},hands:undefined});
    export function createLandmarkers(quality,authorize){authorize();window.sdkModels++;
      ${pending?'return new Promise(resolve=>{window.sdkResolveModels=()=>resolve(bundle())});':'return Promise.resolve(bundle());'}}
    export function closeLandmarkers(value){value?.pose.close();value?.hands?.close();}
  `}));
}

test('withdrawal ends recording through final save and preserves original captured frames',async({page})=>{
  await syntheticSdk(page);const original=await sample(page);
  await page.getByRole('button',{name:'New take',exact:true}).click();
  await page.getByRole('checkbox',{name:choice}).check();await page.getByRole('button',{name:'Start camera',exact:true}).click();
  await expect(page.getByRole('button',{name:'Record',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Record',exact:true}).click();
  await expect(page.getByRole('button',{name:'Stop',exact:true})).toBeVisible();
  await expect.poll(async()=>(await storedProject(page)).takes[1]?.frames.length??0,{timeout:10000}).toBeGreaterThan(5);
  const prefix=(await storedProject(page)).takes[1];
  await page.getByRole('checkbox',{name:choice}).uncheck();
  await expect.poll(async()=>(await storedProject(page)).takes[1].status).toBe('complete');await saved(page);
  await expect.poll(()=>page.evaluate(()=>Number(Reflect.get(window,'sdkClosed')))).toBe(1);
  const count=await page.evaluate(()=>Number(Reflect.get(window,'sdkFrames')));
  await page.waitForTimeout(200);expect(await page.evaluate(()=>Number(Reflect.get(window,'sdkFrames')))).toBe(count);
  expect(await page.evaluate(()=>Number(Reflect.get(window,'sdkStopped')))).toBeGreaterThan(0);
  const result=await storedProject(page);expect(result.takes[0]).toEqual(original.takes[0]);
  expect(result.takes[1].frames.slice(0,prefix.frames.length)).toEqual(prefix.frames);
  await page.reload();await expect(page.getByRole('checkbox',{name:choice})).not.toBeChecked();
  expect((await storedProject(page)).takes[1].frames).toEqual(result.takes[1].frames);
});

test('withdrawal cancels countdown without creating an empty take',async({page})=>{
  await syntheticSdk(page);await page.goto('/');await saved(page);
  await page.getByRole('checkbox',{name:choice}).check();await page.getByRole('button',{name:'Start camera',exact:true}).click();
  await expect(page.getByRole('button',{name:'Record',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Record',exact:true}).click();
  await expect(page.getByRole('button',{name:'Cancel',exact:true})).toBeVisible();
  await page.getByRole('checkbox',{name:choice}).uncheck();
  await expect(page.getByRole('button',{name:'Record',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Record',exact:true})).toBeDisabled();
  expect((await storedProject(page)).takes).toHaveLength(0);
});

test('late returned camera models close after withdrawal and regrant without automatic restart',async({page})=>{
  await syntheticSdk(page,true);await page.goto('/');
  const permission=page.getByRole('checkbox',{name:choice});await permission.check();
  await page.getByRole('button',{name:'Start camera',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>typeof Reflect.get(window,'sdkResolveModels'))).toBe('function');
  await permission.uncheck();await permission.check();
  await page.evaluate(()=>(Reflect.get(window,'sdkResolveModels') as ()=>void)());
  await expect.poll(()=>page.evaluate(()=>Number(Reflect.get(window,'sdkClosed')))).toBe(1);
  expect(await page.evaluate(()=>Number(Reflect.get(window,'sdkModels')))).toBe(1);
  await expect(page.getByRole('button',{name:'Start camera',exact:true})).toBeEnabled();
  expect(await page.evaluate(()=>Number(Reflect.get(window,'sdkFrames')))).toBe(0);
});

test('withdrawal and regrant prevent an old selected-camera failure from opening fallback camera',async({page})=>{
  await syntheticSdk(page);
  await page.addInitScript(()=>{
    Object.defineProperty(navigator.mediaDevices,'enumerateDevices',{configurable:true,value:async()=>[
      {kind:'videoinput',deviceId:'owned-selected',label:'Owned delayed camera',groupId:'owned'}
    ]});
    Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:()=>{
      Reflect.set(window,'sdkCameraRequests',Number(Reflect.get(window,'sdkCameraRequests'))+1);
      return new Promise((_resolve,reject)=>Reflect.set(window,'sdkRejectCamera',()=>reject(new DOMException('Owned delayed failure','NotFoundError'))));
    }});
  });
  await page.goto('/');await page.getByRole('combobox',{name:'Camera',exact:true}).selectOption('owned-selected');
  const permission=page.getByRole('checkbox',{name:choice});await permission.check();
  await page.getByRole('button',{name:'Start camera',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>typeof Reflect.get(window,'sdkRejectCamera'))).toBe('function');
  await permission.uncheck();await permission.check();
  await page.evaluate(()=>(Reflect.get(window,'sdkRejectCamera') as ()=>void)());
  await expect.poll(()=>page.evaluate(()=>Number(Reflect.get(window,'sdkClosed')))).toBe(1);
  expect(await page.evaluate(()=>Number(Reflect.get(window,'sdkCameraRequests')))).toBe(1);
  expect(await page.evaluate(()=>Number(Reflect.get(window,'sdkFrames')))).toBe(0);
});

test('programmatic denied video pick does not bypass processing admission',async({page})=>{
  await syntheticSdk(page);await page.goto('/');await saved(page);
  const original=await storedProject(page);
  await page.getByLabel('Video file to import').setInputFiles({name:'owned-denied.webm',mimeType:'video/webm',buffer:Buffer.from('synthetic denied fixture')});
  await expect(page.getByText('Allow MediaPipe processing before starting camera or video.',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>Number(Reflect.get(window,'sdkModels')))).toBe(0);
  expect(await storedProject(page)).toEqual(original);
});

async function syntheticVideoSource(page:import('@playwright/test').Page,pendingSeek=false){
  await page.route('**/src/import/videoSource.ts',route=>route.fulfill({contentType:'text/javascript',body:`
    export async function openVideoFile(file,video,signal){signal.throwIfAborted();Object.defineProperty(video,'videoWidth',{value:640});Object.defineProperty(video,'videoHeight',{value:480});return 1;}
    export function seekTo(video,t,signal){signal.throwIfAborted();${pendingSeek?'return new Promise(resolve=>{window.sdkFinishSeek=resolve});':'return Promise.resolve();'}}
    export function closeVideoFile(){}
  `}));
}

test('pending admitted video model cannot deliver a take after withdrawal',async({page})=>{
  await syntheticSdk(page,true);await syntheticVideoSource(page);await page.goto('/');await saved(page);
  const original=await storedProject(page);await page.getByRole('checkbox',{name:choice}).check();
  await page.getByLabel('Video file to import').setInputFiles({name:'owned-pending.webm',mimeType:'video/webm',buffer:Buffer.from('owned synthetic decoder fixture')});
  await expect.poll(()=>page.evaluate(()=>typeof Reflect.get(window,'sdkResolveModels'))).toBe('function');
  await page.getByRole('checkbox',{name:choice}).uncheck();
  await page.evaluate(()=>(Reflect.get(window,'sdkResolveModels') as ()=>void)());
  await expect.poll(()=>page.evaluate(()=>Number(Reflect.get(window,'sdkClosed')))).toBe(1);
  expect(await page.evaluate(()=>Number(Reflect.get(window,'sdkFrames')))).toBe(0);expect(await storedProject(page)).toEqual(original);
});

test('withdrawal during a video seek prevents new inference and stale take commit',async({page})=>{
  await syntheticSdk(page);await syntheticVideoSource(page,true);await page.goto('/');await saved(page);
  const original=await storedProject(page);await page.getByRole('checkbox',{name:choice}).check();
  await page.getByLabel('Video file to import').setInputFiles({name:'owned-seek.webm',mimeType:'video/webm',buffer:Buffer.from('owned synthetic decoder fixture')});
  await expect.poll(()=>page.evaluate(()=>typeof Reflect.get(window,'sdkFinishSeek'))).toBe('function');
  await page.getByRole('checkbox',{name:choice}).uncheck();await page.evaluate(()=>(Reflect.get(window,'sdkFinishSeek') as ()=>void)());
  await expect.poll(()=>page.evaluate(()=>Number(Reflect.get(window,'sdkClosed')))).toBe(1);
  expect(await page.evaluate(()=>Number(Reflect.get(window,'sdkFrames')))).toBe(0);expect(await storedProject(page)).toEqual(original);
});

test('default choice and checkbox-only do not start camera or model processing',async({page})=>{
  let models=0;
  await page.route('**/models/**',route=>{models++;return route.abort();});
  await page.route('**/mediapipe/**',route=>{models++;return route.abort();});
  await page.goto('/');
  const permission=page.getByRole('checkbox',{name:choice});
  await expect(permission).not.toBeChecked();
  await expect(page.getByRole('button',{name:'Start camera',exact:true})).toBeDisabled();
  await expect(page.getByRole('button',{name:'Import video',exact:true})).toBeDisabled();
  await permission.focus();await page.keyboard.press('Space');await expect(permission).toBeChecked();
  await expect(page.getByRole('button',{name:'Start camera',exact:true})).toBeEnabled();
  await expect(page.getByRole('button',{name:'Import video',exact:true})).toBeEnabled();
  expect(await page.evaluate(()=>Number(Reflect.get(window,'sdkCameraRequests')))).toBe(0);expect(models).toBe(0);
});

test('declined sample editing and backup restore survive reload without storing processing permission',async({page},info)=>{
  const original=await sample(page);const permission=page.getByRole('checkbox',{name:choice});
  await expect(permission).not.toBeChecked();await permission.check();
  await page.getByLabel('Clip 1 name').fill('SDK_choice_not_saved');await saved(page);
  await page.reload();await expect(permission).not.toBeChecked();
  await expect(page.getByLabel('Clip 1 name')).toHaveValue('SDK_choice_not_saved');
  expect((await storedProject(page)).takes[0].frames).toEqual(original.takes[0].frames);
  expect(JSON.stringify(await storedProject(page))).not.toContain('processingConsent');
  expect(await page.evaluate(()=>Number(Reflect.get(window,'sdkCameraRequests')))).toBe(0);
  await permission.check();const file=await download(page,info,'sdk-permission-free.emotecap');
  const reader=new ZipReader(new BlobReader(new Blob([await readFile(file)])),{useWebWorkers:false});
  try {
    const entries=await reader.getEntries();
    for(const entry of entries){
      expect(entry.filename).not.toMatch(/consent|privacy|permission/i);
      if(!entry.directory && entry.filename.endsWith('.json')){
        expect(await entry.getData(new TextWriter())).not.toMatch(/processingConsent|processingAllowed|sdk-processing|sdk-permission/i);
      }
    }
  } finally {await reader.close();}
  const archiveBytes=Array.from(await readFile(file));
  const archiveCheck=await page.evaluate(async bytes=>{
    try{const url='/src/project/archive/codec.ts';const codec=await import(url);await codec.decodeProject(new Blob([new Uint8Array(bytes)]));return null;}
    catch(error){const outer=error as Error;return {message:outer.message,cause:String(outer.cause)};}
  },archiveBytes);
  expect(archiveCheck).toBeNull();
  await permission.uncheck();
  await page.getByLabel('Import project file').setInputFiles({name:'sdk-permission-free.emotecap',mimeType:'application/x-emotecap',buffer:Buffer.from(archiveBytes)});
  await expect.poll(()=>projectId(page)).not.toBe(original.id);await saved(page);
  await expect(permission).not.toBeChecked();
  expect((await storedProject(page)).takes[0].frames).toEqual(original.takes[0].frames);
  await page.reload();await expect(permission).not.toBeChecked();
});
