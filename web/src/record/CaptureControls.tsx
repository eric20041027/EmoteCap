import type { CalibrationMessage } from '../capture/useCalibration';
import { ImportButton } from '../import/ImportButton';
import { formatClock } from '../ui/format';
import { takeDuration } from './take';
import type { RecorderState } from './useRecorder';

interface CaptureControlsProps {
  state: Exclude<RecorderState, { phase: 'recorded' }>;
  canRecord: boolean;
  isCalibrating: boolean;
  calibrationMessage: CalibrationMessage | null;
  onRecord: () => void;
  onStop: () => void;
  onCancel: () => void;
  onCalibrate: () => void;
  /** Turn a video file into a take instead of recording one. */
  onImport: (file: File) => void;
  /** Why the last import failed, if it did. */
  importError?: string;
}

/** Record / Stop / Cancel, T-pose calibration and video import, before a take exists. */
export function CaptureControls(props: CaptureControlsProps) {
  const { state, canRecord, isCalibrating, calibrationMessage } = props;

  if (state.phase === 'recording') {
    return (
      <div className="capture">
        <button type="button" className="btn-record btn-record--stop" onClick={props.onStop}>
          <span className="btn-record__icon btn-record__icon--stop" aria-hidden />
          Stop
        </button>
        <div className="capture__live">
          <span className="rec-dot" aria-hidden />
          <span className="capture__clock">{formatClock(takeDuration(state.frames))}</span>
          <span className="dock__meta">{state.frames.length} frames captured</span>
        </div>
      </div>
    );
  }

  if (state.phase === 'countdown') {
    return (
      <div className="capture">
        <button type="button" className="btn-record btn-record--armed" onClick={props.onCancel}>
          Cancel
        </button>
        <p className="capture__tip">Get into position — recording starts after the countdown.</p>
      </div>
    );
  }

  return (
    <div className="capture">
      <button
        type="button"
        className="btn-record"
        disabled={!canRecord || isCalibrating}
        title={canRecord ? 'Start a 3-second countdown, then record' : 'Waiting for the camera'}
        onClick={props.onRecord}
      >
        <span className="btn-record__icon" aria-hidden />
        Record
      </button>
      <button
        type="button"
        className="btn btn--secondary"
        disabled={!canRecord || isCalibrating}
        onClick={props.onCalibrate}
      >
        {isCalibrating ? 'Hold the T-pose…' : 'Calibrate T-pose'}
      </button>
      <ImportButton disabled={isCalibrating} onFile={props.onImport} />
      <div className="capture__text">
        <p className="capture__tip">
          Stand 2–3 m back so your whole body is visible. Recording starts after a 3-second countdown.
        </p>
        {calibrationMessage && (
          <p className={`capture__note capture__note--${calibrationMessage.tone}`}>{calibrationMessage.text}</p>
        )}
        {state.notice && <p className="capture__note capture__note--warn">{state.notice}</p>}
        {props.importError && <p className="capture__note capture__note--warn">{props.importError}</p>}
      </div>
    </div>
  );
}
