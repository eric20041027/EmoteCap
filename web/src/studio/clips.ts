import { CLIP_NAME_PATTERN, fallbackSegments, makeClip, type Clip } from '../motion/index';
import { MAX_CLIPS, type ProjectClip, type ProjectTake } from '../project/types';
import { ProjectDataError } from '../project/validation';
export function clipNameIssues(clips:readonly ProjectClip[]):ReadonlyMap<string,string> {
  const issues=new Map<string,string>(),names=new Map<string,ProjectClip[]>();
  for(const clip of clips) {
    if(!CLIP_NAME_PATTERN.test(clip.name)) issues.set(clip.id,'Clip name needs 1–24 letters, digits or underscores.');
    const key=clip.name.toLowerCase();names.set(key,[...(names.get(key)??[]),clip]);
  }
  for(const group of names.values()) if(group.length>1) for(const clip of group) issues.set(clip.id,'Clip names must be unique, ignoring case.');
  return issues;
}
export function projectClips(take:ProjectTake):Clip[] {
  if(!take.frames.length || !take.clips.length) throw new ProjectDataError('Add a clip with recorded frames before exporting.');
  const issues=clipNameIssues(take.clips);if(issues.size) throw new ProjectDataError(issues.values().next().value!);
  return take.clips.map(clip=>prepareProjectClip(take,clip));
}
function prepareProjectClip(take:ProjectTake,clip:ProjectClip):Clip {
  return {...makeClip(take.frames,clip),skeleton:take.provenance.skeleton};
}
/** The selected preview and batch export use the identical derived-frame preparation. */
export function projectClip(take:ProjectTake,clipId:string):Clip {
  if(!take.frames.length) throw new ProjectDataError('Add recorded frames before previewing a clip.');
  const clip=take.clips.find(candidate=>candidate.id===clipId);
  if(!clip) throw new ProjectDataError('The selected clip no longer exists.');
  const issue=clipNameIssues(take.clips).get(clipId);if(issue) throw new ProjectDataError(issue);
  return prepareProjectClip(take,clip);
}
export function clampClipTime(clip:ProjectClip,field:'start'|'end',seconds:number,duration:number):number {
  if(!Number.isFinite(seconds) || !Number.isFinite(duration)) throw new ProjectDataError('Clip time must be finite.');
  return field==='start'?Math.max(0,Math.min(clip.end-0.1,seconds)):Math.min(duration,Math.max(clip.start+0.1,seconds));
}
export function localClips(take:ProjectTake):ProjectClip[] {
  const duration=take.frames.at(-1)?.t??0;if(duration<0.1) return [];
  const found=fallbackSegments(take.frames);
  const segments=found.length?found:[{name:'Clip_01',start:0,end:duration,loop:false,description:'No pauses found; full take.'}];
  if(segments.length>MAX_CLIPS) throw new ProjectDataError('More than 50 clips were found. Trim this take manually instead.');
  return segments.map(segment=>({...segment,id:crypto.randomUUID()}));
}
