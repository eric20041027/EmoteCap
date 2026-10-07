import { expect, test } from '@playwright/test';
test('sample saves and restores in a real browser without camera or model startup',async({page})=>{
  await page.addInitScript(()=>{
    Reflect.set(window,'emoteCameraRequests',0);
    Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async()=>{
      Reflect.set(window,'emoteCameraRequests',Number(Reflect.get(window,'emoteCameraRequests'))+1);throw new DOMException('Camera must be explicit','NotAllowedError');
    }});
  });
  let models=0;
  await page.route('**/models/**',route=>{models++;return route.abort();});
  await page.route('**/mediapipe/**',route=>{models++;return route.abort();});
  await page.route('**/api/health',route=>route.fulfill({json:{ok:true,blender:false}}));
  await page.goto('/');await page.getByRole('button',{name:'Use sample project'}).click();
  await expect(page.getByLabel('Take name')).toHaveValue('Synthetic right-arm raise');
  await expect(page.getByRole('status',{name:'Project save status'})).toContainText('Saved');
  await page.reload();await expect(page.getByLabel('Take name')).toHaveValue('Synthetic right-arm raise');
  expect(await page.evaluate(()=>Number(Reflect.get(window,'emoteCameraRequests')))).toBe(0);
  expect(models).toBe(0);
});
