import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { drawPoseOverlay } from '../capture/drawPoseOverlay';
import { CaptureError, closeLandmarkers, createLandmarkers } from '../capture/landmarkers';
import { createPoseSolver, type MotionFrame, type SmoothingLevel } from '../motion/index';
import type { TakeNote } from '../record/useRecorder';
import { ImportError, convertVideo, type ConvertedVideo } from './convertVideo';
import { createFrameDetector } from './detectFrame';
import { closeVideoFile, openVideoFile, seekTo } from './videoSource';

export type ImportState =
  | { phase: 'idle'; error?: string }
  | { phase: 'loading'; fileName: string }
  | { phase: 'converting'; fileName: string; done: number; total: number; startedAt: number };

export interface VideoImport {
  state: ImportState;
  /** Width / height of the imported video, for sizing its view. */
  aspect: number;
  start: (file: File) => void;
  cancel: () => void;
}

export interface VideoImportOptions {
  /** The <video> the file is read in (shown in the Camera panel while importing). */
  videoRef: RefObject<HTMLVideoElement | null>;
  overlayRef: RefObject<HTMLCanvasElement | null>;
  trackHands: boolean;
  smoothing: SmoothingLevel;
  /** Every solved frame as soon as it is solved (3D preview, Live Link). */
  onFrame: (frame: MotionFrame) => void;
  /** The finished take (frames timed in video seconds), its source file, and how it was calibrated. */
  onDone: (frames: MotionFrame[], video: File, note: TakeNote) => void;
}

const IDLE: ImportState = { phase: 'idle' };
const DEFAULT_ASPECT = 16 / 9;
/** Progress re-renders the app; a few times a second is plenty. */
const PROGRESS_PUBLISH_MS = 200;

function calibrationNote(calibratedAt: number | null): TakeNote {
  return calibratedAt === null
    ? {
        tone: 'warn',
        text: 'No T-pose found, so posture is not calibrated and the head may tilt. Start the video with a one-second T-pose.',
      }
    : { tone: 'ok', text: `Auto-calibrated from the T-pose at ${calibratedAt.toFixed(1)} s.` };
}

function describeImportError(error: unknown): string {
  if (error instanceof ImportError || error instanceof CaptureError) return error.message;
  return `Import failed: ${error instanceof Error ? error.message : String(error)}`;
}

/** Turn a video file into a take: read every frame, solve it, then hand the take to the recorder. */
export function useVideoImport(options: VideoImportOptions): VideoImport {
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<ImportState>(IDLE);
  const [aspect, setAspect] = useState(DEFAULT_ASPECT);
  const optionsRef = useRef(options);

  useLayoutEffect(() => {
    optionsRef.current = options;
  });

  const start = useCallback((picked: File) => {
    setState({ phase: 'loading', fileName: picked.name });
    setAspect(DEFAULT_ASPECT);
    setFile(picked);
  }, []);

  const cancel = useCallback(() => {
    setFile(null);
    setState(IDLE);
  }, []);

  // Runs once the import view (and its <video>) is on screen for the picked file.
  useEffect(() => {
    const video = optionsRef.current.videoRef.current;
    if (!file || !video) return;
    const controller = new AbortController();
    const { signal } = controller;

    const run = async (): Promise<ConvertedVideo> => {
      const duration = await openVideoFile(file, video, signal);
      setAspect(video.videoWidth / video.videoHeight);
      const landmarkers = await createLandmarkers('accurate');
      try {
        signal.throwIfAborted();
        const { trackHands, smoothing } = optionsRef.current;
        const detect = createFrameDetector(landmarkers, trackHands);
        const frameSize = { width: video.videoWidth, height: video.videoHeight };
        const startedAt = performance.now();
        let publishedAt = 0;
        return await convertVideo(duration, {
          seek: (t) => seekTo(video, t, signal),
          detect: (timestampMs) => detect(video, timestampMs),
          createSolver: () => createPoseSolver({}, smoothing),
          aspect: frameSize.width / frameSize.height,
          signal,
          onProgress: ({ done, total, frame, detection }) => {
            drawPoseOverlay(optionsRef.current.overlayRef.current, frameSize, detection.image, detection.hands.image);
            if (frame) optionsRef.current.onFrame(frame);
            const now = performance.now();
            if (now - publishedAt < PROGRESS_PUBLISH_MS && done < total) return;
            publishedAt = now;
            setState({ phase: 'converting', fileName: file.name, done, total, startedAt });
          },
        });
      } finally {
        closeLandmarkers(landmarkers);
      }
    };

    run().then(
      ({ frames, calibratedAt }) => {
        if (signal.aborted) return;
        setFile(null);
        setState(IDLE);
        optionsRef.current.onDone(frames, file, calibrationNote(calibratedAt));
      },
      (error: unknown) => {
        if (signal.aborted) return;
        console.error('Video import failed:', error);
        setFile(null);
        setState({ phase: 'idle', error: describeImportError(error) });
      },
    );

    return () => {
      controller.abort();
      closeVideoFile(video);
    };
  }, [file]);

  return { state, aspect, start, cancel };
}
