import { useMemo, useRef, useState } from 'react';
import './App.css';
import { CameraView } from './capture/CameraView';
import { needsStepBack } from './capture/captureChecks';
import { drawPoseOverlay } from './capture/drawPoseOverlay';
import { useCalibration } from './capture/useCalibration';
import { usePose, type CaptureQuality, type PoseResult } from './capture/usePose';
import { ChipToggle, LiveLinkToggle } from './live/LiveLinkToggle';
import { useLiveLink } from './live/useLiveLink';
import { createPoseSolver, tposeFrame, type MotionFrame, type PoseLandmark } from './motion/index';
import { PreviewCanvas } from './preview/PreviewCanvas';
import { RecordPanel } from './record/RecordPanel';
import { takeDuration } from './record/take';
import { useRecorder } from './record/useRecorder';
import { AppHeader } from './ui/AppHeader';
import { CountdownOverlay } from './ui/CountdownOverlay';
import { StatusBar } from './ui/StatusBar';
import { useServerHealth } from './ui/useServerHealth';

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<MotionFrame | null>(tposeFrame());
  const latestWorldRef = useRef<PoseLandmark[] | null>(null);
  const solver = useMemo(() => createPoseSolver(), []);
  const recorder = useRecorder();
  const calibration = useCalibration(solver, latestWorldRef);
  const server = useServerHealth();
  const liveLink = useLiveLink();
  const [mirrorPreview, setMirrorPreview] = useState(true);
  const [quality, setQuality] = useState<CaptureQuality>('fast');
  const [hasPose, setHasPose] = useState(false);
  const [stepBack, setStepBack] = useState(true);
  const { state } = recorder;
  const isReviewing = state.phase === 'recorded';

  // Runs once per camera frame, outside React rendering.
  const handlePose = ({ landmarks, worldLandmarks, hands, timestampMs }: PoseResult) => {
    drawPoseOverlay(overlayRef.current, videoRef.current, landmarks, hands.image);
    latestWorldRef.current = worldLandmarks ?? null;
    setHasPose(worldLandmarks !== undefined);
    setStepBack(needsStepBack(landmarks));
    const frame = solver.solve(worldLandmarks, timestampMs / 1000, hands.world, landmarks);
    if (!frame) return;
    if (liveLink.enabled) liveLink.send(frame);
    if (!isReviewing) frameRef.current = frame;
    recorder.push(frame);
  };

  const pose = usePose(videoRef, handlePose, quality);
  const recordingSeconds = state.phase === 'recording' ? takeDuration(state.frames) : null;

  return (
    <div className="app">
      <AppHeader>
        <StatusBar cameraStatus={pose.status} fps={pose.fps} hasPose={hasPose} server={server} />
        <ChipToggle
          label={quality === 'accurate' ? 'Accurate' : 'Fast'}
          pressed={quality === 'accurate'}
          onToggle={() => setQuality((q) => (q === 'accurate' ? 'fast' : 'accurate'))}
          title="Fast: Pose Full + hands every other frame (smooth Live Link). Accurate: Pose Heavy + hands every frame (best for recording). Switching restarts the camera."
        />
      </AppHeader>

      <main className="stage">
        <section className="panel" aria-label="Camera">
          <div className="panel__head">
            <h2 className="panel__title">Camera</h2>
            <span className="panel__meta">Mirrored · MediaPipe Pose</span>
          </div>
          <CameraView
            videoRef={videoRef}
            overlayRef={overlayRef}
            status={pose.status}
            message={pose.message}
            onRetry={pose.retry}
            showStepBackHint={stepBack}
            recordingSeconds={recordingSeconds}
          />
        </section>

        <section className="panel" aria-label="3D preview">
          <div className="panel__head">
            <h2 className="panel__title">3D preview</h2>
            <span className="legend">
              <span className="legend__item legend__item--left">Left</span>
              <span className="legend__item legend__item--right">Right</span>
              <ChipToggle
                label="Mirror"
                pressed={mirrorPreview}
                onToggle={() => setMirrorPreview((value) => !value)}
                title="Flip the preview like a mirror so it matches the camera view"
              />
              <LiveLinkToggle enabled={liveLink.enabled} status={liveLink.status} onToggle={liveLink.toggle} />
            </span>
          </div>
          <div className="preview-frame">
            <PreviewCanvas frameRef={frameRef} mirrored={mirrorPreview} />
            {isReviewing && <span className="preview-badge">Reviewing take</span>}
          </div>
        </section>
      </main>

      <RecordPanel
        recorder={recorder}
        calibration={calibration}
        frameRef={frameRef}
        canRecord={pose.status === 'ready'}
        videoRef={videoRef}
      />

      {recorder.countdown !== null && <CountdownOverlay value={recorder.countdown} caption="Get into position" />}
      {calibration.remaining !== null && (
        <CountdownOverlay value={calibration.remaining} caption="Hold a T-pose — arms straight out" />
      )}
    </div>
  );
}
