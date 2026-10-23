import { expect, test } from '@playwright/test';
import { tpose, toMediaPipe } from '../src/motion/poses.testutil';
import { ARMS_DOWN_IMAGE } from '../src/import/testPoses';
import { mediaRows, sample, saved, storedProject } from './helpers';
const world=toMediaPipe(tpose());
const image=world.map(p=>({x:0.5+p.x/2,y:0.95+p.y/2,z:0,visibility:1}));
test.beforeAll(async({browser})=>{console.log(`Acceptance browser: ${browser.version()}`);});
test('camera startup is explicit and stopping releases a late model even before permission settles',async({page})=>{
  await page.addInitScript(()=>{
    Reflect.set(window,'emoteCameraRequests',0);Reflect.set(window,'emoteModelsClosed',0);
    Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:()=>{
      Reflect.set(window,'emoteCameraRequests',Number(Reflect.get(window,'emoteCameraRequests'))+1);
      return new Promise(()=>{});
    }});
  });
  await page.route('**/src/capture/landmarkers.ts',route=>route.fulfill({contentType:'text/javascript',body:`
    export class CaptureError extends Error {}
    export function createLandmarkers(){return new Promise(resolve=>{window.emoteResolveModel=()=>resolve({pose:{close(){window.emoteModelsClosed++}},hands:undefined})});}
    export function closeLandmarkers(value){value?.pose.close();value?.hands?.close();}
  `}));
  await page.route('**/api/health',route=>route.fulfill({json:{ok:true,blender:false}}));
  await page.goto('/');await expect(page.getByRole('heading',{name:'Camera',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>Number(Reflect.get(window,'emoteCameraRequests')))).toBe(0);
  await page.getByRole('checkbox',{name:'Allow MediaPipe performance and usage metrics'}).check();await page.getByRole('button',{name:'Start camera',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>typeof Reflect.get(window,'emoteResolveModel'))).toBe('function');
  await page.getByRole('button',{name:'Stop camera',exact:true}).click();
  await page.evaluate(()=>(Reflect.get(window,'emoteResolveModel') as ()=>void)());
  await expect.poll(()=>page.evaluate(()=>Number(Reflect.get(window,'emoteModelsClosed')))).toBe(1);
  await expect(page.getByRole('button',{name:'Start camera',exact:true})).toBeVisible();
});

async function syntheticCapture(page:import('@playwright/test').Page) {
  await page.addInitScript(()=>{
    Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async()=>{
      const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;const context=canvas.getContext('2d')!;let n=0;
      const timer=setInterval(()=>{context.fillStyle=n++%2?'#234567':'#345678';context.fillRect(0,0,canvas.width,canvas.height);},33);
      const stream=canvas.captureStream(30);const track=stream.getVideoTracks()[0];track.addEventListener('ended',()=>clearInterval(timer));
      window.addEventListener('pagehide',()=>{clearInterval(timer);stream.getTracks().forEach(track=>track.stop());},{once:true});return stream;
    }});
  });
  await page.route('**/src/capture/landmarkers.ts',route=>route.fulfill({contentType:'text/javascript',body:`
    export class CaptureError extends Error {}
    const world=${JSON.stringify(world)},image=${JSON.stringify(image)},down=${JSON.stringify(ARMS_DOWN_IMAGE)};
    export async function createLandmarkers(){return {pose:{detectForVideo(){return {worldLandmarks:[world],landmarks:[window.emoteArmsDown?down:image]}},close(){}},hands:undefined};}
    export function closeLandmarkers(value){value?.pose.close();value?.hands?.close();}
  `}));
  await page.route('**/api/health',route=>route.fulfill({json:{ok:true,blender:false}}));
}

