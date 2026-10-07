import {useState} from 'react';
import type {LiveLinkSnapshot} from './liveLink';
import './LiveLinkToggle.css';
export function LiveLinkPanel({state,onRetryCleanup}:{state:LiveLinkSnapshot;onRetryCleanup:()=>void}){
  const [copyMessage,setCopyMessage]=useState<string|null>(null);
  const copy=async()=>{if(!state.pairingCode)return;try{await navigator.clipboard.writeText(state.pairingCode);setCopyMessage('Pairing code copied.');}
    catch{setCopyMessage('Select the pairing code and copy it with your keyboard.');}};
  return <section className="studio-panel live-link-panel" aria-label="Unity Live Link">
    <h2>Unity Live Link</h2>
    <p className="studio-help">Enable Live Link above, then paste the pairing code into EmoteCapLiveLink on a Humanoid character in Unity and enter Play mode. Use both apps on this computer.</p>
    <p role="status" aria-live="polite">{state.status==='live'?'Local service accepted this stream.':state.status==='connecting'?'Waiting for the local service handshake.':state.status==='error'?'Pairing needs attention.':'Live Link is off.'}</p>
    {state.pairingCode&&<>
      <label className="live-link-code">Unity pairing code<input readOnly value={state.pairingCode} onFocus={event=>event.currentTarget.select()} /></label>
      <p className="studio-help">Expires {new Date(state.expiresAt!).toLocaleString()}. Treat this code as private; stopping Live Link requests its revocation.</p>
      <button type="button" className="btn btn--secondary" onClick={()=>void copy()}>Copy pairing code</button>
    </>}
    {copyMessage&&state.pairingCode&&<p className="studio-help" role="status">{copyMessage}</p>}
    {state.error&&<p className="studio-warning" role="alert">{state.error}</p>}
    {state.cleanupWarning&&<p className="studio-warning" role="alert">{state.cleanupWarning}</p>}
    {state.failedPairings.map(pair=><div key={pair.id} className="live-link-unrevoked">
      <label className="live-link-code">Unrevoked pairing code<input readOnly value={pair.code} onFocus={event=>event.currentTarget.select()} /></label>
      <p className="studio-help">Expires {new Date(pair.expiresAt).toLocaleString()}.</p>
    </div>)}
    {state.failedPairings.length>0&&<button type="button" className="btn btn--secondary" onClick={onRetryCleanup}>Retry pairing cleanup</button>}
  </section>;
}
