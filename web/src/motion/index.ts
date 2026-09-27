/**
 * Public motion-core API used by the web app. Import only from here.
 *
 * Interim implementation: the solver returns the T-pose and makeClip does no resampling.
 * The motion-core plan (docs/superpowers/plans/*-p1-motion-core.md) replaces both
 * without changing these signatures, so the web lane can build against them now.
 */
import { CLIP_NAME_PATTERN, DEFAULT_FPS, tposeFrame, type Clip, type MotionFrame } from './contract';

export * from './contract';

/** One MediaPipe world landmark (meters, origin at the hip midpoint). */
export interface PoseLandmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface PoseSolver {
  /** Solve one frame from the 33 MediaPipe world landmarks. Returns null when no pose is available. */
  solve(worldLandmarks: PoseLandmark[] | undefined, t: number): MotionFrame | null;
  /** Treat the current pose as the actor's T-pose (call while the actor holds a T-pose). */
  calibrate(worldLandmarks: PoseLandmark[]): void;
  /** Forget filter and continuity state (call when a new session starts). */
  reset(): void;
}

export function createPoseSolver(): PoseSolver {
  return {
    solve: (worldLandmarks, t) => (worldLandmarks && worldLandmarks.length === 33 ? tposeFrame(t) : null),
    calibrate: () => undefined,
    reset: () => undefined,
  };
}

export interface ClipOptions {
  /** Seconds, inclusive, relative to the recording. */
  start: number;
  end: number;
  name: string;
  loop: boolean;
  fps?: number;
}

/** Cut [start, end] out of recorded frames and rebase time to 0. Throws on an invalid name or empty range. */
export function makeClip(frames: MotionFrame[], options: ClipOptions): Clip {
  if (!CLIP_NAME_PATTERN.test(options.name)) {
    throw new Error(`Invalid clip name "${options.name}": use 1-24 letters, digits, or underscores`);
  }
  const picked = frames
    .filter((f) => f.t >= options.start && f.t <= options.end)
    .map((f) => ({ ...f, t: f.t - options.start }));
  if (picked.length === 0) throw new Error('No frames in the selected range');
  return { name: options.name, loop: options.loop, fps: options.fps ?? DEFAULT_FPS, frames: picked };
}