test('hand intent restarts owned models and cleans late results after switching and withdrawal',async({page})=>{
  await syntheticCapture(page);
  await page.addInitScript(()=>{
    localStorage.setItem('emotecap.skeleton','body');
    Reflect.set(window,'captureModelIntents',[]);Reflect.set(window,'captureModelsClosed',0);
    Reflect.set(window,'captureModelResolvers',[]);
  });
  await page.route('**/src/capture/landmarkers.ts',route=>route.fulfill({contentType:'text/javascript',body:`
    export class CaptureError extends Error {}
    export function createLandmarkers(quality,authorize,options){
      authorize();window.captureModelIntents.push(options.trackHands);
      return new Promise(resolve=>window.captureModelResolvers.push(()=>resolve({pose:{close(){window.captureModelsClosed++}},hands:undefined})));
    }
    export function closeLandmarkers(value){value?.pose.close();value?.hands?.close();}
  `}));
  await page.goto('/');const permission=page.getByRole('checkbox',{name:'Allow MediaPipe performance and usage metrics'});
  await permission.check();await page.getByRole('button',{name:'Start camera',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>Reflect.get(window,'captureModelIntents'))).toEqual([false]);
  await page.getByLabel('Skeleton',{exact:true}).selectOption('full');
  await expect.poll(()=>page.evaluate(()=>Reflect.get(window,'captureModelIntents'))).toEqual([false,true]);
  await page.evaluate(()=>(Reflect.get(window,'captureModelResolvers') as (()=>void)[])[0]());
  await expect.poll(()=>page.evaluate(()=>Reflect.get(window,'captureModelsClosed'))).toBe(1);
  await permission.uncheck();
  await page.evaluate(()=>(Reflect.get(window,'captureModelResolvers') as (()=>void)[])[1]());
  await expect.poll(()=>page.evaluate(()=>Reflect.get(window,'captureModelsClosed'))).toBe(2);
  await permission.check();await expect(page.getByRole('button',{name:'Start camera',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>Reflect.get(window,'captureModelIntents'))).toEqual([false,true]);
});

test('calibration requires a fresh stable T-pose and is invalidated by a new capture configuration',async({page})=>{
  await syntheticCapture(page);await page.goto('/');
  const permission=page.getByRole('checkbox',{name:'Allow MediaPipe performance and usage metrics'});
  await permission.check();await page.getByRole('button',{name:'Start camera',exact:true}).click();
  const calibrate=page.getByRole('button',{name:'Calibrate T-pose',exact:true});await expect(calibrate).toBeEnabled();
  await calibrate.click();await expect(page.getByText('T-pose calibrated.',{exact:true})).toBeVisible({timeout:8000});
  await page.getByLabel('Skeleton',{exact:true}).selectOption('body');await expect(calibrate).toBeEnabled();
  await page.evaluate(()=>Reflect.set(window,'emoteArmsDown',true));await calibrate.click();
  await expect(page.getByText('Face the camera with both arms straight out in a T-pose.',{exact:true})).toBeVisible({timeout:8000});
  await page.evaluate(()=>{Reflect.set(window,'emoteArmsDown',false);document.querySelector('video')!.pause();});
  await calibrate.click();await expect(page.getByText(/The pose is stale/)).toBeVisible({timeout:8000});
  await calibrate.click();await permission.uncheck();
  await expect(page.getByText('T-pose calibrated.',{exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Start camera',exact:true})).toBeVisible();
});

test('camera recording preserves SDK-shaped visibility-zero finger curls',async({page})=>{
  await syntheticCapture(page);
  await page.route('**/src/capture/landmarkers.ts',route=>route.fulfill({contentType:'text/javascript',body:`
    import {tposeHandCanonical} from '/src/motion/hands.ts';
    import {normalize,sub,quatFromAxisAngle} from '/src/motion/math.ts';
    import {rotatePoints,toMediaPipe} from '/src/motion/poses.testutil.ts';
    const hand=tposeHandCanonical('Left'),curl=quatFromAxisAngle(normalize(sub(hand[5],hand[17])),-Math.PI/3);
    const handWorld=toMediaPipe(rotatePoints(hand,[6,7,8],hand[5],curl)).map(p=>({...p,visibility:0}));
    const image=${JSON.stringify(image)};
    const handImage=handWorld.map(()=>({x:image[15].x,y:image[15].y,z:0,visibility:0}));
    handImage[5].y-=0.05;handImage[17].y+=0.05;
    export class CaptureError extends Error{}
    export async function createLandmarkers(){return {
      pose:{detectForVideo(){return {worldLandmarks:[${JSON.stringify(world)}],landmarks:[image]}},close(){}},
      hands:{detectForVideo(){return {worldLandmarks:[handWorld],landmarks:[handImage],handedness:[[{categoryName:'Left',score:1}]]}},close(){}}
    };}
    export function closeLandmarkers(value){value?.pose.close();value?.hands?.close();}
  `}));
  await page.goto('/');await page.getByRole('checkbox',{name:'Allow MediaPipe performance and usage metrics'}).check();
  await page.getByRole('button',{name:'Start camera',exact:true}).click();
  const record=page.getByRole('button',{name:'Record',exact:true});await expect(record).toBeEnabled();await record.click();
  await expect(page.getByText(/\d+ frames captured/)).toBeVisible();
  await expect.poll(()=>page.getByText(/\d+ frames captured/).textContent()).not.toMatch(/^0 frames/);
  await page.getByRole('button',{name:'Stop',exact:true}).click();await saved(page);
  const frames=(await storedProject(page)).takes[0].frames;
  const offset=await page.evaluate(async()=>{const url='/src/motion/contract.ts';return (await import(url)).BONE_INDEX.LeftIndexProximal*4;});
  expect(frames.length).toBeGreaterThan(0);expect(Math.abs(frames.at(-1)!.r[offset+3])).toBeCloseTo(Math.cos(Math.PI/6),2);
});

test('synthetic camera checkpoints and stop preserve earlier originals and bind video to the captured take',async({page})=>{
  await syntheticCapture(page);const original=await sample(page);
  await page.getByRole('button',{name:'New take',exact:true}).click();await page.getByRole('checkbox',{name:'Allow MediaPipe performance and usage metrics'}).check();await page.getByRole('button',{name:'Start camera',exact:true}).click();
  await expect(page.getByRole('button',{name:'Record',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Record',exact:true}).click();
  await expect(page.getByRole('button',{name:'Stop',exact:true})).toBeVisible();
  await expect.poll(async()=>(await storedProject(page)).takes[1]?.frames.length??0,{timeout:10000}).toBeGreaterThan(10);
  const prefix=(await storedProject(page)).takes[1];expect(prefix.status).toBe('recording');
  await page.getByRole('button',{name:'Stop',exact:true}).click();await expect(page.getByLabel('Take name')).toHaveValue('Take 2');await saved(page);
  await expect(page.getByLabel('Keep source video')).toBeEnabled();
  let result=await storedProject(page);expect(result.takes[0]).toEqual(original.takes[0]);
  expect(result.takes[1]).toMatchObject({id:prefix.id,status:'complete',source:'camera',media:null});
  expect(result.takes[1].frames.slice(0,prefix.frames.length)).toEqual(prefix.frames);
  await page.getByLabel('Keep source video').check();await saved(page);
  const rows=await mediaRows(page);expect(rows).toHaveLength(1);expect(rows[0].takeId).toBe(prefix.id);expect(rows[0].size).toBeGreaterThan(0);
  await page.getByRole('button',{name:/Synthetic right-arm raise/}).click();await expect(page.getByLabel('Keep source video')).toBeDisabled();
  result=await storedProject(page);expect(result.takes[0].media).toBeNull();
});

test('reloading an ongoing synthetic recording restores only the saved prefix as interrupted',async({page})=>{
  await syntheticCapture(page);await page.goto('/');await saved(page);
  await page.getByRole('checkbox',{name:'Allow MediaPipe performance and usage metrics'}).check();await page.getByRole('button',{name:'Start camera',exact:true}).click();await expect(page.getByRole('button',{name:'Record',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Record',exact:true}).click();await expect(page.getByRole('button',{name:'Stop',exact:true})).toBeVisible();
  await expect.poll(async()=>(await storedProject(page)).takes[0]?.frames.length??0,{timeout:10000}).toBeGreaterThan(10);
  const before=await storedProject(page),prefix=before.takes[0];page.once('dialog',dialog=>dialog.accept());await page.reload();
  await expect(page.getByText(/Interrupted recording: this is the last saved prefix/)).toBeVisible();await saved(page);
  const restored=await storedProject(page);expect(restored.id).toBe(before.id);expect(restored.takes[0]).toMatchObject({id:prefix.id,status:'interrupted',frames:prefix.frames,media:null});
  await expect(page.getByRole('button',{name:'Start camera',exact:true})).toBeVisible();expect(await mediaRows(page)).toEqual([]);
});

test('the twentieth take can be stopped manually at the take-count limit',async({page})=>{
  await syntheticCapture(page);await sample(page);
  await page.evaluate(async()=>{
    const url='/src/project/model.ts',model=await import(url);
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('emotecap-studio');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    const summaries=await new Promise<{id:string;name:string}[]>(resolve=>{const r=db.transaction('summaries').objectStore('summaries').getAll();r.onsuccess=()=>resolve(r.result);});
    const id=summaries.find(s=>s.name==='EmoteCap sample')!.id;
    let project=await new Promise<import('../src/project/types').ProjectDocument>(resolve=>{const r=db.transaction('projects').objectStore('projects').get(id);r.onsuccess=()=>resolve(r.result);});
    const template=project.takes[0];while(project.takes.length<19) project=model.addTake(project,{name:`Fixture ${project.takes.length+1}`,source:'sample',provenance:template.provenance,frames:template.frames});
    await new Promise<void>((resolve,reject)=>{const tx=db.transaction(['projects','summaries'],'readwrite');tx.objectStore('projects').put(project);
      tx.objectStore('summaries').put({id:project.id,name:project.name,revision:project.revision,updatedAt:project.updatedAt,takeCount:project.takes.length});
      tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});db.close();
  });
  await page.reload();await saved(page);await page.getByRole('button',{name:'New take',exact:true}).click();
  await page.getByRole('checkbox',{name:'Allow MediaPipe performance and usage metrics'}).check();await page.getByRole('button',{name:'Start camera',exact:true}).click();await expect(page.getByRole('button',{name:'Record',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Record',exact:true}).click();const stop=page.getByRole('button',{name:'Stop',exact:true});
  await expect(stop).toBeVisible();await expect(stop).toBeEnabled();
  await expect.poll(async()=>(await storedProject(page)).takes[19]?.frames.length??0,{timeout:10000}).toBeGreaterThan(10);
  await stop.click();await expect(page.getByLabel('Take name')).toHaveValue('Take 20');await saved(page);
  const result=await storedProject(page);expect(result.takes).toHaveLength(20);expect(result.takes[19].status).toBe('complete');
});
