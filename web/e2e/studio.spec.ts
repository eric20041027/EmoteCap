import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { download, mediaRows, projectId, sample, saved, saveStatus, storedProject } from './helpers';
test.beforeEach(async({context})=>{
  await context.addInitScript(()=>{
    Reflect.set(window,'emoteCameraRequests',0);
    Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async()=>{
      Reflect.set(window,'emoteCameraRequests',Number(Reflect.get(window,'emoteCameraRequests'))+1);
      throw new DOMException('Synthetic workflow has no camera','NotAllowedError');
    }});
  });
  await context.route('**/api/health',route=>route.fulfill({json:{ok:true,blender:false}}));
});
test('sample saves and restores in a real browser without camera or model startup',async({page})=>{
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

test('keyboard clip edits, undo and original frames survive reload',async({page})=>{
  const original=await sample(page);
  const name=page.getByLabel('Clip 1 name');await name.focus();await page.keyboard.press('ControlOrMeta+A');await page.keyboard.type('Walk_01');
  await page.getByLabel('Clip 1 start (seconds)').fill('0.25');await page.keyboard.press('Tab');
  await page.getByLabel('Clip 1 end (seconds)').fill('1.50');await page.keyboard.press('Tab');
  await page.getByLabel('Clip 1 loop').focus();await page.keyboard.press('Space');await saved(page);
  await page.reload();await expect(page.getByLabel('Clip 1 name')).toHaveValue('Walk_01');
  await expect(page.getByLabel('Clip 1 start (seconds)')).toHaveValue('0.25');await expect(page.getByLabel('Clip 1 end (seconds)')).toHaveValue('1.50');
  await expect(page.getByLabel('Clip 1 loop')).toBeChecked();
  await page.getByRole('button',{name:'Undo clip edit'}).focus();await page.keyboard.press('Enter');await saved(page);
  const result=await storedProject(page);expect(result.takes[0].frames).toEqual(original.takes[0].frames);
  expect(result.takes[0].clips[0]).toMatchObject({id:original.takes[0].clips[0].id,name:'Walk_01',start:0.25,end:1.5,loop:false});
  expect(result.takes[0].clipRevision).toBeGreaterThan(original.takes[0].clipRevision);
});

test('invalid and duplicate draft names save while disabling export',async({page})=>{
  await page.route('**/api/health',route=>route.fulfill({json:{ok:true,blender:true}}));await sample(page);
  await page.getByLabel('Clip 1 name').fill('');await saved(page);await expect(page.getByRole('button',{name:'Export FBX'})).toBeDisabled();
  await page.reload();await expect(page.getByLabel('Clip 1 name')).toHaveValue('');
  await page.getByLabel('Clip 1 name').fill('Walk_01');await expect(page.getByRole('button',{name:'Export FBX'})).toBeEnabled();
  await page.getByRole('button',{name:'Add clip',exact:true}).click();await page.getByLabel('Clip 2 name').fill('WALK_01');await saved(page);
  await expect(page.getByRole('button',{name:'Export FBX'})).toBeDisabled();
  expect((await storedProject(page)).takes[0].clips.map(c=>c.name)).toEqual(['Walk_01','WALK_01']);
});

test('portable backup restores edits in a new project without camera access',async({page},info)=>{
  const original=await sample(page);await page.getByLabel('Clip 1 name').fill('Backed_up');await saved(page);
  const file=await download(page,info);await page.getByLabel('Import project file').setInputFiles(file);
  await expect.poll(()=>projectId(page)).not.toBe(original.id);await expect(page.getByLabel('Clip 1 name')).toHaveValue('Backed_up');await saved(page);
  const imported=await storedProject(page);expect(imported.takes[0].id).toBe(original.takes[0].id);expect(imported.takes[0].frames).toEqual(original.takes[0].frames);
  expect(imported.takes[0].media).toBeNull();await page.reload();await expect(page.getByLabel('Clip 1 name')).toHaveValue('Backed_up');
});

test('a corrupt import preserves the current project and editable original',async({page})=>{
  const before=await sample(page);await page.getByLabel('Import project file').setInputFiles({name:'corrupt.emotecap',mimeType:'application/x-emotecap',buffer:Buffer.from('not zip')});
  await expect(page.getByRole('alert')).toContainText(/corrupt|unsupported/i);expect(await projectId(page)).toBe(before.id);
  expect((await storedProject(page)).takes[0].frames).toEqual(before.takes[0].frames);
  await page.getByLabel('Clip 1 name').fill('Still_editable');await saved(page);
});

test('an injected quota failure preserves a downloadable in-memory revision',async({page},info)=>{
  const original=await sample(page);
  await page.evaluate(()=>{
    const originalPut=IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put=function(...args:Parameters<IDBObjectStore['put']>){
      if(this.name==='projects') throw new DOMException('Injected storage quota','QuotaExceededError');return originalPut.apply(this,args);
    };
  });
  await page.getByLabel('Clip 1 name').fill('Unsaved_quota');await expect(saveStatus(page)).toHaveText('Not saved');
  expect((await storedProject(page)).takes[0].clips[0].name).toBe(original.takes[0].clips[0].name);
  const file=await download(page,info,'quota-recovery.emotecap');expect((await readFile(file)).length).toBeGreaterThan(100);
  await page.getByRole('button',{name:'New project'}).click();await expect(page.getByRole('alert')).toContainText(/full|unsaved/i);expect(await projectId(page)).toBe(original.id);
});

test('another tab cannot overwrite a newer revision and can reopen after explicit discard',async({page,context},info)=>{
  const original=await sample(page),other=await context.newPage();await other.goto('/');await expect(other.getByLabel('Clip 1 name')).toBeVisible();
  await page.getByLabel('Clip 1 name').fill('First_tab');await saved(page);
  await other.getByLabel('Clip 1 name').fill('Second_unsaved');await expect(saveStatus(other)).toHaveText('Not saved');
  await expect(other.getByRole('alert')).toContainText('another tab');expect((await storedProject(other)).takes[0].clips[0].name).toBe('First_tab');
  const path=await download(other,info,'conflict-recovery.emotecap');expect((await readFile(path)).length).toBeGreaterThan(100);
  other.once('dialog',dialog=>dialog.accept());await other.getByRole('button',{name:'Reopen saved copy'}).click();
  await expect(other.getByLabel('Clip 1 name')).toHaveValue('First_tab');await saved(other);expect(await projectId(other)).toBe(original.id);await other.close();
});

test('included source needs a separate retention choice and unchecking deletes stored media',async({page})=>{
  await sample(page);const bytes=Array.from(await readFile(new URL('../../contracts/fixtures/sample-project.emotecap',import.meta.url)));
  const archive=await page.evaluate(async bytes=>{
    const url='/src/project/archive/codec.ts',codec=await import(url);
    const decoded=await codec.decodeProject(new Blob([new Uint8Array(bytes)]));
    const blob=await codec.encodeProject(decoded.project,{includeMedia:true,readMedia:async()=>({name:'synthetic-source.webm',blob:new Blob(['synthetic video'],{type:'video/webm'})})});
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  },bytes);
  await page.getByLabel('Import project file').setInputFiles({name:'with-source.emotecap',mimeType:'application/x-emotecap',buffer:Buffer.from(archive)});
  await expect(page.getByLabel('Keep source video')).toBeEnabled();await expect(page.getByLabel('Keep source video')).not.toBeChecked();await saved(page);
  expect(await mediaRows(page)).toEqual([]);await page.getByLabel('Keep source video').check();await saved(page);
  expect((await mediaRows(page))[0].size).toBe(15);await page.reload();await expect(page.getByLabel('Keep source video')).toBeChecked();
  await page.getByLabel('Keep source video').uncheck();await saved(page);expect(await mediaRows(page)).toEqual([]);
  await page.reload();await expect(page.getByLabel('Keep source video')).not.toBeChecked();expect(await mediaRows(page)).toEqual([]);
});

test('new-take selection keeps previous originals and offers keyboard return',async({page})=>{
  const original=await sample(page);await page.getByRole('button',{name:'New take',exact:true}).click();await saved(page);
  await expect(page.getByLabel('Take name')).toHaveCount(0);expect((await storedProject(page)).takes).toEqual(original.takes);
  const select=page.getByRole('button',{name:/Synthetic right-arm raise/});await select.focus();await page.keyboard.press('Enter');
  await expect(page.getByLabel('Take name')).toHaveValue('Synthetic right-arm raise');await saved(page);
});
