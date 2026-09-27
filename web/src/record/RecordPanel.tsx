import type { RefObject } from 'react';
import type { Calibration } from '../capture/useCalibration';
import type { MotionFrame } from '../motion/index';
import { CaptureControls } from './CaptureControls';
import { ExportedFiles } from './ExportedFiles';
import { ReviewPanel } from './ReviewPanel';
import { useExporter } from './useExporter';
import type { Recorder } from './useRecorder';
import './record.css';

interface RecordPanelProps {
  recorder: Recorder;
  calibration: Calibration;
  frameRef: RefObject<MotionFrame | null>;
  canRecord: boolean;
}

/** Bottom dock: capture controls before a take, trim/playback/export after it. */
export function RecordPanel({ recorder, calibration, frameRef, canRecord }: RecordPanelProps) {
  const exporter = useExporter();
  const { state } = recorder;

  return (
    <section className="dock" aria-label="Recording">
      {state.phase === 'recorded' ? (
        <ReviewPanel frames={state.frames} frameRef={frameRef} exporter={exporter} onDiscard={recorder.discard} />
      ) : (
        <CaptureControls
          state={state}
          canRecord={canRecord}
          isCalibrating={calibration.remaining !== null}
          calibrationMessage={calibration.message}
          onRecord={recorder.start}
          onStop={recorder.stop}
          onCancel={recorder.discard}
          onCalibrate={calibration.start}
        />
      )}
      <ExportedFiles files={exporter.files} />
    </section>
  );
}
