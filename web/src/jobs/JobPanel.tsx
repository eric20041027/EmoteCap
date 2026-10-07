import type { ExportJobs,JobsSnapshot } from './controller';
import './jobs.css';
interface Props {controller:ExportJobs;state:JobsSnapshot}
export function JobPanel({controller,state}:Props){
  const action=(run:()=>Promise<unknown>)=>{void run().catch(()=>{});};
  return <section className="export-jobs" aria-label="Export jobs">
    <div className="studio-heading"><h2>Export jobs</h2><button type="button" className="btn btn--secondary" disabled={state.loading} onClick={()=>action(()=>controller.refresh())}>Refresh jobs</button></div>
    <p className="studio-help">Exports keep the submitted clip revision. You can keep editing while Blender works.</p>
    {state.error && <p className="studio-error" role="alert">{state.error}</p>}
    {!state.jobs.length && <p className="studio-help">{state.loading?'Checking saved exports…':'No export jobs yet.'}</p>}
    <ol className="export-jobs-list">{state.jobs.map(job=>{
      const active=job.state==='queued'||job.state==='running',retry=['failed','cancelled','interrupted'].includes(job.state);
      return <li key={job.id} className="export-job" aria-label={`Export ${job.id}`}>
        <div className="studio-heading"><p className="export-job-state" role="status">{job.phase}</p><span className="studio-help">{job.snapshot?`Clip revision ${job.snapshot.clipRevision}`:'Captured export input'} · {job.id.slice(0,8)}</span></div>
        {active && <progress aria-label="Export progress" max={100} value={job.progress} />}
        {job.error && <div className="studio-error"><p>{job.error.message}</p>{job.error.details && <details><summary>Export details</summary><pre>{job.error.details}</pre></details>}</div>}
        {job.warning && <p className="studio-warning">{job.warning}</p>}
        <div className="studio-actions">
          {active && <button type="button" className="btn btn--secondary" disabled={state.busy||job.cancelRequested} onClick={()=>action(()=>controller.cancel(job.id))}>{job.cancelRequested?'Cancelling…':'Cancel export'}</button>}
          {retry && <button type="button" className="btn btn--secondary" disabled={state.busy} onClick={()=>action(()=>controller.retry(job.id))}>Retry saved export</button>}
          {!active && <button type="button" className="btn btn--ghost" disabled={state.busy} onClick={()=>{if(window.confirm('Delete this export job and its local downloads? Copies already added to Unity remain.'))action(()=>controller.delete(job.id));}}>Delete export job</button>}
        </div>
        {!!job.files.length && <ul className="export-job-files">{job.files.map(file=><li key={file.url}><span>{file.name}</span><a href={file.url} download className="btn btn--link">Download FBX</a><a href={file.sidecar} download className="btn btn--link">Download sidecar</a></li>)}</ul>}
      </li>;
    })}</ol>
  </section>;
}
