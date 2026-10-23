import {describe,expect,it,vi} from 'vitest';
import {tposeFrame} from '../motion/index';
import {MAX_TAKE_FRAMES} from '../project/types';
import {EMPTY_TAKE_NOTICE,RecorderSession} from './recorderSession';

function recording(times:number[]=[]) {
  const session=new RecorderSession();session.arm();session.begin();
  times.forEach(t=>session.push(tposeFrame(t)));return session;
}
describe('RecorderSession',()=>{
  it('publishes stable summaries without exposing or copying history per push',()=>{
    const session=recording(),notify=vi.fn();session.subscribe(notify);
    const summary=session.getSnapshot();
    session.push(tposeFrame(100));session.push(tposeFrame(101));
    expect(session.getSnapshot()).toBe(summary);expect(notify).not.toHaveBeenCalled();
    expect(summary).not.toHaveProperty('frames');
    session.publish();expect(session.getSnapshot()).toEqual({phase:'recording',frameCount:2,durationSeconds:1});
    expect(notify).toHaveBeenCalledTimes(1);session.publish();expect(notify).toHaveBeenCalledTimes(1);
  });
  it('owns frame arrays and returns immutable snapshots including unpublished frames',()=>{
    const session=recording([100.5]),input=tposeFrame(100.6),prefix=session.snapshotFrames();
    session.push(input);const next=session.snapshotFrames();
    expect(prefix).toHaveLength(1);expect(next.map(f=>f.t)).toEqual([0,expect.closeTo(0.1,9)]);
    expect(input.t).toBe(100.6);expect(next[1].r).not.toBe(input.r);expect(next[1].h).not.toBe(input.h);
    input.r[3]=0;input.h[1]=99;expect(next[1].r[3]).toBe(1);expect(next[1].h[1]).not.toBe(99);
    expect(Object.isFrozen(next)).toBe(true);expect(Object.isFrozen(next[1].r)).toBe(true);
    session.stop();expect(session.getSnapshot()).toMatchObject({phase:'recorded',frames:next});
  });
  it.each([100,99,NaN,Infinity])('keeps the valid prefix on invalid/nonincreasing time %s',t=>{
    const session=recording([100]);session.push(tposeFrame(t));
    expect(session.getSnapshot()).toMatchObject({phase:'recorded',interrupted:true});
    expect(session.snapshotFrames()).toHaveLength(1);
  });
  it('rejects invalid rotations without losing earlier motion',()=>{
    const session=recording([100]),frame=tposeFrame(101);frame.r[0]=NaN;session.push(frame);
    expect(session.getSnapshot()).toMatchObject({phase:'recorded',interrupted:true});
    expect(session.snapshotFrames()).toHaveLength(1);
  });
  it('stops exactly at capacity, synchronously, before a UI publish',()=>{
    const session=recording();session.push(tposeFrame(10),2);session.push(tposeFrame(11),2);
    expect(session.getSnapshot()).toMatchObject({phase:'recorded'});
    expect(session.snapshotFrames().map(f=>f.t)).toEqual([0,1]);
    session.push(tposeFrame(12));expect(session.snapshotFrames()).toHaveLength(2);
  });
  it('keeps a prefix if the remaining capacity shrinks',()=>{
    const session=recording([100,101]);session.push(tposeFrame(102),2);
    expect(session.getSnapshot().phase).toBe('recorded');expect(session.snapshotFrames()).toHaveLength(2);
  });
  it('does not capture when capacity is zero',()=>{
    const session=recording();session.push(tposeFrame(1),0);
    expect(session.getSnapshot()).toMatchObject({phase:'idle',notice:expect.stringMatching(/limit/i)});
    expect(session.snapshotFrames()).toHaveLength(0);
  });
  it.each([280,280.01])('enforces the 180-second boundary at %s',t=>{
    const session=recording([100,200]);session.push(tposeFrame(t));
    expect(session.getSnapshot().phase).toBe('recorded');expect(session.snapshotFrames()).toHaveLength(t===280?3:2);
  });
  it('enforces the absolute frame limit for nonfinite or excessive budgets',()=>{
    for(const capacity of [Infinity,MAX_TAKE_FRAMES+10]) {
      const session=recording();for(let n=0;n<MAX_TAKE_FRAMES;n++)session.push(tposeFrame(n/120),capacity);
      expect(session.getSnapshot().phase).toBe('recorded');expect(session.snapshotFrames()).toHaveLength(MAX_TAKE_FRAMES);
    }
  });
  it('stops empty takes with a notice and clears it when rearming',()=>{
    const session=recording();session.stop();expect(session.getSnapshot()).toEqual({phase:'idle',notice:EMPTY_TAKE_NOTICE});
    session.arm();expect(session.getSnapshot()).toEqual({phase:'countdown'});
  });
  it('ignores out-of-order transitions and pushes outside recording',()=>{
    const session=new RecorderSession(),idle=session.getSnapshot();session.begin();session.stop();session.push(tposeFrame(0));
    expect(session.getSnapshot()).toBe(idle);session.arm();const countdown=session.getSnapshot();
    session.push(tposeFrame(0));session.arm();expect(session.getSnapshot()).toBe(countdown);
    session.begin();session.arm();expect(session.getSnapshot().phase).toBe('recording');
  });
  it('discard from every phase clears history and stale publish/begin cannot resurrect it',()=>{
    for(const phase of ['countdown','recording','recorded']) {
      const session=new RecorderSession();session.arm();if(phase!=='countdown')session.begin();
      if(phase==='recorded'){session.push(tposeFrame(1));session.stop();}
      session.discard();session.publish();session.begin();expect(session.getSnapshot()).toEqual({phase:'idle'});
      expect(session.snapshotFrames()).toEqual([]);
    }
  });
  it('supports subscribe/unsubscribe churn without duplicate notifications',()=>{
    const session=new RecorderSession(),listener=vi.fn(),unsubscribe=session.subscribe(listener);
    unsubscribe();const unsubscribeAgain=session.subscribe(listener);session.arm();expect(listener).toHaveBeenCalledTimes(1);
    unsubscribeAgain();session.begin();session.push(tposeFrame(1));session.publish();expect(listener).toHaveBeenCalledTimes(1);
  });
  it('loads nonempty imported takes only when idle with source video and note',()=>{
    const session=new RecorderSession(),frames=[tposeFrame(0)],video=new Blob(['video']),note={tone:'ok' as const,text:'Calibrated'};
    session.load([],video);expect(session.getSnapshot().phase).toBe('idle');
    session.load(frames,video,note);expect(session.getSnapshot()).toEqual({phase:'recorded',frames,video,note});
    const original=session.getSnapshot();session.load([tposeFrame(1)],video);session.push(tposeFrame(2));expect(session.getSnapshot()).toBe(original);
    const active=recording([1]);active.load(frames,video);expect(active.getSnapshot().phase).toBe('recording');
  });
});
