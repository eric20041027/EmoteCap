/**
 * Frame-by-frame conversion of an imported video into a take. The video reader, landmarkers and solver are
 * passed in, so the loop itself is plain logic.
 */
import type { Landmark, NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { TrackedHands } from '../capture/hands';
import type { MotionFrame, PoseSolver } from '../motion/index';
import { holdFromStart, sampleTimes } from './frameTimes';

/** Error whose message is already user-facing. */
export class ImportError extends Error {}

export const NO_PERSON_MESSAGE = 'No person found in this video. Use a clip where one whole body is visible.';
/** A frame the landmarkers fail on counts as empty; this many failures in a row means they are broken for good. */
export const MAX_FAILED_FRAMES_IN_A_ROW = 10;

/** What the landmarkers found in one video frame. */
export interface FrameDetection {
  /** Pose world landmarks (solver input); undefined when nobody is in the frame. */
  world: Landmark[] | undefined;
  /** Normalized image landmarks of the same pose (overlay and jump detection). */
  image: NormalizedLandmark[] | undefined;
  hands: TrackedHands;
}

export interface ConvertProgress {
  /** Frames analysed so far, out of `total`. */
  done: number;
  total: number;
  /** The solved frame, or null when nobody was found in this one. */
  frame: MotionFrame | null;
  detection: FrameDetection;
}

export interface ConvertSteps {
  /** Show the video frame at time t (seconds); resolves once it can be read. */
  seek: (t: number) => Promise<void>;
  /** Run the landmarkers on the frame currently shown; timestamps grow with every call. */
  detect: (timestampMs: number) => FrameDetection;
  /** A fresh solver, so no filter state leaks in from the live camera. */
  solver: PoseSolver;
  onProgress?: (progress: ConvertProgress) => void;
  signal?: AbortSignal;
}

const NOTHING_FOUND: FrameDetection = { world: undefined, image: undefined, hands: { world: {}, image: {} } };

/**
 * Analyse a video at the export rate. Resolves with a take timed in video seconds and starting at 0;
 * rejects with the signal's reason when cancelled, or an ImportError when nobody is found.
 */
export async function convertVideo(duration: number, steps: ConvertSteps): Promise<MotionFrame[]> {
  const { seek, detect, solver, onProgress, signal } = steps;
  const times = sampleTimes(duration);
  const frames: MotionFrame[] = [];
  let failedInARow = 0;
  for (const [index, t] of times.entries()) {
    signal?.throwIfAborted();
    await seek(t);
    signal?.throwIfAborted();
    let detection = NOTHING_FOUND;
    try {
      detection = detect(t * 1000);
      failedInARow = 0;
    } catch (error) {
      failedInARow += 1;
      if (failedInARow >= MAX_FAILED_FRAMES_IN_A_ROW) throw error;
      console.warn(`Pose detection failed at ${t.toFixed(2)} s; skipping that frame.`, error);
    }
    const frame = solver.solve(detection.world, t, detection.hands.world, detection.image);
    if (frame) frames.push(frame);
    onProgress?.({ done: index + 1, total: times.length, frame, detection });
  }
  if (frames.length === 0) throw new ImportError(NO_PERSON_MESSAGE);
  return holdFromStart(frames);
}
