import type { RefObject } from 'react';
import './CameraView.css';
import { formatClock } from '../ui/format';
import type { PoseStatus } from './usePose';

interface CameraViewProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  overlayRef: RefObject<HTMLCanvasElement | null>;
  status: PoseStatus;
  message: string;
  onRetry: () => void;
  showStepBackHint: boolean;
  /** Seconds recorded so far, or null when not recording. */
  recordingSeconds: number | null;
}

/** Mirrored webcam feed with the pose overlay, loading/error covers, REC badge and framing hint. */
export function CameraView(props: CameraViewProps) {
  const { videoRef, overlayRef, status, message, onRetry, showStepBackHint, recordingSeconds } = props;

  return (
    <div className="camera">
      <video ref={videoRef} className="camera__media mirrored" muted playsInline />
      <canvas ref={overlayRef} className="camera__media mirrored" />

      {recordingSeconds !== null && (
        <div className="rec-badge" role="status">
          <span className="rec-dot" aria-hidden />
          REC {formatClock(recordingSeconds)}
        </div>
      )}

      {status === 'ready' && showStepBackHint && (
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
          <button type="button" className="btn btn--secondary" onClick={onRetry}>
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
