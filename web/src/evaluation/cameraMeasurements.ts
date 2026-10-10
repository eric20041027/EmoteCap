import type {MotionFrame} from '../motion/index';
import type {CameraContext,CameraSetup,CameraAttemptStatus,CameraHandState,CameraDiagnostics} from '../capture/diagnostics';
import lock from '../../package-lock.json';
import pins from '../../scripts/mediapipe-assets.json';
import {cropRect} from '../capture/cropFrame';
export interface CameraMetadata {
  sourceCommit:string;classification:'synthetic'|'observed';
  environment:{kind:'desktop'|'laptop';model:string;os:string;cpu:string;gpu:string;browser:string};
  warmupMs:number;localProcessingAuthorized:boolean;sourceDigests:Record<string,string>;
}
export interface CameraReceipt {
  schema:'emotecap-camera-measurement-v1';qualification:'pending';outcome:'completed'|'incomplete';reason:string|null;
  runId:string;metadata:CameraMetadata;context:Omit<CameraContext,'cameraKey'>;setup:CameraSetup;
  sdkVersion:string;modelSha256:string;handModelSha256:string;
  clock:'performance-monotonic';latencyDefinition:'detection-to-render-call';responseDefinition:'event-to-next-animation-frame';
  startedMs:number;finishedMs:number|null;fast720pLaptopCandidate:boolean;interactionSamplesCapped:boolean;
  attempts:CameraAttempt[];interactions:{startedMs:number;finishedMs:number}[];
  summary:{effectiveRenderedFps:number|null;renderedOutputFps:number;attemptFps:number;failureRate:number|null;p95DetectionToRenderCallMs:number|null;
    p95OutputDetectionToRenderCallMs:number|null;p95NextAnimationFrameResponseMs:number|null;measuredWallMs:number;renderedCount:number|null;
    renderedOutputCount:number;attemptCount:number;unrenderedCount:number;inputIdentityAvailable:boolean;
    inputCounterProgress:'unavailable'|'insufficient'|'stalled'|'advancing'}|null;
}
export interface CameraAttempt {
  inputTimeS:number;inputFrame:number|null;startedMs:number;finishedMs:number;renderedMs:number|null;
  status:CameraAttemptStatus;handState:CameraHandState;
}
const MAX_ATTEMPTS=21601,MAX_WALL_MS=180000,MAX_BYTES=32*1024*1024;
function finite(value:unknown,max=1e12):value is number {
  return typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=max;
}
function description(value:unknown):value is string {
  return typeof value==='string'&&value.trim().length>0&&value.length<=160&&!/[\x00-\x1f]/.test(value);
}
export function validCameraMetadata(value:CameraMetadata):boolean {
  if(!value||typeof value!=='object'||!value.environment||!value.sourceDigests)return false;
  const environment=value.environment,sources=value.sourceDigests;
  return /^[0-9a-f]{40}$/.test(value.sourceCommit)&&['observed','synthetic'].includes(value.classification)
    &&value.localProcessingAuthorized===true&&finite(value.warmupMs,MAX_WALL_MS-1)
    &&['desktop','laptop'].includes(environment.kind)
    &&['kind','model','os','cpu','gpu','browser'].every(key=>Object.hasOwn(environment,key))
    &&Object.keys(environment).length===6&&['model','os','cpu','gpu','browser'].every(key=>description(Reflect.get(environment,key)))
    &&Object.keys(sources).sort().join(',')==='App,PreviewCanvas,cameraMeasurements,usePose'
    &&Object.values(sources).every(value=>typeof value==='string'&&/^[0-9a-f]{64}$/.test(value));
}
function validSetup(value:CameraSetup):boolean {
  return Number.isInteger(value.width)&&finite(value.width,8192)&&value.width>0
    &&Number.isInteger(value.height)&&finite(value.height,8192)&&value.height>0
    &&(value.frameRate===null||finite(value.frameRate,1000))
    &&[null,'GPU','CPU'].includes(value.poseDelegate)&&[null,'GPU','CPU'].includes(value.handDelegate)
    &&typeof value.handModelAvailable==='boolean';
}
function p95(values:number[]):number|null {
  if(!values.length)return null;
  values.sort((a,b)=>a-b);return values[Math.ceil(values.length*.95)-1];
}
interface Running {
  runId:string;metadata:CameraMetadata;context:CameraContext;setup:CameraSetup;startedMs:number;lastMs:number;
  attempts:CameraAttempt[];interactions:{startedMs:number;finishedMs:number}[];interactionSamplesCapped:boolean;bytes:number;lastInputFrame:number|null;
}
export class CameraMeasurements implements CameraDiagnostics {
  private context:CameraContext|null=null;
  private cameraSetup:CameraSetup|null=null;
  private preview=false;
  private run:Running|null=null;
  private pending:{inputTimeS:number;inputFrame:number|null;startedMs:number;frame?:MotionFrame;frameTime?:number}|null=null;
  private awaitingRender:{frame:MotionFrame;frameTime:number;attempt:CameraAttempt}|null=null;
  private listeners=new Set<()=>void>();
  private snapshot={ready:false,busy:false,result:null as CameraReceipt|null};
  constructor(private readonly now:()=>number=()=>performance.now()){}
  get active(){return this.run!==null;}
  getSnapshot=()=>this.snapshot;
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  private publish(result=this.snapshot.result){
    const ready=!!this.context&&this.context.status==='ready'&&this.context.allowed
      &&this.context.workflow!=='paused'&&this.preview&&this.cameraSetup!==null;
    const busy=this.active;
    if(ready===this.snapshot.ready&&busy===this.snapshot.busy&&result===this.snapshot.result)return;
    this.snapshot={ready,busy,result};for(const listener of this.listeners)listener();
  }
  configure(context:CameraContext){
    if(this.context&&JSON.stringify(context)!==JSON.stringify(this.context)){
      this.interrupt('capture-context-changed');
      if(context.cameraKey!==this.context.cameraKey)this.cameraSetup=null;
    }
    this.context={...context};this.publish();
  }
  setup(setup:CameraSetup){
    if(!validSetup(setup)){this.cameraSetup=null;this.interrupt('invalid-camera-setup');this.publish();return;}
    if(this.cameraSetup&&JSON.stringify(setup)!==JSON.stringify(this.cameraSetup))this.interrupt('camera-setup-changed');
    this.cameraSetup={...setup};this.publish();
  }
  previewReady(ready:boolean){this.preview=ready;if(!ready)this.interrupt('preview-unavailable');this.publish();}
  start(metadata:CameraMetadata){
    if(this.active||!this.snapshot.ready||!this.context||!this.cameraSetup||!validCameraMetadata(metadata))
      throw new Error('A ready live camera, preview, local actor permission and complete declared metadata are required.');
    const startedMs=this.now();if(!finite(startedMs))throw new Error('Invalid measurement clock.');
    // Explicit fields prevent undeclared attributes from reaching the receipt.
    const frozen:CameraMetadata={sourceCommit:metadata.sourceCommit,classification:metadata.classification,
      environment:{...metadata.environment},warmupMs:metadata.warmupMs,localProcessingAuthorized:true,sourceDigests:{...metadata.sourceDigests}};
    this.run={runId:crypto.randomUUID(),metadata:frozen,context:{...this.context},setup:{...this.cameraSetup},
      startedMs,lastMs:startedMs,attempts:[],interactions:[],interactionSamplesCapped:false,bytes:16384,lastInputFrame:null};
    this.pending=null;this.awaitingRender=null;this.publish();
  }
  private time(value:number):boolean {
    const run=this.run;if(!run)return false;
    if(!finite(value)||value<run.lastMs){this.interrupt('invalid-clock');return false;}
    if(value-run.startedMs>MAX_WALL_MS){this.interrupt('duration-limit');return false;}
    run.lastMs=value;return true;
  }
  begin(inputTimeS:number,startedMs:number,width:number,height:number,inputFrame:number|null=null){
    if(!this.run||!this.time(startedMs))return;
    const run=this.run;
    if(this.pending){this.interrupt('unfinished-attempt');return;}
    if(run.attempts.length>=MAX_ATTEMPTS){this.interrupt('attempt-limit');return;}
    if(!finite(inputTimeS)||(run.attempts.length>0&&inputTimeS<=run.attempts.at(-1)!.inputTimeS)){
      this.interrupt('invalid-input-time');return;
    }
    const tracked=cropRect(run.setup.width,run.setup.height,run.context.crop);
    if(width!==tracked.sw||height!==tracked.sh){this.interrupt('frame-dimensions-changed');return;}
    if(inputFrame!==null){
      if(!Number.isSafeInteger(inputFrame)||!finite(inputFrame)){this.interrupt('invalid-input-frame-counter');return;}
      if(run.lastInputFrame!==null&&inputFrame<run.lastInputFrame){this.interrupt('input-frame-counter-reset');return;}
      run.lastInputFrame=inputFrame;
    }
    this.pending={inputTimeS,inputFrame,startedMs};
  }
  solved(frame:MotionFrame){
    if(!this.run)return;
    if(!this.pending||!finite(frame.t)){this.interrupt('invalid-solved-frame');return;}
    this.pending.frame=frame;this.pending.frameTime=frame.t;
  }
  end(finishedMs:number,status:CameraAttemptStatus,handState:CameraHandState){
    if(!this.run||!this.time(finishedMs))return;
    const pending=this.pending;
    if(!pending||!['ok','no-pose','no-frame','handler-error','detector-error'].includes(status)
      ||!['off','ran','reused','unavailable'].includes(handState)){this.interrupt('invalid-attempt');return;}
    if(status==='ok'&&!pending.frame)status='no-frame';
    const attempt:CameraAttempt={inputTimeS:pending.inputTimeS,inputFrame:pending.inputFrame,startedMs:pending.startedMs,finishedMs,renderedMs:null,status,handState};
    // Reserve space for a future first-render timestamp as well as JSON separators.
    const size=new TextEncoder().encode(JSON.stringify(attempt)).byteLength+128;
    if(this.run.bytes+size>MAX_BYTES){this.interrupt('diagnostic-byte-limit');return;}
    this.run.bytes+=size;this.run.attempts.push(attempt);this.pending=null;
    if(status==='ok'&&pending.frame)this.awaitingRender={frame:pending.frame,frameTime:pending.frameTime!,attempt};
  }
  rendered(frame:MotionFrame,finishedMs:number){
    const waiting=this.awaitingRender;
    if(!this.run||!waiting||waiting.frame!==frame||waiting.frameTime!==frame.t)return;
    if(!this.time(finishedMs))return;
    waiting.attempt.renderedMs=finishedMs;this.awaitingRender=null;
  }
  interaction(startedMs:number,finishedMs:number){
    if(!this.run)return;
    if(this.run.interactions.length>=32){this.run.interactionSamplesCapped=true;return;}
    // An event can occur between the last detection and render; its start need not be the latest observed time.
    if(!finite(startedMs)||startedMs<this.run.startedMs||!finite(finishedMs)||finishedMs<startedMs){this.interrupt('invalid-clock');return;}
    if(!this.time(finishedMs))return;
    this.run.interactions.push({startedMs,finishedMs});
  }
  interrupt(reason:string){if(this.run)this.finish(reason);}
  stop(){if(this.run)this.finish(null);}
  private finish(reason:string|null){
    const run=this.run;if(!run)return;
    let finishedMs:number|null=null;
    try {const value=this.now();if(finite(value)&&value>=run.lastMs)finishedMs=value;}catch { /* Keep partial observations. */ }
    if(finishedMs===null)reason??='invalid-clock';
    else if(finishedMs-run.startedMs>MAX_WALL_MS)reason??='duration-limit';
    if(this.pending)reason??='unfinished-attempt';
    const measuredWallMs=finishedMs===null?0:finishedMs-run.startedMs-run.metadata.warmupMs;
    if(measuredWallMs<=0)reason??='warmup-exhausted';
    const samples=run.attempts.filter(a=>a.startedMs>=run.startedMs+run.metadata.warmupMs);
    const outputs=samples.filter(a=>a.status==='ok'&&a.renderedMs!==null);
    const inputIdentityAvailable=samples.every(a=>a.inputFrame!==null),unique=new Map<number,CameraAttempt>();
    const inputCounterProgress=!inputIdentityAvailable?'unavailable':samples.length<2?'insufficient'
      :samples.some(a=>a.inputFrame!==samples[0].inputFrame)?'advancing':'stalled';
    if(inputIdentityAvailable)for(const attempt of outputs)if(!unique.has(attempt.inputFrame!))unique.set(attempt.inputFrame!,attempt);
    const rendered=Array.from(unique.values());
    const responses=run.interactions.filter(a=>a.startedMs>=run.startedMs+run.metadata.warmupMs);
    const summary:CameraReceipt['summary']=reason?null:{measuredWallMs,attemptCount:samples.length,renderedCount:inputIdentityAvailable?rendered.length:null,
      effectiveRenderedFps:inputIdentityAvailable?rendered.length*1000/measuredWallMs:null,
      renderedOutputCount:outputs.length,renderedOutputFps:outputs.length*1000/measuredWallMs,inputIdentityAvailable,inputCounterProgress,
      attemptFps:samples.length*1000/measuredWallMs,
      failureRate:samples.length?samples.filter(a=>a.status!=='ok').length/samples.length:null,
      unrenderedCount:samples.filter(a=>a.status==='ok'&&a.renderedMs===null).length,
      p95DetectionToRenderCallMs:p95(rendered.map(a=>a.renderedMs!-a.startedMs)),
      p95OutputDetectionToRenderCallMs:p95(outputs.map(a=>a.renderedMs!-a.startedMs)),
      p95NextAnimationFrameResponseMs:p95(responses.map(a=>a.finishedMs-a.startedMs))};
    const {cameraKey:_privateKey,...context}=run.context;
    const receipt:CameraReceipt={schema:'emotecap-camera-measurement-v1',qualification:'pending',runId:run.runId,
      outcome:reason?'incomplete':'completed',reason,metadata:run.metadata,context,setup:run.setup,
      sdkVersion:lock.packages['node_modules/@mediapipe/tasks-vision'].version,
      modelSha256:pins.find(p=>p.file===(context.quality==='fast'?'pose_landmarker_full.task':'pose_landmarker_heavy.task'))!.sha256,
      handModelSha256:pins.find(p=>p.file==='hand_landmarker.task')!.sha256,
      clock:'performance-monotonic',latencyDefinition:'detection-to-render-call',responseDefinition:'event-to-next-animation-frame',
      startedMs:run.startedMs,finishedMs,attempts:run.attempts,interactions:run.interactions,
      interactionSamplesCapped:run.interactionSamplesCapped,summary,
      fast720pLaptopCandidate:!!summary&&summary.inputIdentityAvailable&&run.metadata.classification==='observed'&&run.metadata.environment.kind==='laptop'
        &&summary.inputCounterProgress==='advancing'&&summary.renderedOutputCount>0
        &&context.quality==='fast'&&context.crop==='none'&&run.setup.width===1280&&run.setup.height===720
        &&run.setup.poseDelegate!==null&&(context.skeleton==='body'||(run.setup.handModelAvailable&&run.setup.handDelegate!==null))};
    this.run=null;this.pending=null;this.awaitingRender=null;this.publish(receipt);
  }
}
