import { expect, test } from '@playwright/test';
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
