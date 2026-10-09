import { afterEach, expect, it, vi } from 'vitest';
import { IDBFactory, IDBObjectStore as FakeObjectStore } from 'fake-indexeddb';
import { editClip, removeTake, renameProject, setTakeMedia } from './model';
import { rawProject, readyProject } from './testData';
import { openProjectStore, ProjectConflictError, type ProjectStore } from './store';
import { ProjectDataError } from './validation';

const connections: ProjectStore[]=[];
afterEach(()=>{for(const store of connections.splice(0)) store.close();vi.restoreAllMocks();});
async function open(factory=new IDBFactory(),name='test') {
  const store=await openProjectStore({factory,name});connections.push(store);return store;
}
async function rawDatabase(factory:IDBFactory,name:string,version=1):Promise<IDBDatabase> {
  return new Promise((resolve,reject)=>{const r=factory.open(name,version);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
}
const blob=()=>new Blob(['original source'],{type:'video/webm'});
function retainedProject() {
  const project=readyProject(), video=blob(), takeId=project.takes[0].id;
  return {project:setTakeMedia(project,takeId,{name:'source.webm',type:video.type,size:video.size}),video,takeId};
}

it('saves, closes, and reopens the selected take and edited project',async()=>{
  const factory=new IDBFactory(), store=await open(factory);
  const base=readyProject(), take=base.takes[0];
  const project=editClip(base,take.id,take.clips[0].id,{name:'Wave',loop:true,start:0.2});
  await store.save(project,null);store.close();
  const reopened=await open(factory);
  expect(await reopened.load(project.id)).toEqual(project);
  expect(await reopened.list()).toEqual([{id:project.id,name:project.name,revision:project.revision,
    updatedAt:project.updatedAt,takeCount:1}]);
  expect(await reopened.load(crypto.randomUUID())).toBeNull();
});

it('does not overwrite a newer tab or create over an existing project ID',async()=>{
  const factory=new IDBFactory(), a=await open(factory), b=await open(factory), project=readyProject();
  await a.save(project,null);
  await expect(b.save(project,null)).rejects.toBeInstanceOf(ProjectConflictError);
  const first=renameProject(project,'First tab');await a.save(first,project.revision);
  await expect(b.save(renameProject(project,'Second tab'),project.revision)).rejects.toBeInstanceOf(ProjectConflictError);
  expect((await b.load(project.id))?.name).toBe('First tab');
  await expect(a.save(first,first.revision)).rejects.toThrow(/revision/i);
});

it('keeps raw media optional and removes it with the retention choice',async()=>{
  const store=await open(), {project,video,takeId}=retainedProject();
  await store.save(project,null,new Map([[takeId,video]]));
  expect(await (await store.readMedia(project.id,takeId))?.text()).toBe('original source');
  const edited=renameProject(project,'Saved media retained');await store.save(edited,project.revision);
  expect((await store.readMedia(project.id,takeId))?.size).toBe(video.size);
  const removed=setTakeMedia(edited,takeId,null);await store.save(removed,edited.revision);
  expect(await store.readMedia(project.id,takeId)).toBeNull();
});

it('deletes take media and every project record without affecting another project',async()=>{
  const store=await open(), {project,video,takeId}=retainedProject(), other=readyProject();
  await store.save(project,null,new Map([[takeId,video]]));await store.save(other,null);
  const withoutTake=removeTake(project,takeId);await store.save(withoutTake,project.revision);
  expect(await store.readMedia(project.id,takeId)).toBeNull();
  await expect(store.remove(other.id,other.revision-1)).rejects.toBeInstanceOf(ProjectConflictError);
  await store.remove(project.id,withoutTake.revision);
  expect(await store.load(project.id)).toBeNull();expect(await store.list()).toHaveLength(1);
  expect(await store.load(other.id)).toEqual(other);
  const extra=retainedProject();await store.save(extra.project,null,new Map([[extra.takeId,extra.video]]));
  await store.remove(extra.project.id,extra.project.revision);
  expect(await store.readMedia(extra.project.id,extra.takeId)).toBeNull();
});

it('rolls back document, summary and media after a quota failure in a later write',async()=>{
  const store=await open(), {project,video,takeId}=retainedProject();
  await store.save(project,null,new Map([[takeId,video]]));
  const changed=renameProject(setTakeMedia(project,takeId,null),'Unsaved');
  const originalPut=FakeObjectStore.prototype.put;
  const fault=vi.spyOn(FakeObjectStore.prototype,'put').mockImplementation(function(this:IDBObjectStore,value:unknown,key?:IDBValidKey){
    if(this.name==='summaries') throw new DOMException('Disk full','QuotaExceededError');
    return originalPut.call(this,value,key);
  });
  try {await expect(store.save(changed,project.revision)).rejects.toMatchObject({reason:'quota'});}
  finally {fault.mockRestore();}
  expect(await store.load(project.id)).toEqual(project);
  expect((await store.list())[0].name).toBe(project.name);
  expect(await (await store.readMedia(project.id,takeId))?.text()).toBe('original source');
});

it('does not call a request success a completed save if the transaction aborts afterward',async()=>{
  const store=await open(), project=readyProject();await store.save(project,null);
  const originalPut=FakeObjectStore.prototype.put;
  const fault=vi.spyOn(FakeObjectStore.prototype,'put').mockImplementation(function(this:IDBObjectStore,value:unknown,key?:IDBValidKey){
    const r=originalPut.call(this,value,key);
    if(this.name==='projects') r.addEventListener('success',()=>this.transaction.abort());
    return r;
  });
  try {await expect(store.save(renameProject(project,'Aborted'),project.revision)).rejects.toMatchObject({reason:'write'});}
  finally {fault.mockRestore();}
  expect(await store.load(project.id)).toEqual(project);
});

it('rejects missing, mismatching or unchosen video without partial installation',async()=>{
  const store=await open(), {project,video,takeId}=retainedProject();
  await expect(store.save(project,null)).rejects.toBeInstanceOf(ProjectDataError);
  await expect(store.save(project,null,new Map([[takeId,new Blob(['wrong'],{type:video.type})]]))).rejects.toBeInstanceOf(ProjectDataError);
  await expect(store.save(setTakeMedia(project,takeId,null),null,new Map([[takeId,video]]))).rejects.toBeInstanceOf(ProjectDataError);
  expect(await store.list()).toEqual([]);expect(await store.load(project.id)).toBeNull();
});

it('protects originals and rejects invalid input before replacing stored data',async()=>{
  const store=await open(), project=readyProject();await store.save(project,null);
  const bad=structuredClone(project);Object.assign(bad,{revision:project.revision+1});bad.takes[0].frames[0].h[1]=1.1;
  await expect(store.save(bad,project.revision)).rejects.toThrow(/original/i);
  const raw=rawProject();Object.assign(raw,{schemaVersion:2});
  await expect(store.save(raw,project.revision)).rejects.toBeInstanceOf(ProjectDataError);
  expect(await store.load(project.id)).toEqual(project);
});

it('surfaces corrupt stored data without resetting it',async()=>{
  const factory=new IDBFactory(), store=await open(factory), project=readyProject();await store.save(project,null);
  const db=await rawDatabase(factory,'test');
  await new Promise<void>((resolve,reject)=>{
    const tx=db.transaction('projects','readwrite');tx.objectStore('projects').put({...project,apiKey:'unsupported'});
    tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);
  });db.close();
  await expect(store.load(project.id)).rejects.toBeInstanceOf(ProjectDataError);
  expect(await store.list()).toHaveLength(1);
});

it('rejects unavailable, newer and structurally incompatible storage with a clear error',async()=>{
  await expect(openProjectStore()).rejects.toMatchObject({reason:'unavailable'});
  const newerFactory=new IDBFactory(), newer=await rawDatabase(newerFactory,'new',2);newer.close();
  await expect(openProjectStore({factory:newerFactory,name:'new'})).rejects.toMatchObject({reason:'unavailable'});
  const brokenFactory=new IDBFactory(), broken=await rawDatabase(brokenFactory,'broken');broken.close();
  await expect(openProjectStore({factory:brokenFactory,name:'broken'})).rejects.toMatchObject({reason:'unavailable'});
  const store=await open();store.close();
  await expect(store.list()).rejects.toMatchObject({reason:'unavailable'});
});

it('reports a blocked open and closes a connection delivered after rejection',async()=>{
  const factory=new IDBFactory(), older=await rawDatabase(factory,'blocked');
  const upgrade=factory.open('blocked',2);
  const shim=Object.create(factory) as IDBFactory;
  Object.defineProperty(shim,'open',{value:()=>upgrade});
  await expect(openProjectStore({factory:shim,name:'blocked'})).rejects.toMatchObject({reason:'blocked'});
  const lateSuccess=new Promise<void>(resolve=>upgrade.addEventListener('success',()=>resolve()));
  older.close();await lateSuccess;
  const next=await rawDatabase(factory,'blocked',3);next.close(); // Would remain blocked if the rejected connection leaked.
});

it('rejects a corrupt unique project-media index before accepting the database',async()=>{
  const factory=new IDBFactory(), request=factory.open('bad-index',1);
  request.onupgradeneeded=()=>{
    const db=request.result;db.createObjectStore('projects',{keyPath:'id'});db.createObjectStore('summaries',{keyPath:'id'});
    db.createObjectStore('media',{keyPath:['projectId','takeId']}).createIndex('projectId','projectId',{unique:true});
  };
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  db.close();
  await expect(openProjectStore({factory,name:'bad-index'})).rejects.toMatchObject({reason:'unavailable'});
});
