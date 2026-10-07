import { expect, it } from 'vitest';
import { tposeFrame } from '../motion/contract';
import { addTake, appendTakeFrames, createProject, editClip, finishTake, recoverProject,
  removeClip, removeTake, renameProject, renameTake, replaceClips, selectTake,
  setTakeMedia, undoClips } from './model';
import { provenance, readyProject } from './testData';
import { MAX_MEDIA_BYTES, MAX_TAKES } from './types';

it('creates a versioned Unicode project with a stable identity', () => {
  const project = createProject('我的動畫', 1000);
  expect(project).toMatchObject({format:'emotecap-project', schemaVersion:1,
    contractVersion:2, name:'我的動畫', revision:0, createdAt:1000,
    updatedAt:1000, activeTakeId:null, takes:[]});
  expect(project.id).toMatch(/^[0-9a-f-]{36}$/);
});

it('owns original buffers and provenance when a solver reuses them', () => {
  const frame = tposeFrame(0);
  const meta = provenance();
  const project = addTake(createProject(), {name:'Take', source:'video', frames:[frame], provenance:meta});
  frame.r[0] = 0.7; frame.h[1] = 99; meta.models[0].sha256 = 'b'.repeat(64);
  expect(project.takes[0].frames[0]).toEqual(tposeFrame(0));
  expect(project.takes[0].provenance.models[0].sha256).toBe('a'.repeat(64));
  expect(Object.isFrozen(project.takes[0].frames[0].r)).toBe(true);
  expect(project.takes[0].clips).toEqual([]);
});

it('preserves original motion through edits, deletion and undo with new revisions', () => {
  const original = readyProject();
  const take = original.takes[0];
  const clip = take.clips[0];
  const edited = editClip(original, take.id, clip.id, {name:'wave',start:0.2,end:0.8,loop:true});
  expect(edited.takes[0].frames).toBe(take.frames);
  expect(edited.takes[0].provenance).toBe(take.provenance);
  expect(original.takes[0].clips[0].name).toBe('Clip_01');
  const deleted = removeClip(edited,take.id,clip.id);
  const undone = undoClips(deleted,take.id);
  expect(undone.takes[0].clips).toEqual(edited.takes[0].clips);
  expect(undone.takes[0].clipRevision).toBe(3);
  expect(undone.revision).toBe(original.revision + 3);
  expect(undoClips(undone,take.id).takes[0].clips).toEqual(take.clips);
});

it('bounds undo history to the last twenty changes', () => {
  let project = readyProject();
  const {id,clips} = project.takes[0];
  for(let n=0;n<30;n++) project = editClip(project,id,clips[0].id,{name:`clip_${n}`});
  expect(project.takes[0].undo).toHaveLength(20);
  for(let n=0;n<20;n++) project = undoClips(project,id);
  expect(project.takes[0].clips[0].name).toBe('clip_9');
  expect(project.takes[0].clipRevision).toBe(50);
  expect(undoClips(project,id)).toBe(project);
});

it('saves temporarily empty or invalid export names without losing drafts', () => {
  const original=readyProject(), take=original.takes[0];
  expect(editClip(original,take.id,take.clips[0].id,{name:''}).takes[0].clips[0].name).toBe('');
  expect(editClip(original,take.id,take.clips[0].id,{name:'手揮動'}).takes[0].clips[0].name).toBe('手揮動');
  expect(() => editClip(original,take.id,take.clips[0].id,{end:2})).toThrow(/range/i);
  expect(editClip(original,take.id,take.clips[0].id,{name:take.clips[0].name})).toBe(original);
});

it('appends only to a recording, finishes it, and never changes previous checkpoints', () => {
  const original = addTake(createProject(),{name:'Camera',source:'camera',provenance:provenance()});
  const id=original.takes[0].id;
  const checkpoint=appendTakeFrames(original,id,[tposeFrame(0),tposeFrame(0.5)]);
  const completed=finishTake(appendTakeFrames(checkpoint,id,[tposeFrame(1)]),id);
  expect(original.takes[0].frames).toHaveLength(0);
  expect(checkpoint.takes[0].frames).toHaveLength(2);
  expect(completed.takes[0]).toMatchObject({status:'complete',clips:[{start:0,end:1}]});
  expect(() => appendTakeFrames(completed,id,[tposeFrame(2)])).toThrow(/recording/i);
  expect(() => appendTakeFrames(checkpoint,id,[tposeFrame(0.4)])).toThrow(/time/i);
  expect(() => finishTake(original,id)).toThrow(/empty/i);
});

it('recovers a checkpoint as interrupted while retaining completed takes and all frames', () => {
  const complete=readyProject();
  const recording=addTake(complete,{name:'Camera',source:'camera',provenance:provenance()});
  const id=recording.activeTakeId!;
  const checkpoint=appendTakeFrames(recording,id,[tposeFrame(0),tposeFrame(0.25)]);
  const restored=recoverProject(checkpoint);
  expect(restored.takes[0]).toBe(checkpoint.takes[0]);
  expect(restored.takes[1].status).toBe('interrupted');
  expect(restored.takes[1].frames).toBe(checkpoint.takes[1].frames);
  expect(restored.takes[1].clips[0].end).toBe(0.25);
  expect(recoverProject(restored)).toBe(restored);
  expect(recoverProject(recording).takes[1]).toMatchObject({status:'interrupted',frames:[],clips:[]});
});

it('names, selects and removes takes without overwriting another original', () => {
  const first=readyProject(), firstId=first.activeTakeId!;
  const second=addTake(first,{name:'Second',source:'sample',provenance:provenance(),frames:[tposeFrame(0)]});
  expect(second.takes).toHaveLength(2);
  expect(second.takes[0]).toBe(first.takes[0]);
  const renamed=renameTake(renameProject(second,'新專案'),firstId,'新動作');
  expect(renamed).toMatchObject({name:'新專案',takes:[{name:'新動作'}, {name:'Second'}]});
  const selected=selectTake(renamed,firstId);
  expect(removeTake(selected,firstId).activeTakeId).toBe(second.activeTakeId);
  expect(() => selectTake(selected,crypto.randomUUID())).toThrow(/take/i);
});

it('rejects take and media totals before discarding any original', () => {
  let project=createProject();
  for(let n=0;n<MAX_TAKES;n++) project=addTake(project,{name:`Take ${n}`,source:'camera',provenance:provenance()});
  expect(() => addTake(project,{name:'Extra',source:'camera',provenance:provenance()})).toThrow(/20/);
  const descriptor={name:'source.webm',type:'video/webm',size:MAX_MEDIA_BYTES};
  project=setTakeMedia(project,project.takes[0].id,descriptor);
  project=setTakeMedia(project,project.takes[1].id,descriptor);
  expect(() => setTakeMedia(project,project.takes[2].id,descriptor)).toThrow(/media/i);
  expect(setTakeMedia(project,project.takes[0].id,null).takes[0].media).toBeNull();
});

it('replaces clip lists nondestructively and rejects duplicate clip identities', () => {
  const project=readyProject(), take=project.takes[0];
  const next=[{...take.clips[0],name:'One',end:0.4}, {...take.clips[0],id:crypto.randomUUID(),name:'Two',start:0.5}];
  expect(replaceClips(project,take.id,next).takes[0].frames).toBe(take.frames);
  expect(() => replaceClips(project,take.id,[next[0],next[0]])).toThrow(/duplicate/i);
});
