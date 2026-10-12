import { expect, it } from 'vitest';
import { editClip, replaceClips, undoClips } from '../project/model';
import { readyProject } from '../project/testData';
import { clipNameIssues, clampClipTime, localClips, projectClips, projectClip } from './clips';

it('keeps invalid draft names saveable but blocks animation export',()=>{
  const p=readyProject(),take=p.takes[0],clip=take.clips[0];
  for(const name of ['','中文','bad name']) {
    const changed=editClip(p,take.id,clip.id,{name}).takes[0];
    expect(changed.clips[0].name).toBe(name);expect(clipNameIssues(changed.clips).has(clip.id)).toBe(true);
    expect(clipNameIssues(changed.clips).get(clip.id)).toMatch(/name/i);
    expect(()=>projectClips(changed)).toThrow(/name/i);
  }
});
it('marks every case-insensitive duplicate name',()=>{
  const clip=readyProject().takes[0].clips[0],clips=[clip,{...clip,id:crypto.randomUUID(),name:clip.name.toUpperCase()}];
  const issues=clipNameIssues(clips);expect(issues.size).toBe(2);expect([...issues.values()].every(v=>/unique|duplicate/i.test(v))).toBe(true);
});
it('builds the selected frozen clip revision without mutating original frames',()=>{
  const p=readyProject(),before=p.takes[0],changed=editClip(p,before.id,before.clips[0].id,{start:0.2,end:0.8,loop:true});
  const clips=projectClips(changed.takes[0]);expect(clips[0]).toMatchObject({name:'Clip_01',loop:true,skeleton:'full'});
  expect(clips[0].frames[0].t).toBe(0);expect(clips[0].frames.at(-1)!.t).toBeCloseTo(0.6,4);
  expect(changed.takes[0].frames).toEqual(before.frames);expect(clips[0].frames[0].r).not.toBe(before.frames[0].r);
});
it('clamps keyboard time edits inside the original take with a 0.1-second minimum',()=>{
  const clip=readyProject().takes[0].clips[0];
  expect(clampClipTime(clip,'start',99,1)).toBeCloseTo(0.9);expect(clampClipTime(clip,'start',-1,1)).toBe(0);
  expect(clampClipTime({...clip,start:0.8},'end',0,1)).toBeCloseTo(0.9);expect(clampClipTime(clip,'end',99,1)).toBe(1);
  expect(()=>clampClipTime(clip,'start',NaN,1)).toThrow();
});
it('local pause detection never contacts a server, and keeps generated identities on subsequent edits',()=>{
  const p=readyProject(),take=p.takes[0],generated=localClips(take);
  expect(generated.length).toBeGreaterThan(0);expect(new Set(generated.map(c=>c.id)).size).toBe(generated.length);
  const split=replaceClips(p,take.id,generated),edited=editClip(split,take.id,generated[0].id,{name:'Local'});
  expect(edited.takes[0].clips[0].id).toBe(generated[0].id);
  expect(undoClips(edited,take.id).takes[0].clips).toEqual(generated);
  expect(undoClips(split,take.id).takes[0].clips).toEqual(take.clips);
});
it('blocks export of an empty interrupted take and leaves it saveable',()=>{
  const take=readyProject().takes[0];expect(()=>projectClips({...take,frames:[],clips:[],status:'interrupted'})).toThrow(/clip|frames/i);
});

it('prepares one trimmed processed preview equal to the actual export, preserving originals',()=>{
  const take=readyProject().takes[0];
  const frames=take.frames.map((frame,index)=>({...frame,t:[0,0.45,1][index],h:[0,[0.95,2.5,0.55][index],0] as [number,number,number],r:[...frame.r]}));
  frames[1].r.splice(0,4,0,Math.SQRT1_2,0,Math.SQRT1_2);
  const selected={...take,frames,clips:[{...take.clips[0],start:0.2,end:0.8,loop:true}]};
  const before=structuredClone(selected),packet=projectClip(selected,selected.clips[0].id);
  expect(packet).toEqual(projectClips(selected)[0]);expect(packet.frames[0].t).toBe(0);
  expect(packet.frames.at(-1)!.t).toBeCloseTo(0.6,4);expect(packet).toMatchObject({loop:true,fps:30,skeleton:'full'});
  expect(packet.frames[0].h).not.toEqual(frames[0].h);expect(packet.frames[0].r).not.toEqual(frames[0].r);
  expect(selected).toEqual(before);expect(packet.frames[0].r).not.toBe(selected.frames[0].r);
});
it('can preview a valid selected clip while another invalid draft still blocks batch export',()=>{
  const take=readyProject().takes[0],selected={...take,clips:[...take.clips,{...take.clips[0],id:crypto.randomUUID(),name:''}]};
  expect(projectClip(selected,selected.clips[0].id).name).toBe('Clip_01');
  expect(()=>projectClips(selected)).toThrow(/name/i);
});
it('rejects unknown, empty, invalid and duplicated selected clips without changing their drafts',()=>{
  const take=readyProject().takes[0],id=take.clips[0].id;
  expect(projectClip(take,id).frames.length).toBeGreaterThan(0);
  expect(()=>projectClip(take,'missing')).toThrow(/clip/i);
  expect(()=>projectClip({...take,frames:[]},id)).toThrow(/frames/i);
  for(const name of ['', 'invalid name']) expect(()=>projectClip({...take,clips:[{...take.clips[0],name}]},id)).toThrow(/name/i);
  const duplicate={...take,clips:[...take.clips,{...take.clips[0],id:crypto.randomUUID()}]};
  expect(()=>projectClip(duplicate,id)).toThrow(/unique/i);
});
