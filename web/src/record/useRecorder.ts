import { useCallback, useLayoutEffect, useReducer, useRef } from 'react';
import type { MotionFrame } from '../motion/index';
import { useCountdown } from '../ui/useCountdown';

export const COUNTDOWN_SECONDS = 3;
export const EMPTY_TAKE_NOTICE = 'Nothing was captured. Make sure your whole body is in frame, then record again.';

/** A short remark shown in Review, e.g. how an imported take was calibrated. */
export interface TakeNote {
  tone: 'ok' | 'warn';
  text: string;
}

export type RecorderState =
  | { phase: 'idle'; notice?: string }
  | { phase: 'countdown' }
  | { phase: 'recording'; frames: readonly MotionFrame[]; t0: number | null }
  | {
      phase: 'recorded';
      frames: readonly MotionFrame[];
      /** An imported take's source file: Gemini slices it instead of a camera recording. */
      video?: Blob;
      note?: TakeNote;
    };

export type RecorderAction =
  | { type: 'arm' }
  | { type: 'begin' }
  | { type: 'push'; frame: MotionFrame }
  | { type: 'stop' }
  | { type: 'discard' }
  | { type: 'load'; frames: readonly MotionFrame[]; video: Blob; note?: TakeNote };

export const INITIAL_RECORDER_STATE: RecorderState = { phase: 'idle' };

/** Pure state machine: idle -> countdown -> recording -> recorded (or idle -> recorded for an imported video); discard returns to idle. */
export function recorderReducer(state: RecorderState, action: RecorderAction): RecorderState {
  switch (action.type) {
    case 'arm':
      return state.phase === 'idle' ? { phase: 'countdown' } : state;
    case 'begin':
      return state.phase === 'countdown' ? { phase: 'recording', frames: [], t0: null } : state;
    case 'push': {
      if (state.phase !== 'recording') return state;
      const { frame } = action;
      const t0 = state.t0 ?? frame.t;
      // Copy the arrays: the take must not share buffers with the live solver.
      const rebased: MotionFrame = { t: frame.t - t0, h: [...frame.h], r: [...frame.r] };
      return { phase: 'recording', t0, frames: [...state.frames, rebased] };
    }
    case 'stop':
      if (state.phase !== 'recording') return state;
      return state.frames.length > 0
        ? { phase: 'recorded', frames: state.frames }
        : { phase: 'idle', notice: EMPTY_TAKE_NOTICE };
    case 'discard':
      return { phase: 'idle' };
    case 'load':
      return state.phase === 'idle' && action.frames.length > 0
        ? { phase: 'recorded', frames: action.frames, video: action.video, note: action.note }
        : state;
  }
}

export interface Recorder {
  state: RecorderState;
  /** Seconds left in the pre-roll countdown, or null. */
  countdown: number | null;
  start: () => void;
  stop: () => void;
  discard: () => void;
  /** Feed every solved frame; frames are kept only while recording. */
  push: (frame: MotionFrame) => void;
  /** Open an imported take (frames timed in video seconds) and its source video for review. */
  load: (frames: readonly MotionFrame[], video: Blob, note?: TakeNote) => void;
}

export function useRecorder(): Recorder {
  const [state, dispatch] = useReducer(recorderReducer, INITIAL_RECORDER_STATE);
  const { remaining, start: startCountdown, cancel: cancelCountdown } = useCountdown();
  const phaseRef = useRef(state.phase);

  useLayoutEffect(() => {
    phaseRef.current = state.phase;
  }, [state.phase]);

  const start = useCallback(() => {
    dispatch({ type: 'arm' });
    startCountdown(COUNTDOWN_SECONDS, () => dispatch({ type: 'begin' }));
  }, [startCountdown]);

  const stop = useCallback(() => dispatch({ type: 'stop' }), []);

  const discard = useCallback(() => {
    cancelCountdown();
    dispatch({ type: 'discard' });
  }, [cancelCountdown]);

  // Skip the dispatch outside recording so idle frames never re-render the app.
  const push = useCallback((frame: MotionFrame) => {
    if (phaseRef.current === 'recording') dispatch({ type: 'push', frame });
  }, []);

  const load = useCallback(
    (frames: readonly MotionFrame[], video: Blob, note?: TakeNote) => dispatch({ type: 'load', frames, video, note }),
    [],
  );

  return { state, countdown: remaining, start, stop, discard, push, load };
}
