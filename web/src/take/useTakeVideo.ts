import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { RecorderState } from '../record/useRecorder';
import { startTakeVideo, type TakeVideoSession } from './takeVideo';

export type TakeVideo =
  | { status: 'none' }
  | { status: 'recording' }
  | { status: 'finishing' }
  | { status: 'ready'; blob: Blob }
  | { status: 'failed'; reason: string };

const NO_VIDEO: TakeVideo = { status: 'none' };
const RECORDING: TakeVideo = { status: 'recording' };
const FINISHING: TakeVideo = { status: 'finishing' };

function failed(error: unknown): TakeVideo {
  return { status: 'failed', reason: error instanceof Error ? error.message : String(error) };
}

/**
 * Records the raw camera stream while the recorder is in its 'recording' phase, so video t = 0 is
 * (within a frame) the take's first MotionFrame. A layout effect starts/stops it in the same commit
 * that starts/stops frame capture. The video is dropped when the take is discarded.
 */
export function useTakeVideo(
  videoRef: RefObject<HTMLVideoElement | null> | undefined,
  phase: RecorderState['phase'],
): TakeVideo {
  const [video, setVideo] = useState<TakeVideo>(NO_VIDEO);
  const generationRef = useRef(0);

  useLayoutEffect(() => {
    if (phase !== 'recording') return;
    generationRef.current += 1;
    const generation = generationRef.current;
    // Ignore results that arrive after the take was discarded or a new one started.
    const settle = (next: TakeVideo) => {
      if (generationRef.current === generation) setVideo(next);
    };
    let session: TakeVideoSession;
    try {
      session = startTakeVideo(videoRef?.current?.srcObject);
    } catch (error) {
      console.warn('Take video unavailable, auto-slice will split at pauses:', error);
      settle(failed(error));
      return;
    }
    settle(RECORDING);
    return () => {
      settle(FINISHING);
      session.stop().then(
        (blob) => settle({ status: 'ready', blob }),
        (error: unknown) => {
          console.warn('Take video failed:', error);
          settle(failed(error));
        },
      );
    };
  }, [phase, videoRef]);

  useEffect(() => {
    if (phase !== 'idle' && phase !== 'countdown') return;
    generationRef.current += 1;
    setVideo(NO_VIDEO);
  }, [phase]);

  return video;
}
