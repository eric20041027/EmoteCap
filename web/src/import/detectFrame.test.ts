import { expect, it, vi } from 'vitest';
import type { Landmarkers } from '../capture/landmarkers';
import { createFrameDetector } from './detectFrame';
import { ProcessingConsentError } from '../privacy/processingConsent';

function fixture(){
  const pose=vi.fn(()=>({landmarks:[],worldLandmarks:[]}));
  const hand=vi.fn(()=>({landmarks:[],worldLandmarks:[],handedness:[]}));
  const bundle={pose:{detectForVideo:pose},hands:{detectForVideo:hand}} as unknown as Landmarkers;
  return{pose,hand,bundle,video:{videoWidth:1280,videoHeight:720} as HTMLVideoElement};
}
it('denied inference never reaches either SDK detector',()=>{
  const f=fixture(),deny=()=>{throw new ProcessingConsentError('Choice required');};
  const detect=createFrameDetector(f.bundle,true,deny);
  expect(()=>detect(f.video,0)).toThrow(ProcessingConsentError);
  expect(f.pose).not.toHaveBeenCalled();expect(f.hand).not.toHaveBeenCalled();
});
it('withdrawal inside the pose result stops hand inference and delivery',()=>{
  const f=fixture();let allowed=true;
  f.pose.mockImplementation(()=>{allowed=false;return{landmarks:[],worldLandmarks:[]};});
  const guard=()=>{if(!allowed)throw new ProcessingConsentError('Permission withdrawn');};
  const detect=createFrameDetector(f.bundle,true,guard);
  expect(()=>detect(f.video,0)).toThrow(ProcessingConsentError);expect(f.hand).not.toHaveBeenCalled();
});
it('admitted ordinary hand failure still yields body-only detection',()=>{
  const f=fixture();f.hand.mockImplementation(()=>{throw new Error('Hand error');});
  const detect=createFrameDetector(f.bundle,true,()=>{});
  expect(detect(f.video,0)).toMatchObject({hands:{world:{},image:{}}});
  expect(detect(f.video,33)).toMatchObject({hands:{world:{},image:{}}});
  expect(f.hand).toHaveBeenCalledTimes(1);expect(f.pose).toHaveBeenCalledTimes(2);
});

it('opt-in metadata distinguishes active, disabled and persistent hand failure',()=>{
  const f=fixture();const active=createFrameDetector(f.bundle,true,()=>{},true);
  expect(active(f.video,0).handTracking).toBe('active');
  f.hand.mockImplementation(()=>{throw new Error('Owned hand failure');});
  expect(active(f.video,33).handTracking).toBe('failed');expect(active(f.video,66).handTracking).toBe('failed');
  const disabled=createFrameDetector(f.bundle,false,()=>{},true);
  expect(disabled(f.video,99).handTracking).toBe('disabled');
  expect(createFrameDetector(f.bundle,false,()=>{})(f.video,132)).not.toHaveProperty('handTracking');
});
