import { IDBFactory } from 'fake-indexeddb';
import { afterEach, expect, it, vi } from 'vitest';
import { decodeProject, encodeProject } from '../project/archive/codec';
import { addTake, createProject, editClip, renameProject, undoClips } from '../project/model';
import { provenance, readyProject } from '../project/testData';
import { openProjectStore, ProjectConflictError, ProjectStorageError, type ProjectStore } from '../project/store';
import { MAX_MEDIA_BYTES, MAX_PROJECT_MEDIA_BYTES, type ProjectDocument } from '../project/types';
import { tposeFrame } from '../motion/index';
import { StudioSession } from './session';

const sessions:StudioSession[]=[];
afterEach(()=>{sessions.splice(0).forEach(s=>s.dispose());vi.useRealTimers();});
async function setup(project:ProjectDocument|null=readyProject(),wrap?:(store:ProjectStore)=>ProjectStore) {
  const factory=new IDBFactory(),name=crypto.randomUUID();
  const db=await openProjectStore({factory,name});if(project) await db.save(project,null);
  let remembered:string|null=project?.id??null;
  const studio=new StudioSession(async()=>wrap?wrap(db):db,{read:()=>remembered,write:id=>{remembered=id;}});
  sessions.push(studio);await studio.initialize();
  return {studio,db,factory,name};
}

it('restores a saved project instead of replacing it with a draft',async()=>{
  const {studio}=await setup(createProject('Saved project'));
  expect(studio.getSnapshot().project.name).toBe('Saved project');
  expect(studio.getSnapshot().save.phase).toBe('saved');
});

it('persists edited clips, undo and selected take across a new session',async()=>{
  const original=readyProject(),{studio,factory,name}=await setup(original);
  const take=original.takes[0];
  studio.update(p=>editClip(p,take.id,take.clips[0].id,{name:'Edited',start:0.2,loop:true}));
  await studio.flush();studio.dispose();
  const next=new StudioSession(()=>openProjectStore({factory,name}));sessions.push(next);await next.initialize();
  expect(next.getSnapshot().project.takes[0].clips[0]).toMatchObject({name:'Edited',start:0.2,loop:true});
  expect(next.getSnapshot().project.activeTakeId).toBe(take.id);
  next.update(p=>undoClips(p,take.id));await next.flush();
  expect(next.getSnapshot().project.takes[0].frames).toEqual(take.frames);
  expect(next.getSnapshot().project.takes[0].clips).toEqual(take.clips);
});

it('recovers a saved recording prefix under the same project and take identity',async()=>{
  const recording=addTake(createProject(),{name:'Checkpoint',source:'camera',provenance:provenance()});
  const p={...recording,takes:[{...recording.takes[0],frames:[tposeFrame(0),tposeFrame(0.5)]}]};
  const {studio,db}=await setup(p);
  expect(studio.getSnapshot().project).toMatchObject({id:p.id,takes:[{id:p.takes[0].id,status:'interrupted',frames:p.takes[0].frames}]});
  await studio.flush();expect((await db.load(p.id))?.takes[0].status).toBe('interrupted');
});

it('keeps a usable memory project when browser storage is unavailable',async()=>{
  const studio=new StudioSession(async()=>{throw new ProjectStorageError('unavailable','Storage unavailable');});sessions.push(studio);
  await studio.initialize();studio.update(p=>renameProject(p,'Memory work'));
  expect(studio.getSnapshot()).toMatchObject({storage:'error',save:{phase:'error'},project:{name:'Memory work'}});
  const archive=await encodeProject(studio.getSnapshot().project);
  expect((await decodeProject(archive)).project.name).toBe('Memory work');
});

it('keeps the latest unsaved work after quota failure and blocks project switching',async()=>{
  const {studio,db}=await setup(readyProject(),store=>({...store,save:async()=>{throw new ProjectStorageError('quota','Browser storage is full.');}}));
  const before=studio.getSnapshot().project;studio.update(p=>renameProject(p,'Unsaved after quota'));
  await expect(studio.flush()).rejects.toThrow(/full/);
  await expect(studio.create()).rejects.toThrow(/full/);
  expect(studio.getSnapshot()).toMatchObject({project:{id:before.id,name:'Unsaved after quota'},save:{phase:'error'}});
  expect((await decodeProject(await encodeProject(studio.getSnapshot().project))).project.name).toBe('Unsaved after quota');
  expect((await db.load(before.id))?.name).toBe(before.name);
});

