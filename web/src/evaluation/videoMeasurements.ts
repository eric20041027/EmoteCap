/** Private video-import diagnostics; no camera, upload or acceptance authority. */
import lock from '../../package-lock.json';
import modelPins from '../../scripts/mediapipe-assets.json';
import {closeLandmarkers,createLandmarkers,type Landmarkers} from '../capture/landmarkers';
import {createFrameDetector} from '../import/detectFrame';
import {convertVideo,ImportError,NO_PERSON_MESSAGE,type ConversionAttempt,type ConvertSteps} from '../import/convertVideo';
import {sampleTimes} from '../import/frameTimes';
import {closeVideoFile,openVideoFile,seekTo} from '../import/videoSource';
import {createPoseSolver,type MotionFrame,type SmoothingLevel} from '../motion/index';
import {ProcessingConsent,ProcessingConsentError} from '../privacy/processingConsent';
import {parseFrames} from '../project/validation';
import {loadOriginalRunner,ORIGINAL_COMMIT,type OriginalRunner} from './originalRunner';
import {convertOriginalVideo} from './originalAdapter';
import originalAdapterSource from './originalAdapter.ts?raw';

export const MAX_SOURCE_BYTES=100*1024*1024;
export const MAX_DIAGNOSTIC_BYTES=32*1024*1024;
const MAX_ATTEMPT_BYTES=MAX_DIAGNOSTIC_BYTES/2-65536;
const MAX_ATTEMPTS=21601;
const sdkVersion=lock.packages['node_modules/@mediapipe/tasks-vision'].version;
const modelSha256=modelPins.find(pin=>pin.file==='pose_landmarker_heavy.task')!.sha256;
const handModelSha256=modelPins.find(pin=>pin.file==='hand_landmarker.task')!.sha256;
let collectorActive=false;

export interface MeasurementEnvironment {
  kind:'desktop'|'laptop';os:string;cpu:string;gpu:string;browser:string;
}
export interface CollectionOptions {
  file:File;video:HTMLVideoElement;sourceCommit:string;environment:MeasurementEnvironment;
  classification:'synthetic'|'observed';skeleton:'full'|'body';smoothing:SmoothingLevel;
  warmupMs:number;localProcessingAuthorized:boolean;processingConsent:ProcessingConsent;signal?:AbortSignal;
  implementation?:'current'|'original';originalBuildId?:string;
}
export interface MeasurementPacket {
  schema:'emotecap-measurement-v1';runId:string;sourceCommit:string;classification:'synthetic'|'observed';
  localProcessingAuthorized:true;inputSha256:string;sourceKind:'video';environment:MeasurementEnvironment;
  settings:{quality:'accurate';width:number;height:number;crop:'none';smoothing:SmoothingLevel;
    skeleton:'full'|'body';sdkVersion:string;modelSha256:string;delegate:'GPU'|'CPU';handPolicy:'off'|'every-frame'};
  measurement:{clock:'performance-monotonic';latencyDefinition:'detection-to-solver';
    startedMs:number;finishedMs:number;warmupMs:number};
  samples:readonly {inputTimeS:number;startedMs:number;finishedMs:number;
    status:'ok'|'no-pose'|'detector-error'|'solver-error';frame:MotionFrame|null}[];
  annotations:readonly [];
}
export interface VideoCollection {
  schema:'emotecap-video-collection-v1';runId:string;qualification:'pending';
  outcome:'completed'|'no-person'|'incomplete';reason:string|null;
  metadata:Record<string,unknown>;attempts:readonly ConversionAttempt[];
  finalFrames:readonly MotionFrame[];packet:MeasurementPacket|null;
}

