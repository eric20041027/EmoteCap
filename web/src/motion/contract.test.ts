import { describe, expect, it } from 'vitest';
import bonesJson from '../../../contracts/bones.json';
import { BONE_COUNT, DRIVEN_BONES, SKELETON, tposeFrame } from './contract';

describe('contract', () => {
  it('driven bone order matches contracts/bones.json', () => {
    expect([...DRIVEN_BONES]).toEqual(bonesJson.driven);
  });

  it('skeleton lists parents before children and contains every driven bone', () => {
    const seen = new Set<string>();
    for (const bone of SKELETON) {
      if (bone.parent) expect(seen.has(bone.parent)).toBe(true);
      seen.add(bone.name);
    }
    for (const name of DRIVEN_BONES) expect(seen.has(name)).toBe(true);
  });

  it('T-pose frame holds one identity quaternion per driven bone (18 body + 30 finger)', () => {
    const frame = tposeFrame();
    expect(BONE_COUNT).toBe(48);
    expect(frame.r).toHaveLength(192);
    expect(frame.r.slice(0, 4)).toEqual([0, 0, 0, 1]);
  });
});
