import { describe, expect, it } from 'vitest';
import { pickVideoMimeType } from './takeVideo';

const supports =
  (...types: string[]) =>
  (type: string) =>
    types.includes(type);

describe('pickVideoMimeType', () => {
  it('prefers VP8 (cheapest to encode), then VP9, then plain WebM', () => {
    expect(pickVideoMimeType(supports('video/webm;codecs=vp9', 'video/webm;codecs=vp8'))).toBe('video/webm;codecs=vp8');
    expect(pickVideoMimeType(supports('video/webm;codecs=vp9', 'video/webm'))).toBe('video/webm;codecs=vp9');
    expect(pickVideoMimeType(supports('video/webm'))).toBe('video/webm');
  });

  it('lets the browser choose when no WebM type is supported', () => {
    expect(pickVideoMimeType(supports('video/mp4'))).toBeUndefined();
  });
});
