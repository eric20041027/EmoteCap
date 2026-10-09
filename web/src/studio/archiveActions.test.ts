import { IDBFactory } from 'fake-indexeddb';
import { afterEach, expect, it, vi } from 'vitest';
import { decodeProject, encodeProject } from '../project/archive/codec';
import { renameProject } from '../project/model';
import { readyProject } from '../project/testData';
import { openProjectStore, type ProjectStore } from '../project/store';
import { StudioSession } from './session';
import { downloadProject, importProject } from './archiveActions';
const sessions:StudioSession[]=[];
afterEach(()=>sessions.splice(0).forEach(s=>s.dispose()));
async function setup(wrap?:(store:ProjectStore)=>ProjectStore) {
  const db=await openProjectStore({factory:new IDBFactory(),name:crypto.randomUUID()}),project=readyProject();await db.save(project,null);
  const session=new StudioSession(async()=>wrap?wrap(db):db);sessions.push(session);await session.initialize();return {session,db};
}
it('downloads the current project without reading source video by default',async()=>{
  const {session}=await setup(),read=vi.spyOn(session,'readSource');let file:Blob|null=null;
  await downloadProject(session,false,undefined,(blob)=>{file=blob;});
  expect(file).toBeInstanceOf(Blob);expect(read).not.toHaveBeenCalled();
  expect((await decodeProject(file!)).project.takes).toEqual(session.getSnapshot().project.takes);
});
it('includes memory-only source only when selected without changing retention',async()=>{
  const {session}=await setup(),take=session.getSnapshot().project.takes[0];
  session.attachSource(take.id,{name:'source.webm',blob:new Blob(['source'],{type:'video/webm'})});let file:Blob|null=null;
  await downloadProject(session,true,undefined,b=>{file=b;});const decoded=await decodeProject(file!);
  expect(decoded.media.get(take.id)?.blob.size).toBe(6);expect(session.getSnapshot().project.takes[0].media).toBeNull();
});
it('a corrupt or pre-cancelled import never installs or replaces current work',async()=>{
  const {session}=await setup(),before=session.getSnapshot().project,install=vi.spyOn(session,'install');
  await expect(importProject(session,new Blob(['not zip']),false)).rejects.toThrow();
  const abort=new AbortController();abort.abort();await expect(importProject(session,await encodeProject(readyProject()),false,abort.signal)).rejects.toThrow();
  expect(install).not.toHaveBeenCalled();expect(session.getSnapshot().project).toBe(before);
});
it('cancellation while waiting for a current save never installs the decoded project',async()=>{
  let resolve!:()=>void;
  const {session,db}=await setup(store=>({...store,save:async(...args)=>{await new Promise<void>(r=>{resolve=r;});return store.save(...args);}}));
  session.update(p=>renameProject(p,'Pending work'));const before=session.getSnapshot().project,abort=new AbortController();
  const installing=importProject(session,await encodeProject(readyProject()),false,abort.signal);
  await vi.waitFor(()=>expect(resolve).toBeTypeOf('function'));abort.abort();resolve();await expect(installing).rejects.toThrow(/cancel|abort/i);
  expect(session.getSnapshot().project).toBe(before);expect((await db.load(before.id))?.name).toBe(before.name);
});
