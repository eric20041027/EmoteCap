import type {MotionFrame} from '../motion/index';
import {MAX_TAKE_FRAMES,MAX_TAKE_SECONDS} from '../project/types';
import {parseFrames} from '../project/validation';

export const EMPTY_TAKE_NOTICE='Nothing was captured. Keep the selected capture region clearly visible, then record again.';
export interface TakeNote {tone:'ok'|'warn';text:string}
export type RecorderState=
  | {phase:'idle';notice?:string}
  | {phase:'countdown'}
  | {phase:'recording';frameCount:number;durationSeconds:number}
  | {phase:'recorded';frames:readonly MotionFrame[];video?:Blob;note?:TakeNote;interrupted?:boolean};

/** Owns validated frames separately from React's bounded-rate UI summary. */
export class RecorderSession {
  private state:RecorderState={phase:'idle'};
  private frames:MotionFrame[]=[];
  private t0:number|null=null;
  private listeners=new Set<()=>void>();
  getSnapshot=():RecorderState=>this.state;
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return ()=>{this.listeners.delete(listener);};};
  private set(state:RecorderState) {
    this.state=state;for(const listener of [...this.listeners])listener();
  }
  arm() {
    if(this.state.phase!=='idle')return;
    this.frames=[];this.t0=null;this.set({phase:'countdown'});
  }
  begin() {
    if(this.state.phase==='countdown')this.set({phase:'recording',frameCount:0,durationSeconds:0});
  }
  push(frame:MotionFrame,maxFrames=MAX_TAKE_FRAMES) {
    if(this.state.phase!=='recording')return;
    const capacity=Number.isFinite(maxFrames)?Math.min(MAX_TAKE_FRAMES,Math.max(0,Math.floor(maxFrames))):MAX_TAKE_FRAMES;
    if(this.frames.length>=capacity)return this.finish('Frame capacity limit reached. Captured motion is kept.');
    if(!Number.isFinite(frame.t))return this.finish('Capture produced an invalid timestamp. Recording stopped; earlier motion is kept.',true);
    const t0=this.t0??frame.t,time=frame.t-t0;
    if(time>MAX_TAKE_SECONDS)return this.finish('The 180-second limit was reached. Captured motion is kept.');
    let rebased:MotionFrame;
    try {rebased=parseFrames([{t:time,h:frame.h,r:frame.r}],this.frames.at(-1)?.t??-1)[0];}
    catch {return this.finish('Capture produced an invalid frame or timestamp. Recording stopped; earlier motion is kept.',true);}
    this.t0=t0;this.frames.push(rebased);
    if(this.frames.length>=capacity||time===MAX_TAKE_SECONDS)this.finish('Recording limit reached. Captured motion is kept.');
  }
  /** UI publication never visits the frame history. */
  publish() {
    if(this.state.phase!=='recording'||this.state.frameCount===this.frames.length)return;
    this.set({phase:'recording',frameCount:this.frames.length,durationSeconds:this.frames.at(-1)?.t??0});
  }
  /** Frames and their arrays are frozen by parseFrames; only the list needs copying. */
  snapshotFrames=():readonly MotionFrame[]=>this.state.phase==='recorded'?this.state.frames:Object.freeze(this.frames.slice());
  private finish(text?:string,interrupted=false) {
    const frames=this.snapshotFrames();
    this.set(frames.length?{phase:'recorded',frames,...(text?{note:{tone:'warn' as const,text}}:{}),...(interrupted?{interrupted:true}:{})}
      :{phase:'idle',notice:text??EMPTY_TAKE_NOTICE});
  }
  stop() {if(this.state.phase==='recording')this.finish();}
  discard() {this.frames=[];this.t0=null;this.set({phase:'idle'});}
  load(frames:readonly MotionFrame[],video:Blob,note?:TakeNote) {
    if(this.state.phase==='idle'&&frames.length)this.set({phase:'recorded',frames,video,note});
  }
}
