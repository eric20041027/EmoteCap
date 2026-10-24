import {useCallback,useEffect,useLayoutEffect,useRef,useSyncExternalStore} from 'react';
import type {MotionFrame} from '../motion/index';
import {MAX_TAKE_FRAMES} from '../project/types';
import {useCountdown} from '../ui/useCountdown';
import {RecorderSession,type RecorderState,type TakeNote} from './recorderSession';
export type {RecorderState,TakeNote} from './recorderSession';

export const COUNTDOWN_SECONDS=3;
export const RECORDER_PUBLISH_MS=100;
export interface Recorder {
  state:RecorderState;
  countdown:number|null;
  start:()=>void;
  stop:()=>void;
  discard:()=>void;
  push:(frame:MotionFrame)=>void;
  load:(frames:readonly MotionFrame[],video:Blob,note?:TakeNote)=>void;
  snapshotFrames:()=>readonly MotionFrame[];
}
export function useRecorder(maxFrames=MAX_TAKE_FRAMES):Recorder {
  const sessionRef=useRef<RecorderSession|null>(null);
  if(!sessionRef.current)sessionRef.current=new RecorderSession();
  const session=sessionRef.current;
  const state=useSyncExternalStore(session.subscribe,session.getSnapshot);
  const {remaining,start:startCountdown,cancel:cancelCountdown}=useCountdown();
  const capacityRef=useRef(maxFrames);
  useLayoutEffect(()=>{capacityRef.current=maxFrames;},[maxFrames]);
  useEffect(()=>{
    if(state.phase!=='recording')return;
    const timer=window.setInterval(()=>session.publish(),RECORDER_PUBLISH_MS);
    return ()=>window.clearInterval(timer);
  },[session,state.phase]);
  const start=useCallback(()=>{
    if(session.getSnapshot().phase!=='idle'||capacityRef.current<1)return;
    session.arm();startCountdown(COUNTDOWN_SECONDS,()=>session.begin());
  },[session,startCountdown]);
  const stop=useCallback(()=>session.stop(),[session]);
  const discard=useCallback(()=>{cancelCountdown();session.discard();},[session,cancelCountdown]);
  const push=useCallback((frame:MotionFrame)=>session.push(frame,capacityRef.current),[session]);
  const load=useCallback((frames:readonly MotionFrame[],video:Blob,note?:TakeNote)=>session.load(frames,video,note),[session]);
  return {state,countdown:remaining,start,stop,discard,push,load,snapshotFrames:session.snapshotFrames};
}
