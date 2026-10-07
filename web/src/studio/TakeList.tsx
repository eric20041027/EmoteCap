import { useEffect, useState } from 'react';
import { removeTake, renameTake, selectTake } from '../project/model';
import { MAX_TAKES } from '../project/types';
import { NameField } from './NameField';
import type { StudioSession, StudioSnapshot } from './session';
interface Props {session:StudioSession;state:StudioSnapshot;locked:boolean;onNewTake:()=>void}
export function TakeList({session,state,locked,onNewTake}:Props) {
  const selected=state.project.takes.find(t=>t.id===state.project.activeTakeId);
  const [source,setSource]=useState<'loading'|'available'|'none'|'error'>('none');
  useEffect(()=>{
    if(!selected) {setSource('none');return;}
    let current=true;setSource('loading');
    void session.readSource(selected.id).then(value=>{if(current) setSource(value?'available':'none');},error=>{
      if(current) {setSource('error');session.reportError(error);}
    });
    return ()=>{current=false;};
  },[session,state.project.id,selected?.id,state.mediaRevision]);
  const apply=(action:()=>void|Promise<void>)=>{void Promise.resolve().then(action).catch(error=>session.reportError(error));};
  return <section className="dock studio-takes" aria-label="Takes">
    <div className="studio-heading"><h2 className="dock__title">Takes <span className="studio-help">{state.project.takes.length}/{MAX_TAKES}</span></h2>
      <button type="button" className="btn btn--secondary" disabled={locked||state.busy||state.project.takes.length>=MAX_TAKES} onClick={onNewTake}>New take</button>
    </div>
    <fieldset disabled={locked||state.busy}>
      {state.project.takes.length>0?<ul className="studio-take-list">{state.project.takes.map(take=><li key={take.id}>
        <button type="button" aria-pressed={take.id===selected?.id} onClick={()=>apply(()=>session.update(p=>selectTake(p,take.id)))}>
          <span>{take.name}</span><small>{take.status==='interrupted'?'Interrupted recording':take.status==='recording'?'Recording':`${take.frames.length} frames`}</small>
        </button>
      </li>)}</ul>:<p className="studio-help">Start with the sample, record a camera take or import a video.</p>}
      {selected && <div className="studio-actions studio-take-details">
        <NameField key={selected.id} label="Take name" name={selected.name} onChange={name=>session.update(p=>renameTake(p,selected.id,name))} />
        <label className="studio-check"><input type="checkbox" aria-label="Keep source video" checked={!!selected.media}
          disabled={!selected.media && source!=='available'} onChange={event=>{const keep=event.currentTarget.checked;apply(()=>session.keepSource(selected.id,keep));}} />Keep source video for reloads</label>
        <button type="button" className="btn btn--ghost" onClick={()=>{
          if(window.confirm('Delete this take, its clips and kept source video?')) apply(()=>session.update(p=>removeTake(p,selected.id)));
        }}>Delete take</button>
      </div>}
    </fieldset>
    {selected && <p className="studio-help">{selected.media?'Source video is kept in browser storage after Saved.':source==='available'
      ?'Source video is in memory. Keep it for reloads or include it in a backup before leaving this project.'
      :source==='loading'?'Checking source video…':'Motion is available without source video.'}</p>}
  </section>;
}
