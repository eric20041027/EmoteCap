import {BODY_BONE_COUNT,DRIVEN_BONES,type DrivenBone} from './contract';
import {fromCanonical,LM,tposeCanonical,type PoseLandmark} from './landmarks';
export type CaptureRegion='full-body'|'upper-body';
export const INACTIVE_UPPER_BODY=new Set<DrivenBone>(['Hips','LeftUpperLeg','LeftLowerLeg','LeftFoot','RightUpperLeg','RightLowerLeg','RightFoot']);
export function activeDrivenBones(region:CaptureRegion,fingers:boolean):readonly DrivenBone[] {
  return DRIVEN_BONES.filter((bone,index)=>(fingers||index<BODY_BONE_COUNT)&&(region==='full-body'||!INACTIVE_UPPER_BODY.has(bone)));
}
const reference=tposeCanonical().map(p=>fromCanonical(p,0));
/** Shoulder line plus canonical upright reference; inferred lower-body coordinates never participate. */
export function upperBodyLandmarks(world:readonly PoseLandmark[]):PoseLandmark[] {
  const points=world.map((p,i)=>i>=LM.leftHip?{...reference[i]}:{...p});
  const left=points[LM.leftShoulder],right=points[LM.rightShoulder];
  const mid={x:(left.x+right.x)/2,y:(left.y+right.y)/2,z:(left.z+right.z)/2};
  const visibility=Math.min(left.visibility??1,right.visibility??1);
  const height=reference[LM.leftHip].y-reference[LM.leftShoulder].y;
  points[LM.leftHip]={x:mid.x+reference[LM.leftHip].x,y:mid.y+height,z:mid.z,visibility};
  points[LM.rightHip]={x:mid.x+reference[LM.rightHip].x,y:mid.y+height,z:mid.z,visibility};
  return points;
}
