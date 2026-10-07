import { expect,test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { mediaRows,projectId,sample,saved,storedProject } from './helpers';

async function withSource(page:import('@playwright/test').Page){
  const previous=await sample(page);const bytes=Array.from(await readFile(new URL('../../contracts/fixtures/sample-project.emotecap',import.meta.url)));
  const archive=await page.evaluate(async bytes=>{
    const url='/src/project/archive/codec.ts',codec=await import(url),decoded=await codec.decodeProject(new Blob([new Uint8Array(bytes)]));
    const blob=await codec.encodeProject(decoded.project,{includeMedia:true,readMedia:async()=>({name:'synthetic.webm',blob:new Blob(['synthetic video'],{type:'video/webm'})})});
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  },bytes);
  await page.getByLabel('Import project file').setInputFiles({name:'synthetic-source.emotecap',mimeType:'application/x-emotecap',buffer:Buffer.from(archive)});
  await expect.poll(()=>projectId(page)).not.toBe(previous.id);await expect(page.getByLabel('Keep source video')).toBeEnabled();await saved(page);return storedProject(page);
}
test.beforeEach(async({page})=>{
  await page.route('**/api/health',route=>route.fulfill({json:{ok:true,blender:false,gemini:true,exportJobs:1}}));
  await page.route('**/api/export-jobs',route=>route.fulfill({json:{jobs:[]}}));
});
test('local pauses and checking consent send nothing; explicit Send previews before Apply',async({page})=>{
  let grants=0,uploads=0;
  await page.route('**/api/cloud-consent',route=>{grants++;return route.fulfill({json:{token:'c'.repeat(43),expiresAt:Date.now()+60000}});});
  await page.route('**/api/takes',route=>{uploads++;return route.fulfill({json:{takeId:source.takes[0].id,segments:[{name:'Cloud_suggestion',start:0,end:1,loop:false,description:'Synthetic suggestion'}],
    cleanup:{localVideo:'deleted',warning:null,remoteFiles:'failed',remoteWarning:'Google file deletion could not be confirmed',model:'mock'}}});});
  const source=await withSource(page);await page.getByRole('button',{name:'Find pauses',exact:true}).click();await saved(page);expect(grants).toBe(0);expect(uploads).toBe(0);
  const panel=page.getByRole('region',{name:'Optional Gemini suggestions'});await panel.getByLabel('Allow sending the selected source video to Google Gemini').check();
  expect(grants).toBe(0);expect(uploads).toBe(0);const before=await storedProject(page);
  await panel.getByRole('button',{name:'Send selected video',exact:true}).click();await expect(panel).toContainText('Cloud_suggestion');await expect(panel).toContainText('Google file deletion could not be confirmed');
  expect(grants).toBe(1);expect(uploads).toBe(1);expect((await storedProject(page)).takes[0].clips).toEqual(before.takes[0].clips);
  await panel.getByRole('button',{name:'Apply suggested clips',exact:true}).click();await saved(page);expect((await storedProject(page)).takes[0].clips[0].name).toBe('Cloud_suggestion');
  expect((await storedProject(page)).takes[0].frames).toEqual(source.takes[0].frames);await page.reload();await expect(panel.getByLabel('Allow sending the selected source video to Google Gemini')).not.toBeChecked();
});
test('explicit source deletion removes memory and stored video while preserving motion',async({page})=>{
  const original=await withSource(page);await page.getByLabel('Keep source video').check();await saved(page);expect(await mediaRows(page)).toHaveLength(1);
  page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Delete source video',exact:true}).click();await saved(page);
  await expect(page.getByLabel('Keep source video')).toBeDisabled();expect(await mediaRows(page)).toEqual([]);expect((await storedProject(page)).takes[0].frames).toEqual(original.takes[0].frames);
  await page.reload();await expect(page.getByRole('button',{name:'Delete source video',exact:true})).toBeDisabled();expect((await storedProject(page)).takes[0].frames).toEqual(original.takes[0].frames);
});
