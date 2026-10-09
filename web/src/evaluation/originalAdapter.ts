import {ImportError,NO_PERSON_MESSAGE,type ConvertSteps,type ConvertedVideo,type ConversionAttempt,type FrameDetection} from '../import/convertVideo';
import type {MotionFrame} from '../motion/index';
import type {OriginalRunner} from './originalRunner';
export async function convertOriginalVideo(runner:OriginalRunner,duration:number,steps:ConvertSteps):Promise<ConvertedVideo>{
  let observer=steps.onAttempt,failed=false,solverCount=0;
  let pending:{t:number;seekStartedMs:number;startedMs:number;detected:boolean;status?:ConversionAttempt['status'];detection?:FrameDetection}|null=null;
  const disable=()=>{observer=undefined;failed=true;console.warn('Original measurement collection stopped.');};
  const clock=()=>{
    if(!observer)return 0;
    try{const value=steps.now?steps.now():performance.now();if(!Number.isFinite(value)||value<0)throw new Error('Invalid clock');return value;}
    catch{disable();return 0;}
  };
  const report=(status:ConversionAttempt['status'],frame:MotionFrame|null,detection=pending?.detection)=>{
    if(!pending)return;const current=pending;pending=null;const finishedMs=clock();if(!observer)return;
    try{observer(structuredClone({inputTimeS:current.t,seekStartedMs:current.seekStartedMs,startedMs:current.startedMs,finishedMs,status,frame,
      ...(detection?.handTracking?{handTracking:detection.handTracking}:{}),assignedHandSides:Object.keys(detection?.hands.world??{}).sort()}));}
    catch{disable();}
  };
  const reportFailure=()=>{if(pending?.detected)report(pending.status??'solver-error',null);};
  try{
    if(!steps.onAttempt)return await runner.convertVideo(duration,steps);
    const wrapped:ConvertSteps={...steps,
      seek:async t=>{
        const seekStartedMs=clock();pending={t,seekStartedMs,startedMs:seekStartedMs,detected:false};
        try{await steps.seek(t);}catch(error){report('seek-error',null);throw error;}
      },
      detect:ms=>{
        if(pending){pending.startedMs=clock();pending.detected=true;}
        try{const detection=steps.detect(ms);if(pending)pending.detection=detection;return detection;}
        catch(error){if(pending)pending.status='detector-error';throw error;}
      },
      createSolver:()=>{
        const solver=steps.createSolver();if(++solverCount!==1)return solver;
        return new Proxy(solver,{get(target,key){
          const value=Reflect.get(target,key,target);
          if(key==='solve')return(...args:Parameters<typeof solver.solve>)=>{
            try{return solver.solve(...args);}catch(error){if(pending)pending.status='solver-error';throw error;}
          };
          return typeof value==='function'?value.bind(target):value;
        }});
      },
      onProgress:progress=>{report(pending?.status??(progress.frame?'ok':'no-pose'),progress.frame,progress.detection);steps.onProgress?.(progress);},
    };
    const result=await runner.convertVideo(duration,wrapped);return{...result,measurementState:failed?'failed':'complete'};
  }catch(error){
    reportFailure();
    if(error instanceof runner.ImportError&&error.message===runner.NO_PERSON_MESSAGE)throw new ImportError(NO_PERSON_MESSAGE);
    throw error;
  }
}
