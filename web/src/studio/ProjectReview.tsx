import { useEffect, type RefObject } from 'react';
import { tposeFrame, type MotionFrame } from '../motion/index';
import { editClip, removeClip, replaceClips, undoClips, type ClipPatch } from '../project/model';
import { MAX_CLIPS, type ProjectTake } from '../project/types';
import type { Exporter } from '../record/useExporter';
import { usePlayback } from '../record/usePlayback';
import { TimeField } from '../take/TimeField';
import type { ServerHealth } from '../ui/useServerHealth';
import { clampClipTime, clipNameIssues, localClips, projectClips } from './clips';
import type { StudioSession } from './session';
interface Props {take:ProjectTake;session:StudioSession;frameRef:RefObject<MotionFrame|null>;server:ServerHealth;exporter:Exporter;locked:boolean}
export function ProjectReview({take,session,frameRef,server,exporter,locked}:Props) {
  const playback=usePlayback(take.frames,frameRef),duration=take.frames.at(-1)?.t??0,issues=clipNameIssues(take.clips);
  const {seek}=playback;
  useEffect(()=>{if(take.frames.length) seek(take.frames[0].t);else frameRef.current=tposeFrame();},[seek,take.frames,frameRef]);
  const apply=(action:()=>void)=>{try {action();} catch(error) {session.reportError(error);}};
  const patch=(id:string,change:ClipPatch)=>apply(()=>session.update(p=>editClip(p,take.id,id,change)));
  const addClip=()=>apply(()=>{
    const used=new Set(take.clips.map(c=>c.name.toLowerCase()));let n=1;while(used.has(`clip_${String(n).padStart(2,'0')}`)) n++;
    session.update(p=>replaceClips(p,take.id,[...take.clips,{id:crypto.randomUUID(),name:`Clip_${String(n).padStart(2,'0')}`,start:0,end:duration,loop:false,description:''}]));
  });
  return <section className="dock studio-review" aria-label="Review take">
    <div className="studio-heading"><div><h2 className="dock__title">Review take</h2>
      <p className="studio-help">{duration.toFixed(2)} seconds · {take.frames.length} original frames</p></div>
      <button type="button" className="btn btn--secondary" onClick={playback.stop}>Stop playback</button>
    </div>
    {take.status==='interrupted' && <p className="studio-warning" role="status">Interrupted recording: this is the last saved prefix. Frames after that checkpoint were not recovered.</p>}
    <p className="studio-help">{take.provenance.calibration.note}</p>
    {take.frames.length===0 && <p className="studio-help">This checkpoint has no captured frames. Keep the project or start a new take.</p>}
    <fieldset disabled={locked}>
      <div className="studio-actions">
        <button type="button" className="btn btn--secondary" disabled={duration<0.1||take.clips.length>=MAX_CLIPS} onClick={addClip}>Add clip</button>
        <button type="button" className="btn btn--secondary" disabled={duration<0.1} onClick={()=>apply(()=>session.update(p=>replaceClips(p,take.id,localClips(take))))}>Find pauses</button>
        <button type="button" className="btn btn--secondary" disabled={!take.undo.length} onClick={()=>apply(()=>session.update(p=>undoClips(p,take.id)))}>Undo clip edit</button>
      </div>
      <ol className="studio-clips">{take.clips.map((clip,index)=><li key={clip.id} className="studio-clip">
        <div className="studio-clip-fields">
          <label className="studio-field">Clip {index+1} name<input aria-label={`Clip ${index+1} name`} maxLength={24} value={clip.name}
            aria-invalid={issues.has(clip.id)} aria-describedby={issues.has(clip.id)?`clip-error-${clip.id}`:undefined} onChange={event=>patch(clip.id,{name:event.target.value})} /></label>
          <label className="studio-field">Start (seconds)<TimeField label={`Clip ${index+1} start (seconds)`} value={clip.start} min={0} max={clip.end-0.1}
            onChange={value=>patch(clip.id,{start:clampClipTime(clip,'start',value,duration)})} /></label>
          <label className="studio-field">End (seconds)<TimeField label={`Clip ${index+1} end (seconds)`} value={clip.end} min={clip.start+0.1} max={duration}
            onChange={value=>patch(clip.id,{end:clampClipTime(clip,'end',value,duration)})} /></label>
          <label className="studio-check"><input type="checkbox" aria-label={`Clip ${index+1} loop`} checked={clip.loop} onChange={event=>patch(clip.id,{loop:event.target.checked})} />Loop</label>
          <button type="button" className="btn btn--secondary" aria-label={`Play clip ${index+1}`} onClick={()=>playback.play(clip.start,clip.end,clip.loop)}>Play</button>
          <button type="button" className="btn btn--ghost" aria-label={`Delete clip ${index+1}`} onClick={()=>apply(()=>session.update(p=>removeClip(p,take.id,clip.id)))}>Delete</button>
        </div>
        <label className="studio-field">Description<input aria-label={`Clip ${index+1} description`} value={clip.description} maxLength={512} onChange={event=>patch(clip.id,{description:event.target.value})} /></label>
        {issues.has(clip.id) && <p id={`clip-error-${clip.id}`} className="studio-error">{issues.get(clip.id)} Export is unavailable until names are valid.</p>}
      </li>)}</ol>
      <button type="button" className="btn btn--primary" disabled={exporter.busy||server!=='online'||issues.size>0||!take.clips.length||!take.frames.length}
        onClick={()=>{const frozen=take,projectId=session.getSnapshot().project.id;void exporter.exportClips(()=>projectClips(frozen),{projectId,takeId:frozen.id,clipRevision:frozen.clipRevision});}}>Export FBX</button>
    </fieldset>
    {server!=='online' && <p className="studio-help">{server==='no-blender'?'Blender is missing from the local export service.':server==='checking'?'Checking the local export service…':'Start the local export service to export FBX.'} You can still review, save and download this project.</p>}
    {exporter.busy && <p role="status">Saving export input…</p>}
    {exporter.error && <div className="studio-error" role="alert"><p>{exporter.error.message}</p>{exporter.error.details && <details><summary>Export details</summary><pre>{exporter.error.details}</pre></details>}</div>}
  </section>;
}
