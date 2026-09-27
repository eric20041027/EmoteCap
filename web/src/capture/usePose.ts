import type { Landmark, NormalizedLandmark } from '@mediapipe/tasks-vision';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { INSECURE_CONTEXT_MESSAGE, describeCameraError } from './captureChecks';
import { cropRect, type CropMode } from './cropFrame';
import { NO_HANDS, assignHands, type TrackedHands } from './hands';
import { CaptureError, closeLandmarkers, createLandmarkers, type CaptureQuality, type Landmarkers } from './landmarkers';
import { detachStream, stopStream } from './streams';

export type { CaptureQuality } from './landmarkers';

export interface PoseResult {
  /** Normalized image landmarks (0..1) of the first pose, for the overlay. */
  landmarks: NormalizedLandmark[] | undefined;
  /** World landmarks (meters, hip-centred) of the first pose, for the solver. */
  worldLandmarks: Landmark[] | undefined;
  /** Hands matched to the actor's left/right (empty when hand tracking is off or nothing is detected). */
  hands: TrackedHands;
  /** Size of the (possibly cropped) frame the landmarks are normalized to. */
  frameSize: { width: number; height: number };
  timestampMs: number;
}

export type PoseStatus = 'loading' | 'ready' | 'error';

export interface PoseTracker {
  status: PoseStatus;
  message: string;
  /** Detection rate, smoothed (EMA). */
  fps: number;
  /** Width / height of the frame fed to the model (after cropping), for sizing the camera view. */
  frameAspect: number;
  /** True while a landscape camera is being cropped to portrait. */
  cropped: boolean;
  retry: () => void;
}

const HAND_EVERY_N_FRAMES: Record<CaptureQuality, number> = { fast: 2, accurate: 1 };
/** Reuse the last hand result on skipped frames for at most this long. */
const HAND_REUSE_MS = 150;
const LOADING_MESSAGE = 'Starting the camera and loading the pose model…';
const FPS_SMOOTHING = 0.1;
const FPS_PUBLISH_MS = 500;
const HAVE_CURRENT_DATA = 2;

/**
 * Default: the built-in camera at 720p. A chosen device (e.g. an upright iPhone via Continuity Camera) only
 * gets a height hint, so a portrait source can deliver a portrait 720x1280 frame instead of a landscape crop.
 */
async function openCamera(deviceId: string): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) throw new CaptureError(INSECURE_CONTEXT_MESSAGE);
  const fallback: MediaTrackConstraints = { width: 1280, height: 720, facingMode: 'user' };
  const video: MediaTrackConstraints = deviceId ? { deviceId: { exact: deviceId }, height: { ideal: 1280 } } : fallback;
  try {
    return await navigator.mediaDevices.getUserMedia({ video, audio: false });
  } catch (error) {
    const name = error instanceof DOMException ? error.name : '';
    if (!deviceId || (name !== 'OverconstrainedError' && name !== 'NotFoundError' && name !== 'NotReadableError')) {
      throw new CaptureError(describeCameraError(error));
    }
    // The chosen camera vanished or is busy (e.g. the iPhone went to sleep): use the default camera instead.
    console.warn(`Camera ${deviceId} unavailable (${name}); falling back to the default camera.`);
  }
  try {
    return await navigator.mediaDevices.getUserMedia({ video: fallback, audio: false });
  } catch (error) {
    throw new CaptureError(describeCameraError(error));
  }
}

/**
 * Webcam + MediaPipe PoseLandmarker loop. Calls `onResult` once per new video frame
 * (from requestAnimationFrame, outside React rendering). The latest `onResult` is always used.
 */
