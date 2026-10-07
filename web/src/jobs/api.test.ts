import { expect,it,vi } from 'vitest';
import { JobFailure,parseJob,requestJobs,submitJob } from './api';
import { ID,NEXT,job,submission } from './testData';
const response=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});

it('owns a valid frozen response',()=>{
  const value=job(),parsed=parseJob(value);value.phase='Changed';expect(parsed.phase).toBe('Waiting for Blender');expect(Object.isFrozen(parsed)).toBe(true);
});
it.each([{state:'mystery'},{schemaVersion:2},{progress:101},{id:'bad'},{inputSha256:'wrong'},
  {snapshot:{projectId:ID,takeId:NEXT,clipRevision:-1}},{cancelRequested:'yes'}])('rejects malformed job %j',patch=>expect(()=>parseJob(job(patch))).toThrow(JobFailure));
it.each(['/files/../escape.fbx','javascript:alert(1)',`/files/${NEXT}/Wave.fbx`,`/files/${ID}/Wave.fbx?redirect=other`])('rejects unsafe or mismatched download %s',url=>{
  expect(()=>parseJob(job({state:'succeeded',progress:100,files:[{name:'Wave',url,sidecar:`/files/${ID}/Wave.emotecap.json`}]}))).toThrow(JobFailure);
});
it('accepts paired immutable result links',()=>{
  expect(parseJob(job({state:'succeeded',progress:100,files:[{name:'Wave',url:`/files/${ID}/Wave.fbx`,sidecar:`/files/${ID}/Wave.emotecap.json`}]})).files).toHaveLength(1);
});
it('freezes submitted bytes before later edits and passes explicit metadata',async()=>{
  const input=submission(),fetchFn=vi.fn(async(_url:string,_init:RequestInit)=>response(job(),202));const pending=submitJob(input,fetchFn);input.snapshot.clipRevision=8;input.clips[0].name='Changed';await pending;
  const body=JSON.parse(fetchFn.mock.calls[0][1].body as string);expect(body.snapshot.clipRevision).toBe(7);expect(body.clips[0].name).toBe('Wave');
});
it('shows queue capacity rejection rather than losing the take',async()=>{
  await expect(submitJob(submission(),async()=>response({detail:'Export queue is full'},429))).rejects.toThrow(/queue is full/i);
});
it('bounds streamed response bytes before parsing',async()=>{
  const stream=new ReadableStream<Uint8Array>({start(c){c.enqueue(new Uint8Array(9*1024*1024+1));c.close();}});
  await expect(requestJobs(async()=>new Response(stream))).rejects.toThrow(/large/i);
});
it('pre-cancel never sends a request',async()=>{
  const cancel=new AbortController();cancel.abort();const fetchFn=vi.fn(async()=>response({jobs:[]}));
  await expect(requestJobs(fetchFn,cancel.signal)).rejects.toThrow(/cancel/i);expect(fetchFn).not.toHaveBeenCalled();
});
it('times out even when an injected fetch ignores cancellation',async()=>{
  vi.useFakeTimers();try {
    const pending=requestJobs(()=>new Promise(()=>{})).catch(error=>error);
    await vi.advanceTimersByTimeAsync(15000);expect((await pending).message).toMatch(/timed out/i);
  }finally{vi.useRealTimers();}
});
