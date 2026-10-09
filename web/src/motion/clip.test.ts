import { describe, expect, it } from 'vitest';
import { makeClip } from './clip';
import { H0, identityRotations, type MotionFrame } from './contract';
import { quatDot, quatFromAxisAngle } from './math';

const DEG = Math.PI / 180;

function frameAt(t: number, rightUpperArm: [number, number, number, number] = [0, 0, 0, 1], hipsY = H0): MotionFrame {
  const r = identityRotations();
  r.splice(9 * 4, 4, ...rightUpperArm); // RightUpperArm is driven index 9
  return { t, h: [0, hipsY, 0], r };
}

describe('makeClip', () => {
  it('keeps subframe trim boundaries instead of collapsing a clip to its interior samples', () => {
    const original=[frameAt(0),frameAt(0.5),frameAt(1)];
    const clip=makeClip(original,{start:0.2,end:0.8,name:'Precise',loop:false});
    expect(clip.frames).toHaveLength(19);expect(clip.frames.at(-1)!.t).toBeCloseTo(0.6,4);
    expect(original.map(f=>f.t)).toEqual([0,0.5,1]);
  });
  it('resamples irregular frames to exact fps starting at t = 0', () => {
    const frames = [0, 0.03, 0.07, 0.1, 0.135, 0.17, 0.2].map((t) => frameAt(t + 5));
    const clip = makeClip(frames, { start: 5, end: 5.2, name: 'Wave', loop: false });
    expect(clip.fps).toBe(30);
    expect(clip.frames.map((f) => f.t)).toEqual([0, 0.0333, 0.0667, 0.1, 0.1333, 0.1667, 0.2]);
  });

  it('slerps rotations and lerps hips height between samples', () => {
    const frames = [frameAt(0, [0, 0, 0, 1], 0.9), frameAt(2 / 30, quatFromAxisAngle([0, 0, 1], 90 * DEG) as [number, number, number, number], 1.0)];
    const clip = makeClip(frames, { start: 0, end: 1, name: 'Mid', loop: false });
    const middle = clip.frames[1];
    const q = middle.r.slice(9 * 4, 9 * 4 + 4) as [number, number, number, number];
    expect(Math.abs(quatDot(q, quatFromAxisAngle([0, 0, 1], 45 * DEG)))).toBeCloseTo(1, 4);
    expect(middle.h[1]).toBeCloseTo(0.95, 5);
  });

  it('keeps the loop flag and name', () => {
    const clip = makeClip([frameAt(0), frameAt(0.5)], { start: 0, end: 1, name: 'Idle_Loop', loop: true });
    expect(clip.name).toBe('Idle_Loop');
    expect(clip.loop).toBe(true);
  });

  it('rejects invalid names and empty ranges', () => {
    expect(() => makeClip([frameAt(0)], { start: 0, end: 1, name: 'bad name', loop: false })).toThrow(/Invalid clip name/);
    expect(() => makeClip([frameAt(0)], { start: 2, end: 3, name: 'Empty', loop: false })).toThrow(/No frames/);
  });
});

describe('makeClip smoothing', () => {
  const noisy = (i: number) => frameAt(i / 30, quatFromAxisAngle([0, 0, 1], (45 + (i % 2 ? 6 : -6)) * DEG) as [number, number, number, number]);

  it('smooths frame-to-frame jitter without shifting the pose', () => {
    const frames = Array.from({ length: 30 }, (_, i) => noisy(i));
    const raw = makeClip(frames, { start: 0, end: 1, name: 'Raw', loop: false, smooth: false });
    const smoothed = makeClip(frames, { start: 0, end: 1, name: 'Smooth', loop: false });
    const target = quatFromAxisAngle([0, 0, 1], 45 * DEG);
    const error = (clip: typeof raw) => {
      const mids = clip.frames.slice(5, 25);
      return mids.reduce((sum, f) => sum + (1 - Math.abs(quatDot(f.r.slice(36, 40) as [number, number, number, number], target))), 0) / mids.length;
    };
    expect(error(smoothed)).toBeLessThan(error(raw) * 0.3);
  });

  it('leaves a steady pose exactly as it is', () => {
    const steady = quatFromAxisAngle([0, 0, 1], 30 * DEG) as [number, number, number, number];
    const clip = makeClip(Array.from({ length: 10 }, (_, i) => frameAt(i / 30, steady)), { start: 0, end: 1, name: 'Steady', loop: false });
    for (const frame of clip.frames) expect(Math.abs(quatDot(frame.r.slice(36, 40) as [number, number, number, number], steady))).toBeCloseTo(1, 6);
  });
});
