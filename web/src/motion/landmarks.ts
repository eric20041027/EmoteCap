import type { Vec3 } from './contract';

/** One MediaPipe world landmark (meters, origin at the hip midpoint, y down, z away from camera). */
export interface PoseLandmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export const LANDMARK_COUNT = 33;

/** MediaPipe BlazePose indices used by the solver. Left/right are the actor's own sides. */
export const LM = {
  nose: 0,
  leftEar: 7,
  rightEar: 8,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftPinky: 17,
  rightPinky: 18,
  leftIndex: 19,
  rightIndex: 20,
  leftThumb: 21,
  rightThumb: 22,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
  leftHeel: 29,
  rightHeel: 30,
  leftFootIndex: 31,
  rightFootIndex: 32,
} as const;

/** MediaPipe world landmark -> canonical (right-handed, +Y up, character faces +Z). */
export const toCanonical = (lm: PoseLandmark): Vec3 => [lm.x, -lm.y, -lm.z];

/** Canonical point -> MediaPipe world landmark (inverse of toCanonical). */
export const fromCanonical = (p: Vec3, visibility = 1): PoseLandmark => ({ x: p[0], y: -p[1], z: -p[2], visibility });

/**
 * Canonical positions of all 33 landmarks for an actor in the contract's T-pose
 * (palms down, facing +Z). The solver derives its default rest frames from these.
 */
export function tposeCanonical(): Vec3[] {
  const left: Record<number, Vec3> = {
    1: [0.015, 1.63, 0.08], // eye inner
    2: [0.03, 1.63, 0.08], // eye
    3: [0.045, 1.63, 0.07], // eye outer
    7: [0.075, 1.62, -0.02], // ear
    9: [0.025, 1.57, 0.09], // mouth
    11: [0.18, 1.4, 0], // shoulder
    13: [0.46, 1.4, 0], // elbow
    15: [0.72, 1.4, 0], // wrist
    17: [0.88, 1.4, -0.03], // pinky
    19: [0.9, 1.4, 0.03], // index
    21: [0.8, 1.4, 0.06], // thumb
    23: [0.09, 0.93, 0], // hip
    25: [0.09, 0.5, 0], // knee
    27: [0.09, 0.08, 0], // ankle
    29: [0.09, 0.02, -0.05], // heel
    31: [0.09, 0, 0.17], // foot index (toes)
  };
  const rightOf: Record<number, number> = { 1: 4, 2: 5, 3: 6, 7: 8, 9: 10, 11: 12, 13: 14, 15: 16, 17: 18, 19: 20, 21: 22, 23: 24, 25: 26, 27: 28, 29: 30, 31: 32 };
  const points: Vec3[] = Array.from({ length: LANDMARK_COUNT }, () => [0, 0, 0] as Vec3);
  points[LM.nose] = [0, 1.6, 0.1];
  for (const [index, p] of Object.entries(left)) {
    const i = Number(index);
    points[i] = [...p];
    points[rightOf[i]] = [-p[0], p[1], p[2]];
  }
  return points;
}
