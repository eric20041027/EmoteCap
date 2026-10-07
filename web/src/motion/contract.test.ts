import { describe, expect, it } from 'vitest';
import bonesJson from '../../../contracts/bones.json';
import tposeClip from '../../../contracts/fixtures/tpose.clip.json';
import raiseClip from '../../../contracts/fixtures/raise-right-arm.clip.json';
import { BONE_COUNT, CONTRACT_VERSION, DRIVEN_BONES, SKELETON, tposeFrame } from './contract';

describe('contract', () => {
  it('keeps v2 fixtures readable without changing the wire shape', () => {
    expect(CONTRACT_VERSION).toBe(2);
    expect(SKELETON).toHaveLength(52);
    for (const clip of [tposeClip, raiseClip]) {
      expect(clip.frames[0].t).toBe(0);
      for (const frame of clip.frames) {
        expect(frame.h).toHaveLength(3);
        expect(frame.r).toHaveLength(192);
        expect([...frame.h, ...frame.r, frame.t].every(Number.isFinite)).toBe(true);
      }
    }
  });

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
