import { useCallback, useEffect, useReducer, useRef, useState, type Dispatch } from 'react';
import type { MotionFrame } from '../motion/index';
import { takeDuration } from '../record/take';
import { EMPTY_SEGMENT_LIST, segmentListReducer, type SegmentListAction, type SegmentListState } from './segmentList';
import { sliceTake, type SliceResult } from './sliceTake';
import { sliceFailure } from './takesApi';
import type { TakeVideo } from './useTakeVideo';

/** Upload + Gemini's own 30 s budget + margin. */
export const SLICE_TIMEOUT_MS = 45_000;

export type SliceStatus =
  | { phase: 'idle' }
  | { phase: 'slicing'; startedAt: number }
  | { phase: 'done'; result: SliceResult };

export interface AutoSlice {
  status: SliceStatus;
  list: SegmentListState;
  edit: Dispatch<SegmentListAction>;
  /** Ask Gemini (or fall back) and replace the clip list. */
  run: () => void;
  /** Stop waiting for Gemini and split at pauses instead. */
  skip: () => void;
}

function unexpected(error: unknown): SliceResult {
  console.error('Auto-slice failed:', error);
  return { source: 'fallback', segments: [], kind: 'unknown', reason: 'unexpected error', details: String(error) };
}

/** Auto-slice state for one take: request lifecycle plus the editable clip list. */
export function useAutoSlice(frames: readonly MotionFrame[], video: TakeVideo): AutoSlice {
  const [status, setStatus] = useState<SliceStatus>({ phase: 'idle' });
  const [list, edit] = useReducer(segmentListReducer, EMPTY_SEGMENT_LIST);
  const controllerRef = useRef<AbortController | null>(null);
  const blob = video.status === 'ready' ? video.blob : null;

  const run = useCallback(() => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setStatus({ phase: 'slicing', startedAt: performance.now() });
    const timer = window.setTimeout(() => controller.abort(sliceFailure('timeout')), SLICE_TIMEOUT_MS);

    const finish = (result: SliceResult) => {
      if (controllerRef.current !== controller) return; // superseded, or the take was discarded
      controllerRef.current = null;
      if (result.source === 'fallback') {
        console.warn(`Gemini slicing unavailable (${result.reason}); split at pauses instead.`, result.details);
      }
      edit({ type: 'load', segments: result.segments, duration: takeDuration(frames) });
      setStatus({ phase: 'done', result });
    };

    sliceTake(frames, blob, { signal: controller.signal })
      .catch(unexpected)
      .then(finish)
      .finally(() => window.clearTimeout(timer));
  }, [frames, blob]);

  const skip = useCallback(() => controllerRef.current?.abort(sliceFailure('skipped')), []);

  useEffect(
    () => () => {
      const controller = controllerRef.current;
      controllerRef.current = null;
      controller?.abort();
    },
    [],
  );

  return { status, list, edit, run, skip };
}
