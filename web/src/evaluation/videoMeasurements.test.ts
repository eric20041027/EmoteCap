import {beforeEach,describe,expect,it,vi} from 'vitest';
import {ProcessingConsent} from '../privacy/processingConsent';
import {tposeFrame} from '../motion/index';
import {collectVideoMeasurements,MAX_DIAGNOSTIC_BYTES,type VideoCollection} from './videoMeasurements';
import {convertVideo,ImportError,type ConvertSteps} from '../import/convertVideo';
import {ORIGINAL_COMMIT,ORIGINAL_INDEX_SHA256} from './originalRunner';

function projected(output:VideoCollection){
  if(output.packet===null)throw new Error('Expected a comparable measurement packet');
  return output.packet;
}

const deps=vi.hoisted(()=>({open:vi.fn(),seek:vi.fn(),closeVideo:vi.fn(),create:vi.fn(),closeModels:vi.fn(),solver:vi.fn(),loadOriginal:vi.fn(),oldConvert:vi.fn(),oldSolver:vi.fn()}));
vi.mock('../import/videoSource',()=>({openVideoFile:deps.open,seekTo:deps.seek,closeVideoFile:deps.closeVideo}));
vi.mock('../capture/landmarkers',()=>({createLandmarkers:deps.create,closeLandmarkers:deps.closeModels}));
vi.mock('../motion/index',async original=>({...await original<object>(),createPoseSolver:deps.solver}));
vi.mock('./originalRunner',async original=>({...await original<object>(),loadOriginalRunner:deps.loadOriginal}));
function pending<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(yes=>{resolve=yes;});return{promise,resolve};}
function options(){
  const processingConsent=new ProcessingConsent();processingConsent.setAllowed(true);
  return{file:new File([new Uint8Array([1,2,3])],'owned.mp4',{type:'video/mp4'}),
    video:{src:'',srcObject:null,videoWidth:1280,videoHeight:720} as HTMLVideoElement,
    sourceCommit:'a'.repeat(40),environment:{kind:'desktop' as const,os:'Windows 11',cpu:'Owned CPU',gpu:'Owned GPU',browser:'Edge 154'},
    classification:'synthetic' as const,skeleton:'full' as const,smoothing:'medium' as const,warmupMs:0,
    localProcessingAuthorized:true,processingConsent};
}
function bundle(){return{poseDelegate:'CPU',handDelegate:'CPU',
  pose:{detectForVideo:vi.fn((_:unknown,ms:number)=>Math.round(ms)===33?{landmarks:[],worldLandmarks:[]}:
    {landmarks:[[{x:0,y:0,z:0,visibility:1}]],worldLandmarks:[[{x:0,y:0,z:0,visibility:1}]]})},
  hands:{detectForVideo:vi.fn(()=>({landmarks:[],worldLandmarks:[],handedness:[]}))}};}

