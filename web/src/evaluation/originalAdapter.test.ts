import {describe,expect,it,vi} from 'vitest';
import {ImportError,NO_PERSON_MESSAGE,type ConvertSteps,type ConversionAttempt,type FrameDetection} from '../import/convertVideo';
import {tposeFrame,type PoseSolver} from '../motion/index';
import {convertOriginalVideo} from './originalAdapter';
import type {OriginalRunner} from './originalRunner';

const nobody:FrameDetection={world:undefined,image:undefined,hands:{world:{},image:{}},handTracking:'disabled'};
const person:FrameDetection={...nobody,world:[],handTracking:'active'};
function solver():PoseSolver{return{solve:()=>tposeFrame(),calibrate:()=>{},relaxFingers:()=>{},setSmoothing:()=>{},reset:()=>{}};}
function steps(overrides:Partial<ConvertSteps>={}){let clock=0;return{seek:vi.fn(async()=>{}),detect:vi.fn(()=>person),createSolver:vi.fn(solver),aspect:1,now:vi.fn(()=>++clock),...overrides};}
function runner(convert:OriginalRunner['convertVideo']):OriginalRunner {
  return{convertVideo:vi.fn(convert),createPoseSolver:solver,ImportError:class LegacyError extends Error{},NO_PERSON_MESSAGE,
    compiledSource:{sourceCommit:'a'.repeat(40),sourceIndexSha256:'b'.repeat(64)},provenance:{} as OriginalRunner['provenance']};
}
const one:OriginalRunner['convertVideo']=async(_,input)=>{
  const preview=input.createSolver();await input.seek(0);input.signal?.throwIfAborted();const detection=input.detect(0);
  const frame=preview.solve(detection.world,0,detection.hands.world,detection.image);
  input.onProgress?.({done:1,total:1,frame,detection});return{frames:frame?[frame]:[],calibratedAt:null};
};
describe('original converter observation boundary (controlled runner; actual parity qualified separately)',()=>{
  it('without observer passes through the same steps/result and never reads the clock',async()=>{
    const input=steps(),output={frames:[tposeFrame()],calibratedAt:null},original=runner(async()=>output);
    expect(await convertOriginalVideo(original,.1,input)).toBe(output);expect(original.convertVideo).toHaveBeenCalledWith(.1,input);expect(input.now).not.toHaveBeenCalled();
  });
  it('records copied preview timing before progress and preserves ordinary final output',async()=>{
    const events:ConversionAttempt[]=[],order:string[]=[],input=steps({onAttempt:event=>{events.push(event);order.push('attempt');},onProgress:()=>order.push('progress')});
    const output=await convertOriginalVideo(runner(one),.1,input);expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({inputTimeS:0,seekStartedMs:1,startedMs:2,finishedMs:3,status:'ok',handTracking:'active',assignedHandSides:[]});
    expect(order).toEqual(['attempt','progress']);expect(output.frames).toEqual([tposeFrame()]);expect(output.measurementState).toBe('complete');
    output.frames[0].r[0]=.5;expect(events[0].frame!.r[0]).toBe(0);
  });
  it('keeps no-pose attempts with null frame and translates only the legacy no-person classification',async()=>{
    const events:ConversionAttempt[]=[],original=runner(async(duration,input)=>{await one(duration,input);throw new original.ImportError(NO_PERSON_MESSAGE);});
    const input=steps({detect:()=>nobody,createSolver:()=>({...solver(),solve:()=>null}),onAttempt:event=>events.push(event)});
    await expect(convertOriginalVideo(original,.1,input)).rejects.toBeInstanceOf(ImportError);
    expect(events).toHaveLength(1);expect(events[0]).toMatchObject({status:'no-pose',frame:null,handTracking:'disabled'});
  });
  it('retains each skipped detector error and the fatal tenth exactly once before original rejection',async()=>{
    const error=new Error('Owned detector failure'),events:ConversionAttempt[]=[],original=runner(async(_,input)=>{
      const preview=input.createSolver();for(let n=0;n<10;n++){await input.seek(n/30);let detection=nobody;
        try{detection=input.detect(n*1000/30);}catch(cause){if(n===9)throw cause;}
        const frame=preview.solve(detection.world,n/30,detection.hands.world,detection.image);input.onProgress?.({done:n+1,total:10,frame,detection});}
      throw new Error('Control must throw its tenth detector error');
    });
    await expect(convertOriginalVideo(original,1,steps({detect:()=>{throw error;},createSolver:()=>({...solver(),solve:()=>null}),onAttempt:event=>events.push(event)}))).rejects.toBe(error);
    expect(events).toHaveLength(10);expect(events.every(event=>event.status==='detector-error'&&event.frame===null)).toBe(true);
  });
  for(const failure of ['seek','solve','calibrate'] as const)it(`observes ${failure} failure once without replacing the original error`,async()=>{
    const error=new Error(`Owned ${failure} failure`),events:ConversionAttempt[]=[],input=steps({onAttempt:event=>events.push(event)});
    if(failure==='seek')input.seek=async()=>{throw error;};
    if(failure==='solve')input.createSolver=()=>({...solver(),solve:()=>{throw error;}});
    if(failure==='calibrate')input.createSolver=()=>({...solver(),calibrate:()=>{throw error;}});
    const original=runner(failure==='calibrate'?async(_,wrapped)=>{const preview=wrapped.createSolver();await wrapped.seek(0);wrapped.detect(0);preview.calibrate([]);throw error;}:one);
    await expect(convertOriginalVideo(original,.1,input)).rejects.toBe(error);expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({status:failure==='seek'?'seek-error':'solver-error',frame:null});
  });
  it('aborting after a successful seek does not invent an attempted detection',async()=>{
    const controller=new AbortController(),events:ConversionAttempt[]=[],input=steps({signal:controller.signal,
      seek:async()=>{controller.abort();},onAttempt:event=>events.push(event)});
    await expect(convertOriginalVideo(runner(one),.1,input)).rejects.toThrow();expect(input.detect).not.toHaveBeenCalled();expect(events).toEqual([]);
  });
  for(const failure of ['observer','clock'] as const)it(`${failure} diagnostic failure preserves the successful original conversion`,async()=>{
    const observer=vi.fn(()=>{if(failure==='observer')throw new Error('Owned observer failure');}),input=steps({onAttempt:observer});
    if(failure==='clock')input.now=vi.fn(()=>NaN);
    const result=await convertOriginalVideo(runner(one),.1,input);expect(result.frames).toEqual([tposeFrame()]);expect(result.measurementState).toBe('failed');
    if(failure==='clock')expect(observer).not.toHaveBeenCalled();else expect(observer).toHaveBeenCalledTimes(1);
  });
  it('retains the original solver method receiver during calibration and solve',async()=>{
    const events:ConversionAttempt[]=[],state={...solver(),height:1,
      calibrate(){this.height=1.5;},solve(){return{...tposeFrame(),h:[0,this.height,0] as [number,number,number]};}},input=steps({createSolver:()=>state,onAttempt:event=>events.push(event)});
    const original=runner(async(_,wrapped)=>{const preview=wrapped.createSolver();await wrapped.seek(0);const detection=wrapped.detect(0);
      preview.calibrate([]);const frame=preview.solve(detection.world,0);wrapped.onProgress?.({done:1,total:1,frame,detection});return{frames:frame?[frame]:[],calibratedAt:0};});
    const result=await convertOriginalVideo(original,.1,input);expect(result.frames[0].h[1]).toBe(1.5);expect(events[0].frame!.h[1]).toBe(1.5);
  });
});
