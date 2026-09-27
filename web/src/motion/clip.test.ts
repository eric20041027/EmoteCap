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
