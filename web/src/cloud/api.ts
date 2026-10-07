/** Explicit selected-source permission followed by a single bounded upload. */
import type { Segment } from '../motion/index';
import type { FetchFn } from '../jobs/api';
import { buildTakeForm,preflightFailure } from '../take/takesApi';
import { describeErrorDetail } from '../record/exportApi';
import { HttpFailure,httpJSON } from './transport';
export interface CloudSource {takeId:string;video:Blob;duration:number}
export interface CloudCleanup {localVideo:'deleted'|'failed';warning:string|null;remoteFiles:'not-used'|'deleted'|'failed'|'unknown';remoteWarning:string|null;model:string|null}
export interface CloudReply {takeId:string;segments:Segment[];cleanup:CloudCleanup}
export interface CloudOptions {fetchFn?:FetchFn;signal?:AbortSignal;onSending?:()=>void}
export class CloudFailure extends Error {constructor(message:string,readonly cleanup:CloudCleanup|null=null){super(message);}}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const record=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v);
const string=(v:unknown,max:number):v is string=>typeof v==='string'&&v.length<=max;
const optional=(v:unknown,max:number)=>v===null||string(v,max);
function unexpected():never{throw new CloudFailure('Unexpected Gemini suggestions. Keep your current clips and use local Find pauses.');}
export function parseCleanup(value:unknown):CloudCleanup {
  if(!record(value)||!['deleted','failed'].includes(String(value.localVideo))||!optional(value.warning,512)
    ||!['not-used','deleted','failed','unknown'].includes(String(value.remoteFiles))||!optional(value.remoteWarning,512)||!optional(value.model,100))return unexpected();
  return Object.freeze({localVideo:value.localVideo as CloudCleanup['localVideo'],warning:value.warning as string|null,
    remoteFiles:value.remoteFiles as CloudCleanup['remoteFiles'],remoteWarning:value.remoteWarning as string|null,model:value.model as string|null});
}
export function parseReply(value:unknown,source:CloudSource):CloudReply {
  if(!record(value)||value.takeId!==source.takeId.toLowerCase()||!Array.isArray(value.segments)||!value.segments.length||value.segments.length>50)return unexpected();
  const names=new Set<string>();
  const segments=value.segments.map((v:unknown)=>{
    if(!record(v)||!string(v.name,24)||!/^[A-Za-z0-9_]{1,24}$/.test(v.name)||names.has(v.name.toLowerCase())
      ||typeof v.start!=='number'||!Number.isFinite(v.start)||v.start<0||typeof v.end!=='number'||!Number.isFinite(v.end)
      ||v.end<=v.start||v.end>source.duration+.001||typeof v.loop!=='boolean'||!string(v.description,512))return unexpected();
    names.add(v.name.toLowerCase());return {name:v.name,start:v.start,end:Math.min(source.duration,v.end),loop:v.loop,description:v.description};
  });
  return {takeId:source.takeId.toLowerCase(),segments,cleanup:parseCleanup(value.cleanup)};
}
export async function sendVideo(source:CloudSource,allowed:boolean,options:CloudOptions={}):Promise<CloudReply>{
  if(allowed!==true)throw new CloudFailure('Explicit permission is required before sending a video.');
  const captured={...source,takeId:source.takeId.toLowerCase()},blocked=preflightFailure(captured.video,captured.duration);
  if(blocked)throw new CloudFailure(blocked.message);if(!UUID.test(captured.takeId))throw new CloudFailure('Invalid source take identity');
  const mime=captured.video.type||'video/webm',duration=Number(captured.duration.toFixed(3));
  try{
    const permission=await httpJSON('/api/cloud-consent',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      provider:'gemini',policyVersion:1,allowUpload:true,takeId:captured.takeId,size:captured.video.size,duration,mimeType:mime})},{...options,timeoutMs:15000,maxBytes:4096});
    if(!record(permission)||!string(permission.token,43)||!/^[A-Za-z0-9_-]{43}$/.test(permission.token)||typeof permission.expiresAt!=='number'||!Number.isSafeInteger(permission.expiresAt)||permission.expiresAt<=Date.now())throw new CloudFailure('Upload permission could not be confirmed. Choose Send again.');
    if(options.signal?.aborted)throw options.signal.reason??new DOMException('Cancelled','AbortError');options.onSending?.();
    const body=await httpJSON('/api/takes',{method:'POST',headers:{'X-EmoteCap-Consent':permission.token},body:buildTakeForm(captured.video,duration,captured.takeId)},options);
    return parseReply(body,captured);
  }catch(error){
    if(error instanceof CloudFailure)throw error;
    let cleanup:CloudCleanup|null=null;
    if(error instanceof HttpFailure){const detail=record(error.body)&&record(error.body.detail)?error.body.detail:null;
      if(detail?.cleanup)try{cleanup=parseCleanup(detail.cleanup);}catch{/* Original service error still remains visible. */}
      throw new CloudFailure(describeErrorDetail(error.body).slice(0,1024)||error.message,cleanup);}
    throw error;
  }
}
