import { expect, test } from '@playwright/test';
import { tpose, toMediaPipe } from '../src/motion/poses.testutil';
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
  await page.getByRole('button',{name:'Start camera',exact:true}).click();
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
    const world=${JSON.stringify(world)},image=${JSON.stringify(image)};
    export async function createLandmarkers(){return {pose:{detectForVideo(){return {worldLandmarks:[world],landmarks:[image]}},close(){}},hands:undefined};}
    export function closeLandmarkers(value){value?.pose.close();value?.hands?.close();}
  `}));
  await page.route('**/api/health',route=>route.fulfill({json:{ok:true,blender:false}}));
}

test('synthetic camera checkpoints and stop preserve earlier originals and bind video to the captured take',async({page})=>{
  await syntheticCapture(page);const original=await sample(page);
  await page.getByRole('button',{name:'New take',exact:true}).click();await page.getByRole('button',{name:'Start camera',exact:true}).click();
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
  await page.getByRole('button',{name:'Start camera',exact:true}).click();await expect(page.getByRole('button',{name:'Record',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Record',exact:true}).click();await expect(page.getByRole('button',{name:'Stop',exact:true})).toBeVisible();
  await expect.poll(async()=>(await storedProject(page)).takes[0]?.frames.length??0,{timeout:10000}).toBeGreaterThan(10);
  const before=await storedProject(page),prefix=before.takes[0];page.once('dialog',dialog=>dialog.accept());await page.reload();
  await expect(page.getByText(/Interrupted recording: this is the last saved prefix/)).toBeVisible();await saved(page);
  const restored=await storedProject(page);expect(restored.id).toBe(before.id);expect(restored.takes[0]).toMatchObject({id:prefix.id,status:'interrupted',frames:prefix.frames,media:null});
  await expect(page.getByRole('button',{name:'Start camera',exact:true})).toBeVisible();expect(await mediaRows(page)).toEqual([]);
});
