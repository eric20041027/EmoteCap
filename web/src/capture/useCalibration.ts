import { useCallback, useEffect, useState } from 'react';
import type { PoseSolver } from '../motion/index';
import type { CalibrationWindow } from './calibrationWindow';
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

/** Five-second setup countdown followed by a fresh stable, visible T-pose decision. */
export function useCalibration(
  solver: PoseSolver,
  calibrationWindow: CalibrationWindow,
  /** The camera in use: MediaPipe's 3D bias depends on the camera angle, so each camera needs its own T-pose. */
  cameraKey = '',
): Calibration {
  const { remaining, start: startCountdown, cancel } = useCountdown();
  const [message, setMessage] = useState<CalibrationMessage | null>(null);
  const [calibratedSolver, setCalibratedSolver] = useState<PoseSolver | null>(null);
  useEffect(()=>()=>cancel(),[solver,calibrationWindow,cameraKey,cancel]);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), MESSAGE_MS);
    return () => window.clearTimeout(timer);
  }, [message]);

  const start = useCallback(() => {
    setMessage(null);
    startCountdown(CALIBRATION_SECONDS, () => {
      const decision=calibrationWindow.read(performance.now());
      if (!decision.ok) {
        setMessage({ tone: 'warn', text: decision.reason });
        return;
      }
      try {
        solver.calibrate(decision.sample.world,decision.sample.hands);
        setCalibratedSolver(solver);
        setMessage({ tone: 'ok', text: 'T-pose calibrated.' });
      } catch (error) {
        console.error('T-pose calibration failed:', error);
        setMessage({ tone: 'warn', text: 'Calibration failed. Hold a clear T-pose facing the camera and try again.' });
      }
    });
  }, [calibrationWindow, solver, startCountdown]);

  return { remaining, message, isCalibrated: calibratedSolver === solver, start, cancel };
}
