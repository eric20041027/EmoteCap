import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { drawPoseOverlay } from '../capture/drawPoseOverlay';
import { CaptureError, closeLandmarkers, createLandmarkers } from '../capture/landmarkers';
import { createPoseSolver, type MotionFrame, type SmoothingLevel } from '../motion/index';
import type { TakeNote } from '../record/useRecorder';
import { ImportError, convertVideo, type ConvertedVideo } from './convertVideo';
import { createFrameDetector } from './detectFrame';
import { closeVideoFile, openVideoFile, seekTo } from './videoSource';
import { ProcessingConsent, ProcessingConsentError, type SdkAuthorization } from '../privacy/processingConsent';

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
  processingConsent:ProcessingConsent;
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
  if (error instanceof ImportError || error instanceof CaptureError || error instanceof ProcessingConsentError) return error.message;
  return `Import failed: ${error instanceof Error ? error.message : String(error)}`;
}

/** Turn a video file into a take: read every frame, solve it, then hand the take to the recorder. */
export function useVideoImport(options: VideoImportOptions): VideoImport {
  const [picked, setPicked] = useState<{file:File;authorize:SdkAuthorization;generation:number}|null>(null);
  const generation=useRef(0);
  const [state, setState] = useState<ImportState>(IDLE);
  const [aspect, setAspect] = useState(DEFAULT_ASPECT);
  const optionsRef = useRef(options);

  useLayoutEffect(() => {
    optionsRef.current = options;
  });

  const start = useCallback((picked: File) => {
    const id=++generation.current;
    let authorize:SdkAuthorization;
    try {authorize=optionsRef.current.processingConsent.lease();authorize();}
    catch(error){setPicked(null);setState({phase:'idle',error:describeImportError(error)});return;}
    setState({ phase: 'loading', fileName: picked.name });
    setAspect(DEFAULT_ASPECT);
    setPicked({file:picked,authorize,generation:id});
  }, []);

  const cancel = useCallback(() => {
    generation.current+=1;
    setPicked(null);
    setState(IDLE);
  }, []);

  // Runs once the import view (and its <video>) is on screen for the picked file.
  useEffect(() => {
    const video = optionsRef.current.videoRef.current;
    if (!picked || !video) return;
    const {file}=picked;
    const controller = new AbortController();
    const { signal } = controller;
    const active=()=>!signal.aborted&&generation.current===picked.generation;
    const authorize=()=>{
      signal.throwIfAborted();
      if(!active())throw new DOMException('Import superseded','AbortError');
      picked.authorize();
    };

    const run = async (): Promise<ConvertedVideo> => {
      authorize();
      const duration = await openVideoFile(file, video, signal);
      authorize();
      setAspect(video.videoWidth / video.videoHeight);
      const landmarkers = await createLandmarkers('accurate',authorize);
      try {
        authorize();
        const { trackHands, smoothing } = optionsRef.current;
        const detect = createFrameDetector(landmarkers, trackHands,authorize);
        const frameSize = { width: video.videoWidth, height: video.videoHeight };
        const startedAt = performance.now();
        let publishedAt = 0;
        return await convertVideo(duration, {
          seek: async(t) => {authorize();await seekTo(video,t,signal);authorize();},
          detect: (timestampMs) => detect(video, timestampMs),
          createSolver: () => createPoseSolver({}, smoothing),
          aspect: frameSize.width / frameSize.height,
          signal,
          onProgress: ({ done, total, frame, detection }) => {
            authorize();
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

    void run().then(
      ({ frames, calibratedAt }) => {
        if (!active()) return;
        authorize();
        setPicked(null);
        setState(IDLE);
        optionsRef.current.onDone(frames, file, calibrationNote(calibratedAt));
      },
    ).catch((error: unknown) => {
        if (!active()) return;
        console.error('Video import failed:', error);
        setPicked(null);
        setState({ phase: 'idle', error: describeImportError(error) });
    });

    return () => {
      controller.abort();
      closeVideoFile(video);
    };
  }, [picked]);

  return { state, aspect, start, cancel };
}
