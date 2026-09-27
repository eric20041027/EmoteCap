import { describe, expect, it } from 'vitest';
import { H0, identityRotations, type MotionFrame, type Segment } from './contract';
import { quatFromAxisAngle } from './math';
import { fallbackSegments, motionEnergy, refineSegments } from './segments';

const FPS = 30;
const RIGHT_UPPER_ARM = 9;

/** Right arm spins at 1 rad/s while `moving(t)` is true, otherwise holds still. */
function take(seconds: number, moving: (t: number) => boolean): MotionFrame[] {
  const frames: MotionFrame[] = [];
  let angle = 0;
  for (let i = 0; i <= seconds * FPS; i++) {
    const t = i / FPS;
    if (i > 0 && moving(t)) angle += 1 / FPS;
    const r = identityRotations();
    r.splice(RIGHT_UPPER_ARM * 4, 4, ...quatFromAxisAngle([0, 0, 1], angle));
    frames.push({ t, h: [0, H0, 0], r });
  }
  return frames;
}

const moveStillMove = (t: number) => t < 2 || t > 3;

const segment = (name: string, start: number, end: number): Segment => ({ name, start, end, loop: false, description: '' });

describe('motionEnergy', () => {
  it('is zero for a still take', () => {
    const energy = motionEnergy(take(1, () => false));
    expect(Math.max(...energy)).toBeCloseTo(0, 5);
  });

  it('measures total angular speed in rad/s', () => {
    const energy = motionEnergy(take(2, () => true));
    expect(energy[30]).toBeCloseTo(1, 2);
  });
});

describe('refineSegments', () => {
  it('snaps a clip end to where motion stops and the next start to where motion resumes', () => {
    const frames = take(5, moveStillMove);
    const [first, second] = refineSegments([segment('Spin_A', 0, 2.4), segment('Spin_B', 2.6, 5)], frames);
    expect(first.end).toBeGreaterThanOrEqual(1.95);
    expect(first.end).toBeLessThanOrEqual(2.2);
    expect(second.start).toBeGreaterThanOrEqual(2.8);
    expect(second.start).toBeLessThanOrEqual(3.05);
    expect(first.name).toBe('Spin_A');
  });

  it('keeps segments ordered and non-overlapping', () => {
    const frames = take(5, moveStillMove);
    const refined = refineSegments([segment('A', 0, 2.5), segment('B', 2.5, 5)], frames);
    expect(refined[0].end).toBeLessThanOrEqual(refined[1].start);
    for (const s of refined) expect(s.end - s.start).toBeGreaterThan(0.3);
  });
});

describe('fallbackSegments', () => {
  it('splits a take at still pauses and names clips in order', () => {
    const segments = fallbackSegments(take(5, moveStillMove));
    expect(segments.map((s) => s.name)).toEqual(['Clip_01', 'Clip_02']);
    expect(segments[0].end).toBeGreaterThan(1.8);
    expect(segments[0].end).toBeLessThan(2.3);
    expect(segments[1].start).toBeGreaterThan(2.7);
    expect(segments[1].start).toBeLessThan(3.2);
  });

  it('returns the whole take as one clip when there is no pause', () => {
    const segments = fallbackSegments(take(3, () => true));
    expect(segments).toHaveLength(1);
    expect(segments[0].start).toBeCloseTo(0, 1);
    expect(segments[0].end).toBeCloseTo(3, 1);
  });
});
