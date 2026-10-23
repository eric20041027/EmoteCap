import {describe,expect,it} from 'vitest';
import {TrackingContinuity} from './trackingContinuity';
import {DRIVEN_BONES,type Quat} from './contract';
import {quatFromAxisAngle,quatMultiply,quatDot,quatSlerp,IDENTITY} from './math';
import type {Rotations} from './solver';
const rest=()=>Object.fromEntries(DRIVEN_BONES.map(b=>[b,[0,0,0,1]])) as Rotations;
const all=()=>Object.fromEntries(DRIVEN_BONES.map(b=>[b,true]));
const expectQ=(actual:Quat,expected:Quat)=>expect(Math.abs(quatDot(actual,expected))).toBeCloseTo(1,5);
describe('parent-relative tracking continuity',()=>{
  it('charges only time after the hold interval when a frame crosses its boundary',()=>{
    const policy=new TrackingContinuity(),raw=rest();raw.Head=quatFromAxisAngle([1,0,0],0.8);
    policy.apply(raw,all(),0);
    expectQ(policy.apply(rest(),{...all(),Head:false},0.5).Head,quatSlerp(raw.Head,IDENTITY,1-Math.exp(-0.1/0.25)));
  });
  it('preserves every observed rotation',()=>{
    const raw=rest();raw.Head=quatFromAxisAngle([1,0,0],0.5);
    expect(new TrackingContinuity().apply(raw,all(),0)).toEqual(raw);
  });
  it('holds the local head pose briefly and then relaxes to the moving parent',()=>{
    const policy=new TrackingContinuity(),first=rest(),pitch=quatFromAxisAngle([1,0,0],0.5);first.Head=pitch;
    policy.apply(first,all(),0);const next=rest(),yaw=quatFromAxisAngle([0,1,0],0.7);next.Neck=yaw;
    const tracked={...all(),Head:false};
    expectQ(policy.apply(next,tracked,0.2).Head,quatMultiply(yaw,pitch));
    const relaxed=policy.apply(next,tracked,2);expectQ(relaxed.Head,yaw);
  });
  it('a never observed child follows its parent and fingers follow the fallback hand',()=>{
    const policy=new TrackingContinuity(),raw=rest(),yaw=quatFromAxisAngle([0,1,0],0.7),curl=quatFromAxisAngle([0,0,1],0.4);
    raw.LeftLowerArm=yaw;raw.LeftIndexProximal=curl;
    const output=policy.apply(raw,{...all(),LeftHand:false},0);
    expectQ(output.LeftHand,yaw);expectQ(output.LeftIndexProximal,quatMultiply(yaw,curl));
  });
});
