import type { RefObject } from 'react';
import type { Calibration } from '../capture/useCalibration';
import { ImportProgress } from '../import/ImportProgress';
import type { VideoImport } from '../import/useVideoImport';
import type { MotionFrame } from '../motion/index';
import { useTakeVideo, type TakeVideo } from '../take/useTakeVideo';
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
  /** The camera <video>; its raw (un-mirrored) stream is recorded with each take for Gemini. */
  videoRef: RefObject<HTMLVideoElement | null>;
  importer: VideoImport;
}

/** Bottom dock: capture controls (or import progress) before a take, auto-slice or trim/playback/export after it. */
export function RecordPanel({ recorder, calibration, frameRef, canRecord, videoRef, importer }: RecordPanelProps) {
  const exporter = useExporter();
  const { state } = recorder;
  const cameraVideo = useTakeVideo(videoRef, state.phase);
  // An imported take brings its own video file for Gemini.
  const video: TakeVideo = state.phase === 'recorded' && state.video ? { status: 'ready', blob: state.video } : cameraVideo;
  const importState = importer.state;

  return (
    <section className="dock" aria-label="Recording">
      {state.phase === 'recorded' ? (
        <ReviewPanel
          frames={state.frames}
          video={video}
          frameRef={frameRef}
          exporter={exporter}
          onDiscard={recorder.discard}
        />
      ) : importState.phase !== 'idle' ? (
        <ImportProgress state={importState} onCancel={importer.cancel} />
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
          onImport={importer.start}
          importError={importState.error}
        />
      )}
      <ExportedFiles files={exporter.files} />
    </section>
  );
}
