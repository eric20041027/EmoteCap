import {createHash,randomUUID} from 'node:crypto';
import {writeFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {expect,test,type Page} from '@playwright/test';
import {tpose,toMediaPipe} from '../src/motion/poses.testutil';

const world=toMediaPipe(tpose()),image=world.map(point=>({x:.5+point.x/2,y:.95+point.y/2,z:0,visibility:1}));
const root=path.resolve(process.env.EMOTECAP_E2E_ARTIFACT_DIR??'../.superpowers/e2e/measurement-manual');

async function sdk(page:Page,mode:'normal'|'late'|'hand-failure'='normal'){
  await page.addInitScript(()=>{
    Reflect.set(window,'measurementSetups',0);Reflect.set(window,'measurementCloses',0);
    Reflect.set(window,'measurementDetections',0);
  });
  await page.route('**/src/capture/landmarkers.ts',route=>route.fulfill({contentType:'text/javascript',body:`
    export class CaptureError extends Error {}
    export function createLandmarkers(quality,authorize){
      authorize();window.measurementSetups++;
      const models={poseDelegate:'CPU',handDelegate:'CPU',pose:{close(){window.measurementCloses++},detectForVideo(video,ms){
        authorize();window.measurementDetections++;return Math.round(ms*30/1000)===1?{worldLandmarks:[],landmarks:[]}:
        {worldLandmarks:[${JSON.stringify(world)}],landmarks:[${JSON.stringify(image)}]};}},
        hands:{close(){},detectForVideo(){authorize();${mode==='hand-failure'?'throw new Error("Owned synthetic hand failure");':''}
          return{landmarks:[],worldLandmarks:[],handedness:[]};}}};
      ${mode==='late'?'return new Promise(resolve=>{window.resolveMeasurementModel=()=>resolve(models)});':'return Promise.resolve(models);'}
    }
    export function closeLandmarkers(models){try{models?.pose.close();}finally{models?.hands?.close();}}
  `}));
}
async function source(page:Page){
  const bytes=await page.evaluate(async()=>{
    const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;
    const context=canvas.getContext('2d')!;context.fillStyle='#234567';context.fillRect(0,0,64,64);
    const stream=canvas.captureStream(30),chunks:BlobPart[]=[];
    const mimeType=MediaRecorder.isTypeSupported('video/webm;codecs=vp8')?'video/webm;codecs=vp8':'video/webm';
    const recorder=new MediaRecorder(stream,{mimeType});
    const stopped=new Promise<void>(resolve=>{recorder.onstop=()=>resolve();});
    recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
    recorder.start();let n=0;const timer=setInterval(()=>{
      context.fillStyle=n++%2?'#234567':'#456789';context.fillRect(0,0,64,64);
    },33);
    try {await new Promise(resolve=>setTimeout(resolve,550));recorder.stop();await stopped;}
    finally {clearInterval(timer);stream.getTracks().forEach(track=>track.stop());}
    return Array.from(new Uint8Array(await new Blob(chunks,{type:'video/webm'}).arrayBuffer()));
  });
  const buffer=Buffer.from(bytes);
  mkdirSync(root,{recursive:true});writeFileSync(path.join(root,`owned-source-${randomUUID()}.webm`),buffer,{flag:'wx'});
  await page.getByLabel('Source video', {exact:true}).setInputFiles({name:'owned-synthetic.webm',mimeType:'video/webm',buffer});
  return buffer;
}
async function metadata(page:Page){
  await page.getByLabel('Source commit',{exact:true}).fill('a'.repeat(40));
  await page.getByLabel('Operating system',{exact:true}).fill('Synthetic Windows');
  await page.getByLabel('CPU',{exact:true}).fill('Synthetic CPU');
  await page.getByLabel('GPU',{exact:true}).fill('Synthetic GPU');
  await page.getByLabel('Browser',{exact:true}).fill('Synthetic Edge 154');
  await page.getByLabel('Classification',{exact:true}).selectOption('synthetic');
  await page.getByLabel('I have permission to process this video locally',{exact:true}).check();
}
test('private page requires both choices; genuine synthetic decode yields a source-linked packet',async({page,browser})=>{
  await sdk(page);let external=0,api=0;
  page.on('request',request=>{const url=request.url();if(url.startsWith('http')&&new URL(url).origin!=='http://127.0.0.1:4175')external++;
    if(url.includes('/api/')||url.includes('/models/'))api++;});
  await page.goto('/measurements.html');await expect(page.getByRole('heading',{name:'Video import measurements',exact:true})).toBeVisible();
  const grant=page.getByRole('checkbox',{name:'Allow MediaPipe performance and usage metrics'});
  await expect(grant).not.toBeChecked();await grant.check();
  expect(await page.evaluate(()=>Number(Reflect.get(window,'measurementSetups')))).toBe(0);
  const buffer=await source(page);await metadata(page);
  await page.getByRole('button',{name:'Run collection',exact:true}).click();
  await expect(page.getByRole('status',{name:'Collection status'})).toContainText('completed',{timeout:15000});
  await expect(page.getByRole('link',{name:'Download preview packet',exact:true})).toBeVisible({timeout:15000});
  const download=page.waitForEvent('download');await page.getByRole('link',{name:'Download preview packet',exact:true}).click();
  const saved=await download,stream=await saved.createReadStream();const parts:Buffer[]=[];for await(const part of stream!)parts.push(Buffer.from(part));
  const packet=Buffer.concat(parts),decoded=JSON.parse(packet.toString());
  expect(decoded.inputSha256).toBe(createHash('sha256').update(buffer).digest('hex'));
  expect(decoded.classification).toBe('synthetic');expect(decoded.settings).toMatchObject({width:64,height:64,delegate:'CPU',quality:'accurate'});
  expect(decoded.samples.some((row:{status:string})=>row.status==='no-pose')).toBe(true);
  const rawPending=page.waitForEvent('download');await page.getByRole('link',{name:'Download raw collection',exact:true}).click();
  const rawDownload=await rawPending,rawStream=await rawDownload.createReadStream();const rawParts:Buffer[]=[];
  for await(const part of rawStream!)rawParts.push(Buffer.from(part));const rawBytes=Buffer.concat(rawParts),raw=JSON.parse(rawBytes.toString());
  expect(raw.qualification).toBe('pending');expect(raw.outcome).toBe('completed');expect(raw.finalFrames.length).toBeLessThan(raw.attempts.length);
  expect(raw.metadata.pipeline).toBe('video-import-preview-and-final');
  expect(await page.evaluate(()=>Number(Reflect.get(window,'measurementCloses')))).toBe(1);
  expect(await page.getByLabel('Video preview').getAttribute('src')).toBeNull();expect(external).toBe(0);expect(api).toBe(0);
  mkdirSync(root,{recursive:true});writeFileSync(path.join(root,'downloaded-preview.json'),packet,{flag:'wx'});
  writeFileSync(path.join(root,'downloaded-raw.json'),rawBytes,{flag:'wx'});
  writeFileSync(path.join(root,'source-sha.json'),JSON.stringify({sha256:createHash('sha256').update(buffer).digest('hex'),browser:browser.version()}),{flag:'wx'});
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:path.join(root,'private-collector-narrow.png'),fullPage:true});
  await page.reload();await expect(grant).not.toBeChecked();
});
test('withdrawal releases a late model and never delivers inference or a packet',async({page})=>{
  await sdk(page,'late');await page.goto('/measurements.html');await source(page);await metadata(page);
  const grant=page.getByRole('checkbox',{name:'Allow MediaPipe performance and usage metrics'});await grant.check();
  await page.getByRole('button',{name:'Run collection',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>typeof Reflect.get(window,'resolveMeasurementModel'))).toBe('function');
  await grant.uncheck();await page.evaluate(()=>(Reflect.get(window,'resolveMeasurementModel') as ()=>void)());
  await expect.poll(()=>page.evaluate(()=>Number(Reflect.get(window,'measurementCloses')))).toBe(1);
  expect(await page.evaluate(()=>Number(Reflect.get(window,'measurementDetections')))).toBe(0);
  await expect(page.getByRole('link',{name:'Download preview packet',exact:true})).toHaveCount(0);
  await expect(page.getByRole('link',{name:'Download raw collection',exact:true})).toBeVisible();
});
test('hand degradation keeps raw/final data and disables comparable-packet download',async({page})=>{
  await sdk(page,'hand-failure');await page.goto('/measurements.html');await source(page);await metadata(page);
  await page.getByRole('checkbox',{name:'Allow MediaPipe performance and usage metrics'}).check();
  await page.getByRole('button',{name:'Run collection',exact:true}).click();
  await expect(page.getByRole('status',{name:'Collection status'})).toContainText('hand-policy-changed',{timeout:15000});
  await expect(page.getByRole('link',{name:'Download raw collection',exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:'Download preview packet',exact:true})).toHaveCount(0);
});
