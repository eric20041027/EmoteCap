import bonesJson from '../../../contracts/bones.json';

export type Vec3 = [number, number, number];
/** Quaternion as [x, y, z, w]. */
export type Quat = [number, number, number, number];

export interface SkeletonBone {
  name: string;
  parent: string | null;
  fbx: string;
  head: Vec3;
  tail: Vec3;
}

export interface MotionFrame {
  /** Seconds since the start of the take or clip. */
  t: number;
  /** Hips position, canonical meters (x = z = 0). */
  h: Vec3;
  /** BONE_COUNT x 4 world-delta quaternions (x, y, z, w) in DRIVEN_BONES order. */
  r: number[];
}

export interface Clip {
  name: string;
  loop: boolean;
  fps: number;
  frames: MotionFrame[];
}

export interface Segment {
  name: string;
  start: number;
  end: number;
  loop: boolean;
  description: string;
}

export const CONTRACT_VERSION: number = bonesJson.version;
export const H0: number = bonesJson.hipsRestHeight;

export const DRIVEN_BONES = [
  'Hips', 'Spine', 'Chest', 'UpperChest', 'Neck', 'Head',
  'LeftUpperArm', 'LeftLowerArm', 'LeftHand',
  'RightUpperArm', 'RightLowerArm', 'RightHand',
  'LeftUpperLeg', 'LeftLowerLeg', 'LeftFoot',
  'RightUpperLeg', 'RightLowerLeg', 'RightFoot',
  'LeftThumbProximal', 'LeftThumbIntermediate', 'LeftThumbDistal',
  'LeftIndexProximal', 'LeftIndexIntermediate', 'LeftIndexDistal',
  'LeftMiddleProximal', 'LeftMiddleIntermediate', 'LeftMiddleDistal',
  'LeftRingProximal', 'LeftRingIntermediate', 'LeftRingDistal',
  'LeftLittleProximal', 'LeftLittleIntermediate', 'LeftLittleDistal',
  'RightThumbProximal', 'RightThumbIntermediate', 'RightThumbDistal',
  'RightIndexProximal', 'RightIndexIntermediate', 'RightIndexDistal',
  'RightMiddleProximal', 'RightMiddleIntermediate', 'RightMiddleDistal',
  'RightRingProximal', 'RightRingIntermediate', 'RightRingDistal',
  'RightLittleProximal', 'RightLittleIntermediate', 'RightLittleDistal',
] as const;
export type DrivenBone = (typeof DRIVEN_BONES)[number];
export const BONE_COUNT = DRIVEN_BONES.length;
/** The first 18 driven bones are the body; the rest are fingers (15 per hand). */
export const BODY_BONE_COUNT = 18;
export const BONE_INDEX = Object.fromEntries(DRIVEN_BONES.map((name, i) => [name, i])) as Record<DrivenBone, number>;

/** Export skeleton (52 bones, T-pose, parents first). */
export const SKELETON = bonesJson.skeleton as unknown as readonly SkeletonBone[];

export const CLIP_NAME_PATTERN = /^[A-Za-z0-9_]{1,24}$/;
export const DEFAULT_FPS = 30;

export function identityRotations(): number[] {
  const r: number[] = [];
  for (let i = 0; i < BONE_COUNT; i++) r.push(0, 0, 0, 1);
  return r;
}

export function tposeFrame(t = 0): MotionFrame {
  return { t, h: [0, H0, 0], r: identityRotations() };
}
