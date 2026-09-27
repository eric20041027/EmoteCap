import { describe, expect, it } from 'vitest';
import {
  ARMS_DOWN_IMAGE,
  BENT_ARMS_IMAGE,
  HIDDEN_T_POSE_IMAGE,
  ONE_ARM_UP_IMAGE,
  T_POSE_IMAGE,
} from './testPoses';
import { firstHeldRun, isTPose } from './tpose';

describe('isTPose', () => {
  it('recognises both arms straight out to the sides', () => {
    expect(isTPose(T_POSE_IMAGE, 1)).toBe(true);
  });

  it('also works on a video that was saved mirrored', () => {
    const mirrored = T_POSE_IMAGE.map((lm) => ({ ...lm, x: 1 - lm.x }));
    expect(isTPose(mirrored, 1)).toBe(true);
  });

  it('rejects arms down, one arm up, and bent arms', () => {
    expect(isTPose(ARMS_DOWN_IMAGE, 1)).toBe(false);
    expect(isTPose(ONE_ARM_UP_IMAGE, 1)).toBe(false);
    expect(isTPose(BENT_ARMS_IMAGE, 1)).toBe(false);
  });

  it('rejects a pose it cannot see well, or no pose at all', () => {
    expect(isTPose(HIDDEN_T_POSE_IMAGE, 1)).toBe(false);
    expect(isTPose(undefined, 1)).toBe(false);
  });

  it('judges arm angles in the real frame shape, not in normalized units', () => {
    const wristsUp = T_POSE_IMAGE.map((lm, i) => (i === 15 || i === 16 ? { ...lm, y: lm.y - 0.04 } : lm));
    expect(isTPose(wristsUp, 1)).toBe(true); // about 10° in a square frame
    expect(isTPose(wristsUp, 0.25)).toBe(false); // the same numbers in a very tall frame slope over 20°
  });
});

describe('firstHeldRun', () => {
  it('returns the middle of the first run that lasts long enough', () => {
    const flags = [false, false, true, true, true, false, ...Array<boolean>(8).fill(true), false];
    expect(firstHeldRun(flags, 8)).toBe(6 + 4);
  });

  it('returns null when no run lasts long enough', () => {
    expect(firstHeldRun([true, true, false, true, true, true], 4)).toBeNull();
    expect(firstHeldRun([], 1)).toBeNull();
  });
});
