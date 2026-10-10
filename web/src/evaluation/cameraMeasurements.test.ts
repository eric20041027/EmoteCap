import {describe,expect,it} from 'vitest';
import {tposeFrame} from '../motion/index';
import {observeCamera,type CameraContext,type CameraSetup} from '../capture/diagnostics';
import {CameraMeasurements,validCameraMetadata,type CameraMetadata} from './cameraMeasurements';

const context:CameraContext={cameraKey:'private-device:fast:1',quality:'fast',crop:'none',skeleton:'full',
  smoothing:'medium',workflow:'live-preview',calibrated:false,liveLink:false,mirrored:true,status:'ready',allowed:true};
const setup:CameraSetup={width:1280,height:720,frameRate:30,poseDelegate:'GPU',handDelegate:'CPU',handModelAvailable:true};
function metadata():CameraMetadata{return {sourceCommit:'a'.repeat(40),classification:'synthetic',
  environment:{kind:'laptop',model:'Controlled test',os:'Windows 11',cpu:'Declared CPU',gpu:'Declared GPU',browser:'Edge 154'},
  warmupMs:0,localProcessingAuthorized:true,
  sourceDigests:{App:'b'.repeat(64),usePose:'c'.repeat(64),PreviewCanvas:'d'.repeat(64),cameraMeasurements:'e'.repeat(64),videoFrameLoop:'f'.repeat(64)}};}
function ready(){let time=1000;const probe=new CameraMeasurements(()=>time);
  probe.configure({...context});probe.setup({...setup});probe.previewReady(true);
  return {probe,setTime:(value:number)=>{time=value;}};}
