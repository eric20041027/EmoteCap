import { expect, it } from 'vitest';
import { tposeFrame } from '../motion/contract';
import { addTake, appendTakeFrames, createProject, editClip, finishTake, removeTake } from './model';
import { provenance, rawProject, readyProject, type Mutable } from './testData';
import { MAX_PROJECT_FRAMES, MAX_TAKE_FRAMES } from './types';
import { assertOriginalTransition, parseProject, ProjectDataError } from './validation';

it('roundtrips all provenance and draft edits with owned frozen data', () => {
  const raw=rawProject();
  raw.takes[0].clips[0].name='';
  const parsed=parseProject(raw);
  expect(parsed).toEqual(raw);
  expect(parsed.takes[0].frames[0]).not.toBe(raw.takes[0].frames[0]);
  expect(Object.isFrozen(parsed.takes[0].frames[0].h)).toBe(true);
  expect(Object.isFrozen(parsed.takes[0].provenance.models[0])).toBe(true);
  expect(Object.isFrozen(parsed.takes[0].clips)).toBe(true);
  raw.takes[0].frames[0].h[1]=50;
  expect(parsed.takes[0].frames[0].h[1]).toBe(0.95);
});

const badInputs: [string, (raw:ReturnType<typeof rawProject>)=>void][] = [
  ['future schema',r=>Object.assign(r,{schemaVersion:2})],
  ['old contract',r=>r.contractVersion=1],
  ['secret project field',r=>Object.assign(r,{apiKey:'private'})],
  ['secret provenance field',r=>Object.assign(r.takes[0].provenance,{geminiApiKey:'private'})],
  ['unknown frame field',r=>Object.assign(r.takes[0].frames[0],{fps:30})],
  ['nonfinite quaternion',r=>r.takes[0].frames[0].r[0]=NaN],
  ['numeric string',r=>(r.takes[0].frames[0].r as unknown[])[0]='0'],
  ['missing rotation',r=>r.takes[0].frames[0].r.pop()],
  ['sparse rotation',r=>Reflect.deleteProperty(r.takes[0].frames[0].r,0)],
  ['sparse hips',r=>Reflect.deleteProperty(r.takes[0].frames[0].h,1)],
  ['bad norm',r=>r.takes[0].frames[0].r[3]=0.9],
  ['horizontal translation',r=>r.takes[0].frames[0].h[0]=0.01],
  ['repeated timestamp',r=>r.takes[0].frames[1].t=0],
  ['negative timestamp',r=>r.takes[0].frames[0].t=-1],
  ['overlong take',r=>r.takes[0].frames[2].t=180.001],
  ['empty complete take',r=>r.takes[0].frames=[]],
  ['dangling selected take',r=>r.activeTakeId=crypto.randomUUID()],
  ['duplicate take id',r=>r.takes.push(structuredClone(r.takes[0]))],
  ['duplicate clip id',r=>r.takes[0].clips.push(structuredClone(r.takes[0].clips[0]))],
  ['traversal identity',r=>r.takes[0].id='../media'],
  ['clip beyond original',r=>r.takes[0].clips[0].end=1.1],
  ['short clip',r=>r.takes[0].clips[0].end=0.01],
  ['oversized draft name',r=>r.takes[0].clips[0].name='x'.repeat(25)],
  ['oversized history',r=>r.takes[0].undo=Array(21).fill([])],
  ['oversized model list',r=>r.takes[0].provenance.models=Array(4).fill(r.takes[0].provenance.models[0])],
  ['wrong model hash',r=>r.takes[0].provenance.models[0].sha256='bad'],
  ['negative revision',r=>r.revision=-1],
  ['oversized project name',r=>r.name='x'.repeat(121)],
  ['oversized media',r=>r.takes[0].media={name:'x.webm',type:'video/webm',size:100*1024*1024+1}],
];
it.each(badInputs)('rejects %s without accepting partial data',(_label,mutate)=>{
  const raw=rawProject();mutate(raw);
  expect(()=>parseProject(raw)).toThrow(ProjectDataError);
});

it('rejects take/project frame counts before allocating owned frame buffers',()=>{
  const raw=rawProject();
  raw.takes[0].frames=Array(MAX_TAKE_FRAMES+1).fill(tposeFrame());
  expect(()=>parseProject(raw)).toThrow(/frame/i);
  const base=rawProject();
  base.takes=[0,1,2].map(n=>({...structuredClone(base.takes[0]),id:crypto.randomUUID(),
    clips:[],frames:Array(n===2?1:MAX_TAKE_FRAMES).fill(tposeFrame())}));
  expect(base.takes.reduce((n,t)=>n+t.frames.length,0)).toBe(MAX_PROJECT_FRAMES+1);
  base.activeTakeId=base.takes[0].id;
  expect(()=>parseProject(base)).toThrow(/project.*frames/i);
});

it('accepts quaternion/timeline boundary values and an interrupted empty checkpoint',()=>{
  const raw=rawProject();raw.takes[0].frames[0].r[3]=0.98;raw.takes[0].frames[1].r[3]=1.02;
  raw.takes[0].frames[2].t=180;
  expect(parseProject(raw).takes[0].frames[2].t).toBe(180);
  raw.takes[0].status='interrupted';raw.takes[0].frames=[];raw.takes[0].clips=[];
  expect(parseProject(raw).takes[0].status).toBe('interrupted');
});

it('rejects rewriting completed originals even in otherwise valid newer documents',()=>{
  const previous=readyProject();
  const raw=structuredClone(previous) as Mutable<typeof previous>;raw.revision++;
  raw.takes[0].frames[1].h[1]=1.2;
  expect(()=>assertOriginalTransition(previous,parseProject(raw))).toThrow(/original/i);
  const changed=editClip(previous,previous.takes[0].id,previous.takes[0].clips[0].id,{name:'Wave'});
  expect(()=>assertOriginalTransition(previous,changed)).not.toThrow();
  expect(()=>assertOriginalTransition(previous,removeTake(previous,previous.takes[0].id))).not.toThrow();
});

it('permits append/completion but rejects rewriting a recording prefix or provenance',()=>{
  const empty=addTake(createProject(),{name:'Camera',source:'camera',provenance:provenance()});
  const id=empty.takes[0].id, previous=appendTakeFrames(empty,id,[tposeFrame(0)]);
  const appended=finishTake(appendTakeFrames(previous,id,[tposeFrame(1)]),id);
  expect(()=>assertOriginalTransition(previous,appended)).not.toThrow();
  const raw=structuredClone(appended);raw.takes[0].frames[0].h[1]=1.2;
  expect(()=>assertOriginalTransition(previous,parseProject(raw))).toThrow(/original/i);
  const meta=structuredClone(appended) as Mutable<typeof appended>;meta.takes[0].provenance.smoothing='high';
  expect(()=>assertOriginalTransition(previous,parseProject(meta))).toThrow(/original/i);
});
