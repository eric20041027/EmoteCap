import { beforeEach, describe, expect, it, vi } from 'vitest';
import { closeLandmarkers,createLandmarkers,type Landmarkers } from './landmarkers';
import { ProcessingConsentError } from '../privacy/processingConsent';

const sdk=vi.hoisted(()=>({fileset:vi.fn(),pose:vi.fn(),hand:vi.fn()}));
vi.mock('@mediapipe/tasks-vision',()=>({
  FilesetResolver:{forVisionTasks:sdk.fileset},PoseLandmarker:{createFromOptions:sdk.pose},
  HandLandmarker:{createFromOptions:sdk.hand},
}));
function deferred<T>(){let resolve!:(value:T)=>void;let reject!:(error:unknown)=>void;
  const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
const model=()=>({close:vi.fn()});
const admitted=()=>{};
function permission(){let allowed=true;return{withdraw:()=>{allowed=false;},guard:()=>{
  if(!allowed)throw new ProcessingConsentError('Permission withdrawn');}};}

describe('SDK setup admission and late owned cleanup',()=>{
  beforeEach(()=>{vi.resetAllMocks();sdk.fileset.mockResolvedValue({});sdk.pose.mockResolvedValue(model());sdk.hand.mockResolvedValue(model());});
  it('does not even resolve WASM without admission',async()=>{
    const deny=()=>{throw new ProcessingConsentError('Choice required');};
    await expect(createLandmarkers('fast',deny)).rejects.toBeInstanceOf(ProcessingConsentError);
    expect(sdk.fileset).not.toHaveBeenCalled();expect(sdk.pose).not.toHaveBeenCalled();expect(sdk.hand).not.toHaveBeenCalled();
  });
  it('withdrawal during fileset resolution prevents pose or hand setup',async()=>{
    const pending=deferred<object>(),p=permission();sdk.fileset.mockReturnValue(pending.promise);
    const creation=createLandmarkers('fast',p.guard);const failure=expect(creation).rejects.toBeInstanceOf(ProcessingConsentError);
    p.withdraw();pending.resolve({});await failure;
    expect(sdk.pose).not.toHaveBeenCalled();expect(sdk.hand).not.toHaveBeenCalled();
  });
  it('late pose closes once without starting a hand model',async()=>{
    const pending=deferred<ReturnType<typeof model>>(),pose=model(),p=permission();sdk.pose.mockReturnValue(pending.promise);
    const creation=createLandmarkers('fast',p.guard);const failure=expect(creation).rejects.toBeInstanceOf(ProcessingConsentError);
    await vi.waitFor(()=>expect(sdk.pose).toHaveBeenCalledTimes(1));p.withdraw();pending.resolve(pose);await failure;
    expect(pose.close).toHaveBeenCalledTimes(1);expect(sdk.hand).not.toHaveBeenCalled();
  });
  it('withdrawn failed GPU setup never retries the CPU',async()=>{
    const pending=deferred<ReturnType<typeof model>>(),p=permission();sdk.pose.mockReturnValueOnce(pending.promise);
    const creation=createLandmarkers('fast',p.guard);const failure=expect(creation).rejects.toBeInstanceOf(ProcessingConsentError);
    await vi.waitFor(()=>expect(sdk.pose).toHaveBeenCalledTimes(1));p.withdraw();pending.reject(new Error('GPU unavailable'));await failure;
    expect(sdk.pose).toHaveBeenCalledTimes(1);expect(sdk.hand).not.toHaveBeenCalled();
  });
  it('late hand rejection closes both owned returned models',async()=>{
    const pending=deferred<ReturnType<typeof model>>(),pose=model(),hand=model(),p=permission();
    sdk.pose.mockResolvedValue(pose);sdk.hand.mockReturnValue(pending.promise);
    const creation=createLandmarkers('fast',p.guard);const failure=expect(creation).rejects.toBeInstanceOf(ProcessingConsentError);
    await vi.waitFor(()=>expect(sdk.hand).toHaveBeenCalledTimes(1));p.withdraw();pending.resolve(hand);await failure;
    expect(pose.close).toHaveBeenCalledTimes(1);expect(hand.close).toHaveBeenCalledTimes(1);
  });
  it('withdrawn hand GPU failure cannot become CPU retry or body-only success',async()=>{
    const pending=deferred<ReturnType<typeof model>>(),pose=model(),p=permission();
    sdk.pose.mockResolvedValue(pose);sdk.hand.mockReturnValueOnce(pending.promise);
    const creation=createLandmarkers('fast',p.guard);const failure=expect(creation).rejects.toBeInstanceOf(ProcessingConsentError);
    await vi.waitFor(()=>expect(sdk.hand).toHaveBeenCalledTimes(1));p.withdraw();pending.reject(new Error('Hand GPU unavailable'));await failure;
    expect(sdk.hand).toHaveBeenCalledTimes(1);expect(pose.close).toHaveBeenCalledTimes(1);
  });
  it('admitted ordinary GPU failure still falls back to CPU',async()=>{
    const pose=model();sdk.pose.mockRejectedValueOnce(new Error('GPU unavailable')).mockResolvedValueOnce(pose);
    const result=await createLandmarkers('accurate',admitted);expect(result.pose).toBe(pose);
    expect(sdk.pose.mock.calls.map(call=>call[1].baseOptions.delegate)).toEqual(['GPU','CPU']);
    expect(pose.close).not.toHaveBeenCalled();
  });
  it('admitted ordinary hand failure preserves body-only capture',async()=>{
    const pose=model();sdk.pose.mockResolvedValue(pose);sdk.hand.mockRejectedValue(new Error('No hands'));
    const result=await createLandmarkers('fast',admitted);expect(result).toEqual({pose,hands:undefined});
    expect(sdk.hand).toHaveBeenCalledTimes(2);expect(pose.close).not.toHaveBeenCalled();
  });
});

describe('opt-in actual pose delegate metadata',()=>{
  beforeEach(()=>{vi.resetAllMocks();sdk.fileset.mockResolvedValue({});sdk.pose.mockResolvedValue(model());sdk.hand.mockResolvedValue(model());});
  it('reports successful GPU only when requested',async()=>{
    expect((await createLandmarkers('accurate',admitted,{reportDelegate:true})).poseDelegate).toBe('GPU');
    expect(await createLandmarkers('accurate',admitted)).not.toHaveProperty('poseDelegate');
  });
  it('reports actual CPU fallback rather than requested GPU',async()=>{
    sdk.pose.mockRejectedValueOnce(new Error('Owned GPU failure')).mockResolvedValueOnce(model());
    expect((await createLandmarkers('accurate',admitted,{reportDelegate:true})).poseDelegate).toBe('CPU');
  });
  it('reports independently configured hand CPU fallback',async()=>{
    sdk.hand.mockRejectedValueOnce(new Error('Owned hand GPU failure')).mockResolvedValueOnce(model());
    expect(await createLandmarkers('accurate',admitted,{reportDelegate:true})).toMatchObject({poseDelegate:'GPU',handDelegate:'CPU'});
  });
  it('still closes owned hands if owned pose cleanup throws',()=>{
    const pose={close:vi.fn(()=>{throw new Error('Owned pose close failure');})},hands=model();
    expect(()=>closeLandmarkers({pose,hands} as unknown as Landmarkers)).toThrow('Owned pose close failure');
    expect(hands.close).toHaveBeenCalledTimes(1);
  });
});
