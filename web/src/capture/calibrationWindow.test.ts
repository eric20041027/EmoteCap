import {describe,expect,it} from 'vitest';
import {CalibrationWindow} from './calibrationWindow';
import {toMediaPipe,tpose} from '../motion/poses.testutil';
import {T_POSE_IMAGE,ARMS_DOWN_IMAGE} from '../import/testPoses';
const sample=(arrivedMs:number)=>({arrivedMs,world:toMediaPipe(tpose()),image:T_POSE_IMAGE,aspect:1});
function stable(window=new CalibrationWindow(),start=0) {
  for(let n=0;n<12;n++)window.observe(sample(start+n*40));return window;
}
describe('CalibrationWindow',()=>{
  it('qualifies upper-body reference without hips or legs while full-body still rejects them',()=>{
    const upper=new CalibrationWindow('upper-body'),full=new CalibrationWindow();
    for(let n=0;n<12;n++) {
      const input=sample(n*40);for(let i=23;i<33;i++){input.world[i]={x:NaN,y:NaN,z:NaN,visibility:0};input.image=input.image.map((p,j)=>j===i?{...p,visibility:0}:p);}
      upper.observe(input);full.observe(input);
    }
    expect(upper.read(450).ok).toBe(true);expect(full.read(450).ok).toBe(false);
  });
  it('qualifies a fresh stable T-pose and owns the chosen sample',()=>{
    const window=stable(),result=window.read(450);expect(result.ok).toBe(true);
    if(result.ok)expect(result.sample.world).toHaveLength(33);
    const input=sample(480);window.observe(input);input.world[11].x=99;
    const next=window.read(490);expect(next.ok).toBe(true);if(next.ok)expect(next.sample.world[11].x).not.toBe(99);
  });
  it('rejects unavailable, stale and insufficient samples',()=>{
    expect(new CalibrationWindow().read(0)).toMatchObject({ok:false});
    expect(stable().read(1000)).toMatchObject({ok:false,reason:expect.stringMatching(/stale|fresh/i)});
    const window=new CalibrationWindow();for(let n=0;n<20;n++)window.observe(sample(n));
    expect(window.read(20)).toMatchObject({ok:false,reason:expect.stringMatching(/hold/i)});
  });
  it('rejects wrong pose and low confidence even after an earlier good window',()=>{
    const window=stable();window.observe({...sample(480),image:ARMS_DOWN_IMAGE});
    expect(window.read(490)).toMatchObject({ok:false,reason:expect.stringMatching(/T-pose/i)});
    const hidden=sample(520);hidden.world[15].visibility=0.1;window.observe(hidden);
    expect(window.read(530)).toMatchObject({ok:false,reason:expect.stringMatching(/visible|confidence/i)});
  });
  it('rejects moving or nonfinite points and requires a new stable window',()=>{
    const window=stable(),moving=sample(480);moving.world[15].x+=0.08;window.observe(moving);
    expect(window.read(490)).toMatchObject({ok:false,reason:expect.stringMatching(/still|steady/i)});
    const invalid=sample(520);invalid.world[15].x=NaN;window.observe(invalid);
    expect(window.read(530).ok).toBe(false);expect(stable(window,560).read(1010).ok).toBe(true);
  });
  it('duplicates, out-of-order and discontinuous arrivals cannot qualify a held pose',()=>{
    const window=stable();window.observe(sample(440));expect(window.read(450).ok).toBe(false);
    window.observe(sample(400));expect(window.read(450).ok).toBe(false);
    expect(stable(window,500).read(950).ok).toBe(true);
    window.observe(sample(2000));expect(window.read(2010)).toMatchObject({ok:false});
  });
  it('invalid arrival times cannot count toward freshness or stability',()=>{
    const window=stable();window.observe(sample(NaN));expect(window.read(450).ok).toBe(false);
    expect(stable().read(NaN).ok).toBe(false);expect(stable().read(400).ok).toBe(false);
  });
  it('bounds storage and reset cannot reuse an old camera reference',()=>{
    const window=new CalibrationWindow();for(let n=0;n<1000;n++)window.observe(sample(n*10));
    expect(window.sampleCount).toBeLessThanOrEqual(60);expect(window.read(10000).ok).toBe(true);
    window.reset();expect(window.sampleCount).toBe(0);expect(window.read(10000).ok).toBe(false);
  });
});
