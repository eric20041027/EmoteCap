import { BONE_COUNT, CLIP_NAME_PATTERN, DEFAULT_FPS, type Clip, type MotionFrame, type Quat, type Vec3 } from './contract';
import { lerp, quatSlerp } from './math';

export interface ClipOptions {
  /** Seconds, inclusive, relative to the recording. */
  start: number;
  end: number;
  name: string;
  loop: boolean;
  fps?: number;
}

const round4 = (value: number) => Math.round(value * 10000) / 10000;

function interpolate(a: MotionFrame, b: MotionFrame, u: number): Pick<MotionFrame, 'h' | 'r'> {
  const h = lerp(a.h, b.h, u) as Vec3;
  const r: number[] = [];
  for (let i = 0; i < BONE_COUNT; i++) {
    const qa = a.r.slice(i * 4, i * 4 + 4) as Quat;
    const qb = b.r.slice(i * 4, i * 4 + 4) as Quat;
    r.push(...quatSlerp(qa, qb, u));
  }
  return { h, r };
}

/**
 * Cut [start, end] out of recorded frames and resample to exactly `fps` (frame k has t = k / fps).
 * Throws on an invalid name or an empty range.
 */
export function makeClip(frames: readonly MotionFrame[], options: ClipOptions): Clip {
  if (!CLIP_NAME_PATTERN.test(options.name)) {
    throw new Error(`Invalid clip name "${options.name}": use 1-24 letters, digits, or underscores`);
  }
  const fps = options.fps ?? DEFAULT_FPS;
  const picked = frames.filter((f) => f.t >= options.start && f.t <= options.end).sort((a, b) => a.t - b.t);
  if (picked.length === 0) throw new Error('No frames in the selected range');

  const t0 = picked[0].t;
  const duration = picked[picked.length - 1].t - t0;
  const count = Math.floor(duration * fps + 1e-6) + 1;
  const out: MotionFrame[] = [];
  let j = 0;
  for (let k = 0; k < count; k++) {
    const t = t0 + k / fps;
    while (j < picked.length - 2 && picked[j + 1].t <= t) j++;
    const a = picked[j];
    const b = picked[Math.min(j + 1, picked.length - 1)];
    const span = b.t - a.t;
    const u = span > 0 ? Math.min(1, Math.max(0, (t - a.t) / span)) : 0;
    out.push({ t: round4(k / fps), ...interpolate(a, b, u) });
  }
  return { name: options.name, loop: options.loop, fps, frames: out };
}
