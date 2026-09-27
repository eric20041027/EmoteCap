/**
 * Frame-by-frame conversion of an imported video into a take. The video reader, landmarkers and solver are
 * passed in, so the loop itself is plain logic.
 */
import type { Landmark, NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { TrackedHands } from '../capture/hands';
import type { MotionFrame, PoseSolver } from '../motion/index';
import { holdFromStart, sampleTimes } from './frameTimes';
import { firstHeldRun, isTPose } from './tpose';

/** Error whose message is already user-facing. */
export class ImportError extends Error {}

export const NO_PERSON_MESSAGE = 'No person found in this video. Use a clip where one whole body is visible.';
/** A frame the landmarkers fail on counts as empty; this many failures in a row means they are broken for good. */
export const MAX_FAILED_FRAMES_IN_A_ROW = 10;
/** A T-pose must last this many frames (about a quarter second) to count as the calibration pose. */
export const T_POSE_HOLD_FRAMES = 8;

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
  /** Fresh solvers (one for the live preview, one for the final take), so no state leaks in from the camera. */
  createSolver: () => PoseSolver;
  /** Width / height of the video frame, to judge the T-pose in real proportions. */
  aspect: number;
  onProgress?: (progress: ConvertProgress) => void;
  signal?: AbortSignal;
}

export interface ConvertedVideo {
  /** Timed in video seconds, starting at 0. */
  frames: MotionFrame[];
  /** Video time (s) of the T-pose the take was calibrated from, or null when there was none. */
  calibratedAt: number | null;
}

const NOTHING_FOUND: FrameDetection = { world: undefined, image: undefined, hands: { world: {}, image: {} } };

interface AnalysedFrame {
  t: number;
  detection: FrameDetection;
}

function calibrateFrom(solver: PoseSolver, detection: FrameDetection): void {
  if (detection.world) solver.calibrate(detection.world, detection.hands.world);
}

/**
 * Analyse a video at the export rate in two passes. Pass 1 reads every frame (the slow part) and drives the live
 * preview, which switches to the actor's calibration as soon as a T-pose has been held. Pass 2 solves the whole
 * take with a fresh solver calibrated from that T-pose, so the head and posture are right from the first frame
 * (MediaPipe's 3D face and lean estimates are biased until calibrated).
 * Rejects with the signal's reason when cancelled, or an ImportError when nobody is found.
 */
export async function convertVideo(duration: number, steps: ConvertSteps): Promise<ConvertedVideo> {
  const { seek, detect, createSolver, aspect, onProgress, signal } = steps;
  const times = sampleTimes(duration);
  const analysed: AnalysedFrame[] = [];
  const tposeFlags: boolean[] = [];
  const preview = createSolver();
  let previewCalibrated = false;
  let tposeRun = 0;
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
    analysed.push({ t, detection });
    const isT = isTPose(detection.image, aspect);
    tposeFlags.push(isT);
    tposeRun = isT ? tposeRun + 1 : 0;
    if (!previewCalibrated && tposeRun === T_POSE_HOLD_FRAMES) {
      const runStart = index - T_POSE_HOLD_FRAMES + 1;
      calibrateFrom(preview, analysed[runStart + Math.floor(T_POSE_HOLD_FRAMES / 2)].detection);
      previewCalibrated = true;
    }
    const frame = preview.solve(detection.world, t, detection.hands.world, detection.image);
    onProgress?.({ done: index + 1, total: times.length, frame, detection });
  }

  const calibration = firstHeldRun(tposeFlags, T_POSE_HOLD_FRAMES);
  const solver = createSolver();
  if (calibration !== null) calibrateFrom(solver, analysed[calibration].detection);
  const frames: MotionFrame[] = [];
  for (const { t, detection } of analysed) {
    const frame = solver.solve(detection.world, t, detection.hands.world, detection.image);
    if (frame) frames.push(frame);
  }
  if (frames.length === 0) throw new ImportError(NO_PERSON_MESSAGE);
  return { frames: holdFromStart(frames), calibratedAt: calibration === null ? null : analysed[calibration].t };
}
