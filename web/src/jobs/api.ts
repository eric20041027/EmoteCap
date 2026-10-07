/** Bounded job HTTP responses and immutable request bytes. */
import type { Clip } from '../motion/index';
import { ExportFailure,describeErrorDetail } from '../record/exportApi';
export interface JobSnapshot {readonly projectId:string;readonly takeId:string;readonly clipRevision:number}
export interface JobSubmission {clips:readonly Clip[];snapshot?:JobSnapshot|null}
export type JobState='queued'|'running'|'succeeded'|'failed'|'cancelled'|'interrupted';
export interface JobStatus {
  readonly id:string;readonly schemaVersion:1;readonly state:JobState;readonly phase:string;readonly progress:number;
  readonly snapshot:JobSnapshot|null;readonly inputSha256:string;readonly createdAt:number;readonly updatedAt:number;
  readonly retryOf:string|null;readonly cancelRequested:boolean;
  readonly files:readonly {readonly name:string;readonly url:string;readonly sidecar:string}[];
  readonly error:{readonly message:string;readonly details:string}|null;readonly warning:string|null;
}
export type FetchFn=(url:string,init:RequestInit)=>Promise<Response>;
export class JobFailure extends ExportFailure {constructor(message:string,details=''){super(message,details);this.name='JobFailure';}}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const STATES=new Set(['queued','running','succeeded','failed','cancelled','interrupted']);
const MAX_RESPONSE_BYTES=9*1024*1024,MAX_INPUT_BYTES=128*1024*1024;
const record=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v);
const text=(v:unknown,max:number):v is string=>typeof v==='string'&&v.length<=max;
const integer=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
function malformed():never{throw new JobFailure('Unexpected export job response. Refresh jobs or update the local service.');}
function snapshot(v:unknown):JobSnapshot|null {
  if(v===null)return null;
  if(!record(v)||typeof v.projectId!=='string'||!UUID.test(v.projectId)||typeof v.takeId!=='string'||!UUID.test(v.takeId)||!integer(v.clipRevision))return malformed();
  return Object.freeze({projectId:v.projectId,takeId:v.takeId,clipRevision:v.clipRevision});
}
export function parseJob(value:unknown):JobStatus {
  if(!record(value)||typeof value.id!=='string'||!UUID.test(value.id)||value.schemaVersion!==1||typeof value.state!=='string'||!STATES.has(value.state)
    ||!text(value.phase,120)||!value.phase.trim()||!integer(value.progress,0,100)||!text(value.inputSha256,64)||!/^[0-9a-f]{64}$/.test(value.inputSha256)
    ||!integer(value.createdAt)||!integer(value.updatedAt,value.createdAt)||typeof value.cancelRequested!=='boolean'
    ||(value.retryOf!==null&&(typeof value.retryOf!=='string'||!UUID.test(value.retryOf)))
    ||!Array.isArray(value.files)||value.files.length>50||(value.state!=='succeeded'&&value.files.length)
    ||(value.state==='succeeded'&&(!value.files.length||value.progress!==100))
    ||(value.warning!==null&&!text(value.warning,512)))return malformed();
  const id=value.id,names=new Set<string>();
  const files=value.files.map((entry:unknown)=>{
    if(!record(entry)||typeof entry.name!=='string'||!/^[A-Za-z0-9_]{1,24}$/.test(entry.name)||names.has(entry.name.toLowerCase())
      ||entry.url!==`/files/${id}/${entry.name}.fbx`||entry.sidecar!==`/files/${id}/${entry.name}.emotecap.json`)return malformed();
    names.add(entry.name.toLowerCase());return Object.freeze({name:entry.name,url:entry.url as string,sidecar:entry.sidecar as string});
  });
  let error:JobStatus['error']=null;
  if(value.error!==null){if(!record(value.error)||!text(value.error.message,512)||!text(value.error.details,65536))return malformed();error=Object.freeze({message:value.error.message,details:value.error.details});}
  return Object.freeze({id,schemaVersion:1,state:value.state as JobState,phase:value.phase,progress:value.progress,snapshot:snapshot(value.snapshot),inputSha256:value.inputSha256,
    createdAt:value.createdAt,updatedAt:value.updatedAt,retryOf:value.retryOf as string|null,cancelRequested:value.cancelRequested,
    files:Object.freeze(files),error,warning:value.warning as string|null});
}