it('retries pending work without reloading a saved older copy',async()=>{
  let fail=true;
  const {studio}=await setup(readyProject(),store=>({...store,save:async(...args)=>{if(fail) throw new Error('Disk failure');return store.save(...args);}}));
  studio.update(p=>renameProject(p,'Latest'));await expect(studio.flush()).rejects.toThrow('Disk failure');
  studio.update(p=>renameProject(p,'Latest again'));fail=false;await studio.retry();
  expect(studio.getSnapshot()).toMatchObject({project:{name:'Latest again'},save:{phase:'saved'}});
});

it('detects a stale tab and requires an explicit decision before reopening the saved copy',async()=>{
  const {studio,db}=await setup(),old=studio.getSnapshot().project;
  await db.save(renameProject(old,'Other tab'),old.revision);
  studio.update(p=>renameProject(p,'My unsaved tab'));await expect(studio.flush()).rejects.toBeInstanceOf(ProjectConflictError);
  await expect(studio.reopenSaved(false)).rejects.toThrow(/discard/i);
  expect(studio.getSnapshot().project.name).toBe('My unsaved tab');
  await studio.reopenSaved(true);
  expect(studio.getSnapshot()).toMatchObject({project:{name:'Other tab'},save:{phase:'saved'}});
});

it('keeps current work intact when the requested project is missing or corrupt',async()=>{
  const {studio}=await setup();const before=studio.getSnapshot().project;
  await expect(studio.open(crypto.randomUUID())).rejects.toThrow(/exist|found/i);
  expect(studio.getSnapshot().project).toBe(before);
});

it('installs only a new validated project and never overwrites an existing identity',async()=>{
  const {studio}=await setup(),before=studio.getSnapshot().project;
  await expect(studio.install(before,new Map())).rejects.toThrow(/exist|identity|different/i);
  await expect(studio.install({...readyProject(),schemaVersion:99} as unknown as ProjectDocument,new Map())).rejects.toThrow();
  expect(studio.getSnapshot().project).toBe(before);
  const incoming=(await decodeProject(await encodeProject(readyProject()))).project;
  await studio.install(incoming,new Map());await studio.flush();
  expect(studio.getSnapshot().project.id).toBe(incoming.id);
});

it('retains source only after an explicit choice, and removes stored media atomically',async()=>{
  const {studio,db}=await setup(),p=studio.getSnapshot().project,takeId=p.takes[0].id;
  const source={name:'source.webm',blob:new Blob(['source'],{type:'video/webm'})};studio.attachSource(takeId,source);
  expect(studio.getSnapshot().project.takes[0].media).toBeNull();expect(await db.readMedia(p.id,takeId)).toBeNull();
  await studio.keepSource(takeId,true);await studio.flush();
  expect((await db.readMedia(p.id,takeId))?.size).toBe(source.blob.size);
  await studio.keepSource(takeId,false);await studio.flush();
  expect(await db.readMedia(p.id,takeId)).toBeNull();expect((await studio.readSource(takeId))?.blob).toBe(source.blob);
});

it('requires a separate discard decision before dropping a memory-only source',async()=>{
  const {studio}=await setup(),before=studio.getSnapshot().project;
  studio.attachSource(before.takes[0].id,{name:'source.webm',blob:new Blob(['source'],{type:'video/webm'})});
  await expect(studio.create()).rejects.toThrow(/source.*video/i);expect(studio.getSnapshot().project).toBe(before);
  await studio.create(true);expect(studio.getSnapshot().project.id).not.toBe(before.id);expect(studio.hasVolatileSources()).toBe(false);
});

