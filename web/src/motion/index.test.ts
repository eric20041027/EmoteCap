import { describe, expect, it } from 'vitest';
import { createPoseSolver, DRIVEN_BONES } from './index';
import { LM } from './landmarks';
import { quatFromAxisAngle } from './math';
import { DEG, RIGHT_ARM_BELOW_SHOULDER, rotatePoints, toMediaPipe, tpose } from './poses.testutil';

describe('createPoseSolver', () => {
  it('returns null without a full set of landmarks', () => {
    expect(createPoseSolver().solve(undefined, 0)).toBeNull();
    expect(createPoseSolver().solve([], 0)).toBeNull();
  });

  it('turns MediaPipe T-pose landmarks into an identity frame at rest height', () => {
    const frame = createPoseSolver().solve(toMediaPipe(tpose()), 1.5)!;
    expect(frame.t).toBe(1.5);
    expect(frame.h[1]).toBeCloseTo(0.95, 2);
    expect(frame.r).toHaveLength(DRIVEN_BONES.length * 4);
    for (let i = 0; i < DRIVEN_BONES.length; i++) expect(Math.abs(frame.r[i * 4 + 3])).toBeCloseTo(1, 3);
  });

  it('raises the right arm when the actor raises their right arm', () => {
    const p = tpose();
    const raised = rotatePoints(p, RIGHT_ARM_BELOW_SHOULDER, p[LM.rightShoulder], quatFromAxisAngle([0, 0, 1], -90 * DEG));
    const solver = createPoseSolver();
    let frame = null;
    for (let i = 0; i < 20; i++) frame = solver.solve(toMediaPipe(raised), i / 30); // let the filter settle
    const q = frame!.r.slice(9 * 4, 9 * 4 + 4);
    expect(q[2]).toBeCloseTo(-Math.SQRT1_2, 2); // about -Z by 90 degrees
    expect(q[3]).toBeCloseTo(Math.SQRT1_2, 2);
  });
});
