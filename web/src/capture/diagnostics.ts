import type {MotionFrame,SmoothingLevel} from '../motion/index';
import type {CaptureQuality} from './landmarkers';
import type {CropMode} from './cropFrame';

export interface CameraContext {
  cameraKey:string;quality:CaptureQuality;crop:CropMode;skeleton:'full'|'body';smoothing:SmoothingLevel;
  workflow:'live-preview'|'recording'|'paused';calibrated:boolean;liveLink:boolean;mirrored:boolean;
  status:'off'|'loading'|'ready'|'error';allowed:boolean;
}
export interface CameraSetup {
  width:number;height:number;frameRate:number|null;poseDelegate:'GPU'|'CPU'|null;
  handDelegate:'GPU'|'CPU'|null;handModelAvailable:boolean;
}
export type CameraAttemptStatus='ok'|'no-pose'|'no-frame'|'handler-error'|'detector-error';
export type CameraHandState='off'|'ran'|'reused'|'unavailable';
export interface CameraDiagnostics {
  readonly active:boolean;
  configure(context:CameraContext):void;setup(setup:CameraSetup):void;previewReady(ready:boolean):void;
  begin(inputTimeS:number,startedMs:number,width:number,height:number):void;solved(frame:MotionFrame):void;
  end(finishedMs:number,status:CameraAttemptStatus,handState:CameraHandState):void;
  rendered(frame:MotionFrame,finishedMs:number):void;interrupt(reason:string):void;
}
export function observeCamera(sink:CameraDiagnostics|undefined,action:(sink:CameraDiagnostics)=>void):void {
  if(!sink)return;
  try {action(sink);}catch {try {sink.interrupt('observer-failed');}catch { /* Capture owns its resources independently. */ }}
}
