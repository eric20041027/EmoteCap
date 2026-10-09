import { useEffect, useRef, useState } from 'react';
import type { ServerHealth } from '../ui/useServerHealth';
import { checkModels, type ModelAvailability } from './diagnostics';
const LABELS:Record<string,string>={'pose_landmarker_full.task':'Fast body model','pose_landmarker_heavy.task':'Accurate body model','hand_landmarker.task':'Hand model'};
export function SetupDiagnostics({server}: {server:ServerHealth}) {
  const [models,setModels]=useState<readonly ModelAvailability[]|null>(null),[message,setMessage]=useState('Models have not been checked.');
  const controller=useRef<AbortController|null>(null),[checking,setChecking]=useState(false);
  useEffect(()=>()=>controller.current?.abort(),[]);
  const check=async()=>{
    if(controller.current) return;const active=new AbortController();controller.current=active;setChecking(true);setMessage('Checking local model files…');
    try {const result=await checkModels(fetch,active.signal);setModels(result);setMessage(result.every(m=>m.available)?'All tracking models available.':'Some tracking models are unavailable.');}
    catch {setMessage(active.signal.aborted?'Model check cancelled.':'Model check timed out or could not finish.');}
    finally {controller.current=null;setChecking(false);}
  };
  return <details className="dock studio-diagnostics"><summary>Setup diagnostics</summary>
    <p>{server==='online'?'Local export service and Blender are ready.':server==='no-blender'?'Local export service is running; Blender is missing.':server==='checking'?'Checking the local export service…':'Local export service is unavailable.'}</p>
    <p className="studio-help">The sample, project saving and backups work without the export service. Camera tracking needs the local models.</p>
    <p role="status" aria-live="polite">{message}</p>
    {models && <ul>{models.map(m=><li key={m.file}>{LABELS[m.file]}: {m.message}</li>)}</ul>}
    <div className="studio-actions"><button type="button" className="btn btn--secondary" disabled={checking} onClick={()=>void check()}>Check tracking models</button>
      {checking && <button type="button" className="btn btn--secondary" onClick={()=>controller.current?.abort()}>Cancel model check</button>}</div>
  </details>;
}
