import type { MotionFrame } from '../motion/index';

/** Frames per second analysed from an imported video: the rate clips are exported at. */
export const IMPORT_FPS = 30;
/** Absorbs float error so a 1.0 s video at 30 fps still gets its frame at exactly 1.0 s. */
const EPSILON = 1e-6;

/** Frame times 0, 1/fps, 2/fps, … up to `duration` (seconds); empty for a missing or endless duration. */
export function sampleTimes(duration: number, fps: number = IMPORT_FPS): number[] {
  if (!Number.isFinite(duration) || duration <= 0 || !(fps > 0)) return [];
  const count = Math.floor(duration * fps + EPSILON) + 1;
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
