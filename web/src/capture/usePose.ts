import {
  FilesetResolver,
  PoseLandmarker,
  type HandLandmarker,
  type Landmark,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { INSECURE_CONTEXT_MESSAGE, describeCameraError, describeModelError } from './captureChecks';
import { NO_HANDS, assignHands, createHandLandmarker, type TrackedHands } from './hands';

export interface PoseResult {
  /** Normalized image landmarks (0..1) of the first pose, for the overlay. */
  landmarks: NormalizedLandmark[] | undefined;
  /** World landmarks (meters, hip-centred) of the first pose, for the solver. */
  worldLandmarks: Landmark[] | undefined;
  /** Hands matched to the actor's left/right (empty when hand tracking is off or nothing is detected). */
  hands: TrackedHands;
  timestampMs: number;
}

export type PoseStatus = 'loading' | 'ready' | 'error';

export interface PoseTracker {
  status: PoseStatus;
  message: string;
  /** Detection rate, smoothed (EMA). */
  fps: number;
  retry: () => void;
}

const WASM_PATH = '/mediapipe/wasm';
const MODEL_PATH = '/models/pose_landmarker_heavy.task';
const LOADING_MESSAGE = 'Starting the camera and loading the pose model…';
const FPS_SMOOTHING = 0.1;
const FPS_PUBLISH_MS = 500;
const HAVE_CURRENT_DATA = 2;

/** Error whose message is already user-facing. */
class CaptureError extends Error {}

async function openCamera(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) throw new CaptureError(INSECURE_CONTEXT_MESSAGE);
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720, facingMode: 'user' },
      audio: false,
    });
  } catch (error) {
    throw new CaptureError(describeCameraError(error));
  }
}

interface Landmarkers {
  pose: PoseLandmarker;
  /** Optional: body tracking keeps working if the hand model fails to load. */
  hands: HandLandmarker | undefined;
}

async function createLandmarkers(): Promise<Landmarkers> {
  try {
    const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
    const options = (delegate: 'GPU' | 'CPU') => ({
      baseOptions: { modelAssetPath: MODEL_PATH, delegate },
      runningMode: 'VIDEO' as const,
      numPoses: 1,
    });
    let pose: PoseLandmarker;
    try {
      pose = await PoseLandmarker.createFromOptions(fileset, options('GPU'));
    } catch (gpuError) {
      console.warn('PoseLandmarker GPU delegate failed, retrying on CPU:', gpuError);
      pose = await PoseLandmarker.createFromOptions(fileset, options('CPU'));
    }
    let hands: HandLandmarker | undefined;
    try {
      hands = await createHandLandmarker(fileset);
    } catch (handError) {
      console.warn('Hand tracking unavailable; continuing with body only:', handError);
    }
    return { pose, hands };
  } catch (error) {
    throw new CaptureError(describeModelError(error));
  }
}

function stopStream(stream: MediaStream | undefined): void {
  stream?.getTracks().forEach((track) => track.stop());
}

/**
 * Webcam + MediaPipe PoseLandmarker loop. Calls `onResult` once per new video frame
 * (from requestAnimationFrame, outside React rendering). The latest `onResult` is always used.
 */
export function usePose(
  videoRef: RefObject<HTMLVideoElement | null>,
  onResult: (result: PoseResult) => void,
): PoseTracker {
  const [status, setStatus] = useState<{ status: PoseStatus; message: string }>({
    status: 'loading',
    message: LOADING_MESSAGE,
  });
  const [fps, setFps] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const onResultRef = useRef(onResult);

  useLayoutEffect(() => {
    onResultRef.current = onResult;
  });

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let disposed = false;
    let stream: MediaStream | undefined;
    let landmarkers: Landmarkers | undefined;
    let rafId = 0;

    const release = () => {
      cancelAnimationFrame(rafId);
      stopStream(stream);
      landmarkers?.pose.close();
      landmarkers?.hands?.close();
      stream = undefined;
      landmarkers = undefined;
      video.srcObject = null;
    };

    const fail = (error: unknown) => {
      release();
      if (disposed) return;
      const message = error instanceof CaptureError ? error.message : `Pose tracking stopped: ${String(error)}`;
      console.error('Pose capture error:', error);
      setStatus({ status: 'error', message });
    };

    const runLoop = (active: Landmarkers) => {
      let handTracker = active.hands;
      let lastVideoTime = -1;
      let lastDetectMs = 0;
      let lastPublishMs = 0;
      let fpsEma = 0;
      let callbackFailed = false;

      const tick = () => {
        rafId = requestAnimationFrame(tick);
        if (video.readyState < HAVE_CURRENT_DATA || video.currentTime === lastVideoTime) return;
        lastVideoTime = video.currentTime;
        const timestampMs = performance.now();
        let result;
        try {
          result = active.pose.detectForVideo(video, timestampMs);
        } catch (error) {
          fail(error);
          return;
        }
        let hands = NO_HANDS;
        if (handTracker) {
          try {
            hands = assignHands(handTracker.detectForVideo(video, timestampMs), result.landmarks[0]);
          } catch (error) {
            console.warn('Hand tracking stopped (body tracking continues):', error);
            handTracker.close();
            handTracker = undefined;
          }
        }
        if (lastDetectMs > 0) {
          const instant = 1000 / Math.max(timestampMs - lastDetectMs, 1);
          fpsEma = fpsEma === 0 ? instant : fpsEma + FPS_SMOOTHING * (instant - fpsEma);
        }
        lastDetectMs = timestampMs;
        if (timestampMs - lastPublishMs > FPS_PUBLISH_MS) {
          lastPublishMs = timestampMs;
          setFps(Math.round(fpsEma));
        }
        try {
          onResultRef.current({
            landmarks: result.landmarks[0],
            worldLandmarks: result.worldLandmarks[0],
            hands,
            timestampMs,
          });
        } catch (error) {
          // Keep tracking; report the first failure only so the console stays readable.
          if (!callbackFailed) console.error('Pose frame handler failed (further errors suppressed):', error);
          callbackFailed = true;
        }
      };
      tick();
    };

    const start = async () => {
      setStatus({ status: 'loading', message: LOADING_MESSAGE });
      const [camera, model] = await Promise.allSettled([openCamera(), createLandmarkers()]);
      if (camera.status === 'fulfilled') stream = camera.value;
      if (model.status === 'fulfilled') landmarkers = model.value;
      if (disposed) {
        release();
        return;
      }
      if (camera.status === 'rejected') throw camera.reason;
      if (model.status === 'rejected') throw model.reason;
      video.srcObject = stream ?? null;
      video.muted = true;
      video.playsInline = true;
      await video.play();
      if (disposed || !landmarkers) return;
      setStatus({ status: 'ready', message: '' });
      runLoop(landmarkers);
    };

    start().catch(fail);

    return () => {
      disposed = true;
      release();
    };
  }, [videoRef, attempt]);

  return { ...status, fps, retry };
}