describe('owned video measurement collection',()=>{
  beforeEach(()=>{
    vi.restoreAllMocks();vi.resetAllMocks();deps.open.mockResolvedValue(.1);
    deps.seek.mockImplementation(async()=>{await new Promise(resolve=>setTimeout(resolve,2));});
    deps.create.mockResolvedValue(bundle());deps.solver.mockImplementation(()=>({
      solve:(world:unknown,t:number)=>world?tposeFrame(t):null,calibrate:()=>{},relaxFingers:()=>{},setSmoothing:()=>{},reset:()=>{},
    }));
    deps.oldConvert.mockImplementation((duration:number,input:ConvertSteps)=>convertVideo(duration,{...input,onAttempt:undefined,now:undefined}));
    deps.oldSolver.mockImplementation(()=>({solve:(world:unknown,t:number)=>world?{...tposeFrame(t),h:[0,1.5,0]}:null,
      calibrate:()=>{},relaxFingers:()=>{},setSmoothing:()=>{},reset:()=>{}}));
    deps.loadOriginal.mockResolvedValue({convertVideo:deps.oldConvert,createPoseSolver:deps.oldSolver,ImportError,NO_PERSON_MESSAGE:'No person found in this video. Use a clip where one whole body is visible.',
      compiledSource:{sourceCommit:ORIGINAL_COMMIT,sourceIndexSha256:ORIGINAL_INDEX_SHA256},
      provenance:{buildId:'a'.repeat(64),manifest:{sourceCommit:ORIGINAL_COMMIT,sourceIndexSha256:ORIGINAL_INDEX_SHA256}}});
  });
  it('hashes the actual selected bytes and retains failures separately from final motion',async()=>{
    const input=options(),output=await collectVideoMeasurements(input);
    const expected=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await input.file.arrayBuffer())),v=>v.toString(16).padStart(2,'0')).join('');
    expect(output.outcome).toBe('completed');expect(projected(output).inputSha256).toBe(expected);
    expect(projected(output).samples.map(sample=>sample.status)).toEqual(['ok','no-pose','ok']);
    expect(output.finalFrames.map((frame:any)=>frame.t)).toEqual([0,2/30]);
    expect(projected(output).settings).toMatchObject({delegate:'CPU',quality:'accurate',width:1280,height:720,handPolicy:'every-frame'});
    expect(JSON.stringify(output)).not.toContain('owned.mp4');expect(output.qualification).toBe('pending');
    expect(deps.closeModels).toHaveBeenCalledTimes(1);expect(deps.closeVideo).toHaveBeenCalledTimes(1);
  });
  it('default denial and absent local authority never load video or SDK',async()=>{
    const denied=options();denied.processingConsent.setAllowed(false);
    await expect(collectVideoMeasurements(denied)).rejects.toThrow();
    await expect(collectVideoMeasurements({...options(),localProcessingAuthorized:false})).rejects.toThrow();
    expect(deps.open).not.toHaveBeenCalled();expect(deps.create).not.toHaveBeenCalled();expect(deps.closeVideo).not.toHaveBeenCalled();
  });
  it('withdrawal during File hashing prevents media and models',async()=>{
    const input=options(),hash=pending<ArrayBuffer>(),reading=vi.spyOn(input.file,'arrayBuffer').mockReturnValue(hash.promise);
    const running=collectVideoMeasurements(input);expect(reading).toHaveBeenCalledTimes(1);
    input.processingConsent.setAllowed(false);hash.resolve(new ArrayBuffer(3));
    const output=await running;expect(output.outcome).toBe('incomplete');expect(output.packet).toBeNull();
    expect(deps.open).not.toHaveBeenCalled();expect(deps.create).not.toHaveBeenCalled();
  });
  it('cancellation closes a late owned model without running inference',async()=>{
    const input=options(),creation=pending<ReturnType<typeof bundle>>(),models=bundle(),controller=new AbortController();
    deps.create.mockReturnValue(creation.promise);const running=collectVideoMeasurements({...input,signal:controller.signal});
    await vi.waitFor(()=>expect(deps.create).toHaveBeenCalledTimes(1));controller.abort();creation.resolve(models);
    const output=await running;expect(output.packet).toBeNull();expect(output.outcome).toBe('incomplete');
    expect(models.pose.detectForVideo).not.toHaveBeenCalled();expect(deps.closeModels).toHaveBeenCalledWith(models);
    expect(deps.closeModels).toHaveBeenCalledTimes(1);
  });
  it('retains the fatal tenth attempt but never projects an incomplete conversion',async()=>{
    deps.open.mockResolvedValue(1);const models=bundle();models.pose.detectForVideo.mockImplementation(()=>{throw new Error('Owned pose failure');});deps.create.mockResolvedValue(models);
    const output=await collectVideoMeasurements(options());expect(output.outcome).toBe('incomplete');
    expect(output.attempts).toHaveLength(10);expect(output.attempts.every((item:any)=>item.status==='detector-error')).toBe(true);expect(output.packet).toBeNull();
  });
  it('all-no-person completion retains a valid all-failed packet and empty final motion',async()=>{
    const models=bundle();models.pose.detectForVideo.mockReturnValue({landmarks:[],worldLandmarks:[]});deps.create.mockResolvedValue(models);
    const output=await collectVideoMeasurements(options());expect(output.outcome).toBe('no-person');
    expect(projected(output).samples).toHaveLength(3);expect(projected(output).samples.every(item=>item.status==='no-pose')).toBe(true);
    expect(output.finalFrames).toEqual([]);
  });
  it('hand downgrade is retained and cannot produce a uniform-policy packet',async()=>{
    const models=bundle();models.hands.detectForVideo.mockImplementation(()=>{throw new Error('Owned hand failure');});deps.create.mockResolvedValue(models);
    const output=await collectVideoMeasurements(options());expect(output.attempts[0].handTracking).toBe('failed');
    expect(output.packet).toBeNull();expect(output.reason).toBe('hand-policy-changed');expect(output.finalFrames).not.toHaveLength(0);
  });
  it('body-only mode remains a complete explicit hand-off measurement',async()=>{
    const input=options(),output=await collectVideoMeasurements({...input,skeleton:'body'});
    expect(projected(output).settings.handPolicy).toBe('off');expect(projected(output).settings.skeleton).toBe('body');
  });
  it('refuses occupied video, oversized sources and private/missing metadata before effects',async()=>{
    const input=options();input.video.src='blob:foreign';await expect(collectVideoMeasurements(input)).rejects.toThrow();
    const oversized=options();Object.defineProperty(oversized.file,'size',{value:100*1024*1024+1});
    await expect(collectVideoMeasurements(oversized)).rejects.toThrow();
    await expect(collectVideoMeasurements({...options(),sourceCommit:'short'})).rejects.toThrow();
    const privateMeta=options();privateMeta.environment.cpu='C:\\owned\\path';await expect(collectVideoMeasurements(privateMeta)).rejects.toThrow();
    expect(deps.create).not.toHaveBeenCalled();expect(deps.open).not.toHaveBeenCalled();
  });
  it('unknown delegate and exhausted warmup preserve raw output without a packet',async()=>{
    const unknown=bundle();delete (unknown as {poseDelegate?:string}).poseDelegate;deps.create.mockResolvedValue(unknown);
    const first=await collectVideoMeasurements(options());expect(first.packet).toBeNull();expect(first.reason).toBe('delegate-unavailable');
    deps.create.mockResolvedValue(bundle());const second=await collectVideoMeasurements({...options(),warmupMs:1000});
    expect(second.packet).toBeNull();expect(second.reason).toBe('warmup-exhausted-window');expect(second.attempts).toHaveLength(3);
  });
  it('pins source, owned video and metadata before asynchronous hashing',async()=>{
    const input=options(),selected=input.file,ownedVideo=input.video,hash=pending<ArrayBuffer>();
    vi.spyOn(selected,'arrayBuffer').mockReturnValue(hash.promise);const running=collectVideoMeasurements(input);
    input.file=new File([new Uint8Array([8,9,10])],'replacement.mp4',{type:'video/mp4'});
    input.video={src:'',srcObject:null,videoWidth:640,videoHeight:480} as HTMLVideoElement;
    input.environment.cpu='Changed CPU';input.sourceCommit='b'.repeat(40);
    hash.resolve(new Uint8Array([1,2,3]).buffer);const output=await running;
    expect(deps.open.mock.calls[0][0]).toBe(selected);expect(deps.open.mock.calls[0][1]).toBe(ownedVideo);
    expect(deps.closeVideo).toHaveBeenCalledWith(ownedVideo);
    expect(projected(output).sourceCommit).toBe('a'.repeat(40));expect(projected(output).environment.cpu).toBe('Owned CPU');
  });
  it('refuses extra environment data before media effects',async()=>{
    const input=options(),environment={...input.environment,privatePath:'C:\\owned\\private'};
    await expect(collectVideoMeasurements({...input,environment})).rejects.toThrow();
    expect(deps.open).not.toHaveBeenCalled();expect(deps.create).not.toHaveBeenCalled();
  });
  it('rejects a final clock rollback that would invalidate packet time bounds',async()=>{
    let clock=0,final=false,solvers=0;vi.spyOn(performance,'now').mockImplementation(()=>final?5:++clock);
    deps.solver.mockImplementation(()=>{const index=++solvers;return{solve:(world:unknown,t:number)=>{
      if(index===2)final=true;return world?tposeFrame(t):null;
    },calibrate:()=>{},relaxFingers:()=>{},setSmoothing:()=>{},reset:()=>{}};});
    const output=await collectVideoMeasurements(options());expect(output.packet).toBeNull();
    expect(output.reason).toBe('invalid-observation');expect(output.finalFrames).toHaveLength(2);
  });
  it('retains bounded partial data and stops only its own diagnostic job at the budget',async()=>{
    deps.open.mockResolvedValue(180);deps.seek.mockResolvedValue(undefined);
    const rotations=Array.from({length:48},()=>[.18257418583505536,.3651483716701107,.5477225575051661,.7302967433402214]).flat();
    deps.solver.mockImplementation(()=>({solve:(world:unknown,t:number)=>world?{...tposeFrame(t),r:rotations}:null,
      calibrate:()=>{},relaxFingers:()=>{},setSmoothing:()=>{},reset:()=>{}}));
    const output=await collectVideoMeasurements(options());expect(output.outcome).toBe('incomplete');
    expect(output.reason).toBe('diagnostics-limit');expect(output.packet).toBeNull();
    expect(output.attempts.length).toBeGreaterThan(0);expect(output.attempts.length).toBeLessThan(5400);
    expect(new TextEncoder().encode(JSON.stringify(output)).byteLength).toBeLessThanOrEqual(MAX_DIAGNOSTIC_BYTES);
    expect(deps.closeVideo).toHaveBeenCalledTimes(1);
  },20000);
  it('preserves collected data even if owned model cleanup fails',async()=>{
    deps.closeModels.mockImplementation(()=>{throw new Error('Owned cleanup error');});
    const output=await collectVideoMeasurements(options());expect(output.outcome).toBe('incomplete');
    expect(output.reason).toBe('cleanup-failed');expect(output.attempts).toHaveLength(3);
    expect(output.finalFrames).toHaveLength(2);expect(output.packet).toBeNull();expect(deps.closeVideo).toHaveBeenCalledTimes(1);
  });
  it('retains mixed or unknown hand delegates without a misleading single-delegate packet',async()=>{
    const mixed=bundle();mixed.poseDelegate='GPU';deps.create.mockResolvedValue(mixed);
    const first=await collectVideoMeasurements(options());expect(first.metadata.handDelegate).toBe('CPU');
    expect(first.packet).toBeNull();expect(first.reason).toBe('mixed-model-delegates');
    const unknown=bundle();delete (unknown as {handDelegate?:string}).handDelegate;deps.create.mockResolvedValue(unknown);
    const second=await collectVideoMeasurements(options());expect(second.packet).toBeNull();expect(second.reason).toBe('hand-delegate-unavailable');
  });
  it('failed media setup leaves conversion timing unavailable',async()=>{
    deps.open.mockRejectedValue(new Error('Owned video-read failure'));
    const output=await collectVideoMeasurements(options());expect(output.outcome).toBe('incomplete');
    expect(output.metadata.startedMs).toBeNull();expect(output.metadata.finishedMs).toBeNull();
    expect(output.metadata.conversionElapsedMs).toBeNull();
  });
  it('selects the loaded original converter and original solver with source/build provenance',async()=>{
    const input={...options(),sourceCommit:ORIGINAL_COMMIT,implementation:'original' as const,originalBuildId:'a'.repeat(64)};
    const output=await collectVideoMeasurements(input);
    expect(output.outcome).toBe('completed');expect(deps.loadOriginal).toHaveBeenCalledTimes(1);expect(deps.oldConvert).toHaveBeenCalledTimes(1);
    expect(deps.oldSolver).toHaveBeenCalledTimes(2);expect(deps.solver).not.toHaveBeenCalled();
    expect(output.finalFrames.every(frame=>frame.h[1]===1.5)).toBe(true);expect(projected(output).sourceCommit).toBe(ORIGINAL_COMMIT);
    expect(output.metadata).toMatchObject({implementation:'original',originalRunner:{buildId:'a'.repeat(64),manifest:{sourceIndexSha256:ORIGINAL_INDEX_SHA256}}});
    expect(output.metadata.originalAdapterSha256).toMatch(/^[0-9a-f]{64}$/);
  });
  it('wrong original source, missing build and unknown implementation reject before effects',async()=>{
    await expect(collectVideoMeasurements({...options(),implementation:'original',originalBuildId:'a'.repeat(64)} as any)).rejects.toThrow();
    await expect(collectVideoMeasurements({...options(),sourceCommit:ORIGINAL_COMMIT,implementation:'original'} as any)).rejects.toThrow();
    await expect(collectVideoMeasurements({...options(),implementation:'other'} as any)).rejects.toThrow();
    expect(deps.open).not.toHaveBeenCalled();expect(deps.loadOriginal).not.toHaveBeenCalled();expect(deps.create).not.toHaveBeenCalled();
  });
  it('pins implementation and build ID before asynchronous source hashing',async()=>{
    const input={...options(),sourceCommit:ORIGINAL_COMMIT,implementation:'original' as 'original'|'current',originalBuildId:'a'.repeat(64)};
    const hash=pending<ArrayBuffer>();vi.spyOn(input.file,'arrayBuffer').mockReturnValue(hash.promise);const running=collectVideoMeasurements(input);
    input.implementation='current';input.originalBuildId='b'.repeat(64);hash.resolve(new Uint8Array([1,2,3]).buffer);
    const output=await running;expect(deps.loadOriginal.mock.calls[0][0]).toBe('a'.repeat(64));expect(deps.oldConvert).toHaveBeenCalledTimes(1);
    expect(output.metadata.implementation).toBe('original');
  });
  it('original load failure retains explicit partial diagnostics without opening video or models',async()=>{
    deps.loadOriginal.mockRejectedValue(new Error('Owned original load failure'));
    const output=await collectVideoMeasurements({...options(),sourceCommit:ORIGINAL_COMMIT,implementation:'original',originalBuildId:'a'.repeat(64)} as any);
    expect(output.outcome).toBe('incomplete');expect(output.reason).toBe('original-runner-unavailable');expect(output.packet).toBeNull();
    expect(output.metadata.startedMs).toBeNull();expect(deps.open).not.toHaveBeenCalled();expect(deps.create).not.toHaveBeenCalled();
  });
  it('withdrawal during late original loading prevents video/model setup and inference',async()=>{
    const input={...options(),sourceCommit:ORIGINAL_COMMIT,implementation:'original' as const,originalBuildId:'a'.repeat(64)};
    const loaded=pending<unknown>();deps.loadOriginal.mockReturnValue(loaded.promise);const running=collectVideoMeasurements(input);
    await vi.waitFor(()=>expect(deps.loadOriginal).toHaveBeenCalledTimes(1));input.processingConsent.setAllowed(false);loaded.resolve({});
    const output=await running;expect(output.outcome).toBe('incomplete');expect(output.packet).toBeNull();expect(deps.create).not.toHaveBeenCalled();expect(deps.open).not.toHaveBeenCalled();
  });
});
