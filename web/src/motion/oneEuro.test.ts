import { describe, expect, it } from 'vitest';
import { LandmarkFilter, OneEuroFilter } from './oneEuro';

function variance(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
}

/** Deterministic pseudo-random noise in [-amplitude, amplitude]. */
function noise(i: number, amplitude: number): number {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return (x - Math.floor(x) - 0.5) * 2 * amplitude;
}

describe('OneEuroFilter', () => {
  it('passes the first sample through unchanged', () => {
    expect(new OneEuroFilter().filter(0.7, 0)).toBe(0.7);
  });

  it('reduces jitter on a noisy constant signal', () => {
    const filter = new OneEuroFilter();
    const input: number[] = [];
    const output: number[] = [];
    for (let i = 0; i < 300; i++) {
      const x = 1 + noise(i, 0.02);
      input.push(x);
      output.push(filter.filter(x, i / 30));
    }
    expect(variance(output.slice(30))).toBeLessThan(variance(input.slice(30)) * 0.5);
  });

  it('follows a fast step change within a few frames', () => {
    const filter = new OneEuroFilter();
    let y = 0;
    for (let i = 0; i < 30; i++) y = filter.filter(0, i / 30);
    for (let i = 30; i < 40; i++) y = filter.filter(0.5, i / 30);
    expect(y).toBeGreaterThan(0.4);
  });
});

describe('LandmarkFilter', () => {
  it.each([100,NaN,Infinity])('rejects an untrusted coordinate %s without poisoning reacquisition',x=>{
    const filter=new LandmarkFilter();filter.filter([{x:1,y:2,z:3,visibility:1}],0);
    const hidden=filter.filter([{x,y:100,z:100,visibility:0.1}],0.1)[0];
    expect(hidden).toEqual({x:1,y:2,z:3,visibility:0});
    expect(filter.filter([{x:2,y:2,z:3,visibility:1}],0.2)[0].x).toBe(2);
  });
  it('rejects nonfinite coordinates even when visibility claims confidence',()=>{
    const filter=new LandmarkFilter(),out=filter.filter([{x:NaN,y:Infinity,z:0,visibility:1}],0)[0];
    expect([out.x,out.y,out.z].every(Number.isFinite)).toBe(true);expect(out.visibility).toBe(0);
  });
  it('reacquires directly after a long gap',()=>{
    const filter=new LandmarkFilter();filter.filter([{x:0,y:0,z:0}],0);
    expect(filter.filter([{x:1,y:0,z:0}],1)[0].x).toBe(1);
  });
  it('filters every coordinate of every landmark and keeps visibility', () => {
    const filter = new LandmarkFilter();
    const frame = [{ x: 1, y: 2, z: 3, visibility: 0.9 }];
    const out = filter.filter(frame, 0);
    expect(out).toEqual([{ x: 1, y: 2, z: 3, visibility: 0.9 }]);
    expect(out[0]).not.toBe(frame[0]);
  });
});
