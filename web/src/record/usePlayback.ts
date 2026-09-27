import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { MotionFrame } from '../motion/index';
import { frameAtTime } from './take';

export interface Playback {
  /** Current playback time in seconds, or null when stopped. */
  playhead: number | null;
  play: (start: number, end: number, loop: boolean) => void;
  stop: () => void;
  /** Show the frame nearest to `t` in the preview (stops playback). */
  seek: (t: number) => void;
}

/** Replays part of a recorded take into the preview frame ref in real time. */
export function usePlayback(frames: readonly MotionFrame[], frameRef: RefObject<MotionFrame | null>): Playback {
  const [playhead, setPlayhead] = useState<number | null>(null);
  const rafRef = useRef(0);

  const show = useCallback(
    (t: number) => {
      const frame = frameAtTime(frames, t);
      if (frame) frameRef.current = frame;
    },
    [frames, frameRef],
  );

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    setPlayhead(null);
  }, []);

  const seek = useCallback(
    (t: number) => {
      stop();
      show(t);
    },
    [show, stop],
  );

  const play = useCallback(
    (start: number, end: number, loop: boolean) => {
      cancelAnimationFrame(rafRef.current);
      const length = Math.max(end - start, 1e-3);
      const startedAt = performance.now();
      const tick = (now: number) => {
        const elapsed = Math.max(now - startedAt, 0) / 1000;
        if (elapsed > length && !loop) {
          show(end);
          setPlayhead(null);
          return;
        }
        const t = start + (elapsed % length);
        show(t);
        setPlayhead(t);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    },
    [show],
  );

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  return { playhead, play, stop, seek };
}
