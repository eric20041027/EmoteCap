import {useEffect,useMemo,useRef,useState,useSyncExternalStore} from 'react';
import {createRoot} from 'react-dom/client';
import App from '../App';
import {CameraMeasurements,validCameraMetadata,type CameraMetadata} from './cameraMeasurements';
import appSource from '../App.tsx?raw';
import poseSource from '../capture/usePose.ts?raw';
import previewSource from '../preview/PreviewCanvas.tsx?raw';
import probeSource from './cameraMeasurements.ts?raw';

function CameraMeasurementsPage(){
  const probe=useMemo(()=>new CameraMeasurements(),[]),snapshot=useSyncExternalStore(probe.subscribe,probe.getSnapshot);
  const responseRAF=useRef<number|null>(null),[responsePending,setResponsePending]=useState(false);
  const [sourceDigests,setSourceDigests]=useState<Record<string,string>>({}),[status,setStatus]=useState('Enter declared conditions; start the camera separately below.');
  const [sourceCommit,setSourceCommit]=useState(import.meta.env.VITE_EMOTECAP_SOURCE_COMMIT??'');
  const [classification,setClassification]=useState<'synthetic'|'observed'>('synthetic'),[warmupMs,setWarmupMs]=useState(0),[permission,setPermission]=useState(false);
  const [environment,setEnvironment]=useState<CameraMetadata['environment']>({kind:'desktop',model:'',os:'',cpu:'',gpu:'',browser:''});
  const [url,setURL]=useState<string|null>(null);
  useEffect(()=>{
    let mounted=true;
    void Promise.all(Object.entries({App:appSource,usePose:poseSource,PreviewCanvas:previewSource,cameraMeasurements:probeSource}).map(async([name,source])=>{
      const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(source));
      return [name,Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,'0')).join('')] as const;
    })).then(values=>{if(mounted)setSourceDigests(Object.fromEntries(values));}).catch(()=>{if(mounted)setStatus('Source digests unavailable; collection cannot start.');});
    return()=>{mounted=false;probe.interrupt('tool-unmounted');};
  },[probe]);
  useEffect(()=>{
    if(!snapshot.busy)return;
    const timeout=window.setTimeout(()=>probe.interrupt('wall-timeout'),180000);
    const hidden=()=>{if(document.hidden)probe.interrupt('page-hidden');};
    document.addEventListener('visibilitychange',hidden);hidden();
    return()=>{clearTimeout(timeout);document.removeEventListener('visibilitychange',hidden);
      if(responseRAF.current!==null){cancelAnimationFrame(responseRAF.current);responseRAF.current=null;}setResponsePending(false);};
  },[probe,snapshot.busy]);
  useEffect(()=>{
    if(!snapshot.result)return;
    const serialized=JSON.stringify(snapshot.result);
    if(new TextEncoder().encode(serialized).byteLength>32*1024*1024){setStatus('Receipt exceeds the diagnostic bound.');return;}
    const next=URL.createObjectURL(new Blob([serialized],{type:'application/json'}));setURL(next);
    return()=>URL.revokeObjectURL(next);
  },[snapshot.result]);
  const metadata:CameraMetadata={sourceCommit,classification,environment,warmupMs,localProcessingAuthorized:permission,sourceDigests};
  const start=()=>{if(document.hidden)return;try {probe.start(metadata);setStatus('Measuring actual Studio camera and preview.');}
    catch {setStatus('Collection could not start; check camera, preview, permissions and declared conditions. Previous receipt is retained.');}};
  const response=()=>{
    if(!probe.active||responseRAF.current!==null)return;const startedMs=performance.now();setResponsePending(true);
    responseRAF.current=requestAnimationFrame(()=>{responseRAF.current=null;probe.interaction(startedMs,performance.now());setResponsePending(false);setStatus('Response observed at the next animation frame.');});
  };
  const summary=snapshot.result?.summary;
  return <>
    <section className="camera-measurement-panel" aria-label="Camera measurement controls">
      <h1>Studio camera measurements</h1>
      <p>This private tool observes the Studio below. Camera and SDK choices remain separate; measurement never starts them.</p>
      <p>Effective FPS counts distinct presented video inputs after their first successful 3D render call. Repeated processing of one input stays in the raw data and output FPS, with no increase to effective FPS. Latency runs from detection start to render-call return; it excludes sensor exposure, GPU completion and physical screen presentation.</p>
      <fieldset disabled={snapshot.busy} className="camera-measurement-metadata"><legend>Declared source and device conditions</legend>
        <label>Source commit<input aria-label="Source commit" maxLength={40} value={sourceCommit} onChange={event=>setSourceCommit(event.target.value)} /></label>
        <label>Device kind<select value={environment.kind} onChange={event=>setEnvironment(previous=>({...previous,kind:event.target.value as 'desktop'|'laptop'}))}>
          <option value="desktop">Desktop</option><option value="laptop">Laptop</option></select></label>
        {(['model','os','cpu','gpu','browser'] as const).map(key=>{const label={model:'Device model',os:'Operating system',cpu:'CPU',gpu:'GPU',browser:'Browser'}[key];return <label key={key}>{label}
          <input aria-label={label} value={environment[key]} maxLength={160} onChange={event=>setEnvironment(previous=>({...previous,[key]:event.target.value}))} /></label>;})}
        <label>Classification<select value={classification} onChange={event=>setClassification(event.target.value as 'synthetic'|'observed')}>
          <option value="synthetic">Synthetic control</option><option value="observed">Observed execution</option></select></label>
        <label>Warmup milliseconds<input type="number" min={0} max={179999} value={warmupMs} onChange={event=>setWarmupMs(Number(event.target.value))} /></label>
        <label className="camera-measurement-choice"><input type="checkbox" checked={permission} onChange={event=>setPermission(event.target.checked)} />I have permission to process this camera session locally</label>
      </fieldset>
      <div className="camera-measurement-actions">
        <button type="button" disabled={snapshot.busy||!snapshot.ready||!validCameraMetadata(metadata)} onClick={start}>Start measurement</button>
        {snapshot.busy&&<><button type="button" onClick={()=>probe.stop()}>Stop measurement</button>
          <button type="button" disabled={responsePending} onClick={response}>Measure next-frame response</button></>}
        {url&&snapshot.result&&<a href={url} download={`emotecap-camera-${snapshot.result.runId}.json`}>Download camera receipt</a>}
      </div>
      <p role="status" aria-label="Measurement status" aria-live="polite">{snapshot.busy?status:snapshot.result?`${snapshot.result.outcome}: ${snapshot.result.reason??'receipt ready'}`:status}</p>
      {summary&&<p>Effective rendered FPS: {summary.effectiveRenderedFps===null?'unavailable':summary.effectiveRenderedFps.toFixed(2)}; p95 detection-to-render-call: {summary.p95DetectionToRenderCallMs===null?'unavailable':`${summary.p95DetectionToRenderCallMs.toFixed(2)}ms`};
        failed attempts: {summary.failureRate===null?'unavailable':`${(summary.failureRate*100).toFixed(2)}%`}. Qualification remains pending.</p>}
      <p>Keep the raw receipt. Source commit, classification, rights and hardware are declarations; exact source digests identify instrumentation. Fast720p laptop eligibility is a pending label, with no automatic threshold or supported-device claim.</p>
      <p>Change capture conditions or hide the tab to end an incomplete receipt. Maximum180seconds/21601attempts/32MiB; optional response observations cap at32. Stop/start diagnostics can leave the camera running; use Stop camera or withdraw SDK permission when finished.</p>
    </section>
    <App cameraDiagnostics={probe} />
  </>;
}
createRoot(document.getElementById('root')!).render(<CameraMeasurementsPage />);
