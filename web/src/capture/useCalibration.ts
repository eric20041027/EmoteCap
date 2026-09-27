import { useCallback, useEffect, useState, type RefObject } from 'react';
import type { PoseLandmark, PoseSolver } from '../motion/index';
import { useCountdown } from '../ui/useCountdown';

/** Long enough to walk back from the laptop and line up with the on-screen outline. */
export const CALIBRATION_SECONDS = 5;
const MESSAGE_MS = 4000;

export interface CalibrationMessage {
  tone: 'ok' | 'warn';
  text: string;
}

export interface Calibration {
  /** Seconds left before the T-pose is captured, or null. */
  remaining: number | null;
  message: CalibrationMessage | null;
  /** A T-pose was captured with the current camera; a reload or a camera switch asks for a new one. */
  isCalibrated: boolean;
  start: () => void;
  cancel: () => void;
}

/** "Calibrate T-pose": 5-second countdown (with an outline to stand in), then hand the latest world landmarks to the solver. */
export function useCalibration(
  solver: PoseSolver,
  latestWorldRef: RefObject<PoseLandmark[] | null>,
  /** The camera in use: MediaPipe's 3D bias depends on the camera angle, so each camera needs its own T-pose. */
  cameraKey = '',
): Calibration {
  const { remaining, start: startCountdown, cancel } = useCountdown();
  const [message, setMessage] = useState<CalibrationMessage | null>(null);
  const [calibratedFor, setCalibratedFor] = useState<string | null>(null);

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
        setCalibratedFor(cameraKey);
        setMessage({ tone: 'ok', text: 'T-pose calibrated.' });
      } catch (error) {
        console.error('T-pose calibration failed:', error);
        setMessage({ tone: 'warn', text: 'Calibration failed. Hold a clear T-pose facing the camera and try again.' });
      }
    });
  }, [cameraKey, latestWorldRef, solver, startCountdown]);

  return { remaining, message, isCalibrated: calibratedFor === cameraKey, start, cancel };
}
