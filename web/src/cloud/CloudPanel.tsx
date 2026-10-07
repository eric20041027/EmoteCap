import { useState } from 'react';
import type { CloudSlice,CloudSnapshot } from './controller';
import type { CloudCleanup } from './api';
import { httpJSON } from './transport';
interface Props {controller:CloudSlice;state:CloudSnapshot;locked:boolean}
interface CleanupItem {id:string;kind:'temporary'|'legacy';size:number;active:boolean}
function CleanupStatus({cleanup}:{cleanup:CloudCleanup}){
  return <div className="studio-help" aria-label="Video cleanup results">
    <p>{cleanup.localVideo==='deleted'?'Local temporary video was removed.':'Local temporary video could not be removed.'}</p>
    {cleanup.warning&&<p className="studio-warning">{cleanup.warning}</p>}
    <p>{cleanup.remoteFiles==='deleted'?'Google Files upload was deleted.':cleanup.remoteFiles==='not-used'?'The video was sent inline; no Google Files resource was created.':cleanup.remoteFiles==='unknown'?'Google upload or deletion could not be confirmed.':'Google Files deletion failed.'}</p>
    {cleanup.remoteWarning&&<p className="studio-warning">{cleanup.remoteWarning}</p>}
    <p>Provider processing and data use follow <a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noreferrer">Google terms</a>. File deletion does not remove all processing data.</p>
  </div>;
}
export function CloudPanel({controller,state,locked}:Props){
  const [items,setItems]=useState<CleanupItem[]|null>(null),[cursor,setCursor]=useState<string|null>(null),[cleanupError,setCleanupError]=useState<string|null>(null),[cleanupBusy,setCleanupBusy]=useState(false);
  const act=(action:()=>void|Promise<void>)=>{void Promise.resolve().then(action).catch(error=>controller.reportError(error));};
  const refreshCleanup=async(after?:string)=>{
    setCleanupBusy(true);setCleanupError(null);
    try{const body=await httpJSON(`/api/media-cleanup${after?`?after=${encodeURIComponent(after)}`:''}`,{method:'GET'});
      if(typeof body!=='object'||body===null||!('items'in body)||!Array.isArray(body.items)||body.items.length>100||!('nextCursor'in body)
        ||(body.nextCursor!==null&&typeof body.nextCursor!=='string'))throw new Error('Unexpected cleanup inventory');
      const parsed=body.items.map((item:unknown)=>{
        if(typeof item!=='object'||item===null||!('id'in item)||typeof item.id!=='string'||!('kind'in item)||!['temporary','legacy'].includes(String(item.kind))
          ||!('size'in item)||typeof item.size!=='number'||!Number.isSafeInteger(item.size)||item.size<0||!('active'in item)||typeof item.active!=='boolean'
          ||!(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(item.id)||/^legacy-[0-9a-f]{32}$/.test(item.id)))throw new Error('Unexpected cleanup item');
        return item as CleanupItem;
      });setItems(previous=>after?[...(previous??[]),...parsed]:parsed);setCursor(body.nextCursor as string|null);
    }catch(error){setCleanupError(error instanceof Error?error.message:String(error));}finally{setCleanupBusy(false);}
  };
  const remove=async(item:CleanupItem)=>{
    if(!window.confirm(item.kind==='legacy'?'Delete this legacy server recording? The original video cannot be restored.':'Delete this local temporary video?'))return;
    setCleanupBusy(true);setCleanupError(null);
    try{await httpJSON(`/api/media-cleanup/${encodeURIComponent(item.id)}`,{method:'DELETE'});await refreshCleanup();}
    catch(error){setCleanupError(error instanceof Error?error.message:String(error));}finally{setCleanupBusy(false);}
  };
  return <section className="dock studio-cloud" aria-label="Optional Gemini suggestions">
    <h2 className="dock__title">Optional Gemini suggestions</h2>
    <p className="studio-help">Find pauses works locally. Sending to Gemini uploads the selected source video to Google and may incur cost using the local service's key.</p>
    <p className="studio-help">{state.available?`${state.sourceName} · ${(state.sourceBytes/1024/1024).toFixed(2)} MiB`:'This take has no available source video. Local review and Find pauses remain available.'}</p>
    <p className="studio-help">Only send video you are allowed to share. Read <a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noreferrer">Google data-use terms</a> and <a href="https://ai.google.dev/gemini-api/docs/files" target="_blank" rel="noreferrer">Files cleanup policy</a>.</p>
    <label className="studio-check"><input type="checkbox" aria-label="Allow sending the selected source video to Google Gemini" checked={state.consent}
      disabled={locked||state.busy||!state.available} onChange={event=>controller.setConsent(event.target.checked)} />Allow sending the selected source video to Google Gemini</label>
    <div className="studio-actions"><button type="button" className="btn btn--secondary" disabled={locked||state.busy||!state.available||!state.consent} onClick={()=>act(()=>controller.send())}>Send selected video</button>
      {state.busy&&<button type="button" className="btn btn--secondary" onClick={()=>controller.cancel()}>Stop waiting</button>}</div>
    {state.message&&<p role="status" className="studio-help">{state.message}</p>}
    {state.error&&<p role="alert" className="studio-error">{state.error}</p>}
    {state.cleanup&&<CleanupStatus cleanup={state.cleanup} />}
    {state.result&&<div aria-label="Suggested clips"><ul>{state.result.segments.map((segment,index)=><li key={`${index}:${segment.name}`}>{segment.name} · {segment.start.toFixed(2)}–{segment.end.toFixed(2)} seconds</li>)}</ul>
      {state.needsReplace&&<p className="studio-warning">Your clips changed during processing. Applying these suggestions replaces the current edits and keeps an undo copy.</p>}
      <button type="button" className="btn btn--secondary" disabled={locked||state.busy} onClick={()=>{
        if(state.needsReplace&&!window.confirm('Replace your current clip edits with these suggestions? Undo keeps the previous clips.'))return;act(()=>controller.apply(state.needsReplace));
      }}>Apply suggested clips</button></div>}
    <details className="studio-help"><summary>Local temporary and legacy videos</summary><p>Legacy server recordings are kept until you explicitly delete them. This cleanup does not delete browser source copies or exported backups.</p>
      <button type="button" className="btn btn--secondary" disabled={cleanupBusy||state.busy} onClick={()=>void refreshCleanup()}>Review local cleanup</button>
      {cleanupError&&<p className="studio-error" role="alert">{cleanupError}</p>}
      {items&&<ul>{items.map(item=><li key={item.id}>{item.kind==='legacy'?'Legacy recording':'Temporary video'} · {item.id.slice(0,15)} · {(item.size/1024/1024).toFixed(2)} MiB
        <button type="button" className="btn btn--ghost" disabled={cleanupBusy||state.busy||item.active} onClick={()=>void remove(item)}>Delete local video</button></li>)}</ul>}
      {items?.length===0&&<p>No temporary or legacy videos need cleanup.</p>}
      {cursor&&<button type="button" className="btn btn--secondary" disabled={cleanupBusy||state.busy} onClick={()=>void refreshCleanup(cursor)}>Load more local videos</button>}
    </details>
  </section>;
}
