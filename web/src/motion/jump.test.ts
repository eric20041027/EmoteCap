import { describe, expect, it } from 'vitest';
import type { Vec3 } from './contract';
import { createJumpState, solveJumpLift, type JumpState } from './jump';
import type { PoseLandmark } from './landmarks';
import { tpose, translatePoints } from './poses.testutil';

const ALL = Array.from({ length: 33 }, (_, i) => i);
const VISIBLE = new Array(33).fill(1);
const FOCAL = 0.8;
const CAMERA: Vec3 = [0, 1.0, 3.0]; // in front of the actor, looking toward -Z

/** Pinhole projection into normalized, un-mirrored image coordinates (x right, y down). */
function project(points: Vec3[]): PoseLandmark[] {
  return points.map(([x, y, z]) => {
    const depth = CAMERA[2] - z;
    return { x: 0.5 + (FOCAL * (x - CAMERA[0])) / depth, y: 0.5 - (FOCAL * (y - CAMERA[1])) / depth, z: 0, visibility: 1 };
  });
}

function run(frames: Vec3[][], state: JumpState = createJumpState(), t0 = 0) {
  let lift = 0;
  let s = state;
  frames.forEach((points, i) => {
    const result = solveJumpLift(project(points), points, VISIBLE, t0 + i / 30, s);
    lift = result.lift;
    s = result.state;
  });
  return { lift, state: s };
}

const standing = (n: number) => Array.from({ length: n }, () => tpose());

describe('solveJumpLift', () => {
  it('is zero while standing', () => {
    expect(run(standing(30)).lift).toBe(0);
  });

  it('measures how high the actor jumped, in canonical meters', () => {
    const { state } = run(standing(30));
    const airborne = Array.from({ length: 6 }, () => translatePoints(tpose(), ALL, [0, 0.2, 0]));
    expect(run(airborne, state, 1).lift).toBeCloseTo(0.2, 1);
  });

  it('does not mistake stepping back from the camera for a jump', () => {
    const { state } = run(standing(30));
    const back = Array.from({ length: 10 }, () => translatePoints(tpose(), ALL, [0, 0, -1]));
    expect(run(back, state, 1).lift).toBe(0);
  });

  it('stays grounded through a squat', () => {
    const { state } = run(standing(30));
    const squat = Array.from({ length: 10 }, () => translatePoints(tpose(), Array.from({ length: 25 }, (_, i) => i), [0, -0.25, 0]));
    expect(run(squat, state, 1).lift).toBe(0);
  });
});
