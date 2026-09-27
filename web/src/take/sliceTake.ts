import { fallbackSegments, refineSegments, type MotionFrame, type Segment } from '../motion/index';
import { takeDuration } from '../record/take';
import { preflightFailure, requestSegments, toSliceFailure, type SliceFailureKind } from './takesApi';

export type SliceResult =
  | { source: 'gemini'; segments: Segment[] }
  | { source: 'fallback'; segments: Segment[]; kind: SliceFailureKind; reason: string; details: string };

export type SegmentRequest = (video: Blob, duration: number, signal?: AbortSignal) => Promise<Segment[]>;

export interface SliceOptions {
  request?: SegmentRequest;
  signal?: AbortSignal;
}

const defaultRequest: SegmentRequest = (video, duration, signal) => requestSegments(video, duration, { signal });

/**
 * Gemini first (cut points snapped to the actor's pauses); on any failure, split the take at pauses
 * locally so the user always gets clips. Never rejects for Gemini/server problems.
 */
export async function sliceTake(
  frames: readonly MotionFrame[],
  video: Blob | null,
  options: SliceOptions = {},
): Promise<SliceResult> {
  const { request = defaultRequest, signal } = options;
  const duration = takeDuration(frames);
  try {
    const blocked = preflightFailure(video, duration);
    if (blocked || !video) throw blocked;
    const segments = await request(video, duration, signal);
    return { source: 'gemini', segments: refineSegments(segments, frames) };
  } catch (error) {
    const failure = toSliceFailure(error);
    return {
      source: 'fallback',
      segments: fallbackSegments(frames),
      kind: failure.kind,
      reason: failure.message,
      details: failure.details,
    };
  }
}

/** Problems a retry cannot fix (the same video would be rejected again). */
const FINAL_KINDS: ReadonlySet<SliceFailureKind> = new Set(['no-video', 'too-short', 'too-long', 'too-large', 'unsupported-video']);

/** Offer "Try Gemini again" only after a fallback that a retry might fix (no key, timeout, network…). */
export function canRetryGemini(result: SliceResult): boolean {
  return result.source === 'fallback' && !FINAL_KINDS.has(result.kind);
}