export function usePose(
  videoRef: RefObject<HTMLVideoElement | null>,
  onResult: (result: PoseResult) => void,
  quality: CaptureQuality = 'fast',
  /** Camera to open; '' = browser default. */
  deviceId = '',
  /** Run the hand model (off for the body-only skeleton, which also raises fps). */
  trackHands = true,
  /** Crop a landscape camera to a centred portrait window before tracking (applies instantly). */
  crop: CropMode = 'none',
  /** Skip tracking (the camera keeps running), e.g. while a video file is being imported. */
  paused = false,
): PoseTracker {
  const [status, setStatus] = useState<{ status: PoseStatus; message: string }>({
    status: 'loading',
    message: LOADING_MESSAGE,
  });
  const [fps, setFps] = useState(0);
  const [frame, setFrame] = useState({ aspect: 16 / 9, cropped: false });
  const [attempt, setAttempt] = useState(0);
  const onResultRef = useRef(onResult);
  const trackHandsRef = useRef(trackHands);
  const cropRef = useRef(crop);
  const pausedRef = useRef(paused);

  useLayoutEffect(() => {
    onResultRef.current = onResult;
    trackHandsRef.current = trackHands;
    cropRef.current = crop;
    pausedRef.current = paused;
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
      detachStream(video, stream);
      stopStream(stream);
      closeLandmarkers(landmarkers);
      stream = undefined;
      landmarkers = undefined;
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
      let frameIndex = 0;
      let lastHands = NO_HANDS;
      let lastHandsMs = 0;
      let lastVideoTime = -1;
      let lastDetectMs = 0;
      let lastPublishMs = 0;
      let fpsEma = 0;
      let callbackFailed = false;
      const cropCanvas = document.createElement('canvas');
      const cropContext = cropCanvas.getContext('2d');
      let publishedFrame = '';

      /** The frame to track: the video itself, or a centred portrait crop drawn into a canvas. */
      const frameSource = (): { image: HTMLVideoElement | HTMLCanvasElement; width: number; height: number } => {
        const rect = cropRect(video.videoWidth, video.videoHeight, cropRef.current);
        const cropping = cropContext !== null && rect.sw < video.videoWidth;
        const key = `${rect.sw}x${rect.sh}:${cropping}`;
        if (key !== publishedFrame && rect.sh > 0) {
          publishedFrame = key;
          setFrame({ aspect: rect.sw / rect.sh, cropped: cropping });
        }
        if (!cropping || !cropContext) return { image: video, width: video.videoWidth, height: video.videoHeight };
        if (cropCanvas.width !== rect.sw || cropCanvas.height !== rect.sh) {
          cropCanvas.width = rect.sw;
          cropCanvas.height = rect.sh;
        }
        cropContext.drawImage(video, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, rect.sw, rect.sh);
        return { image: cropCanvas, width: rect.sw, height: rect.sh };
      };

      const tick = () => {
        rafId = requestAnimationFrame(tick);
        if (pausedRef.current) return;
        if (video.readyState < HAVE_CURRENT_DATA || video.currentTime === lastVideoTime) return;
        lastVideoTime = video.currentTime;
        const timestampMs = performance.now();
        const source = frameSource();
        let result;
        try {
          result = active.pose.detectForVideo(source.image, timestampMs);
        } catch (error) {
          fail(error);
          return;
        }
        const wantHands = trackHandsRef.current;
        let hands = wantHands && timestampMs - lastHandsMs < HAND_REUSE_MS ? lastHands : NO_HANDS;
        if (handTracker && wantHands && frameIndex % HAND_EVERY_N_FRAMES[quality] === 0) {
          try {
            hands = assignHands(handTracker.detectForVideo(source.image, timestampMs), result.landmarks[0], source);
            lastHands = hands;
            lastHandsMs = timestampMs;
          } catch (error) {
            console.warn('Hand tracking stopped (body tracking continues):', error);
            handTracker.close();
            handTracker = undefined;
          }
        }
        frameIndex += 1;
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
            frameSize: { width: source.width, height: source.height },
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
      const [camera, model] = await Promise.allSettled([openCamera(deviceId), createLandmarkers(quality)]);
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
  }, [videoRef, attempt, quality, deviceId]);

  return { ...status, fps, frameAspect: frame.aspect, cropped: frame.cropped, retry };
}
