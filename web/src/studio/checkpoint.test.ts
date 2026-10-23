import { IDBFactory } from 'fake-indexeddb';
import { afterEach, expect, it, vi } from 'vitest';
import { tposeFrame, type MotionFrame } from '../motion/index';
import { provenance } from '../project/testData';
import { addTake } from '../project/model';
import { openProjectStore } from '../project/store';
import { StudioSession } from './session';
import { CaptureCheckpoint } from './checkpoint';
import { RecorderSession } from '../record/recorderSession';

const sessions:StudioSession[]=[],captures:CaptureCheckpoint[]=[];
afterEach(()=>{captures.splice(0).forEach(c=>c.dispose());sessions.splice(0).forEach(s=>s.dispose());vi.useRealTimers();});
async function setup() {
  const db=await openProjectStore({factory:new IDBFactory(),name:crypto.randomUUID()});
  const studio=new StudioSession(async()=>db);sessions.push(studio);await studio.initialize();await studio.flush();
  return {studio,db};
}
it('creates a stable identified recording take before its first checkpoint',async()=>{
  const {studio}=await setup();const capture=new CaptureCheckpoint(studio,provenance(),()=>[]);captures.push(capture);
  expect(studio.getSnapshot().project.takes).toHaveLength(1);
  expect(studio.getSnapshot().project.takes[0]).toMatchObject({id:capture.takeId,status:'recording',source:'camera',frames:[]});
});
it('checkpoints only after five seconds and commits the exact immutable frame prefix',async()=>{
  vi.useFakeTimers({toFake:['setInterval','clearInterval','setTimeout','clearTimeout']});
  const {studio,db}=await setup();let frames:MotionFrame[]=[];
  const capture=new CaptureCheckpoint(studio,provenance(),()=>frames);captures.push(capture);capture.start();await studio.flush();
  frames=[tposeFrame(0),tposeFrame(0.5)];await vi.advanceTimersByTimeAsync(4999);await studio.flush();
  expect((await db.load(studio.getSnapshot().project.id))?.takes[0].frames).toHaveLength(0);
  await vi.advanceTimersByTimeAsync(1);await studio.flush();
  const saved=await db.load(studio.getSnapshot().project.id);
  expect(saved?.takes[0]).toMatchObject({id:capture.takeId,status:'recording',frames});
  frames[0].r[3]=0;expect(studio.getSnapshot().project.takes[0].frames[0].r[3]).toBe(1);
});
it('finishes the unsaved tail immediately and never repeats a stored prefix',async()=>{
  const {studio,db}=await setup();let frames=[tposeFrame(0),tposeFrame(0.5)];
  const capture=new CaptureCheckpoint(studio,provenance(),()=>frames);captures.push(capture);capture.start();capture.checkpoint();await studio.flush();
  frames=[...frames,tposeFrame(1)];capture.finish(frames);await studio.flush();
  const take=(await db.load(studio.getSnapshot().project.id))!.takes[0];
  expect(take).toMatchObject({id:capture.takeId,status:'complete',frames});expect(take.frames).toHaveLength(3);
  expect(()=>capture.checkpoint()).not.toThrow();expect(studio.getSnapshot().project.takes[0].frames).toHaveLength(3);
});
it('an empty normal stop removes its empty capture without deleting an earlier take',async()=>{
  const {studio,db}=await setup();studio.update(p=>addTake(p,{name:'Earlier',source:'sample',provenance:provenance(),frames:[tposeFrame(0)]}));
  const earlier=studio.getSnapshot().project.takes[0],capture=new CaptureCheckpoint(studio,provenance(),()=>[]);captures.push(capture);capture.start();
  capture.finish([]);await studio.flush();expect((await db.load(studio.getSnapshot().project.id))!.takes).toEqual([earlier]);
});
it('disposal stops the timer and leaves the last saved take recoverable',async()=>{
  vi.useFakeTimers({toFake:['setInterval','clearInterval','setTimeout','clearTimeout']});
  const {studio,db}=await setup();let frames=[tposeFrame(0)];const capture=new CaptureCheckpoint(studio,provenance(),()=>frames);captures.push(capture);capture.start();capture.checkpoint();await studio.flush();capture.dispose();
  frames=[...frames,tposeFrame(1)];await vi.advanceTimersByTimeAsync(10000);
  expect((await db.load(studio.getSnapshot().project.id))?.takes[0].frames).toHaveLength(1);
});
it('a failed capture finalizes its valid prefix as interrupted rather than complete',async()=>{
  const {studio}=await setup(),frames=[tposeFrame(0),tposeFrame(0.5)];
  const capture=new CaptureCheckpoint(studio,provenance(),()=>frames);captures.push(capture);capture.finish(frames,true);await studio.flush();
  expect(studio.getSnapshot().project.takes[0]).toMatchObject({status:'interrupted',frames});
});
it('reads unpublished recorder frames at checkpoints and includes the last frame on immediate stop',async()=>{
  const {studio,db}=await setup(),recorder=new RecorderSession();recorder.arm();recorder.begin();
  const capture=new CaptureCheckpoint(studio,provenance(),recorder.snapshotFrames);captures.push(capture);capture.start();
  recorder.push(tposeFrame(100));recorder.push(tposeFrame(101));capture.checkpoint();await studio.flush();
  expect(recorder.getSnapshot()).toMatchObject({phase:'recording',frameCount:0});
  const prefix=(await db.load(studio.getSnapshot().project.id))!.takes[0].frames;expect(prefix).toHaveLength(2);
  recorder.push(tposeFrame(102));recorder.stop();capture.finish(recorder.snapshotFrames());await studio.flush();
  const frames=(await db.load(studio.getSnapshot().project.id))!.takes[0].frames;
  expect(frames.map(f=>f.t)).toEqual([0,1,2]);expect(frames.slice(0,2)).toEqual(prefix);
});
