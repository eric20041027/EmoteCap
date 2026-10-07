import { fallbackSegments, refineSegments, type MotionFrame, type Segment } from '../motion/index';
import { takeDuration } from '../record/take';
import { hasCloudGrant,preflightFailure, requestSegments, sliceFailure,toSliceFailure, type SliceFailureKind,type CloudGrant } from './takesApi';

export type SliceResult =
  | { source: 'gemini'; segments: Segment[] }
  | { source: 'fallback'; segments: Segment[]; kind: SliceFailureKind; reason: string; details: string };

export type SegmentRequest = (video: Blob, duration: number, signal?: AbortSignal,consent?:CloudGrant) => Promise<Segment[]>;

export interface SliceOptions {
  request?: SegmentRequest;
  signal?: AbortSignal;
  consent?:CloudGrant;
}

const defaultRequest: SegmentRequest = (video, duration, signal,consent) => requestSegments(video, duration, { signal,consent });

/**
 * Local pauses by default. An explicit grant permits Gemini; failures preserve the local option.
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
    if(!hasCloudGrant(options.consent))throw sliceFailure('consent-required');
    const segments = await request(video, duration, signal,options.consent);
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
const FINAL_KINDS: ReadonlySet<SliceFailureKind> = new Set(['consent-required','no-video', 'too-short', 'too-long', 'too-large', 'unsupported-video']);

/** Offer "Try Gemini again" only after a fallback that a retry might fix (no key, timeout, network…). */
export function canRetryGemini(result: SliceResult): boolean {
  return result.source === 'fallback' && !FINAL_KINDS.has(result.kind);
}
