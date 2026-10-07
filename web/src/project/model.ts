import { CONTRACT_VERSION, type MotionFrame } from '../motion/contract';
import { MAX_TAKE_FRAMES, MAX_UNDO, PROJECT_SCHEMA, type MediaDescriptor, type ProjectClip,
  type ProjectDocument, type ProjectTake, type TakeProvenance } from './types';
import { checkProjectLimits, fields, integer, parseClips, parseFrames, parseMedia,
  parseProvenance, ProjectDataError, text } from './validation';

export function createProject(name = 'Untitled project', now = Date.now()): ProjectDocument {
  return Object.freeze({format:'emotecap-project',schemaVersion:PROJECT_SCHEMA,contractVersion:CONTRACT_VERSION,
    id:crypto.randomUUID(),revision:0,name:text(name,120,'Project name'),createdAt:integer(now,'Created time'),
    updatedAt:now,activeTakeId:null,takes:Object.freeze([])});
}
function changed(project: ProjectDocument, takes: readonly ProjectTake[], extra: Partial<Pick<ProjectDocument,'name'|'activeTakeId'>> = {}): ProjectDocument {
  checkProjectLimits(takes,project.id);
  return Object.freeze({...project,...extra,takes:Object.freeze([...takes]),
    revision:integer(project.revision+1,'Project revision'),updatedAt:Math.max(project.updatedAt,Date.now())});
}
function takeById(project: ProjectDocument, id: string): ProjectTake {
  const take=project.takes.find(t=>t.id===id);
  if (!take) throw new ProjectDataError('Take does not exist.');
  return take;
}
function updateTake(project: ProjectDocument, id: string, update: (take:ProjectTake)=>ProjectTake): ProjectDocument {
  const before=takeById(project,id), after=update(before);
  return before===after ? project : changed(project,project.takes.map(t=>t===before?Object.freeze(after):t));
}
function defaultClips(frames: readonly MotionFrame[]): readonly ProjectClip[] {
  const duration=frames.at(-1)?.t ?? 0;
  return parseClips(duration>=0.1 ? [{id:crypto.randomUUID(),name:'Clip_01',start:0,end:duration,loop:false,description:''}] : [],duration);
}
function finalizedEdits(take:ProjectTake):Pick<ProjectTake,'clips'|'clipRevision'> {
  const clips=take.clips.length?take.clips:defaultClips(take.frames);
  return {clips,clipRevision:clips.length && !take.clips.length?integer(take.clipRevision+1,'Clip revision'):take.clipRevision};
}
export interface NewTake {
  name:string; source:ProjectTake['source']; provenance:TakeProvenance; frames?:readonly MotionFrame[];
}
export function addTake(project:ProjectDocument,input:NewTake): ProjectDocument {
  if (!['camera','video','sample'].includes(input.source)) throw new ProjectDataError('Take source is unsupported.');
  const frames=parseFrames(input.frames ?? []), status=input.frames===undefined?'recording':'complete';
  if (status==='complete' && frames.length===0) throw new ProjectDataError('A complete take cannot be empty.');
  const take:ProjectTake=Object.freeze({id:crypto.randomUUID(),name:text(input.name,120,'Take name'),source:input.source,
    status,createdAt:Date.now(),provenance:parseProvenance(input.provenance),frames,clips:defaultClips(frames),
    clipRevision:0,undo:Object.freeze([]),media:null});
  return changed(project,[...project.takes,take],{activeTakeId:take.id});
}
export function appendTakeFrames(project:ProjectDocument,id:string,frames:readonly MotionFrame[]): ProjectDocument {
  return updateTake(project,id,take=>{
    if (take.status!=='recording') throw new ProjectDataError('Only a recording take can receive frames.');
    if (!frames.length) return take;
    if (take.frames.length+frames.length>MAX_TAKE_FRAMES) throw new ProjectDataError('Take frames exceed the 21601-frame limit.');
    return {...take,frames:Object.freeze([...take.frames,...parseFrames(frames,take.frames.at(-1)?.t ?? -1)])};
  });
}
export function finishTake(project:ProjectDocument,id:string):ProjectDocument {
  return updateTake(project,id,take=>{
    if(take.status!=='recording') throw new ProjectDataError('Only a recording take can be finished.');
    if(!take.frames.length) throw new ProjectDataError('Cannot finish an empty take.');
    return {...take,status:'complete',...finalizedEdits(take)};
  });
}
export function recoverProject(project:ProjectDocument):ProjectDocument {
  if(!project.takes.some(t=>t.status==='recording')) return project;
  return changed(project,project.takes.map(t=>t.status!=='recording'?t:Object.freeze({...t,status:'interrupted' as const,...finalizedEdits(t)})));
}
export function selectTake(project:ProjectDocument,id:string|null):ProjectDocument {
  if(id!==null) takeById(project,id);
  return id===project.activeTakeId?project:changed(project,project.takes,{activeTakeId:id});
}
export function renameProject(project:ProjectDocument,name:string):ProjectDocument {
  const valid=text(name,120,'Project name');
  return valid===project.name?project:changed(project,project.takes,{name:valid});
}
export function renameTake(project:ProjectDocument,id:string,name:string):ProjectDocument {
  const valid=text(name,120,'Take name');
  return updateTake(project,id,t=>valid===t.name?t:{...t,name:valid});
}
export function removeTake(project:ProjectDocument,id:string):ProjectDocument {
  takeById(project,id);
  const takes=project.takes.filter(t=>t.id!==id);
  return changed(project,takes,{activeTakeId:project.activeTakeId===id?(takes.at(-1)?.id??null):project.activeTakeId});
}
export function replaceClips(project:ProjectDocument,id:string,clips:readonly ProjectClip[]):ProjectDocument {
  return updateTake(project,id,take=>{
    const next=parseClips(clips,take.frames.at(-1)?.t ?? 0);
    if(JSON.stringify(next)===JSON.stringify(take.clips)) return take;
    return {...take,clips:next,clipRevision:integer(take.clipRevision+1,'Clip revision'),
      undo:Object.freeze([...take.undo,take.clips].slice(-MAX_UNDO))};
  });
}
export type ClipPatch=Partial<Omit<ProjectClip,'id'>>;
export function editClip(project:ProjectDocument,id:string,clipId:string,patch:ClipPatch):ProjectDocument {
  fields(patch,['name','start','end','loop','description'],'Clip edit');
  const take=takeById(project,id);
  if(!take.clips.some(c=>c.id===clipId)) throw new ProjectDataError('Clip does not exist.');
  return replaceClips(project,id,take.clips.map(c=>c.id===clipId?{...c,...patch}:c));
}
export function removeClip(project:ProjectDocument,id:string,clipId:string):ProjectDocument {
  const take=takeById(project,id);
  if(!take.clips.some(c=>c.id===clipId)) throw new ProjectDataError('Clip does not exist.');
  return replaceClips(project,id,take.clips.filter(c=>c.id!==clipId));
}
export function undoClips(project:ProjectDocument,id:string):ProjectDocument {
  return updateTake(project,id,take=>!take.undo.length?take:{...take,clips:take.undo.at(-1)!,
    undo:Object.freeze(take.undo.slice(0,-1)),clipRevision:integer(take.clipRevision+1,'Clip revision')});
}
export function setTakeMedia(project:ProjectDocument,id:string,media:MediaDescriptor|null):ProjectDocument {
  const descriptor=parseMedia(media);
  return updateTake(project,id,take=>JSON.stringify(take.media)===JSON.stringify(descriptor)?take:{...take,media:descriptor});
}
