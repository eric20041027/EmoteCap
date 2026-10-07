import { useEffect, useRef, useState } from 'react';
import { renameProject } from '../project/model';
import { NameField } from './NameField';
import { downloadProject, importProject } from './archiveActions';
import type { StudioSession, StudioSnapshot } from './session';
interface Props {
  session:StudioSession;state:StudioSnapshot;locked:boolean;onBusyChange:(busy:boolean)=>void;
  onSample:(signal:AbortSignal,discardSources:boolean)=>Promise<void>;
}
export function ProjectBar({session,state,locked,onSample,onBusyChange}:Props) {
  const [includeMedia,setIncludeMedia]=useState(false),[operation,setOperation]=useState<string|null>(null);
  const controller=useRef<AbortController|null>(null),fileRef=useRef<HTMLInputElement>(null);
  useEffect(()=>{setIncludeMedia(false);},[state.project.id]);
  useEffect(()=>()=>controller.current?.abort(),[]);
  const run=(action:()=>void|Promise<void>)=>{void Promise.resolve().then(action).catch(error=>session.reportError(error));};
  const decideDiscard=()=>!session.hasVolatileSources() || window.confirm('Source video has not been kept. Leaving this project drops it from memory. Keep it or download a backup with source video first. Discard the source video and continue?');
  const transfer=async(label:string,action:(signal:AbortSignal)=>Promise<void>)=>{
    if(controller.current) return;
    const active=new AbortController();controller.current=active;setOperation(label);onBusyChange(true);
    try {await action(active.signal);} catch(error) {session.reportError(error);}
    finally {controller.current=null;setOperation(null);onBusyChange(false);}
  };
  const busy=locked||state.busy||operation!==null;
  const savedLabel=state.storage==='loading'?'Opening browser storage…':state.save.phase==='saved'?'Saved'
    :state.save.phase==='saving'?'Saving…':state.save.phase==='dirty'?'Unsaved changes':'Not saved';
  const summaries=[...state.summaries];
  if(!summaries.some(s=>s.id===state.project.id)) summaries.unshift({id:state.project.id,name:state.project.name,
    revision:state.project.revision,updatedAt:state.project.updatedAt,takeCount:state.project.takes.length});
  return <section className="dock studio-project" aria-label="Project" data-project-id={state.project.id} data-revision={state.project.revision}>
    <div className="studio-heading"><h2 className="dock__title">Your project</h2>
      <span className={`studio-save studio-save--${state.save.phase}`} role="status" aria-label="Project save status" aria-live="polite">{savedLabel}</span>
    </div>
    <fieldset disabled={busy} className="studio-actions">
      <NameField key={state.project.id} label="Project name" name={state.project.name} onChange={name=>session.update(p=>renameProject(p,name))} />
      <label className="studio-field">Open project<select aria-label="Open project" value={state.project.id} onChange={event=>{
        const id=event.target.value;if(decideDiscard()) run(()=>session.open(id,true));
      }}>{summaries.map(s=><option key={s.id} value={s.id}>{s.id===state.project.id?state.project.name:s.name}</option>)}</select></label>
      <button className="btn btn--secondary" type="button" onClick={()=>{if(decideDiscard()) run(()=>session.create(true));}}>New project</button>
      <button className="btn btn--secondary" type="button" onClick={()=>{if(decideDiscard()) void transfer('Opening sample…',signal=>onSample(signal,true));}}>Use sample project</button>
      <button className="btn btn--secondary" type="button" onClick={()=>run(()=>session.flush())}>Save now</button>
      <button className="btn btn--ghost" type="button" onClick={()=>{
        if(window.confirm('Delete this project, all its takes, clips and kept source videos?')) run(()=>session.removeCurrent());
      }}>Delete project</button>
    </fieldset>
    <fieldset disabled={busy} className="studio-actions">
      <label className="studio-check"><input type="checkbox" checked={includeMedia} onChange={event=>setIncludeMedia(event.target.checked)} />Include source video in backup</label>
      <button className="btn btn--secondary" type="button" onClick={()=>void transfer('Preparing backup…',signal=>downloadProject(session,includeMedia,signal))}>Download project</button>
      <button className="btn btn--secondary" type="button" onClick={()=>fileRef.current?.click()}>Import project</button>
      <input ref={fileRef} type="file" className="studio-file" aria-label="Import project file" accept=".emotecap,application/x-emotecap" onChange={event=>{
        const file=event.target.files?.[0];event.target.value='';if(!file) return;
        if(!file.name.toLowerCase().endsWith('.emotecap')) {session.reportError(new Error('Choose an .emotecap project file.'));return;}
        if(decideDiscard()) void transfer('Importing project…',signal=>importProject(session,file,true,signal));
      }} />
      {(state.save.phase==='error'||state.storage==='error') && <>
        <button className="btn btn--secondary" type="button" onClick={()=>run(()=>session.retry())}>Retry save</button>
        <button className="btn btn--ghost" type="button" onClick={()=>{
          if(window.confirm('Discard this tab\'s unsaved changes and source video, then reopen the saved project? Download a backup first.')) run(()=>session.reopenSaved(true));
        }}>Reopen saved copy</button>
      </>}
    </fieldset>
    {operation && <div className="studio-actions" role="status"><span>{operation}</span><button type="button" className="btn btn--secondary" onClick={()=>controller.current?.abort()}>Cancel project operation</button></div>}
    {state.error && <p className="studio-error" role="alert">{state.error}</p>}
    <p className="studio-help">Browser saving is a recovery copy. Download an .emotecap backup to keep a portable project.</p>
  </section>;
}