function number(value:unknown,upper=1e12):value is number {
  return typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=upper;
}
function descriptor(value:unknown):value is string {
  return typeof value==='string'&&value.length>0&&value.length<=160&&!/[\x00-\x1f\/\\]/.test(value)
    &&!/(?<![A-Za-z])[A-Za-z]:/.test(value);
}
export function validCollectionMetadata(value:Pick<CollectionOptions,'sourceCommit'|'environment'|'classification'|'skeleton'|'smoothing'|'warmupMs'|'implementation'|'originalBuildId'>):boolean {
  const environment=value.environment;
  const environmentKeys=['kind','os','cpu','gpu','browser'];
  return typeof value.sourceCommit==='string'&&/^[0-9a-f]{40}$/.test(value.sourceCommit)
    &&(value.implementation===undefined||value.implementation==='current'||value.implementation==='original')
    &&(value.implementation==='original'?value.sourceCommit===ORIGINAL_COMMIT&&typeof value.originalBuildId==='string'&&/^[0-9a-f]{64}$/.test(value.originalBuildId):value.originalBuildId===undefined)
    &&['synthetic','observed'].includes(value.classification)&&['full','body'].includes(value.skeleton)
    &&['low','medium','high'].includes(value.smoothing)&&number(value.warmupMs,179999)
    &&!!environment&&!Array.isArray(environment)&&
    [Object.prototype,null].includes(Object.getPrototypeOf(environment))&&
    Object.keys(environment).length===environmentKeys.length&&Object.keys(environment).every(key=>environmentKeys.includes(key))&&
    ['desktop','laptop'].includes(environment.kind)
    &&['os','cpu','gpu','browser'].every(key=>descriptor(environment[key as keyof MeasurementEnvironment]));
}
function bytes(value:unknown):number {return new TextEncoder().encode(JSON.stringify(value)).byteLength;}
function freeze<T>(value:T):T {
  if(value&&typeof value==='object'){
    for(const child of Object.values(value))freeze(child);
    Object.freeze(value);
  }
  return value;
}

async function sourceHash(file:File,authorize:()=>void):Promise<string> {
  authorize();const data=await file.arrayBuffer();authorize();
  if(data.byteLength!==file.size||data.byteLength>MAX_SOURCE_BYTES)throw new Error('Source bytes differ');
  const digest=await crypto.subtle.digest('SHA-256',data);authorize();
  return Array.from(new Uint8Array(digest),value=>value.toString(16).padStart(2,'0')).join('');
}

