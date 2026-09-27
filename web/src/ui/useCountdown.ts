import { useCallback, useEffect, useRef, useState } from 'react';
import { beep } from './beep';

const TICK_MS = 1000;
const TICK_HZ = 660;
const GO_HZ = 1320;

export interface Countdown {
  /** Whole seconds left, or null when no countdown is running. */
  remaining: number | null;
  /** Start (or restart) a countdown; `onDone` runs once when it reaches zero. Call from a click handler. */
  start: (seconds: number, onDone: () => void) => void;
  cancel: () => void;
}

/** 3-2-1 style countdown with a beep per second and a higher "go" beep. */
export function useCountdown(): Countdown {
  const [remaining, setRemaining] = useState<number | null>(null);
  const timerRef = useRef<number | undefined>(undefined);

  const cancel = useCallback(() => {
    window.clearInterval(timerRef.current);
    timerRef.current = undefined;
    setRemaining(null);
  }, []);

  const start = useCallback(
    (seconds: number, onDone: () => void) => {
      cancel();
      let left = seconds;
      setRemaining(left);
      beep(TICK_HZ);
      timerRef.current = window.setInterval(() => {
        left -= 1;
        if (left > 0) {
          setRemaining(left);
          beep(TICK_HZ);
          return;
        }
        cancel();
        beep(GO_HZ);
        onDone();
      }, TICK_MS);
    },
    [cancel],
  );

  useEffect(() => () => window.clearInterval(timerRef.current), []);

  return { remaining, start, cancel };
}
