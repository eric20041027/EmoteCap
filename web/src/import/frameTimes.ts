import type { MotionFrame } from '../motion/index';

/** Frames per second analysed from an imported video: the rate clips are exported at. */
export const IMPORT_FPS = 30;
/** Absorbs float error in the frame count (e.g. 29.999999 frames is 30). */
const EPSILON = 1e-6;

/**
 * Frame times 0, 1/fps, 2/fps, … staying at least half a frame before the end (a seek to the very end may never be
 * reported); always at least the first frame. Empty for a missing or endless duration.
 */
export function sampleTimes(duration: number, fps: number = IMPORT_FPS): number[] {
  if (!Number.isFinite(duration) || duration <= 0 || !(fps > 0)) return [];
  const last = duration - 1 / (2 * fps);
  const count = Math.max(1, Math.floor(last * fps + EPSILON) + 1);
  return Array.from({ length: count }, (_, i) => i / fps);
}

/**
 * The take must start at video time 0 so Gemini's cut times line up with the motion.
 * When nobody is found in the first frames, hold the first solved pose from t = 0.
 */
export function holdFromStart(frames: readonly MotionFrame[]): MotionFrame[] {
  if (frames.length === 0 || frames[0].t <= 0) return [...frames];
  const first = frames[0];
  return [{ t: 0, h: [...first.h], r: [...first.r] }, ...frames];
}
