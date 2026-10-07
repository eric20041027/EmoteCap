import { expect, type Page, type TestInfo } from '@playwright/test';
import type { ProjectDocument } from '../src/project/types';
export const saveStatus=(page:Page)=>page.getByRole('status',{name:'Project save status'});
export async function projectId(page:Page):Promise<string> {
  const id=await page.getByRole('region',{name:'Project',exact:true}).getAttribute('data-project-id');if(!id) throw new Error('Project identity missing');return id;
}
export async function storedProject(page:Page,id?:string):Promise<ProjectDocument> {
  return page.evaluate(id=>new Promise<ProjectDocument>((resolve,reject)=>{
    const opening=indexedDB.open('emotecap-studio');opening.onerror=()=>reject(opening.error);
    opening.onsuccess=()=>{
      const db=opening.result,tx=db.transaction('projects','readonly'),request=tx.objectStore('projects').get(id);
      tx.oncomplete=()=>{db.close();if(!request.result) reject(new Error('Saved project missing'));else resolve(request.result);};
      tx.onabort=()=>{db.close();reject(tx.error);};
    };
  }),id??await projectId(page));
}
export async function saved(page:Page):Promise<void> {
  await expect(saveStatus(page)).toHaveText('Saved');
  const revision=Number(await page.getByRole('region',{name:'Project',exact:true}).getAttribute('data-revision'));
  await expect.poll(async()=>(await storedProject(page)).revision).toBe(revision);
}
export async function sample(page:Page):Promise<ProjectDocument> {
  await page.goto('/');await page.getByRole('button',{name:'Use sample project'}).click();
  await expect(page.getByLabel('Take name')).toHaveValue('Synthetic right-arm raise');await saved(page);return storedProject(page);
}
export async function download(page:Page,info:TestInfo,name='backup.emotecap'):Promise<string> {
  const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Download project',exact:true}).click();
  const file=await pending,path=info.outputPath(name);await file.saveAs(path);return path;
}
export async function mediaRows(page:Page):Promise<{projectId:string;takeId:string;size:number;type:string}[]> {
  return page.evaluate(()=>new Promise((resolve,reject)=>{
    const opening=indexedDB.open('emotecap-studio');opening.onerror=()=>reject(opening.error);opening.onsuccess=()=>{
      const db=opening.result,tx=db.transaction('media','readonly'),request=tx.objectStore('media').getAll();
      tx.oncomplete=()=>{db.close();resolve(request.result.map(row=>({projectId:row.projectId,takeId:row.takeId,size:row.blob.size,type:row.blob.type})));};
      tx.onabort=()=>{db.close();reject(tx.error);};
    };
  }));
}
