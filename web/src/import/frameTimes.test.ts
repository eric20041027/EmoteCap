import { describe, expect, it } from 'vitest';
import { tposeFrame } from '../motion/index';
import { holdFromStart, sampleTimes } from './frameTimes';

describe('sampleTimes', () => {
  it('samples every 1/fps from 0, stopping half a frame before the end', () => {
    const times = sampleTimes(1, 30);
    expect(times).toHaveLength(30);
    expect(times[0]).toBe(0);
    expect(times[1]).toBeCloseTo(1 / 30);
    expect(times[29]).toBeCloseTo(29 / 30);
  });

  it('never seeks to the very end of the video, where browsers may not report the seek', () => {
    for (const duration of [0.1, 1, 361 / 30, 27.016]) {
      const times = sampleTimes(duration, 30);
      expect(times[times.length - 1]).toBeLessThan(duration - 1 / 90);
    }
  });

  it('stops at the last frame that fits', () => {
    expect(sampleTimes(0.1, 30)).toHaveLength(3);
    expect(sampleTimes(0.05, 30)).toHaveLength(2);
  });

  it('still reads the first frame of a very short video', () => {
    expect(sampleTimes(0.01, 30)).toEqual([0]);
  });

  it('returns nothing for an empty, unknown or endless video', () => {
    expect(sampleTimes(0)).toEqual([]);
    expect(sampleTimes(Number.NaN)).toEqual([]);
    expect(sampleTimes(Number.POSITIVE_INFINITY)).toEqual([]);
  });
});

describe('holdFromStart', () => {
  it('keeps a take that already starts at 0', () => {
    const frames = [tposeFrame(0), tposeFrame(0.5)];
    expect(holdFromStart(frames)).toEqual(frames);
  });

  it('copies the first pose back to t = 0 when the video starts without a person', () => {
    const late = tposeFrame(0.4);
    const held = holdFromStart([late, tposeFrame(0.5)]);
    expect(held).toHaveLength(3);
    expect(held[0]).toEqual({ ...late, t: 0 });
    expect(held[0].r).not.toBe(late.r);
  });

  it('keeps an empty take empty', () => {
    expect(holdFromStart([])).toEqual([]);
  });
});
