import { describe, expect, it } from 'vitest';
import { DRIVEN_BONES, type DrivenBone, type Quat, type Vec3 } from './contract';
import { LM } from './landmarks';
import { quatDot, quatFromAxisAngle } from './math';
import {
  DEG,
  HEAD_POINTS,
  LEFT_ARM_BELOW_SHOULDER,
  LEFT_HAND_BELOW_ELBOW,
  RIGHT_ARM_BELOW_SHOULDER,
  rotatePoints,
  tpose,
} from './poses.testutil';
import { RELAXED_FINGERS, calibrateRest, createSolverState, solveRotations, type Rotations } from './solver';

const X: Vec3 = [1, 0, 0];
const Y: Vec3 = [0, 1, 0];
const Z: Vec3 = [0, 0, 1];
const ALL_VISIBLE = new Array(33).fill(1);

function expectRotation(rotations: Rotations, bone: DrivenBone, expected: Quat, digits = 3) {
  expect(Math.abs(quatDot(rotations[bone], expected)), bone).toBeCloseTo(1, digits);
}

function solve(points: Vec3[]) {
  return solveRotations(points, ALL_VISIBLE, createSolverState()).rotations;
}

describe('solveRotations', () => {
  /** Body bones at identity; untracked fingers in the resting curl (their hands are at identity). */
  const expectRestPose = (rotations: Rotations) => {
    for (const bone of DRIVEN_BONES) expectRotation(rotations, bone, RELAXED_FINGERS[bone] ?? [0, 0, 0, 1]);
  };

  it('returns identity for every body bone in the T-pose, with untracked fingers resting', () => {
    expectRestPose(solve(tpose()));
  });

  it('raising the left arm 90 degrees rotates the left arm chain about +Z', () => {
    const p = tpose();
    const raised = rotatePoints(p, LEFT_ARM_BELOW_SHOULDER, p[LM.leftShoulder], quatFromAxisAngle(Z, 90 * DEG));
    const rotations = solve(raised);
    const expected = quatFromAxisAngle(Z, 90 * DEG);
    expectRotation(rotations, 'LeftUpperArm', expected);
    expectRotation(rotations, 'LeftLowerArm', expected);
    expectRotation(rotations, 'LeftHand', expected);
    expectRotation(rotations, 'RightUpperArm', [0, 0, 0, 1]);
  });

  it('raising the right arm rotates the right arm chain about -Z (the "raise right hand" check)', () => {
    const p = tpose();
    const raised = rotatePoints(p, RIGHT_ARM_BELOW_SHOULDER, p[LM.rightShoulder], quatFromAxisAngle(Z, -90 * DEG));
    const rotations = solve(raised);
    expectRotation(rotations, 'RightUpperArm', quatFromAxisAngle(Z, -90 * DEG));
    expectRotation(rotations, 'LeftUpperArm', [0, 0, 0, 1]);
  });

  it('bending the left elbow 90 degrees forward rotates only the forearm and hand', () => {
    const p = tpose();
    const bent = rotatePoints(p, LEFT_HAND_BELOW_ELBOW, p[LM.leftElbow], quatFromAxisAngle(Y, -90 * DEG));
    const rotations = solve(bent);
    expectRotation(rotations, 'LeftUpperArm', [0, 0, 0, 1]);
    expectRotation(rotations, 'LeftLowerArm', quatFromAxisAngle(Y, -90 * DEG));
    expectRotation(rotations, 'LeftHand', quatFromAxisAngle(Y, -90 * DEG));
  });

  it('turning the head 45 degrees to the left rotates Head fully and Neck halfway', () => {
    const p = tpose();
    const pivot: Vec3 = [0, 1.62, -0.02];
    const turned = rotatePoints(p, HEAD_POINTS, pivot, quatFromAxisAngle(Y, 45 * DEG));
    const rotations = solve(turned);
    expectRotation(rotations, 'Head', quatFromAxisAngle(Y, 45 * DEG));
    expectRotation(rotations, 'Neck', quatFromAxisAngle(Y, 22.5 * DEG));
  });

  it('twisting the chest 30 degrees about +Y moves Chest fully and Spine halfway', () => {
    const p = tpose();
    const upper = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, ...LEFT_ARM_BELOW_SHOULDER, ...RIGHT_ARM_BELOW_SHOULDER, LM.leftShoulder, LM.rightShoulder];
    const twisted = rotatePoints(p, upper, [0, 1.4, 0], quatFromAxisAngle(Y, 30 * DEG));
    const rotations = solve(twisted);
    expectRotation(rotations, 'Hips', [0, 0, 0, 1], 2);
    expectRotation(rotations, 'Chest', quatFromAxisAngle(Y, 30 * DEG), 2);
    expectRotation(rotations, 'UpperChest', quatFromAxisAngle(Y, 30 * DEG), 2);
    expectRotation(rotations, 'Spine', quatFromAxisAngle(Y, 15 * DEG), 2);
  });

  it('sweeping a straight arm from T-pose to hanging down never flips', () => {
    const p = tpose();
    let state = createSolverState();
    let previous: Quat | null = null;
    for (let step = 0; step <= 20; step++) {
      const angle = (-90 * DEG * step) / 20;
      const pose = rotatePoints(p, LEFT_ARM_BELOW_SHOULDER, p[LM.leftShoulder], quatFromAxisAngle(Z, angle));
      const result = solveRotations(pose, ALL_VISIBLE, state);
      state = result.state;
      const current = result.rotations.LeftUpperArm;
      if (previous) expect(quatDot(previous, current)).toBeGreaterThan(0.9);
      previous = current;
    }
    expect(Math.abs(quatDot(previous!, quatFromAxisAngle(Z, -90 * DEG)))).toBeCloseTo(1, 3);
  });

  it('holds the previous rotation for bones whose landmarks are not visible', () => {
    const p = tpose();
    const first = solveRotations(
      rotatePoints(p, LEFT_ARM_BELOW_SHOULDER, p[LM.leftShoulder], quatFromAxisAngle(Z, 90 * DEG)),
      ALL_VISIBLE,
      createSolverState(),
    );
    const hidden = [...ALL_VISIBLE];
    hidden[LM.leftElbow] = 0.1;
    const second = solveRotations(p, hidden, first.state);
    expectRotation(second.rotations, 'LeftUpperArm', quatFromAxisAngle(Z, 90 * DEG));
  });

  it('calibrating on the current pose makes that pose the new identity', () => {
    const p = tpose();
    const odd = rotatePoints(p, LEFT_ARM_BELOW_SHOULDER, p[LM.leftShoulder], quatFromAxisAngle(Z, -20 * DEG));
    const state = calibrateRest(odd, createSolverState());
    const { rotations } = solveRotations(odd, ALL_VISIBLE, state);
    expectRestPose(rotations);
  });
});
