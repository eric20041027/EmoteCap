import { expect,test } from '@playwright/test';
import { ID,NEXT,job } from '../src/jobs/testData';
import type { JobSubmission } from '../src/jobs/api';
import { sample,saved,storedProject } from './helpers';

test('queued exports allow editing, cancel/retry the frozen revision and survive refresh',async({page})=>{
  let current:Record<string,unknown>|null=null,submitted:JobSubmission|null=null;
  await page.route('**/api/health',route=>route.fulfill({json:{ok:true,blender:true,exportJobs:1}}));
  await page.route('**/api/export-jobs**',async route=>{
    const request=route.request(),path=new URL(request.url()).pathname;
    if(path.endsWith('/cancel')){current={...current,state:'cancelled',phase:'Cancelled',cancelRequested:true};return route.fulfill({json:current});}
    if(path.endsWith('/retry')){current={...current,id:NEXT,state:'succeeded',phase:'Ready to download',progress:100,retryOf:ID,cancelRequested:false,
      files:[{name:'Raise_Right_Arm',url:`/files/${NEXT}/Raise_Right_Arm.fbx`,sidecar:`/files/${NEXT}/Raise_Right_Arm.emotecap.json`}]};return route.fulfill({status:202,json:current});}
    if(request.method()==='POST'){submitted=request.postDataJSON();current=job({snapshot:submitted!.snapshot});return route.fulfill({status:202,json:current});}
    return route.fulfill({json:{jobs:current?[current]:[]}});
  });
  const original=await sample(page),revision=original.takes[0].clipRevision;
  await expect(page.getByRole('button',{name:'Export FBX',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Export FBX',exact:true}).click();
  const panel=page.getByRole('region',{name:'Export jobs'});await expect(panel).toContainText('Waiting for Blender');
  await page.getByLabel('Clip 1 name').fill('Later_edit');await saved(page);expect((await storedProject(page)).takes[0].clipRevision).toBeGreaterThan(revision);
  expect(submitted!.snapshot).toEqual({projectId:original.id,takeId:original.takes[0].id,clipRevision:revision});
  await panel.getByRole('button',{name:'Cancel export',exact:true}).click();await expect(panel).toContainText('Cancelled');
  await panel.getByRole('button',{name:'Retry saved export',exact:true}).click();await expect(panel.getByRole('link',{name:'Download FBX',exact:true})).toHaveAttribute('href',`/files/${NEXT}/Raise_Right_Arm.fbx`);
  await page.reload();await expect(panel.getByRole('link',{name:'Download sidecar',exact:true})).toHaveAttribute('href',`/files/${NEXT}/Raise_Right_Arm.emotecap.json`);
  await expect(page.getByLabel('Clip 1 name')).toHaveValue('Later_edit');expect((await storedProject(page)).takes[0].frames).toEqual(original.takes[0].frames);
});
