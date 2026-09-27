import { describe, expect, it } from 'vitest';
import type { Quat } from './contract';
import { quatDot, quatFromAxisAngle } from './math';
import { RotationFilter } from './rotationFilter';

const DEG = Math.PI / 180;
const Z: [number, number, number] = [0, 0, 1];
const angleBetween = (a: Quat, b: Quat) => 2 * Math.acos(Math.min(1, Math.abs(quatDot(a, b))));

/** Deterministic noise in [-1, 1]. */
const noise = (i: number) => {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return (x - Math.floor(x) - 0.5) * 2;
};

const params = { minCutoff: 1.5, beta: 0.25, dCutoff: 1 };

describe('RotationFilter', () => {
  it('passes the first sample through and keeps a steady rotation', () => {
    const filter = new RotationFilter(params);
    const q = quatFromAxisAngle(Z, 40 * DEG);
    expect(filter.filter(q, 0)).toEqual(q);
    for (let i = 1; i < 30; i++) expect(angleBetween(filter.filter(q, i / 30), q)).toBeLessThan(1e-6);
  });

  it('removes most of the jitter around a held pose', () => {
    const filter = new RotationFilter(params);
    const held = quatFromAxisAngle(Z, 40 * DEG);
    let inError = 0;
    let outError = 0;
    for (let i = 0; i < 120; i++) {
      const noisy = quatFromAxisAngle(Z, (40 + 3 * noise(i)) * DEG);
      const out = filter.filter(noisy, i / 30);
      if (i < 30) continue;
      inError += angleBetween(noisy, held);
      outError += angleBetween(out, held);
    }
    expect(outError).toBeLessThan(inError * 0.5);
  });

  it('still follows a real move within a few frames', () => {
    const filter = new RotationFilter(params);
    for (let i = 0; i < 30; i++) filter.filter(quatFromAxisAngle(Z, 0), i / 30);
    const target = quatFromAxisAngle(Z, 90 * DEG);
    let out: Quat = [0, 0, 0, 1];
    for (let i = 30; i < 45; i++) out = filter.filter(target, i / 30);
    expect(angleBetween(out, target)).toBeLessThan(10 * DEG);
  });

  it('smooths more with a lower cutoff', () => {
    const run = (minCutoff: number) => {
      const filter = new RotationFilter({ ...params, minCutoff });
      let error = 0;
      for (let i = 0; i < 90; i++) {
        const out = filter.filter(quatFromAxisAngle(Z, 3 * noise(i) * DEG), i / 30);
        if (i >= 30) error += angleBetween(out, [0, 0, 0, 1]);
      }
      return error;
    };
    expect(run(0.5)).toBeLessThan(run(3));
  });
});
