import {describe,expect,it} from 'vitest';
import {tposeFrame} from '../motion/index';
import {CameraMeasurements,type CameraMetadata} from '../evaluation/cameraMeasurements';
import {startVideoFrameLoop} from './videoFrameLoop';

const metadata:CameraMetadata={sourceCommit:'a'.repeat(40),classification:'synthetic',warmupMs:0,localProcessingAuthorized:true,
  environment:{kind:'laptop',model:'Controlled callback',os:'Controlled OS',cpu:'Controlled CPU',gpu:'Controlled GPU',browser:'Controlled browser'},
  sourceDigests:{App:'b'.repeat(64),usePose:'c'.repeat(64),PreviewCanvas:'d'.repeat(64),cameraMeasurements:'e'.repeat(64),videoFrameLoop:'f'.repeat(64)}};
function setup(){
  let clock=1000;const probe=new CameraMeasurements(()=>clock);
  probe.configure({cameraKey:'owned',quality:'fast',crop:'none',skeleton:'full',smoothing:'medium',workflow:'live-preview',
    calibrated:true,liveLink:false,mirrored:true,status:'ready',allowed:true});
  probe.setup({width:1280,height:720,frameRate:30,poseDelegate:'GPU',handDelegate:'GPU',handModelAvailable:true});probe.previewReady(true);probe.start(metadata);
  let next=1;const queue=new Map<number,VideoFrameRequestCallback>();
  const video={readyState:2,currentTime:1,requestVideoFrameCallback:(fn:VideoFrameRequestCallback)=>{const id=next++;queue.set(id,fn);return id;},
    cancelVideoFrameCallback:(id:number)=>queue.delete(id)};
  const stop=startVideoFrameLoop(video,(time,id)=>{
    const frame=tposeFrame();frame.t=clock/1000;
    probe.begin(time,clock,1280,720,id);probe.solved(frame);probe.end(clock+1,'ok','ran');probe.rendered(frame,clock+2);clock+=100;
  });
  const emit=(id:number,time:number)=>{
    video.currentTime=time;const [handle,fn]=queue.entries().next().value!;queue.delete(handle);
    fn(clock,{presentationTime:clock,expectedDisplayTime:clock+16,width:1280,height:720,mediaTime:time,presentedFrames:id,processingDuration:.01});
  };
  return {probe,emit,finish:()=>{stop();clock=2000;probe.stop();return probe.getSnapshot().result!;}};
}
describe('native helper to camera measurement integration',()=>{
  it('accepts two advancing frame identities at the same observed source time without fabricating times',()=>{
    const run=setup();run.emit(8,1);run.emit(9,1);const result=run.finish();
    expect(result).toMatchObject({outcome:'completed',reason:null,summary:{inputCounterProgress:'advancing',attemptCount:2,renderedCount:2}});
    expect(result.attempts.map(a=>[a.inputTimeS,a.inputFrame])).toEqual([[1,8],[1,9]]);
  });
  it('still rejects backward source time with advancing native identities',()=>{
    const run=setup();run.emit(8,1);run.emit(9,.9);expect(run.finish()).toMatchObject({outcome:'incomplete',reason:'invalid-input-time'});
  });
  it('still identifies a counter reset when native source time repeats',()=>{
    const run=setup();run.emit(9,1);run.emit(8,1);expect(run.finish()).toMatchObject({outcome:'incomplete',reason:'input-frame-counter-reset'});
  });
});
