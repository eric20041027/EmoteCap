/**
 * Public motion-core API used by the web app. Import only from here.
 */
import type { MotionFrame, Vec3 } from './contract';
import { LANDMARK_COUNT, toCanonical, type PoseLandmark } from './landmarks';
import { LandmarkFilter, type OneEuroParams } from './oneEuro';
import { groundedHipsHeight } from './skeleton';
import { calibrateRest, createSolverState, flattenRotations, solveRotations } from './solver';

export * from './contract';
export { makeClip, type ClipOptions } from './clip';
export { fallbackSegments, motionEnergy, refineSegments } from './segments';
export type { PoseLandmark } from './landmarks';
export type { OneEuroParams } from './oneEuro';

export interface PoseSolver {
  /** Solve one frame from the 33 MediaPipe world landmarks. Returns null when no pose is available. */
  solve(worldLandmarks: PoseLandmark[] | undefined, t: number): MotionFrame | null;
  /** Treat the current pose as the actor's T-pose (call while the actor holds a T-pose). */
  calibrate(worldLandmarks: PoseLandmark[]): void;
  /** Forget filter and continuity state (call when a new session starts). */
  reset(): void;
}

/** Stateful wrapper: One Euro filter -> rotation solver -> skeleton grounding (lowest sole on the floor). */
export function createPoseSolver(filterParams: Partial<OneEuroParams> = {}): PoseSolver {
  let filter = new LandmarkFilter(filterParams);
  let rotationState = createSolverState();
  let lastPoints: Vec3[] | null = null;

  return {
    solve(worldLandmarks, t) {
      if (!worldLandmarks || worldLandmarks.length !== LANDMARK_COUNT) return null;
      const filtered = filter.filter(worldLandmarks, t);
      const points = filtered.map(toCanonical);
      const visibility = filtered.map((lm) => lm.visibility ?? 1);
      const rotation = solveRotations(points, visibility, rotationState);
      rotationState = rotation.state;
      lastPoints = points;
      return { t, h: [0, groundedHipsHeight(rotation.rotations), 0], r: flattenRotations(rotation.rotations) };
    },
    calibrate(worldLandmarks) {
      const points = lastPoints ?? (worldLandmarks.length === LANDMARK_COUNT ? worldLandmarks.map(toCanonical) : null);
      if (points) rotationState = calibrateRest(points, rotationState);
    },
    reset() {
      filter = new LandmarkFilter(filterParams);
      rotationState = createSolverState();
      lastPoints = null;
    },
  };
}