async function request(url:string,init:RequestInit,fetchFn:FetchFn,signal?:AbortSignal):Promise<unknown> {
  if(signal?.aborted)throw new JobFailure('Export request cancelled');
  const cancel=new AbortController();let timedOut=false;
  const onAbort=()=>cancel.abort();signal?.addEventListener('abort',onAbort,{once:true});
  const timer=setTimeout(()=>{timedOut=true;cancel.abort();},15000);
  let rejectAbort!:(reason:JobFailure)=>void;
  const aborted=new Promise<never>((_,reject)=>rejectAbort=reject);
  const abortRequest=()=>rejectAbort(new JobFailure(timedOut?'Export request timed out. Refresh jobs before submitting again.':'Export request cancelled'));
  cancel.signal.addEventListener('abort',abortRequest,{once:true});
  let reader:ReadableStreamDefaultReader<Uint8Array>|undefined;
  try {
    const response=await Promise.race([fetchFn(url,{...init,signal:cancel.signal}),aborted]);
    if(Number(response.headers.get('content-length'))>MAX_RESPONSE_BYTES)throw new JobFailure('Export response is too large');
    const chunks:Uint8Array[]=[];let size=0;
    if(response.body){reader=response.body.getReader();while(true){const part=await Promise.race([reader.read(),aborted]);if(part.done)break;
      size+=part.value.byteLength;if(size>MAX_RESPONSE_BYTES)throw new JobFailure('Export response is too large');chunks.push(part.value);}}
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    const raw=new TextDecoder().decode(bytes);let body:unknown;
    try{body=raw?JSON.parse(raw):null;}catch{body=raw;}
    if(!response.ok)throw new JobFailure(describeErrorDetail(body).slice(0,2048)||`Export service returned HTTP ${response.status}`);
    return body;
  }catch(error){if(error instanceof JobFailure)throw error;throw new JobFailure(`Cannot confirm export jobs: ${error instanceof Error?error.message:String(error)}. Refresh jobs before submitting again.`);}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',onAbort);cancel.signal.removeEventListener('abort',abortRequest);
    if(reader){void reader.cancel().catch(()=>{});reader.releaseLock();}}
}
export async function requestJobs(fetchFn:FetchFn=fetch,signal?:AbortSignal):Promise<readonly JobStatus[]> {
  const body=await request('/api/export-jobs',{method:'GET'},fetchFn,signal);
  if(!record(body)||!Array.isArray(body.jobs)||body.jobs.length>128)return malformed();
  const jobs=body.jobs.map(parseJob);if(new Set(jobs.map(j=>j.id)).size!==jobs.length)return malformed();return Object.freeze(jobs);
}
export async function submitJob(input:JobSubmission,fetchFn:FetchFn=fetch,signal?:AbortSignal):Promise<JobStatus> {
  if(!input.clips.length||input.clips.length>50||input.clips.reduce((n,c)=>n+c.frames.length,0)>43202)throw new JobFailure('Export fewer clips at once (maximum 43202 frames).');
  const body=JSON.stringify(input);if(new TextEncoder().encode(body).length>MAX_INPUT_BYTES)throw new JobFailure('Export input is too large');
  return parseJob(await request('/api/export-jobs',{method:'POST',headers:{'Content-Type':'application/json'},body},fetchFn,signal));
}
export async function jobAction(id:string,action:'cancel'|'retry'|'delete',fetchFn:FetchFn=fetch):Promise<JobStatus|null> {
  if(!UUID.test(id))throw new JobFailure('Invalid export job identity');
  const body=await request(`/api/export-jobs/${id}${action==='delete'?'':`/${action}`}`,{method:action==='delete'?'DELETE':'POST'},fetchFn);
  return action==='delete'?null:parseJob(body);
}
