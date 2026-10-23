import assets from '../../scripts/mediapipe-assets.json';
import packageInfo from '../../package.json';
import { CONTRACT_VERSION } from '../motion/contract';
import type { TakeProvenance } from '../project/types';
import { parseProvenance } from '../project/validation';
import type {CaptureRegion} from '../motion/index';
export const TRACKER_VERSION='1.0.1';
export interface CaptureSettings {
  quality:'fast'|'accurate';skeleton:'full'|'body';smoothing:'low'|'medium'|'high';calibrated:boolean;note?:string;
  region?:CaptureRegion;handsAvailable?:boolean;
}
export function captureProvenance(settings:CaptureSettings):TakeProvenance {
  const poseFile=settings.quality==='fast'?'pose_landmarker_full.task':'pose_landmarker_heavy.task';
  const region=settings.region??'full-body',hands=settings.skeleton==='body'?'off':settings.handsAvailable===false?'unavailable':'available';
  const files=[poseFile,...(hands==='available'?['hand_landmarker.task']:[])];
  return parseProvenance({appVersion:packageInfo.version,contractVersion:CONTRACT_VERSION,trackerVersion:TRACKER_VERSION,
    quality:settings.quality,skeleton:settings.skeleton,smoothing:settings.smoothing,
    processing:{version:'indie-mocap-v1',region,root:region==='upper-body'?'fixed-pelvis':'grounded-in-place',hands},
    calibration:{state:settings.calibrated?'captured':'not-captured',note:settings.note??(settings.calibrated?'T-pose captured for this camera.':'No T-pose was captured.')},
    models:files.map(file=>{const asset=assets.find(a=>a.file===file)!;return {file:asset.file,sha256:asset.sha256};})});
}
