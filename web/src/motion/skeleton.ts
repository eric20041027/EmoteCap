/**
 * Forward kinematics on the canonical export skeleton (contracts/bones.json) and floor contact.
 * Grounding here, rather than from raw landmarks, keeps the exported skeleton's soles exactly on the floor.
 */
import { BONE_INDEX, SKELETON, type DrivenBone, type Quat, type Vec3 } from './contract';
import { IDENTITY, add, rotateVec, sub } from './math';
import type { Rotations } from './solver';

const byName = new Map(SKELETON.map((bone) => [bone.name, bone]));
const HIPS_REST = byName.get('Hips')!.head;

/** Sole contact points in each foot's rest frame, relative to the ankle (LeftFoot/RightFoot head). */
const HEEL_FROM_ANKLE: Vec3 = [0, -0.08, -0.04];

const isDriven = (name: string): name is DrivenBone => name in BONE_INDEX;

/** Joint (bone head) positions relative to the Hips head, canonical meters. */
export function forwardKinematics(rotations: Rotations): Record<string, Vec3> {
  const world = new Map<string, Quat>();
  const joints: Record<string, Vec3> = {};
  for (const bone of SKELETON) {
    const parent = bone.parent ? byName.get(bone.parent)! : null;
    world.set(bone.name, isDriven(bone.name) ? rotations[bone.name] : (parent ? world.get(parent.name)! : IDENTITY));
    joints[bone.name] = parent
      ? add(joints[parent.name], rotateVec(world.get(parent.name)!, sub(bone.head, parent.head)))
      : [0, 0, 0];
  }
  return joints;
}

/** Heel, ball and toe tip of one foot, relative to the Hips head (canonical meters). */
export function solePoints(rotations: Rotations, joints: Record<string, Vec3>, side: 'Left' | 'Right'): Vec3[] {
  const foot = rotations[`${side}Foot`];
  const toe = byName.get(`${side}ToeBase`)!;
  const ankle = joints[`${side}Foot`];
  const ball = joints[`${side}ToeBase`];
  const tip = add(ball, rotateVec(foot, sub(toe.tail, toe.head)));
  const heel = add(ankle, rotateVec(foot, HEEL_FROM_ANKLE));
  return [heel, ball, tip];
}

/** Hips height that puts the lowest sole point of the canonical skeleton on the floor (y = 0). */
export function groundedHipsHeight(rotations: Rotations): number {
  const joints = forwardKinematics(rotations);
  const soles = [...solePoints(rotations, joints, 'Left'), ...solePoints(rotations, joints, 'Right')];
  const lowest = Math.min(...soles.map((p) => p[1]));
  return Number.isFinite(lowest) ? -lowest : HIPS_REST[1];
}
