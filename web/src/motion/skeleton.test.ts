import { describe, expect, it } from 'vitest';
import { DRIVEN_BONES, type DrivenBone, type Quat } from './contract';
import { quatFromAxisAngle } from './math';
import { forwardKinematics, groundedHipsHeight } from './skeleton';
import type { Rotations } from './solver';

const DEG = Math.PI / 180;

function rotations(overrides: Partial<Record<DrivenBone, Quat>> = {}): Rotations {
  return Object.fromEntries(DRIVEN_BONES.map((bone) => [bone, overrides[bone] ?? [0, 0, 0, 1]])) as Rotations;
}

describe('forwardKinematics', () => {
  it('reproduces the rest skeleton relative to the hips for the T-pose', () => {
    const joints = forwardKinematics(rotations());
    expect(joints.Hips).toEqual([0, 0, 0]);
    expect(joints.LeftHand[0]).toBeCloseTo(0.72, 5);
    expect(joints.LeftHand[1]).toBeCloseTo(1.4 - 0.95, 5);
    expect(joints.RightFoot[1]).toBeCloseTo(0.08 - 0.95, 5);
  });

  it('moves children with their parent rotation', () => {
    // Left thigh swung forward 90 degrees: the knee ends up in front of the hip.
    const joints = forwardKinematics(rotations({ LeftUpperLeg: quatFromAxisAngle([1, 0, 0], -90 * DEG) }));
    expect(joints.LeftLowerLeg[2]).toBeCloseTo(0.43, 5);
    expect(joints.LeftLowerLeg[1]).toBeCloseTo(-0.02, 5);
  });
});

describe('groundedHipsHeight', () => {
  it('is the rest hips height when standing in T-pose', () => {
    expect(groundedHipsHeight(rotations())).toBeCloseTo(0.95, 5);
  });

  it('drops to seat height when both thighs point forward (sitting)', () => {
    const thigh = quatFromAxisAngle([1, 0, 0], -90 * DEG);
    expect(groundedHipsHeight(rotations({ LeftUpperLeg: thigh, RightUpperLeg: thigh }))).toBeCloseTo(0.52, 2);
  });

  it('stands on the other foot when one knee is lifted', () => {
    expect(groundedHipsHeight(rotations({ LeftUpperLeg: quatFromAxisAngle([1, 0, 0], -90 * DEG) }))).toBeCloseTo(0.95, 5);
  });

  it('lifts the body so pointed toes stay above the floor', () => {
    const toesDown = quatFromAxisAngle([1, 0, 0], 40 * DEG);
    expect(groundedHipsHeight(rotations({ LeftFoot: toesDown, RightFoot: toesDown }))).toBeGreaterThan(0.97);
  });
});
