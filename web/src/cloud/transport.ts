/** Bounded local HTTP; cancellations also settle non-cooperating injected transports. */
import type { FetchFn } from '../jobs/api';
export class HttpFailure extends Error {constructor(readonly status:number,readonly body:unknown){super(`Local service returned HTTP ${status}`);}}
interface Options {fetchFn?:FetchFn;signal?:AbortSignal;timeoutMs?:number;maxBytes?:number}
export async function httpJSON(url:string,init:RequestInit,{fetchFn=fetch,signal,timeoutMs=75000,maxBytes=1024*1024}:Options={}):Promise<unknown>{
  if(signal?.aborted)throw signal.reason??new DOMException('Cancelled','AbortError');
  const cancel=new AbortController(),onAbort=()=>cancel.abort(signal?.reason??new DOMException('Cancelled','AbortError'));
  signal?.addEventListener('abort',onAbort,{once:true});
  const timer=setTimeout(()=>cancel.abort(new DOMException('Local request timed out','TimeoutError')),timeoutMs);
  let rejectAbort!:(reason:unknown)=>void;const aborted=new Promise<never>((_,reject)=>rejectAbort=reject);
  const reject=()=>rejectAbort(cancel.signal.reason);cancel.signal.addEventListener('abort',reject,{once:true});
  let reader:ReadableStreamDefaultReader<Uint8Array>|undefined;
  try{
    const response=await Promise.race([fetchFn(url,{...init,signal:cancel.signal}),aborted]);
    if(Number(response.headers.get('content-length'))>maxBytes)throw new Error('Local response is too large');
    const chunks:Uint8Array[]=[];let size=0;
    if(response.body){reader=response.body.getReader();while(true){const part=await Promise.race([reader.read(),aborted]);if(part.done)break;
      size+=part.value.byteLength;if(size>maxBytes)throw new Error('Local response is too large');chunks.push(part.value);}}
    const bytes=new Uint8Array(size);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.length;}
    const raw=new TextDecoder().decode(bytes);let body:unknown;try{body=raw?JSON.parse(raw):null;}catch{body=raw;}
    if(!response.ok)throw new HttpFailure(response.status,body);return body;
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',onAbort);cancel.signal.removeEventListener('abort',reject);
    if(reader){void reader.cancel().catch(()=>{});reader.releaseLock();}}
}
