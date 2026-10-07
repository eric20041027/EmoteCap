import {NO_PERSON_MESSAGE,type ConvertSteps,type ConvertedVideo} from '../import/convertVideo';
import type {PoseSolver,SmoothingLevel} from '../motion/index';
import baselineIndex from '../../scripts/baseline-sources.json';
import {importOriginalModule} from './originalModule';

export const ORIGINAL_COMMIT='713d349df05aa26b6b95a1b7974f7f3d8e574149';
export const ORIGINAL_INDEX_SHA256='2ae375ffc2e783ca4ffe296564078bad99e18bc34d13bde19f9342e9756577b8';
export interface OriginalManifest {
  schema:'emotecap-original-runner-v1';sourceCommit:string;sourceIndexSha256:string;consumedSources:string[];
  bundleSha256:string;bundleBytes:number;builderSha256:string;compilerLockSha256:string;viteVersion:string;nodeVersion:string;
  qualification:'compiled-source';
}
export interface OriginalRunner {
  convertVideo:(duration:number,steps:ConvertSteps)=>Promise<ConvertedVideo>;
  createPoseSolver:(filter?:object,smoothing?:SmoothingLevel)=>PoseSolver;
  ImportError:new(message:string)=>Error;NO_PERSON_MESSAGE:string;
  compiledSource:{sourceCommit:string;sourceIndexSha256:string};
  provenance:{buildId:string;manifest:OriginalManifest};
}
const hex=(value:unknown,length=64):value is string=>typeof value==='string'&&new RegExp(`^[0-9a-f]{${length}}$`).test(value);
function fail():never{throw new Error('Original runner unavailable or invalid.');}
const keys=['schema','sourceCommit','sourceIndexSha256','consumedSources','bundleSha256','bundleBytes','builderSha256',
  'compilerLockSha256','viteVersion','nodeVersion','qualification'];
const runtimeSources=new Set(baselineIndex.files.map(file=>file.path).filter(name=>
  name==='contracts/bones.json'||/^web\/src\/(motion|import)\/[A-Za-z]+\.ts$/.test(name)));
function validManifest(value:unknown):value is OriginalManifest {
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const data=value as Record<string,unknown>,names=data.consumedSources;
  return Object.keys(data).length===keys.length&&keys.every(key=>Object.hasOwn(data,key))&&
    data.schema==='emotecap-original-runner-v1'&&data.sourceCommit===ORIGINAL_COMMIT&&data.sourceIndexSha256===ORIGINAL_INDEX_SHA256&&
    data.qualification==='compiled-source'&&hex(data.bundleSha256)&&hex(data.builderSha256)&&hex(data.compilerLockSha256)&&
    Number.isSafeInteger(data.bundleBytes)&&Number(data.bundleBytes)>0&&Number(data.bundleBytes)<=512*1024&&
    data.viteVersion==='8.3.1'&&typeof data.nodeVersion==='string'&&/^v24\.\d{1,3}\.\d{1,3}$/.test(data.nodeVersion)&&
    Array.isArray(names)&&names.length>0&&names.length<=runtimeSources.size&&
    names.every((name,index)=>typeof name==='string'&&runtimeSources.has(name)&&(index===0||name>names[index-1]))&&
    ['contracts/bones.json','web/src/import/convertVideo.ts','web/src/motion/index.ts','web/src/motion/solver.ts'].every(name=>names.includes(name));
}
async function sha(bytes:Uint8Array<ArrayBuffer>):Promise<string>{
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),byte=>byte.toString(16).padStart(2,'0')).join('');
}
async function boundedResponse(url:string,limit:number,signal:AbortSignal,guard:()=>void):Promise<Uint8Array<ArrayBuffer>> {
  guard();const response=await fetch(url,{signal,cache:'no-store',redirect:'error'});
  let reader:ReadableStreamDefaultReader<Uint8Array>|undefined;
  const chunks:Uint8Array<ArrayBuffer>[]= [];let total=0;
  try{
    guard();if(!response.ok||response.redirected||!response.body)fail();reader=response.body.getReader();
    for(;;){guard();const {done,value}=await reader.read();guard();if(done)break;
      total+=value.byteLength;if(total>limit)fail();chunks.push(new Uint8Array(value));}
    const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;
  }catch(error){if(reader)await reader.cancel().catch(()=>{});else await response.body?.cancel().catch(()=>{});throw error;}
  finally{reader?.releaseLock();}
}
export async function loadOriginalRunner(buildId:string,options:{authorize:()=>void;signal:AbortSignal}):Promise<OriginalRunner>{
  if(!hex(buildId))fail();
  const signal=AbortSignal.any([options.signal,AbortSignal.timeout(10000)]),guard=()=>{signal.throwIfAborted();options.authorize();};
  guard();const base=`/.measurement-baseline/runners/${buildId}`;
  const raw=await boundedResponse(base+'/manifest.json',16*1024,signal,guard);
  if(await sha(raw)!==buildId)fail();guard();
  const manifest:unknown=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));if(!validManifest(manifest))fail();
  const bundle=await boundedResponse(base+'/original.bin',512*1024,signal,guard);
  if(bundle.length!==manifest.bundleBytes||await sha(bundle)!==manifest.bundleSha256)fail();guard();
  const url=URL.createObjectURL(new Blob([bundle],{type:'text/javascript'}));
  try{
    guard();const imported=await importOriginalModule(url);guard();
    if(!imported||typeof imported!=='object')fail();const module=imported as Record<string,unknown>;
    const marker=module.compiledSource as Record<string,unknown>|undefined;
    if(typeof module.convertVideo!=='function'||typeof module.createPoseSolver!=='function'||typeof module.ImportError!=='function'||
      module.NO_PERSON_MESSAGE!==NO_PERSON_MESSAGE||!marker||Object.keys(marker).length!==2||
      marker.sourceCommit!==ORIGINAL_COMMIT||marker.sourceIndexSha256!==ORIGINAL_INDEX_SHA256)fail();
    return{...(module as unknown as Omit<OriginalRunner,'provenance'>),provenance:{buildId,manifest}};
  }finally{URL.revokeObjectURL(url);}
}
