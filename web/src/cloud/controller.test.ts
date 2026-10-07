import { afterEach,expect,it,vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createProject,selectTake,editClip,replaceClips,undoClips,addTake } from '../project/model';
import { readyProject,provenance } from '../project/testData';
import { openProjectStore } from '../project/store';
import { StudioSession } from '../studio/session';
import { encodeProject,decodeProject } from '../project/archive/codec';
import { CloudSlice } from './controller';
import type { CloudReply,CloudSource,CloudOptions } from './api';
const sessions:StudioSession[]=[],controllers:CloudSlice[]=[];
afterEach(()=>{controllers.splice(0).forEach(c=>c.stop());sessions.splice(0).forEach(s=>s.dispose());});
function reply(source:CloudSource):CloudReply{return {takeId:source.takeId,segments:[{name:'Suggested',start:0,end:1,loop:false,description:'Synthetic'}],cleanup:{localVideo:'deleted',warning:null,remoteFiles:'failed',remoteWarning:'Deletion failed',model:'mock'}};}
async function setup(send=(source:CloudSource,_allowed:boolean,_options:CloudOptions)=>Promise.resolve(reply(source))){
  const db=await openProjectStore({factory:new IDBFactory(),name:crypto.randomUUID()}),project=readyProject();await db.save(project,null);
  const session=new StudioSession(async()=>db);sessions.push(session);await session.initialize();
  session.attachSource(project.takes[0].id,{name:'synthetic.webm',blob:new Blob(['video'],{type:'video/webm'})});
  const controller=new CloudSlice(session,send);controllers.push(controller);controller.start();return {session,controller,project};
}
it('checking permission alone does not send and selection resets it',async()=>{
  const send=vi.fn(async(source:CloudSource)=>reply(source)),{session,controller}=await setup(send);controller.setConsent(true);expect(controller.getSnapshot().consent).toBe(true);expect(send).not.toHaveBeenCalled();
  session.update(p=>addTake(p,{name:'Other',source:'sample',provenance:provenance(),frames:p.takes[0].frames}));expect(controller.getSnapshot().consent).toBe(false);
});
it('suggestions require explicit apply and preserve original motion and undo',async()=>{
  const {session,controller,project}=await setup();controller.setConsent(true);await controller.send();
  expect(session.getSnapshot().project.takes[0].clips).toEqual(project.takes[0].clips);expect(controller.getSnapshot().result?.cleanup.remoteFiles).toBe('failed');
  controller.apply();expect(session.getSnapshot().project.takes[0].clips[0].name).toBe('Suggested');expect(session.getSnapshot().project.takes[0].frames).toEqual(project.takes[0].frames);
  session.update(p=>undoClips(p,project.takes[0].id));expect(session.getSnapshot().project.takes[0].clips).toEqual(project.takes[0].clips);
});
it('newer edits require explicit replacement approval',async()=>{
  let resolve!:(reply:CloudReply)=>void,source!:CloudSource;
  const {session,controller,project}=await setup((value)=>{source=value;return new Promise(r=>resolve=r);});controller.setConsent(true);const pending=controller.send();
  await vi.waitFor(()=>expect(resolve).toBeTypeOf('function'));session.update(p=>replaceClips(p,project.takes[0].id,[{id:crypto.randomUUID(),name:'New_edit',start:0,end:1,loop:false,description:''}]));
  resolve(reply(source));await pending;expect(()=>controller.apply()).toThrow(/changed|replace/i);expect(session.getSnapshot().project.takes[0].clips[0].name).toBe('New_edit');
  controller.apply(true);expect(session.getSnapshot().project.takes[0].clips[0].name).toBe('Suggested');
});
it('another take never receives the original suggestions',async()=>{
  const {session,controller,project}=await setup();controller.setConsent(true);await controller.send();session.update(p=>addTake(p,{name:'Other',source:'sample',provenance:provenance(),frames:p.takes[0].frames}));
  const otherClips=session.getSnapshot().project.takes[1].clips;expect(()=>controller.apply()).toThrow(/take|project/i);expect(session.getSnapshot().project.takes[1].clips).toEqual(otherClips);
  session.update(p=>selectTake(p,project.takes[0].id));controller.apply();expect(session.getSnapshot().project.takes[0].clips[0].name).toBe('Suggested');
});
it('cancelled late replies do not modify clips or publish suggestions',async()=>{
  let resolve!:(reply:CloudReply)=>void,source!:CloudSource;
  const {session,controller,project}=await setup(value=>{source=value;return new Promise(r=>resolve=r);});controller.setConsent(true);const pending=controller.send();
  await vi.waitFor(()=>expect(resolve).toBeTypeOf('function'));controller.cancel();resolve(reply(source));await pending;
  expect(controller.getSnapshot().result).toBeNull();expect(session.getSnapshot().project.takes[0].clips).toEqual(project.takes[0].clips);
});
it('portable backup contains neither permission token nor provider key',async()=>{
  const {session,controller}=await setup();controller.setConsent(true);await controller.send();
  const decoded=await decodeProject(await encodeProject(session.getSnapshot().project));const json=JSON.stringify(decoded.project);
  expect(json).not.toMatch(/token|apiKey|cleanup|remoteWarning/i);
});
it('effect replay rechecks a pending source instead of leaving it unavailable',async()=>{
  const db=await openProjectStore({factory:new IDBFactory(),name:crypto.randomUUID()}),project=readyProject();await db.save(project,null);
  const session=new StudioSession(async()=>db);sessions.push(session);await session.initialize();const pending:Array<(source:{name:string;blob:Blob})=>void>=[];
  const read=vi.spyOn(session,'readSource').mockImplementation(()=>new Promise(resolve=>pending.push(resolve)));
  const c=new CloudSlice(session);controllers.push(c);c.start();c.stop();c.start();
  expect(read).toHaveBeenCalledTimes(2);pending.forEach(resolve=>resolve({name:'synthetic.webm',blob:new Blob(['video'],{type:'video/webm'})}));
  await vi.waitFor(()=>expect(c.getSnapshot().available).toBe(true));
});
