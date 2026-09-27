/**
 * Clip boundaries from motion energy (spec §6.2): snap Gemini's cut points to the nearest pause,
 * and split a take at pauses when Gemini is unavailable.
 */
import { BODY_BONE_COUNT, type MotionFrame, type Quat, type Segment } from './contract';
import { quatDot } from './math';

const SMOOTH_FRAMES = 5;
const SNAP_WINDOW_SECONDS = 0.75;
const MIN_CLIP_SECONDS = 0.3;
const MIN_PAUSE_SECONDS = 0.4;
/** Energy floor (rad/s summed over bones) below which the actor counts as still. */
const MIN_STILL_THRESHOLD = 0.3;
/** Relative part: a pause is below 20% of the take's busy (90th percentile) energy. */
const STILL_FRACTION_OF_P90 = 0.2;
/** Hips height change (m/s) is weighted so a squat registers like a limb swing. */
const HIPS_WEIGHT = 10;
/** Candidates within this fraction of the window's energy range count as ties. */
const TIE_TOLERANCE = 0.05;

const quatAt = (frame: MotionFrame, bone: number): Quat => frame.r.slice(bone * 4, bone * 4 + 4) as Quat;

function angleBetweenQuats(a: Quat, b: Quat): number {
  return 2 * Math.acos(Math.min(1, Math.abs(quatDot(a, b))));
}

function movingAverage(values: number[], window: number): number[] {
  const half = Math.floor(window / 2);
  return values.map((_, i) => {
    const from = Math.max(0, i - half);
    const to = Math.min(values.length, i + half + 1);
    let sum = 0;
    for (let j = from; j < to; j++) sum += values[j];
    return sum / (to - from);
  });
}

function percentile(values: readonly number[], fraction: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))];
}

/** Smoothed total angular speed per frame (rad/s over the body bones, plus weighted hips speed). */
export function motionEnergy(frames: readonly MotionFrame[]): number[] {
  if (frames.length < 2) return frames.map(() => 0);
  const raw = frames.map((frame, i) => {
    if (i === 0) return 0;
    const previous = frames[i - 1];
    const dt = Math.max(frame.t - previous.t, 1e-3);
    let angular = 0;
    // Body bones only: finger jitter should not split clips.
    for (let bone = 0; bone < BODY_BONE_COUNT; bone++) angular += angleBetweenQuats(quatAt(previous, bone), quatAt(frame, bone));
    return (angular + HIPS_WEIGHT * Math.abs(frame.h[1] - previous.h[1])) / dt;
  });
  raw[0] = raw[1];
  return movingAverage(raw, SMOOTH_FRAMES);
}

/** Time of the calmest frame in [t - window, t + window]; ties go to the first or last candidate. */
function snapToPause(
  frames: readonly MotionFrame[],
  energy: readonly number[],
  t: number,
  prefer: 'first' | 'last',
): number {
  const indices = frames.flatMap((f, i) => (Math.abs(f.t - t) <= SNAP_WINDOW_SECONDS ? [i] : []));
  if (indices.length === 0) return t;
  const values = indices.map((i) => energy[i]);
  const min = Math.min(...values);
  const cutoff = min + TIE_TOLERANCE * (Math.max(...values) - min);
  const calm = indices.filter((i) => energy[i] <= cutoff);
  return frames[prefer === 'first' ? calm[0] : calm[calm.length - 1]].t;
}

/** Move each segment's start/end to the nearest pause (start to the end of a pause, end to its beginning). */
export function refineSegments(segments: readonly Segment[], frames: readonly MotionFrame[]): Segment[] {
  const energy = motionEnergy(frames);
  const sorted = [...segments].sort((a, b) => a.start - b.start);
  const refined: Segment[] = [];
  let previousEnd = -Infinity;
  for (const s of sorted) {
    const start = Math.max(snapToPause(frames, energy, s.start, 'last'), previousEnd);
    const end = snapToPause(frames, energy, s.end, 'first');
    const next =
      end - start > MIN_CLIP_SECONDS
        ? { ...s, start, end }
        : { ...s, start: Math.max(s.start, previousEnd), end: Math.max(s.end, Math.max(s.start, previousEnd) + MIN_CLIP_SECONDS) };
    refined.push(next);
    previousEnd = next.end;
  }
  return refined;
}

/** Split a take at pauses (≥ 0.4 s of low energy). Used when Gemini is unavailable. */
export function fallbackSegments(frames: readonly MotionFrame[]): Segment[] {
  const energy = motionEnergy(frames);
  const threshold = Math.max(MIN_STILL_THRESHOLD, STILL_FRACTION_OF_P90 * percentile(energy, 0.9));
  const active = energy.map((e) => e >= threshold);

  const runs: { start: number; end: number }[] = [];
  let runStart: number | null = null;
  let stillSince: number | null = null;
  frames.forEach((frame, i) => {
    if (active[i]) {
      if (runStart === null) runStart = frame.t;
      stillSince = null;
      return;
    }
    if (runStart === null) return;
    stillSince ??= frame.t;
    if (frame.t - stillSince >= MIN_PAUSE_SECONDS) {
      runs.push({ start: runStart, end: stillSince });
      runStart = null;
      stillSince = null;
    }
  });
  if (runStart !== null) runs.push({ start: runStart, end: stillSince ?? frames[frames.length - 1].t });

  return runs
    .filter((run) => run.end - run.start >= MIN_CLIP_SECONDS)
    .map((run, i) => ({
      name: `Clip_${String(i + 1).padStart(2, '0')}`,
      start: run.start,
      end: run.end,
      loop: false,
      description: 'Split at a pause (automatic fallback)',
    }));
}