export async function collectVideoMeasurements(options:CollectionOptions):Promise<VideoCollection> {
  const {file,video,signal,processingConsent}=options;
  if(collectorActive)throw new Error('A collection is already running.');
  if(!validCollectionMetadata(options)||options.localProcessingAuthorized!==true||
    !(file instanceof File)||file.size<=0||file.size>MAX_SOURCE_BYTES||
    video.src||video.srcObject)throw new Error('Provide valid metadata and an idle owned video source.');
  const lease=processingConsent.lease();lease();signal?.throwIfAborted();
  const metadataOptions=structuredClone({sourceCommit:options.sourceCommit,environment:options.environment,
    classification:options.classification,skeleton:options.skeleton,smoothing:options.smoothing,warmupMs:options.warmupMs,
    implementation:options.implementation??'current',originalBuildId:options.originalBuildId});
  if(!validCollectionMetadata(metadataOptions))throw new Error('The selected implementation metadata is invalid.');
  const runId=crypto.randomUUID();collectorActive=true;
  const controller=new AbortController();
  const abort=()=>controller.abort(signal?.reason);
  signal?.addEventListener('abort',abort,{once:true});
  const authorize=()=>{controller.signal.throwIfAborted();lease();};
  const attempts:ConversionAttempt[]=[],metadata:Record<string,unknown>={
    ...metadataOptions,pipeline:'video-import-preview-and-final',sourceBytes:file.size,
    sdkVersion,modelSha256,handModelSha256,sourceKind:'video',
    declarations:'Source commit, classification, rights and hardware require independent qualification.',
    previewMeaning:'Detection through preview solver; final calibrated motion is separate.',
    throughputMeaning:'Full offline import wall interval, not live camera or Studio FPS.',
  };
  let models:Landmarkers|undefined,videoOwned=false,inputSha256:string|undefined,original:OriginalRunner|undefined;
  let duration=0,startedMs=0,finishedMs=0,retainedBytes=0,diagnosticReason:string|null=null;
  let conversionStarted=false;
  let finalFrames:readonly MotionFrame[]=[],outcome:VideoCollection['outcome']='incomplete',reason:string|null=null;
  let stage='source-read-failed',handPolicy:'off'|'every-frame'='off';
  const clock=()=>{
    const value=performance.now();if(!number(value))throw new Error('Invalid measurement clock');return value;
  };
  const observe=(event:ConversionAttempt)=>{
    try {
      if(attempts.length>=MAX_ATTEMPTS)throw new Error('limit');
      if(!number(event.inputTimeS,180)||!number(event.seekStartedMs)||!number(event.startedMs)||!number(event.finishedMs)||
        event.seekStartedMs>event.startedMs||event.startedMs>event.finishedMs||
        (attempts.length&&(event.inputTimeS<=attempts.at(-1)!.inputTimeS||event.seekStartedMs<attempts.at(-1)!.finishedMs)))
        throw new Error('clock');
      const copied=structuredClone(event);
      if(copied.frame)copied.frame=parseFrames([copied.frame])[0];
      const size=bytes(copied);
      if(retainedBytes+size>MAX_ATTEMPT_BYTES)throw new Error('limit');
      retainedBytes+=size;attempts.push(copied);
      if(event.finishedMs-startedMs>180000)throw new Error('wall-limit');
    } catch(error) {
      diagnosticReason=error instanceof Error&&error.message==='limit'?'diagnostics-limit':
        error instanceof Error&&error.message==='wall-limit'?'wall-limit':'invalid-observation';
      controller.abort(new DOMException('Measurement collection incomplete','AbortError'));
    }
  };
  try {
    inputSha256=await sourceHash(file,authorize);metadata.inputSha256=inputSha256;
    if(metadataOptions.implementation==='original'){
      stage='original-runner-unavailable';original=await loadOriginalRunner(metadataOptions.originalBuildId!,{authorize,signal:controller.signal});authorize();
      metadata.originalRunner=structuredClone(original.provenance);
      const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(originalAdapterSource));authorize();
      metadata.originalAdapterSha256=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
    }
    authorize();stage='video-read-failed';videoOwned=true;
    duration=await openVideoFile(file,video,controller.signal);authorize();
    const width=video.videoWidth,height=video.videoHeight;
    if(!number(duration,180)||duration<=0||!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>8192||height>8192)
      throw new Error('Invalid source dimensions or duration');
    Object.assign(metadata,{width,height,durationS:duration});stage='model-setup-failed';
    const initializationStartedMs=clock();
    models=await createLandmarkers('accurate',authorize,{reportDelegate:true});authorize();
    Object.assign(metadata,{poseDelegate:models.poseDelegate??null,handDelegate:models.handDelegate??null,
      modelInitializationMs:clock()-initializationStartedMs,
      handModelAvailable:models.hands!==undefined});
    const trackHands=metadataOptions.skeleton==='full';
    handPolicy=trackHands&&models.hands?'every-frame':'off';
    metadata.handPolicy=handPolicy;
    const detect=createFrameDetector(models,trackHands,authorize,true);
    stage='conversion-failed';startedMs=clock();conversionStarted=true;
    try {
      const conversionSteps:ConvertSteps={
        seek:async t=>{authorize();await seekTo(video,t,controller.signal);authorize();},
        detect:t=>{authorize();return detect(video,t);},
        createSolver:()=>original?original.createPoseSolver({},metadataOptions.smoothing):createPoseSolver({},metadataOptions.smoothing),aspect:width/height,
        signal:controller.signal,now:clock,onAttempt:observe,
      };
      const result=original?await convertOriginalVideo(original,duration,conversionSteps):await convertVideo(duration,conversionSteps);
      authorize();finalFrames=parseFrames(result.frames);outcome='completed';
      if(result.measurementState!=='complete')diagnosticReason??='observer-failed';
      metadata.calibratedAt=result.calibratedAt;
    } catch(error) {
      if(error instanceof ImportError&&error.message===NO_PERSON_MESSAGE&&!controller.signal.aborted){outcome='no-person';}
      else throw error;
    }
    finishedMs=clock();
  } catch(error) {
    outcome='incomplete';reason=diagnosticReason??(controller.signal.aborted||!processingConsent.allowed||
      error instanceof ProcessingConsentError?'cancelled-or-withdrawn':stage);
    try {finishedMs=clock();}catch{diagnosticReason??='invalid-clock';reason=diagnosticReason;}
  } finally {
    try {if(models)closeLandmarkers(models);}catch {
      outcome='incomplete';reason='cleanup-failed';metadata.cleanupIncomplete=true;
    } finally {
      try {if(videoOwned)closeVideoFile(video);}catch {
        outcome='incomplete';reason='cleanup-failed';metadata.cleanupIncomplete=true;
      } finally {signal?.removeEventListener('abort',abort);collectorActive=false;}
    }
  }
  let packet:MeasurementPacket|null=null;
  const expected=sampleTimes(duration);
  const complete=expected.length>0&&expected.length===attempts.length&&
    expected.every((time,index)=>time===attempts[index].inputTimeS);
  if(diagnosticReason){outcome='incomplete';reason=diagnosticReason;}
  if(outcome!=='incomplete'&&complete&&inputSha256){
    const elapsed=finishedMs-startedMs;
    if(attempts.some(event=>event.seekStartedMs<startedMs||event.finishedMs>finishedMs)){
      outcome='incomplete';reason='invalid-observation';
    }
    else if(models?.poseDelegate!=='CPU'&&models?.poseDelegate!=='GPU')reason='delegate-unavailable';
    else if(attempts.some(event=>event.handTracking==='failed'))reason='hand-policy-changed';
    else if(handPolicy==='every-frame'&&models.handDelegate!=='CPU'&&models.handDelegate!=='GPU')reason='hand-delegate-unavailable';
    else if(handPolicy==='every-frame'&&models.handDelegate!==models.poseDelegate)reason='mixed-model-delegates';
    else if(!number(elapsed,180000)||elapsed<1||finishedMs-(startedMs+metadataOptions.warmupMs)<=0)reason='warmup-exhausted-window';
    else if(attempts.some(event=>event.status==='seek-error'))reason='seek-failed';
    else packet={schema:'emotecap-measurement-v1',runId,sourceCommit:metadataOptions.sourceCommit,
      classification:metadataOptions.classification,localProcessingAuthorized:true,inputSha256,sourceKind:'video',
      environment:metadataOptions.environment,
      settings:{quality:'accurate',width:metadata.width as number,height:metadata.height as number,crop:'none',
        smoothing:metadataOptions.smoothing,skeleton:metadataOptions.skeleton,sdkVersion,modelSha256,
        delegate:models.poseDelegate,handPolicy},
      measurement:{clock:'performance-monotonic',latencyDefinition:'detection-to-solver',startedMs,finishedMs,warmupMs:metadataOptions.warmupMs},
      samples:attempts.map(event=>({inputTimeS:event.inputTimeS,startedMs:event.startedMs,finishedMs:event.finishedMs,
        status:event.status as MeasurementPacket['samples'][number]['status'],frame:event.status==='ok'?structuredClone(event.frame):null})),annotations:[]};
  } else if(outcome!=='incomplete'){outcome='incomplete';reason='attempts-missing';}
  Object.assign(metadata,{startedMs:conversionStarted?startedMs:null,finishedMs:conversionStarted?finishedMs:null,
    conversionElapsedMs:conversionStarted?Math.max(0,finishedMs-startedMs):null,plannedAttempts:expected.length});
  const collection:VideoCollection={schema:'emotecap-video-collection-v1',runId,qualification:'pending',
    outcome,reason,metadata,attempts,finalFrames,packet};
  if(bytes(collection)>MAX_DIAGNOSTIC_BYTES){
    collection.packet=null;collection.outcome='incomplete';collection.reason='diagnostics-limit';
    if(bytes(collection)>MAX_DIAGNOSTIC_BYTES)collection.finalFrames=[];
  }
  return freeze(collection);
}
