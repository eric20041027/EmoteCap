import { describe, expect, it } from 'vitest';
import {
  cross,
  normalize,
  quatDot,
  quatFromAxisAngle,
  quatFromBasis,
  quatMultiply,
  quatConjugate,
  quatSlerp,
  rotateVec,
  sameHemisphere,
} from './math';
import type { Quat, Vec3 } from './contract';

const DEG = Math.PI / 180;

function expectVecClose(actual: Vec3, expected: Vec3, digits = 5) {
  actual.forEach((v, i) => expect(v).toBeCloseTo(expected[i], digits));
}

function expectSameRotation(actual: Quat, expected: Quat) {
  expect(Math.abs(quatDot(actual, expected))).toBeCloseTo(1, 5);
}

describe('math', () => {
  it('cross follows the right-hand rule', () => {
    expectVecClose(cross([1, 0, 0], [0, 1, 0]), [0, 0, 1]);
  });

  it('normalize returns a unit vector', () => {
    expectVecClose(normalize([3, 0, 4]), [0.6, 0, 0.8]);
  });

  it('quatFromAxisAngle about Z by 90 degrees turns +X into +Y', () => {
    const q = quatFromAxisAngle([0, 0, 1], 90 * DEG);
    expectVecClose(rotateVec(q, [1, 0, 0]), [0, 1, 0]);
  });

  it('quatFromBasis of the identity basis is the identity quaternion', () => {
    expectSameRotation(quatFromBasis([1, 0, 0], [0, 1, 0], [0, 0, 1]), [0, 0, 0, 1]);
  });

  it('quatFromBasis recovers a known rotation from its rotated axes', () => {
    const q = quatFromAxisAngle(normalize([1, 2, 3]), 70 * DEG);
    const x = rotateVec(q, [1, 0, 0]);
    const y = rotateVec(q, [0, 1, 0]);
    const z = rotateVec(q, [0, 0, 1]);
    expectSameRotation(quatFromBasis(x, y, z), q);
  });

  it('quatMultiply composes rotations (apply right operand first)', () => {
    const a = quatFromAxisAngle([0, 0, 1], 90 * DEG);
    const b = quatFromAxisAngle([0, 1, 0], 90 * DEG);
    // b turns +X into -Z; a leaves -Z unchanged.
    expectVecClose(rotateVec(quatMultiply(a, b), [1, 0, 0]), [0, 0, -1]);
  });

  it('a quaternion times its conjugate is the identity', () => {
    const q = quatFromAxisAngle(normalize([1, 1, 0]), 40 * DEG);
    expectSameRotation(quatMultiply(q, quatConjugate(q)), [0, 0, 0, 1]);
  });

  it('quatSlerp halfway between identity and 90 degrees is 45 degrees', () => {
    const q = quatSlerp([0, 0, 0, 1], quatFromAxisAngle([0, 1, 0], 90 * DEG), 0.5);
    expectSameRotation(q, quatFromAxisAngle([0, 1, 0], 45 * DEG));
  });

  it('sameHemisphere flips a quaternion that points away from the reference', () => {
    const q: Quat = [0, 0, -0.1, -0.99];
    const fixed = sameHemisphere(q, [0, 0, 0, 1]);
    expect(fixed[3]).toBeGreaterThan(0);
  });
});
