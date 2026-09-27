/**
 * Hips height so the lowest foot touches the floor (spec §6.1 item 6), scaled to the canonical skeleton.
 */
import { H0, type Vec3 } from './contract';
import { LM } from './landmarks';
import { length, midpoint, sub } from './math';

/** Canonical hip-joint -> ankle length (0.43 thigh + 0.42 shin). */
const CANONICAL_LEG = 0.85;
/** Canonical Hips bone head (0.95) sits 0.02 above the hip landmarks (0.93). */
const HIPS_ABOVE_HIP_JOINTS = H0 - 0.93;
const LEG_WINDOW = 30;
const MIN_VISIBILITY = 0.5;
const FOOT_POINTS = [LM.leftHeel, LM.rightHeel, LM.leftFootIndex, LM.rightFootIndex];
const LEGS = [
  [LM.leftHip, LM.leftKnee, LM.leftAnkle],
  [LM.rightHip, LM.rightKnee, LM.rightAnkle],
] as const;

export interface GroundingState {
  /** Actor leg lengths from recent frames (meters). */
  readonly legLengths: readonly number[];
  readonly hipsY: number;
}

export const createGroundingState = (): GroundingState => ({ legLengths: [], hipsY: H0 });

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Pure: returns the Hips height (canonical meters) and the next state. */
export function solveHipsHeight(
  points: Vec3[],
  visibility: readonly number[],
  state: GroundingState,
): { hipsY: number; state: GroundingState } {
  const isVisible = (i: number) => (visibility[i] ?? 0) >= MIN_VISIBILITY;
  const feet = FOOT_POINTS.filter(isVisible);
  if (feet.length === 0 || !isVisible(LM.leftHip) || !isVisible(LM.rightHip)) {
    return { hipsY: state.hipsY, state };
  }

  const legs = LEGS.filter((leg) => leg.every(isVisible)).map(
    ([hip, knee, ankle]) => length(sub(points[knee], points[hip])) + length(sub(points[ankle], points[knee])),
  );
  const legLengths =
    legs.length > 0 ? [...state.legLengths, legs.reduce((a, b) => a + b, 0) / legs.length].slice(-LEG_WINDOW) : state.legLengths;
  const actorLeg = legLengths.length > 0 ? median(legLengths) : CANONICAL_LEG;

  const hipMid = midpoint(points[LM.leftHip], points[LM.rightHip]);
  const lowestFoot = Math.min(...feet.map((i) => points[i][1]));
  const hipsY = HIPS_ABOVE_HIP_JOINTS + (hipMid[1] - lowestFoot) * (CANONICAL_LEG / actorLeg);
  return { hipsY, state: { legLengths, hipsY } };
}
