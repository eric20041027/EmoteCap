import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { TakeProvenance } from '../project/types';
import type { Recorder } from '../record/useRecorder';
import type { TakeVideo } from '../take/useTakeVideo';
import { CaptureCheckpoint } from './checkpoint';
import type { StudioSession } from './session';
export function useCaptureProject(recorder:Recorder,session:StudioSession,provenance:TakeProvenance,video:TakeVideo) {
  const latest=useRef({recorder,provenance}),capture=useRef<CaptureCheckpoint|null>(null);
  const [takeId,setTakeId]=useState<string|null>(null),[settled,setSettled]=useState(true),attached=useRef<string|null>(null);
  useLayoutEffect(()=>{latest.current={recorder,provenance};});
  const phase=recorder.state.phase;
  useEffect(()=>{
    try {
      if(phase==='recording' && !capture.current) {
        const next=new CaptureCheckpoint(session,latest.current.provenance,()=>{
          const state=latest.current.recorder.state;return state.phase==='recording'||state.phase==='recorded'?state.frames:[];
        });capture.current=next;setTakeId(next.takeId);setSettled(false);attached.current=null;next.start();
      } else if(capture.current && phase!=='recording') {
        const state=latest.current.recorder.state,frames=state.phase==='recorded'?state.frames:[];
        capture.current.finish(frames,state.phase==='recorded'&&!!state.interrupted);capture.current=null;
        if(!frames.length) {setTakeId(null);setSettled(true);}
      }
      if(phase==='idle'||phase==='countdown') {setTakeId(null);setSettled(true);attached.current=null;}
    } catch(error) {session.reportError(error);latest.current.recorder.stop();}
  },[phase,session]);
  useEffect(()=>{
    if(phase!=='recorded'||!takeId||attached.current===takeId) return;
    if(video.status==='recording'||video.status==='finishing') return;
    try {
      if(video.status==='ready' && session.getSnapshot().project.takes.some(t=>t.id===takeId)) {
        session.attachSource(takeId,{name:`Camera-${takeId}.webm`,blob:video.blob});
      } else if(video.status==='failed') session.reportError(new Error(`${video.reason} Captured motion is still available.`));
    } catch(error) {session.reportError(error);}
    attached.current=takeId;setSettled(true);
  },[phase,session,takeId,video]);
  useEffect(()=>()=>capture.current?.dispose(),[]);
  return {takeId,sourcePending:phase==='recorded'&&takeId!==null&&!settled};
}
