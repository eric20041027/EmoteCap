import { describe, expect, it } from 'vitest';
import { cropRect, PORTRAIT_ASPECT } from './cropFrame';

describe('cropRect', () => {
  it('keeps the whole frame when cropping is off', () => {
    expect(cropRect(1920, 1080, 'none')).toEqual({ sx: 0, sy: 0, sw: 1920, sh: 1080 });
  });

  it('cuts a centred 3:4 portrait window out of a landscape frame', () => {
    const rect = cropRect(1440, 1080, 'portrait');
    expect(rect).toEqual({ sx: 315, sy: 0, sw: 810, sh: 1080 });
    expect(rect.sw / rect.sh).toBeCloseTo(PORTRAIT_ASPECT, 5);
  });

  it('leaves an already-portrait frame alone', () => {
    expect(cropRect(720, 1280, 'portrait')).toEqual({ sx: 0, sy: 0, sw: 720, sh: 1280 });
  });

  it('returns an empty rect before the video has a size', () => {
    expect(cropRect(0, 0, 'portrait')).toEqual({ sx: 0, sy: 0, sw: 0, sh: 0 });
  });
});
