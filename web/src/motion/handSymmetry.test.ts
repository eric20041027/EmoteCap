import { describe, expect, it } from 'vitest';
import type { Quat, Vec3 } from './contract';
import { FINGERS, SEGMENTS, fingerBone, tposeHandCanonical, type Side } from './hands';
import { DRIVEN_BONES, createPoseSolver } from './index';
import { fromCanonical, tposeCanonical } from './landmarks';
import { quatConjugate, quatFromAxisAngle, quatMultiply, rotateVec } from './math';

const DEG = Math.PI / 180;
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mirror = (p: Vec3): Vec3 => [-p[0], p[1], p[2]];
const angleOf = (q: Quat) => 2 * Math.acos(Math.min(1, Math.abs(q[3])));

/** Left T-pose hand (palm down, fingers along +X) with each finger curled toward the palm by `curl` per joint. */
function curledLeftHand(curl: number): Vec3[] {
  const h = tposeHandCanonical('Left').map((p) => [...p] as Vec3);
  for (const base of [5, 9, 13, 17]) {
    for (let joint = base; joint < base + 3; joint++) {
      const bend = quatFromAxisAngle([0, 0, 1], -curl);
      for (let p = joint + 1; p <= base + 3; p++) h[p] = add(h[joint], rotateVec(bend, sub(h[p], h[joint])));
    }
  }
  return h;
}

/** Each finger segment's rotation relative to its hand, as solved from the given canonical hands. */
function fingerAnglesRelativeToHand(hands: Record<Side, Vec3[]>): Record<Side, number[]> {
  const solver = createPoseSolver();
  const body = tposeCanonical().map((p) => fromCanonical(p));
  const frame = solver.solve(body, 0, {
    Left: hands.Left.map((p) => fromCanonical(p)),
    Right: hands.Right.map((p) => fromCanonical(p)),
  });
  if (!frame) throw new Error('no frame');
  const q = (bone: string): Quat => {
    const i = DRIVEN_BONES.indexOf(bone as (typeof DRIVEN_BONES)[number]);
    return [frame.r[i * 4], frame.r[i * 4 + 1], frame.r[i * 4 + 2], frame.r[i * 4 + 3]];
  };
  const out = { Left: [] as number[], Right: [] as number[] };
  for (const side of ['Left', 'Right'] as const) {
    for (const finger of FINGERS) {
      for (let s = 0; s < SEGMENTS.length; s++) {
        out[side].push(angleOf(quatMultiply(quatConjugate(q(`${side}Hand`)), q(fingerBone(side, finger, s)))) / DEG);
      }
    }
  }
  return out;
}

describe('hand symmetry', () => {
  it('solves a mirrored right hand exactly like the left hand', () => {
    const left = curledLeftHand(30 * DEG);
    const right = left.map(mirror);
    const angles = fingerAnglesRelativeToHand({ Left: left, Right: right });
    for (let i = 0; i < angles.Left.length; i++) expect(angles.Right[i]).toBeCloseTo(angles.Left[i], 3);
  });

  it('shows no finger rotation for flat T-pose hands on either side', () => {
    const angles = fingerAnglesRelativeToHand({ Left: tposeHandCanonical('Left'), Right: tposeHandCanonical('Right') });
    for (const value of [...angles.Left, ...angles.Right]) expect(value).toBeLessThan(0.5);
  });
});
