import { afterEach,expect,it,vi } from 'vitest';
import { ExportJobs } from './controller';
import type { FetchFn } from './api';
import { ID,NEXT,job,submission } from './testData';
const controllers:ExportJobs[]=[];afterEach(()=>{controllers.forEach(c=>c.stop());controllers.length=0;vi.useRealTimers();});
const response=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status});
function create(fetchFn:FetchFn){const c=new ExportJobs(fetchFn);controllers.push(c);return c;}
it('refresh retrieves durable jobs after browser restart',async()=>{
  const c=create(vi.fn(async()=>response({jobs:[job()]})));await c.refresh();expect(c.getSnapshot().jobs[0].id).toBe(ID);
});
it('preserves last-known jobs when polling fails and reports the error',async()=>{
  let fail=false;const c=create(vi.fn(async()=>{if(fail)throw new Error('Offline');return response({jobs:[job()]});}));
  await c.refresh();fail=true;await expect(c.refresh()).rejects.toThrow();expect(c.getSnapshot().jobs).toHaveLength(1);expect(c.getSnapshot().error).toMatch(/Offline/i);
});
it('never overlaps polls and ignores a late response after stop',async()=>{
  vi.useFakeTimers();let resolve!:(r:Response)=>void;const fetchFn=vi.fn(()=>new Promise<Response>(r=>resolve=r)),c=create(fetchFn);
  c.start();await vi.advanceTimersByTimeAsync(5000);expect(fetchFn).toHaveBeenCalledTimes(1);c.stop();const before=c.getSnapshot();resolve(response({jobs:[job()]}));
  await vi.advanceTimersByTimeAsync(1000);expect(c.getSnapshot()).toBe(before);expect(fetchFn).toHaveBeenCalledTimes(1);
});
it('submits immutable bytes and accepts editing while queued',async()=>{
  const fetchFn=vi.fn(async(_url:string,_init:RequestInit)=>response(job(),202)),c=create(fetchFn),input=submission();const pending=c.submit(input);input.snapshot.clipRevision=9;input.clips[0].name='Later_edit';await pending;
  expect(JSON.parse(fetchFn.mock.calls[0][1].body as string).snapshot.clipRevision).toBe(7);expect(c.getSnapshot().busy).toBe(false);expect(c.getSnapshot().jobs[0].state).toBe('queued');
});
it('cancel and retry use server identity instead of newer clips',async()=>{
  const fetchFn=vi.fn(async(url:string,_init:RequestInit)=>response(url.endsWith('/retry')?job({id:NEXT,retryOf:ID}):job({state:'cancelled',cancelRequested:true}))),c=create(fetchFn);
  await c.cancel(ID);expect(c.getSnapshot().jobs[0].state).toBe('cancelled');await c.retry(ID);
  expect(c.getSnapshot().jobs[0]).toMatchObject({id:NEXT,retryOf:ID,snapshot:{clipRevision:7}});expect(fetchFn.mock.calls.every(([,init])=>!init.body)).toBe(true);
});
it('a stale poll cannot resurrect a job after deletion',async()=>{
  let resolve!:(r:Response)=>void;const fetchFn=vi.fn((url:string,init?:RequestInit)=>init?.method==='DELETE'?Promise.resolve(new Response(null,{status:204})):new Promise<Response>(r=>resolve=r));
  const c=create(fetchFn),pending=c.refresh();await c.delete(ID);resolve(response({jobs:[job()]}));await pending;expect(c.getSnapshot().jobs).toEqual([]);
});
it('effect replay during an accepted submission releases the action lock',async()=>{
  let resolve!:(response:Response)=>void;
  const fetchFn=vi.fn((_url:string,init:RequestInit)=>init.method==='POST'?new Promise<Response>(r=>resolve=r):Promise.resolve(response({jobs:[]}))),c=create(fetchFn);
  const pending=c.submit(submission());expect(c.getSnapshot().busy).toBe(true);c.stop();c.start();resolve(response(job(),202));await pending;
  expect(c.getSnapshot().busy).toBe(false);
});
it('a poll started during deletion cannot resurrect its completed result',async()=>{
  let finishDelete!:(response:Response)=>void,finishPoll!:(response:Response)=>void;
  const fetchFn:FetchFn=(_url,init)=>new Promise(resolve=>{if(init.method==='DELETE')finishDelete=resolve;else finishPoll=resolve;});
  const c=create(fetchFn),deleting=c.delete(ID),polling=c.refresh();finishDelete(new Response(null,{status:204}));await deleting;
  finishPoll(response({jobs:[job()]}));await polling;expect(c.getSnapshot().jobs).toEqual([]);
});
