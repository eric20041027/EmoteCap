/** Normalized image landmarks for import tests (un-mirrored camera: the actor's left side is on the image's right). */
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

type Point = [number, number];

function pose(points: Record<number, Point>, visibility = 1): NormalizedLandmark[] {
  return Array.from({ length: 33 }, (_, i) => {
    const [x, y] = points[i] ?? [0.5, 0.5];
    return { x, y, z: 0, visibility };
  });
}

const TORSO: Record<number, Point> = { 11: [0.58, 0.3], 12: [0.42, 0.3], 23: [0.55, 0.55], 24: [0.45, 0.55] };

export const T_POSE_IMAGE = pose({ ...TORSO, 13: [0.72, 0.3], 15: [0.86, 0.31], 14: [0.28, 0.3], 16: [0.14, 0.29] });
export const ARMS_DOWN_IMAGE = pose({ ...TORSO, 13: [0.6, 0.42], 15: [0.61, 0.54], 14: [0.4, 0.42], 16: [0.39, 0.54] });
export const ONE_ARM_UP_IMAGE = pose({ ...TORSO, 13: [0.72, 0.3], 15: [0.86, 0.31], 14: [0.36, 0.18], 16: [0.32, 0.06] });
export const BENT_ARMS_IMAGE = pose({ ...TORSO, 13: [0.72, 0.3], 15: [0.7, 0.18], 14: [0.28, 0.3], 16: [0.3, 0.18] });
export const HIDDEN_T_POSE_IMAGE = T_POSE_IMAGE.map((lm) => ({ ...lm, visibility: 0.2 }));
