import {useEffect,useMemo,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ProcessingConsent} from '../privacy/processingConsent';
import {ProcessingConsentPanel} from '../privacy/ProcessingConsentPanel';
import {collectVideoMeasurements,MAX_SOURCE_BYTES,validCollectionMetadata,
  type MeasurementEnvironment,type VideoCollection} from './videoMeasurements';
import type {SmoothingLevel} from '../motion/index';

function browserDescription(){
  const match=navigator.userAgent.match(/(Edg|Chrome|Firefox)\/([\d.]+)/);
  return match?`${match[1]==='Edg'?'Edge':match[1]} ${match[2]}`:'';
}
function VideoMeasurementsPage(){
  const consent=useMemo(()=>new ProcessingConsent(),[]),video=useRef<HTMLVideoElement>(null);
  const active=useRef<AbortController|null>(null),mounted=useRef(true);
  const [allowed,setAllowed]=useState(false),[local,setLocal]=useState(false),[busy,setBusy]=useState(false);
  const [file,setFile]=useState<File|null>(null),[commit,setCommit]=useState(import.meta.env.VITE_EMOTECAP_SOURCE_COMMIT??'');
  const [environment,setEnvironment]=useState<MeasurementEnvironment>({kind:'desktop',os:'',cpu:'',gpu:'',browser:browserDescription()});
  const [classification,setClassification]=useState<'synthetic'|'observed'>('synthetic');
  const [skeleton,setSkeleton]=useState<'full'|'body'>('full'),[smoothing,setSmoothing]=useState<SmoothingLevel>('medium');
  const [warmup,setWarmup]=useState(0),[result,setResult]=useState<VideoCollection|null>(null);
  const [status,setStatus]=useState('Choose a source and enter the declared run metadata.');
  const [links,setLinks]=useState<{raw:string;packet:string|null}|null>(null);
  useEffect(()=>()=>{mounted.current=false;active.current?.abort();consent.setAllowed(false);},[consent]);
  useEffect(()=>{
    if(!result){setLinks(null);return;}
    const raw=URL.createObjectURL(new Blob([JSON.stringify(result)],{type:'application/json'}));
    const packet=result.packet?URL.createObjectURL(new Blob([JSON.stringify(result.packet)],{type:'application/json'})):null;
    setLinks({raw,packet});return()=>{URL.revokeObjectURL(raw);if(packet)URL.revokeObjectURL(packet);};
  },[result]);
  const metadata={sourceCommit:commit,environment,classification,skeleton,smoothing,warmupMs:warmup};
  const ready=!!file&&file.size>0&&file.size<=MAX_SOURCE_BYTES&&allowed&&local&&validCollectionMetadata(metadata);
  const choose=(value:boolean)=>{
    consent.setAllowed(value);setAllowed(value);
    if(!value&&active.current){active.current.abort();setStatus('Cancelling collection; waiting for owned setup to settle.');}
  };
  const run=async()=>{
    if(active.current||!ready||!file||!video.current)return;
    const controller=new AbortController();active.current=controller;setBusy(true);setStatus('Collecting Accurate video import measurements…');
    try {
      const collected=await collectVideoMeasurements({...metadata,file,video:video.current,
        localProcessingAuthorized:local,processingConsent:consent,signal:controller.signal});
      if(mounted.current){setResult(collected);setStatus(`${collected.outcome}: ${collected.reason??'source-linked raw collection ready'}`);}
    } catch {
      if(mounted.current)setStatus('Collection could not start. Check metadata, source, permission and owned setup. The previous result remains available.');
    } finally {if(active.current===controller)active.current=null;if(mounted.current)setBusy(false);}
  };
  const cancel=()=>{active.current?.abort();setStatus('Cancelling collection; waiting for owned setup to settle.');};
  const changeEnvironment=(key:'os'|'cpu'|'gpu'|'browser',value:string)=>setEnvironment(previous=>({...previous,[key]:value}));
  return <main>
    <h1>Video import measurements</h1>
    <p>This private developer tool collects Accurate import attempts and final calibrated motion. Downloads contain motion, timings, source digest and your declared metadata.</p>
    <p>Preview timing covers detection through the preview solver. Throughput uses the whole file import; camera/Studio/laptop acceptance requires its own measurements. Retain the raw collection with its preview packet.</p>
    <fieldset disabled={busy} className="metadata"><legend>Source and declared conditions</legend>
      <label>Source video<input aria-label="Source video" type="file" accept="video/*,.mp4,.m4v,.mov,.webm,.mkv" onChange={event=>setFile(event.target.files?.[0]??null)} /></label>
      <label>Source commit<input aria-label="Source commit" value={commit} maxLength={40} onChange={event=>setCommit(event.target.value)} /></label>
      <label>Device kind<select value={environment.kind} onChange={event=>setEnvironment(previous=>({...previous,kind:event.target.value as 'desktop'|'laptop'}))}>
        <option value="desktop">Desktop</option><option value="laptop">Laptop</option></select></label>
      {(['os','cpu','gpu','browser'] as const).map(key=><label key={key}>{key==='os'?'Operating system':key==='browser'?'Browser':key.toUpperCase()}
        <input aria-label={key==='os'?'Operating system':key==='browser'?'Browser':key.toUpperCase()} maxLength={160} value={environment[key]}
          onChange={event=>changeEnvironment(key,event.target.value)} /></label>)}
      <label>Classification<select aria-label="Classification" value={classification} onChange={event=>setClassification(event.target.value as 'synthetic'|'observed')}>
        <option value="synthetic">Synthetic control</option><option value="observed">Observed execution</option></select></label>
      <label>Skeleton<select value={skeleton} onChange={event=>setSkeleton(event.target.value as 'full'|'body')}>
        <option value="full">Body and fingers</option><option value="body">Body only</option></select></label>
      <label>Smoothing<select value={smoothing} onChange={event=>setSmoothing(event.target.value as SmoothingLevel)}>
        <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
      <label>Warmup milliseconds<input type="number" min={0} max={179999} value={warmup} onChange={event=>setWarmup(Number(event.target.value))} /></label>
      <label className="choice"><input type="checkbox" checked={local} onChange={event=>setLocal(event.target.checked)} />I have permission to process this video locally</label>
    </fieldset>
    <p>Enter a full lowercase commit ID and bounded device/browser descriptions. Source is limited to100MiB/180seconds. Source commit, classification, rights and hardware are declarations requiring independent qualification.</p>
    <ProcessingConsentPanel allowed={allowed} onChange={choose} />
    <div className="actions"><button type="button" disabled={!ready||busy} onClick={()=>void run()}>Run collection</button>
      {busy&&<button type="button" onClick={cancel}>Cancel collection</button>}</div>
    <p role="status" aria-label="Collection status" aria-live="polite">{status}</p>
    <video ref={video} aria-label="Video preview" muted playsInline controls={!busy} />
    {result&&<section aria-label="Collected result"><h2>Collected result</h2>
      <p>Run {result.runId}; {result.attempts.length} preview attempts; {result.finalFrames.length} final frames. Qualification is pending.</p>
      <p>Raw data preserves failures and hand state. A preview packet is unavailable for incomplete data, invalid clocks, changed hand policy, unknown/mixed active model delegates or an exhausted warmup.</p>
      {links&&<div className="actions"><a href={links.raw} download={`emotecap-raw-${result.runId}.json`}>Download raw collection</a>
        {links.packet&&<a href={links.packet} download={`emotecap-preview-${result.runId}.json`}>Download preview packet</a>}</div>}
    </section>}
  </main>;
}

createRoot(document.getElementById('root')!).render(<VideoMeasurementsPage />);
