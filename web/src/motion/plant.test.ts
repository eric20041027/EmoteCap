import { describe, expect, it } from 'vitest';
import { DRIVEN_BONES, type DrivenBone, type Quat } from './contract';
import { quatDot, quatFromAxisAngle, quatMultiply } from './math';
import { plantFeet } from './plant';
import { groundedHipsHeight } from './skeleton';
import type { Rotations } from './solver';

const DEG = Math.PI / 180;
const X: [number, number, number] = [1, 0, 0];
const Y: [number, number, number] = [0, 1, 0];

function rotations(overrides: Partial<Record<DrivenBone, Quat>> = {}): Rotations {
  return Object.fromEntries(DRIVEN_BONES.map((bone) => [bone, overrides[bone] ?? [0, 0, 0, 1]])) as Rotations;
}

function expectSame(actual: Quat, expected: Quat) {
  expect(Math.abs(quatDot(actual, expected))).toBeCloseTo(1, 4);
}

describe('plantFeet', () => {
  it('leaves flat standing feet unchanged', () => {
    const planted = plantFeet(rotations());
    expectSame(planted.LeftFoot, [0, 0, 0, 1]);
    expectSame(planted.RightFoot, [0, 0, 0, 1]);
  });

  it('flattens toes-down feet while standing, so heels touch the floor again', () => {
    const toesDown = quatFromAxisAngle(X, 30 * DEG);
    const planted = plantFeet(rotations({ LeftFoot: toesDown, RightFoot: toesDown }));
    expectSame(planted.LeftFoot, [0, 0, 0, 1]);
    expectSame(planted.RightFoot, [0, 0, 0, 1]);
    expect(groundedHipsHeight(planted)).toBeCloseTo(0.95, 3);
  });

  it('keeps the direction the foot points (yaw) and removes only the tilt', () => {
    const turnedOut = quatFromAxisAngle(Y, 30 * DEG);
    const tilted = quatMultiply(turnedOut, quatFromAxisAngle(X, 20 * DEG));
    const planted = plantFeet(rotations({ LeftFoot: tilted, RightFoot: [0, 0, 0, 1] }));
    expectSame(planted.LeftFoot, turnedOut);
  });

  it('does not touch a lifted foot', () => {
    const thighUp = quatFromAxisAngle(X, -90 * DEG);
    const pointed = quatFromAxisAngle(X, 40 * DEG);
    const planted = plantFeet(rotations({ LeftUpperLeg: thighUp, LeftFoot: pointed, RightFoot: pointed }));
    expectSame(planted.LeftFoot, pointed);
    expectSame(planted.RightFoot, [0, 0, 0, 1]);
  });
});
