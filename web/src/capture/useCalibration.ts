import { useCallback, useEffect, useState, type RefObject } from 'react';
import type { PoseLandmark, PoseSolver } from '../motion/index';
import { useCountdown } from '../ui/useCountdown';

export const CALIBRATION_SECONDS = 3;
const MESSAGE_MS = 4000;

export interface CalibrationMessage {
  tone: 'ok' | 'warn';
  text: string;
}

export interface Calibration {
  /** Seconds left before the T-pose is captured, or null. */
  remaining: number | null;
  message: CalibrationMessage | null;
  start: () => void;
  cancel: () => void;
}

/** "Calibrate T-pose": 3-second countdown, then hand the latest world landmarks to the solver. */
export function useCalibration(
  solver: PoseSolver,
  latestWorldRef: RefObject<PoseLandmark[] | null>,
): Calibration {
  const { remaining, start: startCountdown, cancel } = useCountdown();
  const [message, setMessage] = useState<CalibrationMessage | null>(null);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), MESSAGE_MS);
    return () => window.clearTimeout(timer);
  }, [message]);

  const start = useCallback(() => {
    setMessage(null);
    startCountdown(CALIBRATION_SECONDS, () => {
      const landmarks = latestWorldRef.current;
      if (!landmarks) {
        setMessage({ tone: 'warn', text: 'No pose detected, calibration skipped. Step into frame and try again.' });
        return;
      }
      try {
        solver.calibrate(landmarks);
        setMessage({ tone: 'ok', text: 'T-pose calibrated.' });
      } catch (error) {
        console.error('T-pose calibration failed:', error);
        setMessage({ tone: 'warn', text: 'Calibration failed. Hold a clear T-pose facing the camera and try again.' });
      }
    });
  }, [latestWorldRef, solver, startCountdown]);

  return { remaining, message, start, cancel };
}
