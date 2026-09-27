import { describe, expect, it, vi } from 'vitest';
import { H0, fallbackSegments, identityRotations, refineSegments, type MotionFrame, type Segment } from '../motion/index';
import { canRetryGemini, sliceTake, type SliceResult } from './sliceTake';
import { sliceFailure, type SliceFailureKind } from './takesApi';

const FPS = 30;
const RIGHT_UPPER_ARM = 9;
const VIDEO = new Blob(['webm'], { type: 'video/webm' });

/** 5 s take: the right arm swings during 0.5–1.8 s and 3–4.3 s, and holds still otherwise. */
function takeWithTwoMoves(): MotionFrame[] {
  const moving = (t: number) => (t > 0.5 && t < 1.8) || (t > 3 && t < 4.3);
  const frames: MotionFrame[] = [];
  let angle = 0;
  for (let i = 0; i <= 5 * FPS; i++) {
    const t = i / FPS;
    if (moving(t)) angle += 2 / FPS;
    const r = identityRotations();
    r.splice(RIGHT_UPPER_ARM * 4, 4, 0, 0, Math.sin(angle / 2), Math.cos(angle / 2));
    frames.push({ t, h: [0, H0, 0], r });
  }
  return frames;
}

const FRAMES = takeWithTwoMoves();
const GEMINI_SEGMENTS: Segment[] = [
  { name: 'Wave_Right', start: 0.4, end: 2, loop: false, description: 'Waves' },
  { name: 'Wave_Again', start: 2.9, end: 4.5, loop: true, description: 'Waves again' },
];

describe('sliceTake', () => {
  it('uses Gemini segments, snapped to pauses, when the request succeeds', async () => {
    const request = vi.fn(async () => GEMINI_SEGMENTS);
    const result = await sliceTake(FRAMES, VIDEO, { request });
    expect(result).toEqual({ source: 'gemini', segments: refineSegments(GEMINI_SEGMENTS, FRAMES) });
    expect(request).toHaveBeenCalledWith(VIDEO, 5, undefined);
  });

  it.each(['not-configured', 'gemini-failed', 'too-large', 'unsupported-video', 'unreachable'] as const)(
    'falls back to splitting at pauses on %s',
    async (kind) => {
      const failure = sliceFailure(kind, 'server said no');
      const result = await sliceTake(FRAMES, VIDEO, { request: async () => Promise.reject(failure) });
      expect(result).toEqual({
        source: 'fallback',
        segments: fallbackSegments(FRAMES),
        kind,
        reason: failure.message,
        details: 'server said no',
      });
      expect(result.segments).toHaveLength(2);
    },
  );

  it('falls back without uploading when no video was recorded', async () => {
    const request = vi.fn(async () => GEMINI_SEGMENTS);
    const result = await sliceTake(FRAMES, null, { request });
    expect(result).toMatchObject({ source: 'fallback', kind: 'no-video' });
    expect(request).not.toHaveBeenCalled();
  });

  it('passes the abort signal to the request', async () => {
    const controller = new AbortController();
    const request = vi.fn(async () => GEMINI_SEGMENTS);
    await sliceTake(FRAMES, VIDEO, { request, signal: controller.signal });
    expect(request).toHaveBeenCalledWith(VIDEO, 5, controller.signal);
  });
});

describe('canRetryGemini', () => {
  const fallback = (kind: SliceFailureKind): SliceResult => ({ source: 'fallback', segments: [], kind, reason: '', details: '' });

  it('offers a retry for problems that may go away', () => {
    expect(canRetryGemini(fallback('not-configured'))).toBe(true);
    expect(canRetryGemini(fallback('timeout'))).toBe(true);
  });

  it('does not offer a retry when the same video would be rejected again, or Gemini already answered', () => {
    expect(canRetryGemini(fallback('no-video'))).toBe(false);
    expect(canRetryGemini(fallback('too-long'))).toBe(false);
    expect(canRetryGemini({ source: 'gemini', segments: [] })).toBe(false);
  });
});
