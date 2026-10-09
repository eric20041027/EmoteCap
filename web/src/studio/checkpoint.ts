import type { MotionFrame } from '../motion/index';
import { addTake, appendTakeFrames, finishTake, recoverProject, removeTake } from '../project/model';
import type { TakeProvenance } from '../project/types';
import { ProjectDataError } from '../project/validation';
import { StudioSession } from './session';
export const CHECKPOINT_MS=5000;
export class CaptureCheckpoint {
  readonly takeId:string;
  private timer:ReturnType<typeof setInterval>|null=null;
  private finished=false;
  constructor(private readonly session:StudioSession,provenance:TakeProvenance,private readonly readFrames:()=>readonly MotionFrame[]) {
    session.update(p=>addTake(p,{name:`Take ${p.takes.length+1}`,source:'camera',provenance}));
    this.takeId=session.getSnapshot().project.activeTakeId!;
  }
  start():void {
    if(this.finished || this.timer!==null) return;
    this.flush();
    this.timer=setInterval(()=>{
      try {this.checkpoint();} catch(error) {this.session.reportError(error);}
    },CHECKPOINT_MS);
  }
  private append(frames:readonly MotionFrame[]):void {
    const take=this.session.getSnapshot().project.takes.find(t=>t.id===this.takeId);
    if(!take) throw new ProjectDataError('Recording take no longer exists.');
    if(frames.length<take.frames.length) throw new ProjectDataError('Recording cannot replace its saved frame prefix.');
    this.session.update(p=>appendTakeFrames(p,this.takeId,frames.slice(take.frames.length)));
  }
  private flush():void {void this.session.flush().catch(error=>this.session.reportError(error));}
  checkpoint():void {if(!this.finished) {this.append(this.readFrames());this.flush();}}
  finish(frames:readonly MotionFrame[],interrupted=false):void {
    if(this.finished) return;
    if(this.timer!==null) clearInterval(this.timer);this.timer=null;
    this.append(frames);
    this.session.update(p=>frames.length?(interrupted?recoverProject(p):finishTake(p,this.takeId)):removeTake(p,this.takeId));
    this.finished=true;this.flush();
  }
  dispose():void {if(this.timer!==null) clearInterval(this.timer);this.timer=null;this.finished=true;}
}
