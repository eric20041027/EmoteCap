/**
 * Public motion-core API used by the web app. Import only from here.
 */
import type { MotionFrame, Vec3 } from './contract';
import { HAND_LANDMARK_COUNT, SIDES, type Side } from './hands';
import { LANDMARK_COUNT, toCanonical, type PoseLandmark } from './landmarks';
import { LandmarkFilter, type OneEuroParams } from './oneEuro';
import { groundedHipsHeight } from './skeleton';
import { calibrateRest, createSolverState, flattenRotations, solveRotations, type HandPoints } from './solver';

export * from './contract';
export { makeClip, type ClipOptions } from './clip';
export { fallbackSegments, motionEnergy, refineSegments } from './segments';
export type { PoseLandmark } from './landmarks';
export type { Side } from './hands';

/** MediaPipe Hand Landmarker world landmarks (21 per hand) keyed by the actor's own side. */
export type HandLandmarks = Partial<Record<Side, PoseLandmark[]>>;
export type { OneEuroParams } from './oneEuro';

export interface PoseSolver {
  /** Solve one frame from the 33 MediaPipe world landmarks. Returns null when no pose is available. */
  solve(worldLandmarks: PoseLandmark[] | undefined, t: number, hands?: HandLandmarks): MotionFrame | null;
  /** Treat the current pose (and tracked hands) as the actor's T-pose (call while the actor holds a T-pose). */
  calibrate(worldLandmarks: PoseLandmark[], hands?: HandLandmarks): void;
  /** Forget filter and continuity state (call when a new session starts). */
  reset(): void;
}

/** Stateful wrapper: One Euro filter -> rotation solver -> skeleton grounding (lowest sole on the floor). */
export function createPoseSolver(filterParams: Partial<OneEuroParams> = {}): PoseSolver {
  let filter = new LandmarkFilter(filterParams);
  let handFilters = { Left: new LandmarkFilter(filterParams), Right: new LandmarkFilter(filterParams) };
  let rotationState = createSolverState();
  let lastPoints: Vec3[] | null = null;
  let lastHands: HandPoints = {};

  const toHandPoints = (hands: HandLandmarks, t: number): HandPoints => {
    const out: HandPoints = {};
    for (const side of SIDES) {
      const h = hands[side];
      if (h && h.length === HAND_LANDMARK_COUNT) out[side] = handFilters[side].filter(h, t).map(toCanonical);
    }
    return out;
  };

  return {
    solve(worldLandmarks, t, hands = {}) {
      if (!worldLandmarks || worldLandmarks.length !== LANDMARK_COUNT) return null;
      const filtered = filter.filter(worldLandmarks, t);
      const points = filtered.map(toCanonical);
      const visibility = filtered.map((lm) => lm.visibility ?? 1);
      const handPoints = toHandPoints(hands, t);
      const rotation = solveRotations(points, visibility, rotationState, handPoints);
      rotationState = rotation.state;
      lastPoints = points;
      lastHands = handPoints;
      return { t, h: [0, groundedHipsHeight(rotation.rotations), 0], r: flattenRotations(rotation.rotations) };
    },
    calibrate(worldLandmarks, hands) {
      const points = lastPoints ?? (worldLandmarks.length === LANDMARK_COUNT ? worldLandmarks.map(toCanonical) : null);
      const rawHands: HandPoints = {};
      for (const side of SIDES) {
        const h = hands?.[side];
        if (h && h.length === HAND_LANDMARK_COUNT) rawHands[side] = h.map(toCanonical);
      }
      const handPoints = { ...rawHands, ...lastHands }; // prefer the filtered hands from the last solve
      if (points) rotationState = calibrateRest(points, rotationState, handPoints);
    },
    reset() {
      filter = new LandmarkFilter(filterParams);
      handFilters = { Left: new LandmarkFilter(filterParams), Right: new LandmarkFilter(filterParams) };
      rotationState = createSolverState();
      lastPoints = null;
      lastHands = {};
    },
  };
}