function ok(probe:CameraMeasurements,input:number,start:number,end:number,render:number|null,inputFrame=Math.round(input*1000)){
  const frame=tposeFrame();frame.t=input;
  probe.begin(input,start,1280,720,inputFrame);probe.solved(frame);probe.end(end,'ok','ran');
  if(render!==null)probe.rendered(frame,render);return frame;
}
describe('camera measurement receipts',()=>{
  it('requires the frame-loop digest and binds the new input identity definition',()=>{
    const missing=metadata();delete missing.sourceDigests.videoFrameLoop;
    expect(validCameraMetadata(missing)).toBe(false);
    const {probe,setTime}=ready();probe.start(metadata());
    ok(probe,0,1000,1010,1020,1);setTime(2000);probe.stop();
    expect(probe.getSnapshot().result).toMatchObject({inputFrameDefinition:'video-frame-callback-presented-frames',
      metadata:{sourceDigests:{videoFrameLoop:'f'.repeat(64)}}});
  });
  it('requires real ready setup, preview, local actor rights and bounded declarations',()=>{
    const probe=new CameraMeasurements(()=>1000);
    expect(probe.getSnapshot().ready).toBe(false);expect(()=>probe.start(metadata())).toThrow();
    probe.configure(context);probe.setup(setup);probe.previewReady(true);expect(probe.getSnapshot().ready).toBe(true);
    for(const m of [{...metadata(),localProcessingAuthorized:false},{...metadata(),sourceCommit:'HEAD'},
      {...metadata(),warmupMs:180000},{...metadata(),sourceDigests:{...metadata().sourceDigests,extra:'f'.repeat(64)}},
      {...metadata(),environment:{...metadata().environment,cpu:'x'.repeat(161)}}])expect(()=>probe.start(m)).toThrow();
    probe.start(metadata());expect(probe.getSnapshot().busy).toBe(true);
  });
  it('includes failed attempts and trailing idle in wall FPS and counts a frame only once',()=>{
    const {probe,setTime}=ready();probe.start(metadata());
    const frame=ok(probe,0,1000,1010,1020);probe.rendered(frame,1030);
    probe.begin(.1,1100,1280,720,1);probe.end(1110,'no-pose','reused');setTime(2000);probe.stop();
    expect(probe.getSnapshot().result?.summary).toMatchObject({effectiveRenderedFps:1,attemptFps:2,
      failureRate:.5,p95DetectionToRenderCallMs:20,renderedCount:1,attemptCount:2,unrenderedCount:0});
  });
  it('uses start-bound warmup and literal nearest-rank render and response p95',()=>{
    const {probe,setTime}=ready();probe.start({...metadata(),warmupMs:200});
    ok(probe,0,1000,1010,1020);ok(probe,.2,1200,1210,1220);ok(probe,.3,1300,1310,1340);
    probe.interaction(1400,1420);probe.interaction(1500,1550);setTime(2200);probe.stop();
    expect(probe.getSnapshot().result?.summary).toMatchObject({effectiveRenderedFps:2,attemptFps:2,
      failureRate:0,p95DetectionToRenderCallMs:40,p95NextAnimationFrameResponseMs:50,measuredWallMs:1000});
  });
  it('retains overwritten frames and matches only the latest mutation of the same object',()=>{
    const {probe,setTime}=ready();probe.start(metadata());const frame=ok(probe,0,1000,1010,null);
    frame.t=.1;probe.begin(.1,1100,1280,720,1);probe.solved(frame);probe.end(1110,'ok','reused');probe.rendered(frame,1120);
    probe.rendered(tposeFrame(),1130);setTime(2000);probe.stop();
    const report=probe.getSnapshot().result!;expect(report.attempts.map(a=>a.renderedMs)).toEqual([null,1120]);
    expect(report.summary).toMatchObject({unrenderedCount:1,effectiveRenderedFps:1,failureRate:0});
  });
  it('reports zero FPS and null latency for all failed poses without inventing success',()=>{
    const {probe,setTime}=ready();probe.start(metadata());
    probe.begin(0,1000,1280,720,0);probe.end(1010,'no-pose','unavailable');
    probe.begin(.1,1100,1280,720,1);probe.end(1110,'handler-error','off');setTime(2000);probe.stop();
    expect(probe.getSnapshot().result?.summary).toMatchObject({effectiveRenderedFps:0,failureRate:1,p95DetectionToRenderCallMs:null});
  });
  it('reports no attempts honestly and rejects exhausted warmup',()=>{
    const a=ready();a.probe.start(metadata());a.setTime(2000);a.probe.stop();
    expect(a.probe.getSnapshot().result?.summary).toMatchObject({effectiveRenderedFps:0,attemptFps:0,failureRate:null});
    const b=ready();b.probe.start({...metadata(),warmupMs:1000});b.setTime(1500);b.probe.stop();
    expect(b.probe.getSnapshot().result).toMatchObject({outcome:'incomplete',reason:'warmup-exhausted',summary:null});
  });
  it('freezes metadata and omits transient frames, private camera IDs and tokens',()=>{
    const {probe,setTime}=ready(),m=metadata();probe.start(m);m.environment.cpu='Edited';m.sourceDigests.App='f'.repeat(64);
    ok(probe,0,1000,1010,1020);setTime(2000);probe.stop();const report=probe.getSnapshot().result!;
    expect(report.metadata.environment.cpu).toBe('Declared CPU');expect(report.metadata.sourceDigests.App).toBe('b'.repeat(64));
    const serialized=JSON.stringify(report);for(const secret of ['private-device','landmarks','worldLandmarks','"r":','"h":','pairingCode','deviceId'])expect(serialized).not.toContain(secret);
    expect(report).toMatchObject({schema:'emotecap-camera-measurement-v1',qualification:'pending',fast720pLaptopCandidate:false});
  });
  it('never qualifies synthetic, desktop, cropped, non720p or unknown-delegate data',()=>{
    for(const kind of ['synthetic','desktop','crop','resolution','delegate','eligible'] as const){
      const {probe,setTime}=ready(),m=metadata();m.classification='observed';
      if(kind==='synthetic')m.classification='synthetic';if(kind==='desktop')m.environment.kind='desktop';
      if(kind==='crop')probe.configure({...context,crop:'portrait'});
      if(kind==='resolution')probe.setup({...setup,width:640,height:480});
      if(kind==='delegate')probe.setup({...setup,poseDelegate:null});
      probe.start(m);
      for(let i=0;i<2;i++){
        const frame=tposeFrame();frame.t=i*.1;
        probe.begin(frame.t,1000+i*100,kind==='crop'?540:kind==='resolution'?640:1280,kind==='resolution'?480:720,i);
        probe.solved(frame);probe.end(1010+i*100,'ok','ran');probe.rendered(frame,1020+i*100);
      }
      setTime(2000);probe.stop();expect(probe.getSnapshot().result?.fast720pLaptopCandidate).toBe(kind==='eligible');
      expect(probe.getSnapshot().result?.qualification).toBe('pending');
    }
  });
  it.each(['quality','crop','skeleton','smoothing','workflow','calibrated','liveLink','mirrored','cameraKey','status','allowed'] as const)('closes a partial receipt on %s change',key=>{
    const {probe}=ready();probe.start(metadata());const changed={...context,[key]:({quality:'accurate',crop:'portrait',skeleton:'body',
      smoothing:'high',workflow:'paused',calibrated:true,liveLink:true,mirrored:false,cameraKey:'other',status:'off',allowed:false})[key]};
    probe.configure(changed as CameraContext);expect(probe.getSnapshot().result).toMatchObject({outcome:'incomplete',summary:null});
    expect(probe.active).toBe(false);
  });
  it('invalidates ready setup when camera identity changes and retains prior reports on rejected start',()=>{
    const {probe,setTime}=ready();probe.start(metadata());setTime(2000);probe.stop();const previous=probe.getSnapshot().result;
    probe.configure({...context,cameraKey:'another'});expect(probe.getSnapshot().ready).toBe(false);
    expect(()=>probe.start(metadata())).toThrow();expect(probe.getSnapshot().result).toBe(previous);
  });
  it('stops on changed dimensions, hand availability, delegates or preview loss',()=>{
    for(const change of ['size','hands','delegate','preview'] as const){const {probe}=ready();probe.start(metadata());
      if(change==='preview')probe.previewReady(false);
      else probe.setup({...setup,...(change==='size'?{width:640}:change==='hands'?{handModelAvailable:false}:{poseDelegate:'CPU' as const})});
      expect(probe.getSnapshot().result).toMatchObject({outcome:'incomplete',summary:null});}
  });
  it.each([['backward',999],['NaN',NaN],['infinity',Infinity]])('rejects %s observation clocks',(_label,time)=>{
    const {probe}=ready();probe.start(metadata());probe.begin(0,time,1280,720);
    expect(probe.getSnapshot().result).toMatchObject({outcome:'incomplete',reason:'invalid-clock',summary:null});
  });
  it('ends a partial receipt for invalid/repeated input time, changed dimensions and orphaned callbacks',()=>{
    for(const kind of ['input','repeat','size','orphan'] as const){const {probe}=ready();probe.start(metadata());
      if(kind==='input')probe.begin(NaN,1000,1280,720);
      if(kind==='repeat'){probe.begin(0,1000,1280,720);probe.end(1010,'no-pose','off');probe.begin(0,1100,1280,720);}
      if(kind==='size')probe.begin(0,1000,720,1280);
      if(kind==='orphan')probe.end(1010,'ok','ran');
      expect(probe.getSnapshot().result).toMatchObject({outcome:'incomplete',summary:null});}
  });
  it('bounds attempts at21601 and stops overlong or stalled intervals',()=>{
    const {probe,setTime}=ready();probe.start(metadata());
    for(let n=0;n<21601;n++){probe.begin(n,1000+n*2,1280,720);probe.end(1001+n*2,'no-pose','off');}
    probe.begin(21601,50000,1280,720);expect(probe.getSnapshot().result?.attempts).toHaveLength(21601);
    expect(probe.getSnapshot().result).toMatchObject({outcome:'incomplete',reason:'attempt-limit',summary:null});
    setTime(1000);probe.start(metadata());setTime(181001);probe.stop();
    expect(probe.getSnapshot().result).toMatchObject({outcome:'incomplete',reason:'duration-limit',summary:null});
    expect(new TextEncoder().encode(JSON.stringify(probe.getSnapshot().result)).byteLength).toBeLessThan(32*1024*1024);
  });
  it('caps optional interaction observations without erasing ordinary preview evidence',()=>{
    const {probe,setTime}=ready();probe.start(metadata());for(let n=0;n<40;n++)probe.interaction(1100+n*2,1101+n*2);
    ok(probe,0,1300,1310,1320);setTime(2000);probe.stop();
    expect(probe.getSnapshot().result?.interactions).toHaveLength(32);expect(probe.getSnapshot().result).toMatchObject({interactionSamplesCapped:true,outcome:'completed'});
  });
  it('matches portrait tracking dimensions while retaining delivered camera dimensions',()=>{
    const {probe,setTime}=ready();probe.configure({...context,crop:'portrait'});probe.start(metadata());
    const frame=tposeFrame();probe.begin(0,1000,540,720,0);probe.solved(frame);probe.end(1010,'ok','ran');probe.rendered(frame,1020);
    setTime(2000);probe.stop();expect(probe.getSnapshot().result).toMatchObject({outcome:'completed',setup:{width:1280,height:720},
      fast720pLaptopCandidate:false,summary:{effectiveRenderedFps:1}});
  });
  it('deduplicates repeated camera inputs without hiding detector output throughput',()=>{
    const {probe,setTime}=ready();probe.start({...metadata(),classification:'observed'});
    ok(probe,0,1000,1010,1020,9);ok(probe,.1,1100,1110,1150,9);
    ok(probe,.2,1200,1210,1240,10);ok(probe,.3,1300,1310,1370,10);setTime(2000);probe.stop();
    expect(probe.getSnapshot().result?.summary).toMatchObject({effectiveRenderedFps:2,renderedOutputFps:4,
      renderedCount:2,renderedOutputCount:4,attemptFps:4,p95DetectionToRenderCallMs:40,inputIdentityAvailable:true,
      inputCounterProgress:'advancing'});
    expect(probe.getSnapshot().result?.fast720pLaptopCandidate).toBe(true);
  });
  it('does not admit a stalled input counter while preserving output and response observations',()=>{
    const {probe,setTime}=ready();probe.start({...metadata(),classification:'observed'});
    ok(probe,0,1000,1010,1020,3682);ok(probe,.1,1100,1110,1120,3682);
    probe.interaction(1200,1263.4);setTime(2000);probe.stop();
    const report=probe.getSnapshot().result!;
    expect(report).toMatchObject({outcome:'completed',qualification:'pending',fast720pLaptopCandidate:false,
      summary:{inputCounterProgress:'stalled',inputIdentityAvailable:true,effectiveRenderedFps:1,
        renderedOutputFps:2,renderedCount:1,renderedOutputCount:2,attemptCount:2}});
    expect(report.summary?.p95NextAnimationFrameResponseMs).toBeCloseTo(63.4,8);
    expect(report.attempts.map(a=>a.inputFrame)).toEqual([3682,3682]);
  });
  it.each([0,1])('does not admit insufficient counter observations (%i attempt)',count=>{
    const {probe,setTime}=ready();probe.start({...metadata(),classification:'observed'});
    if(count)ok(probe,0,1000,1010,1020,3682);setTime(2000);probe.stop();
    expect(probe.getSnapshot().result).toMatchObject({fast720pLaptopCandidate:false,
      summary:{inputCounterProgress:'insufficient',attemptCount:count}});
  });
  it('does not use warmup counter advances to admit a stalled measured interval',()=>{
    const {probe,setTime}=ready();probe.start({...metadata(),classification:'observed',warmupMs:200});
    ok(probe,0,1000,1010,1020,1);ok(probe,.1,1100,1110,1120,2);
    ok(probe,.2,1200,1210,1220,3);ok(probe,.3,1300,1310,1320,3);setTime(2200);probe.stop();
    expect(probe.getSnapshot().result).toMatchObject({fast720pLaptopCandidate:false,
      summary:{inputCounterProgress:'stalled',attemptCount:2,renderedCount:1,renderedOutputCount:2}});
  });
  it('does not admit advancing inputs without a successful render output',()=>{
    const {probe,setTime}=ready();probe.start({...metadata(),classification:'observed'});
    probe.begin(0,1000,1280,720,1);probe.end(1010,'no-pose','ran');
    probe.begin(.1,1100,1280,720,2);probe.end(1110,'no-pose','ran');setTime(2000);probe.stop();
    expect(probe.getSnapshot().result).toMatchObject({fast720pLaptopCandidate:false,
      summary:{inputCounterProgress:'advancing',renderedCount:0,failureRate:1}});
  });
  it('does not inherit counter progress when a new measurement starts',()=>{
    const {probe,setTime}=ready();const m={...metadata(),classification:'observed' as const};probe.start(m);
    ok(probe,0,1000,1010,1020,1);ok(probe,.1,1100,1110,1120,2);setTime(2000);probe.stop();
    expect(probe.getSnapshot().result?.fast720pLaptopCandidate).toBe(true);
    setTime(3000);probe.start(m);ok(probe,0,3000,3010,3020,3682);ok(probe,.1,3100,3110,3120,3682);
    setTime(4000);probe.stop();
    expect(probe.getSnapshot().result).toMatchObject({fast720pLaptopCandidate:false,
      summary:{inputCounterProgress:'stalled',attemptCount:2}});
  });
  it('keeps output timings but withholds effective camera FPS when input identity is unavailable',()=>{
    const {probe,setTime}=ready();probe.start(metadata());const frame=tposeFrame();
    probe.begin(0,1000,1280,720);probe.solved(frame);probe.end(1010,'ok','ran');probe.rendered(frame,1020);setTime(2000);probe.stop();
    expect(probe.getSnapshot().result?.summary).toMatchObject({effectiveRenderedFps:null,renderedOutputFps:1,inputIdentityAvailable:false,
      inputCounterProgress:'unavailable'});
    expect(probe.getSnapshot().result?.fast720pLaptopCandidate).toBe(false);
  });
  it('rejects a source frame-counter reset while source time still advances',()=>{
    const {probe}=ready();probe.start(metadata());ok(probe,0,1000,1010,1020,8);
    probe.begin(.1,1100,1280,720,7);expect(probe.getSnapshot().result).toMatchObject({outcome:'incomplete',reason:'input-frame-counter-reset',summary:null});
  });
  it('isolates a throwing diagnostic observer and its throwing interruption cleanup',()=>{
    const sink={interrupt:()=>{throw new Error('cleanup');}} as unknown as import('../capture/diagnostics').CameraDiagnostics;
    expect(()=>observeCamera(sink,()=>{throw new Error('observer');})).not.toThrow();
    let ordinary=0;observeCamera(undefined,()=>{ordinary++;});expect(ordinary).toBe(0);
  });
  it('publishes stable snapshots rather than per-frame React notifications',()=>{
    const {probe,setTime}=ready();let notified=0;const unsubscribe=probe.subscribe(()=>{notified++;});probe.start(metadata());
    const snapshot=probe.getSnapshot();ok(probe,0,1000,1010,1020);expect(probe.getSnapshot()).toBe(snapshot);expect(notified).toBe(1);
    setTime(2000);probe.stop();expect(notified).toBe(2);unsubscribe();probe.start(metadata());expect(notified).toBe(2);
  });
});