it('rejects unknown-take, replaced and oversized source attachments without changing motion',async()=>{
  const {studio}=await setup(),before=studio.getSnapshot().project,id=before.takes[0].id;
  const source={name:'source.webm',blob:new Blob(['source'],{type:'video/webm'})};
  expect(()=>studio.attachSource(crypto.randomUUID(),source)).toThrow(/take/i);
  studio.attachSource(id,source);
  expect(()=>studio.attachSource(id,{...source,blob:new Blob(['different'],{type:'video/webm'})})).toThrow(/replace/i);
  class TooBig extends Blob {override get size(){return MAX_MEDIA_BYTES+1;}}
  expect(()=>studio.attachSource(id,{name:'big.webm',blob:new TooBig([],{type:'video/webm'})})).toThrow(/limit|100/i);
  expect(studio.getSnapshot().project).toBe(before);
});

it('enforces the total source-cache cap before retaining another blob',async()=>{
  const {studio}=await setup();studio.update(p=>addTake(p,{name:'Two',source:'video',provenance:provenance(),frames:[tposeFrame(0)]}));
  studio.update(p=>addTake(p,{name:'Three',source:'video',provenance:provenance(),frames:[tposeFrame(0)]}));
  class SizedBlob extends Blob {override get size(){return Math.floor(MAX_PROJECT_MEDIA_BYTES/3)+1;}}
  const ids=studio.getSnapshot().project.takes.map(t=>t.id);
  for(const id of ids.slice(0,2)) studio.attachSource(id,{name:'source.webm',blob:new SizedBlob([],{type:'video/webm'})});
  expect(()=>studio.attachSource(ids[2],{name:'source.webm',blob:new SizedBlob([],{type:'video/webm'})})).toThrow(/200|project.*limit/i);
});

it('does not lose in-memory edits while the initial database open is delayed',async()=>{
  const {db}=await setup();let resolve!:(store:ProjectStore)=>void;
  const studio=new StudioSession(()=>new Promise(r=>{resolve=r;}));sessions.push(studio);
  const initializing=studio.initialize();studio.update(p=>renameProject(p,'Typed while opening'));resolve(db);await initializing;
  expect(studio.getSnapshot().project.name).toBe('Typed while opening');await studio.flush();
});

it('closes late database results without publishing after disposal',async()=>{
  const {db}=await setup();let resolve!:(store:ProjectStore)=>void;
  const close=vi.spyOn(db,'close'),studio=new StudioSession(()=>new Promise(r=>{resolve=r;}));sessions.push(studio);
  const listener=vi.fn();studio.subscribe(listener);const initializing=studio.initialize();studio.dispose();listener.mockClear();
  resolve(db);await initializing;expect(close).toHaveBeenCalled();expect(listener).not.toHaveBeenCalled();
});

it('removes only the confirmed current project and creates a separate empty draft',async()=>{
  const {studio,db}=await setup(),before=studio.getSnapshot().project;await studio.removeCurrent();
  expect(await db.load(before.id)).toBeNull();expect(studio.getSnapshot().project.id).not.toBe(before.id);
  expect(studio.getSnapshot().project.takes).toHaveLength(0);
});

it('rejects source retention when no video exists and never creates a descriptor',async()=>{
  const {studio}=await setup(),p=studio.getSnapshot().project;
  await expect(studio.keepSource(p.takes[0].id,true)).rejects.toThrow(/no source/i);
  expect(studio.getSnapshot().project).toBe(p);
});

it('serializes navigation and rejects late source attachment during a project switch',async()=>{
  let resolve!:(p:ProjectDocument)=>void;const target=createProject('Target');
  const {studio,db}=await setup(readyProject(),store=>({...store,load:async id=>id===target.id?new Promise(r=>{resolve=r;}):store.load(id)}));
  await db.save(target,null);
  const switching=studio.open(target.id);await vi.waitFor(()=>expect(resolve).toBeTypeOf('function'));
  await expect(studio.create()).rejects.toThrow(/wait/i);
  expect(()=>studio.update(p=>renameProject(p,'Late edit'))).toThrow(/wait/i);
  expect(()=>studio.attachSource(studio.getSnapshot().project.takes[0].id,{name:'late.webm',blob:new Blob(['video'],{type:'video/webm'})})).toThrow(/wait/i);
  resolve(target);await switching;expect(studio.getSnapshot().project.id).toBe(target.id);
});

