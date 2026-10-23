/**
 * Public motion-core API used by the web app. Import only from here.
 */
import type { MotionFrame } from './contract';
import { HAND_LANDMARK_COUNT, SIDES, type Side } from './hands';
import { createJumpState, solveJumpLift } from './jump';
import { LANDMARK_COUNT, toCanonical, type PoseLandmark } from './landmarks';
import { LandmarkFilter, type OneEuroParams } from './oneEuro';
import { plantFeet } from './plant';
import { BoneRotationFilters, type SmoothingLevel } from './rotationFilter';
import { groundedHipsHeight } from './skeleton';
import {
  calibrateRest,
  createSolverState,
  flattenRotations,
  handRelaxAmount,
  relaxFingers,
  relaxHandToward,
  solveRotations,
  type HandPoints,
} from './solver';

export * from './contract';
export { makeClip, type ClipOptions } from './clip';
export { fallbackSegments, motionEnergy, refineSegments } from './segments';
export type { PoseLandmark } from './landmarks';
export type { Side } from './hands';

/** MediaPipe Hand Landmarker world landmarks (21 per hand) keyed by the actor's own side. */
export type HandLandmarks = Partial<Record<Side, PoseLandmark[]>>;
export type { OneEuroParams } from './oneEuro';
export type { SmoothingLevel } from './rotationFilter';

export interface PoseSolver {
  /**
   * Solve one frame from the 33 MediaPipe world landmarks (plus tracked hands and, for jump detection,
   * the same frame's normalized image landmarks). Returns null when no pose is available.
   */
  solve(worldLandmarks: PoseLandmark[] | undefined, t: number, hands?: HandLandmarks, image?: PoseLandmark[]): MotionFrame | null;
  /** Treat the current pose (and tracked hands) as the actor's T-pose (call while the actor holds a T-pose). */
  calibrate(worldLandmarks: PoseLandmark[], hands?: HandLandmarks): void;
  /** Straighten untracked fingers along their hands (body-only skeleton). */
  relaxFingers(): void;
  /** Rotation smoothing: low = most responsive, high = steadiest. Applies from the next frame. */
  setSmoothing(level: SmoothingLevel): void;
  /** Forget filter and continuity state (call when a new session starts). */
  reset(): void;
}

/**
 * Stateful wrapper: landmark filter -> rotation solver -> rotation filter -> foot planting -> grounding + jump lift.
 */
export function createPoseSolver(filterParams: Partial<OneEuroParams> = {}, smoothing: SmoothingLevel = 'medium'): PoseSolver {
  let filter = new LandmarkFilter(filterParams);
  let handFilters = { Left: new LandmarkFilter(filterParams), Right: new LandmarkFilter(filterParams) };
  let rotationState = createSolverState();
  let rotationFilters = new BoneRotationFilters(smoothing);
  let smoothingLevel = smoothing;
  let jumpState = createJumpState();
  let lastSolveTime: number | null = null;
  let handLastSeen: Partial<Record<Side, number>> = {};

  /** A hand that stays out of view stops freezing its last finger pose and eases into a resting hand. */
  const relaxMissingHands = (handPoints: HandPoints, t: number) => {
    const dt = lastSolveTime === null ? 0 : t - lastSolveTime;
    lastSolveTime = t;
    for (const side of SIDES) {
      if (handPoints[side]) {
        handLastSeen[side] = t;
        continue;
      }
      const missing = t - (handLastSeen[side] ?? Number.NEGATIVE_INFINITY);
      rotationState = relaxHandToward(rotationState, side, handRelaxAmount(missing, dt));
    }
  };

  const toHandPoints = (hands: HandLandmarks, t: number): HandPoints => {
    const out: HandPoints = {};
    for (const side of SIDES) {
      const h = hands[side];
      if (h && h.length === HAND_LANDMARK_COUNT) out[side] = handFilters[side].filter(h, t).map(toCanonical);
    }
    return out;
  };

  return {
    solve(worldLandmarks, t, hands = {}, image) {
      if (!Number.isFinite(t)||t<0||!worldLandmarks || worldLandmarks.length !== LANDMARK_COUNT) return null;
      const filtered = filter.filter(worldLandmarks, t);
      const points = filtered.map(toCanonical);
      const visibility = filtered.map((lm) => lm.visibility ?? 1);
      const handPoints = toHandPoints(hands, t);
      relaxMissingHands(handPoints, t);
      const rotation = solveRotations(points, visibility, rotationState, handPoints);
      rotationState = rotation.state;
      const jump = solveJumpLift(image, points, visibility, t, jumpState);
      jumpState = jump.state;
      const planted = plantFeet(rotationFilters.filter(rotation.rotations, t));
      const hipsY = groundedHipsHeight(planted) + jump.lift;
      return { t, h: [0, hipsY, 0], r: flattenRotations(planted) };
    },
    calibrate(worldLandmarks, hands) {
      if(worldLandmarks.length!==LANDMARK_COUNT||!worldLandmarks.every(p=>[p.x,p.y,p.z].every(Number.isFinite)))
        throw new Error('Calibration requires finite world landmarks.');
      const points = worldLandmarks.map(toCanonical);
      const rawHands: HandPoints = {};
      for (const side of SIDES) {
        const h = hands?.[side];
        if(h && (h.length!==HAND_LANDMARK_COUNT||!h.every(p=>[p.x,p.y,p.z].every(Number.isFinite))))
          throw new Error('Calibration requires finite hand landmarks.');
        if(h)rawHands[side]=h.map(toCanonical);
      }
      rotationState=calibrateRest(points,rotationState,rawHands);
      filter=new LandmarkFilter(filterParams);
      handFilters={Left:new LandmarkFilter(filterParams),Right:new LandmarkFilter(filterParams)};
      rotationFilters=new BoneRotationFilters(smoothingLevel);
      jumpState=createJumpState();lastSolveTime=null;handLastSeen={};
    },
    setSmoothing(level) {
      smoothingLevel = level;
      rotationFilters = new BoneRotationFilters(level);
    },
    relaxFingers() {
      rotationState = relaxFingers(rotationState);
    },
    reset() {
      filter = new LandmarkFilter(filterParams);
      handFilters = { Left: new LandmarkFilter(filterParams), Right: new LandmarkFilter(filterParams) };
      rotationState = createSolverState();
      rotationFilters = new BoneRotationFilters(smoothingLevel);
      jumpState = createJumpState();
      lastSolveTime = null;
      handLastSeen = {};
    },
  };
}
