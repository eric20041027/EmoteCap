import { expect,it,vi } from 'vitest';
import { sendVideo,parseReply,CloudFailure } from './api';
import { ID } from '../jobs/testData';
const source={takeId:ID,video:new Blob(['video'],{type:'video/webm'}),duration:2};
const cleanup={localVideo:'deleted',warning:null,remoteFiles:'failed',remoteWarning:'Check Google Files',model:'gemini-test-model'};
const reply=()=>({takeId:ID,segments:[{name:'Wave',start:0,end:2,loop:false,description:'Synthetic'}],cleanup});
const response=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status});

it('does not issue a grant or upload without explicit permission',async()=>{
  const fetchFn=vi.fn(async()=>response({}));await expect(sendVideo(source,false,{fetchFn})).rejects.toThrow(/consent|permission/i);expect(fetchFn).not.toHaveBeenCalled();
});
it('obtains one permission then sends only the frozen selected video',async()=>{
  const fetchFn=vi.fn(async(url:string,init:RequestInit)=>url.endsWith('/cloud-consent')?response({token:'c'.repeat(43),expiresAt:Date.now()+60000}):response(reply()));
  const result=await sendVideo(source,true,{fetchFn});expect(fetchFn).toHaveBeenCalledTimes(2);
  const payload=JSON.parse(fetchFn.mock.calls[0][1].body as string);expect(payload).toMatchObject({provider:'gemini',allowUpload:true,takeId:ID,size:5,duration:2});
  const upload=fetchFn.mock.calls[1][1];expect(upload.headers).toMatchObject({'X-EmoteCap-Consent':'c'.repeat(43)});expect((upload.body as FormData).get('takeId')).toBe(ID);
  expect(result.cleanup.remoteFiles).toBe('failed');expect(result.cleanup.remoteWarning).toBe('Check Google Files');
});
it.each([{takeId:'604e37e2-814a-40f8-9c0a-6dc702c73dbb'},{segments:[{name:'bad name',start:0,end:2,loop:false}]},
  {segments:[{name:'Wave',start:0,end:3,loop:false}]},{cleanup:{...cleanup,remoteFiles:'all-data-erased'}}])('rejects malformed or mismatched suggestions %j',patch=>{
  expect(()=>parseReply({...reply(),...patch},source)).toThrow(CloudFailure);
});
it('pre-cancellation sends no permission or media',async()=>{
  const signal=new AbortController();signal.abort();const fetchFn=vi.fn(async()=>response({}));await expect(sendVideo(source,true,{fetchFn,signal:signal.signal})).rejects.toThrow();expect(fetchFn).not.toHaveBeenCalled();
});
it('a late grant after cancellation never starts upload',async()=>{
  let resolve!:(response:Response)=>void;const fetchFn=vi.fn((_url:string,_init:RequestInit)=>new Promise<Response>(r=>resolve=r)),cancel=new AbortController();
  const pending=sendVideo(source,true,{fetchFn,signal:cancel.signal}).catch(error=>error);cancel.abort();resolve(response({token:'c'.repeat(43),expiresAt:Date.now()+60000}));
  await pending;expect(fetchFn).toHaveBeenCalledTimes(1);
});