it('keeps a newly imported memory project when unavailable storage is later retried',async()=>{
  const {db}=await setup();let fail=true;
  const studio=new StudioSession(async()=>{if(fail) throw new Error('Unavailable');return db;});sessions.push(studio);
  await studio.initialize();const incoming=readyProject();await studio.install(incoming,new Map());
  fail=false;await studio.retry();expect(studio.getSnapshot().project.id).toBe(incoming.id);
  expect((await db.load(incoming.id))?.takes).toEqual(incoming.takes);
});

it('never creates another save lane after disposal during an awaited navigation save',async()=>{
  let resolve!:()=>void;
  const {studio}=await setup(readyProject(),store=>({...store,save:()=>new Promise<void>(r=>{resolve=r;})}));
  studio.update(p=>renameProject(p,'Closing tab'));const navigating=studio.create();
  await vi.waitFor(()=>expect(resolve).toBeTypeOf('function'));studio.dispose();const before=studio.getSnapshot();resolve();
  await expect(navigating).rejects.toThrow(/closed/i);expect(studio.getSnapshot()).toBe(before);
});

it('does not hide an unrelated operation failure when autosave completes',async()=>{
  const {studio}=await setup();studio.update(p=>renameProject(p,'Pending edit'));studio.reportError(new Error('Project import failed'));
  await studio.flush();expect(studio.getSnapshot()).toMatchObject({save:{phase:'saved'},error:'Project import failed'});
});

it('unkeeping a reloaded source preserves memory backup and re-retention until explicit discard',async()=>{
  const {studio,factory,name}=await setup(),p=studio.getSnapshot().project,takeId=p.takes[0].id;
  const blob=new Blob(['original retained source'],{type:'video/webm'});studio.attachSource(takeId,{name:'source.webm',blob});
  await studio.keepSource(takeId,true);await studio.flush();studio.dispose();
  const db=await openProjectStore({factory,name}),reloaded=new StudioSession(async()=>db);sessions.push(reloaded);await reloaded.initialize();
  await reloaded.keepSource(takeId,false);await reloaded.flush();expect(await db.readMedia(p.id,takeId)).toBeNull();
  const memory=await reloaded.readSource(takeId);expect(memory?.blob.size).toBe(blob.size);expect(reloaded.hasVolatileSources()).toBe(true);
  const decoded=await decodeProject(await encodeProject(reloaded.getSnapshot().project,{includeMedia:true,readMedia:id=>reloaded.readSource(id)}));
  expect(await decoded.media.get(takeId)!.blob.text()).toBe('original retained source');
  await reloaded.keepSource(takeId,true);await reloaded.flush();expect((await db.readMedia(p.id,takeId))?.size).toBe(blob.size);
});
it('explicit source deletion preserves motion and removes memory and stored media',async()=>{
  const original=readyProject(),{studio,db,factory,name}=await setup(original),id=original.takes[0].id;
  studio.attachSource(id,{name:'source.webm',blob:new Blob(['video'],{type:'video/webm'})});await studio.keepSource(id,true);await studio.flush();
  await studio.deleteSource(id);expect(await studio.readSource(id)).toBeNull();expect(await db.readMedia(original.id,id)).toBeNull();
  expect(studio.getSnapshot().project.takes[0].frames).toEqual(original.takes[0].frames);expect(studio.getSnapshot().project.takes[0].clips).toEqual(original.takes[0].clips);
  studio.dispose();const next=new StudioSession(()=>openProjectStore({factory,name}));sessions.push(next);await next.initialize();expect(await next.readSource(id)).toBeNull();
});
it('a failed deletion confirmation keeps the current original available',async()=>{
  let fail=false;const {studio}=await setup(readyProject(),store=>({...store,save:async(...args)=>{if(fail)throw new ProjectStorageError('quota','Full');return store.save(...args);}}));
  const id=studio.getSnapshot().project.takes[0].id;studio.attachSource(id,{name:'source.webm',blob:new Blob(['video'],{type:'video/webm'})});
  await studio.keepSource(id,true);await studio.flush();fail=true;await expect(studio.deleteSource(id)).rejects.toThrow('Full');expect((await studio.readSource(id))?.blob.size).toBe(5);
});
