import { describe, expect, it } from 'vitest';
import { CLIP_NAME_PATTERN, tposeFrame } from '../motion/index';
import { frameAtTime, nextClipName } from './take';

describe('nextClipName', () => {
  it.each([
    ['Clip_01', 'Clip_02'],
    ['Clip_09', 'Clip_10'],
    ['Clip_99', 'Clip_100'],
    ['Take_7', 'Take_8'],
    ['Wave', 'Wave_02'],
  ])('%s -> %s', (current, next) => {
    expect(nextClipName(current)).toBe(next);
  });

  it('stays within the 24-character limit', () => {
    const next = nextClipName('A'.repeat(24));
    expect(next).toHaveLength(24);
    expect(next.endsWith('_02')).toBe(true);
    expect(CLIP_NAME_PATTERN.test(nextClipName('B'.repeat(20) + '_999'))).toBe(true);
  });

  it('falls back to Clip_01 for an invalid name', () => {
    expect(nextClipName('bad name!')).toBe('Clip_01');
    expect(nextClipName('')).toBe('Clip_01');
  });
});

describe('frameAtTime', () => {
  const frames = [0, 0.1, 0.2, 0.3].map((t) => tposeFrame(t));

  it('returns undefined for an empty take', () => {
    expect(frameAtTime([], 1)).toBeUndefined();
  });

  it('clamps to the first and last frame', () => {
    expect(frameAtTime(frames, -5)).toBe(frames[0]);
    expect(frameAtTime(frames, 9)).toBe(frames[3]);
  });

  it('picks the nearest frame', () => {
    expect(frameAtTime(frames, 0.14)).toBe(frames[1]);
    expect(frameAtTime(frames, 0.16)).toBe(frames[2]);
    expect(frameAtTime(frames, 0.3)).toBe(frames[3]);
  });
});
