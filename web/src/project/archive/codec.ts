import { CONTRACT_VERSION } from '../../motion/contract';
import { recoverProject } from '../model';
import { PROJECT_SCHEMA, type ProjectDocument, type ProjectTake } from '../types';
import { parseMedia, parseProject } from '../validation';
import { ProjectArchiveError, archiveLimits, type ArchiveLimits } from './limits';
import { parseArchiveJSON } from './json';
import { mediaPath, parseManifest, type ArchiveManifest } from './manifest';
import { abortable, archiveOperation } from './operation';
import { readZip, writeZip } from './zip';

export {ProjectArchiveError} from './limits';
export interface ArchiveMediaSource {readonly name:string;readonly blob:Blob}
interface Options {signal?:AbortSignal;limits?:Partial<ArchiveLimits>}
export interface EncodeOptions extends Options {
  includeMedia?:boolean;readMedia?:(takeId:string)=>Promise<ArchiveMediaSource|null>;
}
function jsonBlob(value:unknown):Blob {
  // Validated schema text forbids NUL, so this internal placeholder cannot collide with user content.
  const signedZero='\u0000EmoteCapSignedZero\u0000';
  const json=JSON.stringify(value,(_key,item:unknown)=>Object.is(item,-0)?signedZero:item)
    .replaceAll(JSON.stringify(signedZero),'-0.0');
  return new Blob([json],{type:'application/json'});
}
function newNamespace(project:ProjectDocument):string {
  const used=new Set([project.id.toLowerCase(),...project.takes.flatMap(t=>[t.id,...t.clips.map(c=>c.id),...t.undo.flatMap(list=>list.map(c=>c.id))]).map(id=>id.toLowerCase())]);
  let id=crypto.randomUUID();while(used.has(id.toLowerCase())) id=crypto.randomUUID();return id;
}

export function encodeProject(project:ProjectDocument,options:EncodeOptions={}):Promise<Blob> {
  return archiveOperation(options.signal,async signal=>{
    const limits=archiveLimits(options.limits),original=parseProject(project),payloads=new Map<string,Blob>();
    const takes:ProjectTake[]=[], media:ArchiveManifest['media'][number][]=[];
    for(const take of original.takes) {
      signal.throwIfAborted();
      const source=options.includeMedia && options.readMedia ? await abortable(options.readMedia(take.id),signal) : null;
      if(options.includeMedia && take.media && !source) throw new ProjectArchiveError('missing-media','A retained source video is unavailable. Include no video or restore its source first.');
      if(source) {
        if(!(source.blob instanceof Blob)) throw new ProjectArchiveError('invalid','Source media must be a video Blob.');
        const descriptor=parseMedia({name:source.name,type:source.blob.type,size:source.blob.size})!;
        if(take.media && (take.media.size!==descriptor.size || take.media.type!==descriptor.type)) throw new ProjectArchiveError('invalid','Retained video does not match its description.');
        const path=mediaPath(take.id);payloads.set(path,source.blob);media.push({takeId:take.id,path});takes.push({...take,media:descriptor});
      } else takes.push({...take,media:null});
    }
    const snapshot=parseProject({...original,takes}),header=parseManifest({format:'emotecap-archive',version:1,
      project:'project.json',projectSchema:PROJECT_SCHEMA,contractVersion:CONTRACT_VERSION,media});
    return writeZip(new Map([['manifest.json',jsonBlob(header)],['project.json',jsonBlob(snapshot)],...payloads]),limits,signal);
  });
}

export function decodeProject(blob:Blob,options:Options={}):Promise<{project:ProjectDocument;media:ReadonlyMap<string,ArchiveMediaSource>}> {
  return archiveOperation(options.signal,async signal=>{
    const limits=archiveLimits(options.limits),entries=await readZip(blob,limits,signal);
    const header=parseManifest(await parseArchiveJSON(entries.get('manifest.json')!,limits.manifestBytes,signal));
    const original=parseProject(await parseArchiveJSON(entries.get(header.project)!,limits.jsonBytes,signal));
    const sources=new Map<string,ArchiveMediaSource>(),referenced=new Set<string>();
    for(const row of header.media) {
      signal.throwIfAborted();const take=original.takes.find(t=>t.id===row.takeId), data=entries.get(row.path);
      if(!take?.media || !data || data.size!==take.media.size) throw new ProjectArchiveError('invalid','Archive source references or sizes do not match the project.');
      referenced.add(row.path);sources.set(row.takeId,Object.freeze({name:take.media.name,blob:new Blob([data],{type:take.media.type})}));
    }
    if(original.takes.some(t=>t.media && !sources.has(t.id)) || [...entries.keys()].some(p=>p.startsWith('media/') && !referenced.has(p))) {
      throw new ProjectArchiveError('invalid','Archive source data is missing or unreferenced.');
    }
    const restored=parseProject({...original,id:newNamespace(original),takes:original.takes.map(t=>({...t,media:null}))});
    return {project:recoverProject(restored),media:sources};
  });
}
