import { BONE_COUNT, CLIP_NAME_PATTERN, DEFAULT_FPS, type Clip, type MotionFrame, type Quat, type Vec3 } from './contract';
import { lerp, quatNormalize, quatSlerp, sameHemisphere } from './math';

export interface ClipOptions {
  /** Seconds, inclusive, relative to the recording. */
  start: number;
  end: number;
  name: string;
  loop: boolean;
  fps?: number;
  /** Zero-lag smoothing over neighbouring frames (default on); recorded clips can look ahead, live tracking cannot. */
  smooth?: boolean;
}

const round4 = (value: number) => Math.round(value * 10000) / 10000;

/** Centred 5-tap kernel (about 0.17 s at 30 fps): removes jitter, keeps timing. */
const SMOOTH_WEIGHTS = [1, 2, 3, 2, 1];
const SMOOTH_HALF = (SMOOTH_WEIGHTS.length - 1) / 2;

const quatAt = (frame: MotionFrame, bone: number): Quat => frame.r.slice(bone * 4, bone * 4 + 4) as Quat;

/** Weighted average of each bone's quaternions (aligned to the centre frame) and of the hips position. */
function smoothFrames(frames: MotionFrame[]): MotionFrame[] {
  return frames.map((frame, k) => {
    const r: number[] = [];
    for (let bone = 0; bone < BONE_COUNT; bone++) {
      const centre = quatAt(frame, bone);
      const sum: Quat = [0, 0, 0, 0];
      for (let j = -SMOOTH_HALF; j <= SMOOTH_HALF; j++) {
        const neighbour = frames[k + j];
        if (!neighbour) continue;
        const q = sameHemisphere(quatAt(neighbour, bone), centre);
        const w = SMOOTH_WEIGHTS[j + SMOOTH_HALF];
        for (let c = 0; c < 4; c++) sum[c] += w * q[c];
      }
      r.push(...quatNormalize(sum));
    }
    const h: Vec3 = [0, 0, 0];
    let weight = 0;
    for (let j = -SMOOTH_HALF; j <= SMOOTH_HALF; j++) {
      const neighbour = frames[k + j];
      if (!neighbour) continue;
      const w = SMOOTH_WEIGHTS[j + SMOOTH_HALF];
      for (let c = 0; c < 3; c++) h[c] += w * neighbour.h[c];
      weight += w;
    }
    return { t: frame.t, h: h.map((v) => v / weight) as Vec3, r };
  });
}

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
  return { name: options.name, loop: options.loop, fps, frames: options.smooth === false ? out : smoothFrames(out) };
}
