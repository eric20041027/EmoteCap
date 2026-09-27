/**
 * MediaPipe Hand Landmarker topology (21 points per hand) and its T-pose, derived from the export skeleton
 * so hand-landmark rest frames match the skeleton's finger bones exactly.
 */
import { SKELETON, type DrivenBone, type Vec3 } from './contract';

export const HAND_LANDMARK_COUNT = 21;

export const HAND_LM = {
  wrist: 0,
  thumbCmc: 1,
  thumbMcp: 2,
  thumbIp: 3,
  thumbTip: 4,
  indexMcp: 5,
  indexPip: 6,
  indexDip: 7,
  indexTip: 8,
  middleMcp: 9,
  middlePip: 10,
  middleDip: 11,
  middleTip: 12,
  ringMcp: 13,
  ringPip: 14,
  ringDip: 15,
  ringTip: 16,
  pinkyMcp: 17,
  pinkyPip: 18,
  pinkyDip: 19,
  pinkyTip: 20,
} as const;

export type Side = 'Left' | 'Right';
export const SIDES: readonly Side[] = ['Left', 'Right'];
export const FINGERS = ['Thumb', 'Index', 'Middle', 'Ring', 'Little'] as const;
export const SEGMENTS = ['Proximal', 'Intermediate', 'Distal'] as const;
export type Finger = (typeof FINGERS)[number];

/** First landmark of each finger chain; the chain continues at +1, +2, +3 (tip). */
export const FINGER_BASE: Record<Finger, number> = { Thumb: 1, Index: 5, Middle: 9, Ring: 13, Little: 17 };

export const fingerBone = (side: Side, finger: Finger, segment: number): DrivenBone =>
  `${side}${finger}${SEGMENTS[segment]}` as DrivenBone;

const byName = new Map(SKELETON.map((bone) => [bone.name, bone]));

/** Canonical positions of the 21 hand landmarks for a hand in the skeleton's T-pose. */
export function tposeHandCanonical(side: Side): Vec3[] {
  const points: Vec3[] = new Array(HAND_LANDMARK_COUNT);
  points[HAND_LM.wrist] = [...byName.get(`${side}Hand`)!.head];
  for (const finger of FINGERS) {
    const base = FINGER_BASE[finger];
    SEGMENTS.forEach((_, i) => {
      const bone = byName.get(fingerBone(side, finger, i))!;
      points[base + i] = [...bone.head];
      if (i === SEGMENTS.length - 1) points[base + i + 1] = [...bone.tail];
    });
  }
  return points;
}
