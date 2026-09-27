/** Helpers for building synthetic poses in tests. Not used by production code. */
import type { Quat, Vec3 } from './contract';
import { fromCanonical, LM, tposeCanonical, type PoseLandmark } from './landmarks';
import { add, rotateVec, sub } from './math';

export const DEG = Math.PI / 180;

export const LEFT_ARM_BELOW_SHOULDER = [LM.leftElbow, LM.leftWrist, LM.leftPinky, LM.leftIndex, LM.leftThumb];
export const RIGHT_ARM_BELOW_SHOULDER = [LM.rightElbow, LM.rightWrist, LM.rightPinky, LM.rightIndex, LM.rightThumb];
export const LEFT_HAND_BELOW_ELBOW = [LM.leftWrist, LM.leftPinky, LM.leftIndex, LM.leftThumb];
export const HEAD_POINTS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** Rotate the listed points about a pivot point; returns a new array. */
export function rotatePoints(points: Vec3[], indices: number[], pivot: Vec3, q: Quat): Vec3[] {
  const selected = new Set(indices);
  return points.map((p, i) => (selected.has(i) ? add(pivot, rotateVec(q, sub(p, pivot))) : p));
}

/** Translate the listed points; returns a new array. */
export function translatePoints(points: Vec3[], indices: number[], offset: Vec3): Vec3[] {
  const selected = new Set(indices);
  return points.map((p, i) => (selected.has(i) ? add(p, offset) : p));
}

export const toMediaPipe = (points: Vec3[]): PoseLandmark[] => points.map((p) => fromCanonical(p));

export const tpose = (): Vec3[] => tposeCanonical();
