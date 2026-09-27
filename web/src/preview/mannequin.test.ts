import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { DRIVEN_BONES, SKELETON, tposeFrame, type MotionFrame } from '../motion/index';
import { Mannequin } from './mannequin';

const Z_AXIS = new THREE.Vector3(0, 0, 1);

function quatAboutZ(degrees: number): number[] {
  const q = new THREE.Quaternion().setFromAxisAngle(Z_AXIS, THREE.MathUtils.degToRad(degrees));
  return [q.x, q.y, q.z, q.w];
}

/** T-pose frame with the given driven bones carrying the given world-delta quaternion. */
function frameWith(rotations: Record<string, number[]>, hipsHeight = 0.95): MotionFrame {
  const base = tposeFrame(0);
  const r = [...base.r];
  for (const [bone, quat] of Object.entries(rotations)) {
    const index = DRIVEN_BONES.indexOf(bone as (typeof DRIVEN_BONES)[number]);
    r.splice(index * 4, 4, ...quat);
  }
  return { t: 0, h: [0, hipsHeight, 0], r };
}

function worldPosition(mannequin: Mannequin, bone: string): THREE.Vector3 {
  const object = mannequin.root.getObjectByName(bone);
  if (!object) throw new Error(`missing bone ${bone}`);
  return object.getWorldPosition(new THREE.Vector3());
}

function angleFromIdentity(q: THREE.Quaternion): number {
  return q.angleTo(new THREE.Quaternion());
}

describe('Mannequin', () => {
  it('builds one object per skeleton bone at its rest head position', () => {
    const mannequin = new Mannequin();
    for (const bone of SKELETON) {
      const position = worldPosition(mannequin, bone.name);
      expect(position.x).toBeCloseTo(bone.head[0], 6);
      expect(position.y).toBeCloseTo(bone.head[1], 6);
      expect(position.z).toBeCloseTo(bone.head[2], 6);
    }
  });

  it('T-pose frame gives every bone an identity world rotation', () => {
    const mannequin = new Mannequin();
    mannequin.applyFrame(tposeFrame(0));
    for (const bone of SKELETON) {
      expect(angleFromIdentity(mannequin.boneWorldQuaternion(bone.name))).toBeLessThan(1e-6);
    }
  });

  it('right arm chain rotated -90 degrees about Z points the right arm up', () => {
    const mannequin = new Mannequin();
    const up = quatAboutZ(-90);
    mannequin.applyFrame(frameWith({ RightUpperArm: up, RightLowerArm: up, RightHand: up }));

    const shoulder = worldPosition(mannequin, 'RightUpperArm');
    const hand = worldPosition(mannequin, 'RightHand');
    expect(hand.y).toBeGreaterThan(shoulder.y + 0.4);
    expect(hand.x).toBeLessThan(0);
    // The left arm is untouched.
    expect(worldPosition(mannequin, 'LeftHand').y).toBeCloseTo(1.4, 6);
  });

  it('children do not inherit the parent world delta', () => {
    const mannequin = new Mannequin();
    mannequin.applyFrame(frameWith({ RightUpperArm: quatAboutZ(-90) }));
    expect(angleFromIdentity(mannequin.boneWorldQuaternion('RightUpperArm'))).toBeCloseTo(Math.PI / 2, 5);
    expect(angleFromIdentity(mannequin.boneWorldQuaternion('RightLowerArm'))).toBeLessThan(1e-6);
  });

  it('undriven bones keep their rest rotation relative to their parent', () => {
    const mannequin = new Mannequin();
    const tilt = quatAboutZ(30);
    mannequin.applyFrame(frameWith({ UpperChest: tilt }));
    const expected = new THREE.Quaternion(...(tilt as [number, number, number, number]));
    expect(mannequin.boneWorldQuaternion('LeftShoulder').angleTo(expected)).toBeLessThan(1e-6);
  });

  it('moves the hips to the frame height and keeps them in place horizontally', () => {
    const mannequin = new Mannequin();
    mannequin.applyFrame(frameWith({}, 0.7));
    const hips = worldPosition(mannequin, 'Hips');
    expect(hips.x).toBe(0);
    expect(hips.y).toBeCloseTo(0.7, 6);
    expect(hips.z).toBe(0);
  });
});
