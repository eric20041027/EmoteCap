import {describe,expect,it} from 'vitest';
import {activeDrivenBones,upperBodyLandmarks} from './captureProfile';
import {createPoseSolver,H0,BONE_INDEX,type Quat} from './index';
import {toMediaPipe,tpose,rotatePoints,DEG} from './poses.testutil';
import {quatDot,quatFromAxisAngle} from './math';
import {parseFrames} from '../project/validation';
describe('capture regions',()=>{
  it.each(['low','medium','high'] as const)('keeps never observed children neutral after %s smoothing',smoothing=>{
    const solver=createPoseSolver({},smoothing,'upper-body'),neutral=tpose();
    const yaw=quatFromAxisAngle([0,1,0],90*DEG);
    for(let i=0;i<30;i++) {
      const world=toMediaPipe(i===0?neutral:rotatePoints(neutral,[...neutral.keys()],[0,0,0],yaw));
      for(const index of [13,15,17,19,21])world[index].visibility=0;
      const frame=solver.solve(world,i/30)!;
      const rotation=(bone:keyof typeof BONE_INDEX)=>frame.r.slice(BONE_INDEX[bone]*4,BONE_INDEX[bone]*4+4) as Quat;
      for(const [parent,child] of [['UpperChest','LeftUpperArm'],['LeftUpperArm','LeftLowerArm'],['LeftLowerArm','LeftHand'],['LeftHand','LeftThumbProximal'],['LeftThumbProximal','LeftThumbIntermediate']] as const)
        expect(Math.abs(quatDot(rotation(parent),rotation(child)))).toBeCloseTo(1,6);
    }
  });
  it('derives active counts from the unchanged driven bone set',()=>{
    expect(activeDrivenBones('full-body',true)).toHaveLength(48);expect(activeDrivenBones('full-body',false)).toHaveLength(18);
    expect(activeDrivenBones('upper-body',true)).toHaveLength(41);expect(activeDrivenBones('upper-body',false)).toHaveLength(11);
  });
  it('does not require inferred lower landmarks for upper-body calibration and solve',()=>{
    const world=toMediaPipe(tpose());for(let i=23;i<33;i++)world[i]={x:NaN,y:Infinity,z:0,visibility:0};
    const prepared=upperBodyLandmarks(world);expect(prepared.every(p=>[p.x,p.y,p.z].every(Number.isFinite))).toBe(true);
    expect(world[23].x).toBeNaN();
    const solver=createPoseSolver({},'low','upper-body');expect(()=>solver.calibrate(world)).not.toThrow();
    const frame=solver.solve(world,0)!;expect(frame.h).toEqual([0,H0,0]);expect(frame.r).toHaveLength(192);
    expect(()=>parseFrames([frame])).not.toThrow();
  });
  it('keeps pelvis and legs neutral even when all noisy lower observations are visible',()=>{
    const p=tpose(),turned=rotatePoints(p,[...p.keys()],[0,0,0],quatFromAxisAngle([0,1,0],45*DEG));
    turned[25][2]+=0.5;turned[27][1]+=0.6;
    const solver=createPoseSolver({},'low','upper-body'),frame=solver.solve(toMediaPipe(turned),1)!;
    expect(frame.h).toEqual([0,H0,0]);
    for(const bone of ['Hips','LeftUpperLeg','LeftLowerLeg','LeftFoot','RightUpperLeg','RightLowerLeg','RightFoot'] as const)
      expect(frame.r.slice(BONE_INDEX[bone]*4,BONE_INDEX[bone]*4+4)).toEqual([0,0,0,1]);
    expect(Math.abs(frame.r[BONE_INDEX.Chest*4+1])).toBeGreaterThan(0.1);
  });
});
