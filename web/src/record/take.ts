import { CLIP_NAME_PATTERN, type MotionFrame } from '../motion/index';

export const DEFAULT_CLIP_NAME = 'Clip_01';
const MAX_CLIP_NAME_LENGTH = 24;
const NUMBERED_NAME = /^(.*)_(\d+)$/;

/** "Clip_01" -> "Clip_02", "Wave" -> "Wave_02"; keeps the result a valid clip name (<= 24 chars). */
export function nextClipName(current: string): string {
  if (!CLIP_NAME_PATTERN.test(current)) return DEFAULT_CLIP_NAME;
  const match = NUMBERED_NAME.exec(current);
  const base = match ? match[1] : current;
  const number = match ? Number(match[2]) + 1 : 2;
  const width = match ? match[2].length : 2;
  const suffix = `_${String(number).padStart(width, '0')}`;
  return base.slice(0, MAX_CLIP_NAME_LENGTH - suffix.length) + suffix;
}

/** Duration of a take in seconds (frames are re-based so the first frame is t = 0). */
export function takeDuration(frames: readonly MotionFrame[]): number {
  return frames.length > 0 ? frames[frames.length - 1].t : 0;
}

/** Frame nearest to time t (frames sorted by t); clamps outside the take. */
export function frameAtTime(frames: readonly MotionFrame[], t: number): MotionFrame | undefined {
  if (frames.length === 0) return undefined;
  let lo = 0;
  let hi = frames.length - 1;
  if (t <= frames[lo].t) return frames[lo];
  if (t >= frames[hi].t) return frames[hi];
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (frames[mid].t <= t) lo = mid;
    else hi = mid;
  }
  return t - frames[lo].t <= frames[hi].t - t ? frames[lo] : frames[hi];
}
