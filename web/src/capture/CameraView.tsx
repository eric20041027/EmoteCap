import type { CSSProperties, RefObject } from 'react';
import './CameraView.css';
import { formatClock } from '../ui/format';
import { CalibrationGuide } from './CalibrationGuide';
import type { PoseStatus } from './usePose';

interface CameraViewProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  overlayRef: RefObject<HTMLCanvasElement | null>;
  status: PoseStatus;
  message: string;
  onRetry: () => void;
  startDisabled?: boolean;
  showStepBackHint: boolean;
  /** Seconds recorded so far, or null when not recording. */
  recordingSeconds: number | null;
  /** Width / height of the tracked frame; the view takes the camera's own shape. */
  aspect: number;
  /** A landscape camera is cropped to portrait: fill the view and cut the sides like the tracker does. */
  cropped: boolean;
  /** A T-pose was captured for this camera. */
  calibrated: boolean;
  /** Seconds left in the calibration countdown, or null when not calibrating. */
  calibrationSecondsLeft: number | null;
  onCalibrate: () => void;
}

const CALIBRATE_TITLE =
  "Hold a T-pose for 3 seconds so the character's head and posture match yours. Redo it after moving the camera.";

/** Mirrored webcam feed with the pose overlay, loading/error covers, REC badge, calibration prompt and framing hint. */
export function CameraView(props: CameraViewProps) {
  const { videoRef, overlayRef, status, message, onRetry, showStepBackHint, recordingSeconds, aspect, cropped } = props;
  const calibrationSecondsLeft = props.calibrationSecondsLeft;
  const showCalibrate = status === 'ready' && recordingSeconds === null && calibrationSecondsLeft === null;
  const shape = { aspectRatio: String(aspect), '--aspect': aspect } as CSSProperties;

  return (
    <div className="camera" style={shape}>
      <video ref={videoRef} className={`camera__media mirrored${cropped ? ' camera__media--cover' : ''}`} muted playsInline />
      <canvas ref={overlayRef} className="camera__media mirrored" />
      {status==='off' && <div className="camera__cover"><p>Use a sample or saved project, or start camera capture.</p>
        <button type="button" className="btn btn--secondary" disabled={props.startDisabled} onClick={onRetry}>Start camera</button></div>}

      {recordingSeconds !== null && (
        <div className="rec-badge" role="status">
          <span className="rec-dot" aria-hidden />
          REC {formatClock(recordingSeconds)}
        </div>
      )}

      {calibrationSecondsLeft !== null && <CalibrationGuide secondsLeft={calibrationSecondsLeft} />}

      {showCalibrate && (
        <button
          type="button"
          className={`camera__calibrate camera__calibrate--${props.calibrated ? 'done' : 'needed'}`}
          title={props.calibrated ? `Calibrate again. ${CALIBRATE_TITLE}` : CALIBRATE_TITLE}
          onClick={props.onCalibrate}
        >
          {props.calibrated ? '✓ Calibrated' : '⚠ Calibrate T-pose'}
        </button>
      )}

      {status === 'ready' && showStepBackHint && calibrationSecondsLeft === null && (
        <div className="camera__hint" role="status">
          Step back so your whole body is in frame
        </div>
      )}

      {status === 'loading' && (
        <div className="camera__cover">
          <span className="spinner" aria-hidden />
          <p>{message}</p>
        </div>
      )}

      {status === 'error' && (
        <div className="camera__cover camera__cover--error" role="alert">
          <p className="camera__error">{message}</p>
          <button type="button" className="btn btn--secondary" disabled={props.startDisabled} onClick={onRetry}>
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
