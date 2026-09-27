import * as THREE from 'three';
import { DRIVEN_BONES, SKELETON, type MotionFrame, type SkeletonBone } from '../motion/index';

type Side = 'left' | 'right' | 'center';

const SIDE_COLORS: Record<Side, number> = { left: 0x4f8dff, right: 0xff8a3d, center: 0xa7afbf };
const EYE_COLOR = 0x0b0d12;
const TORSO_BONES = new Set(['Hips', 'Spine', 'Chest', 'UpperChest']);
const TORSO_RADIUS = 0.06;
const LIMB_RADIUS = 0.035;
const HAND_RADIUS = 0.024;
const FINGER_RADIUS = 0.008;
const FINGER_BONE = /(Thumb|Index|Middle|Ring|Little)/;
const HEAD_RADIUS = 0.1;
const EYE_RADIUS = 0.017;
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const IDENTITY = new THREE.Quaternion();
const DRIVEN_INDEX = new Map<string, number>(DRIVEN_BONES.map((name, index) => [name, index]));
const FRAME_FLOATS = DRIVEN_BONES.length * 4;

function sideOf(name: string): Side {
  if (name.startsWith('Left')) return 'left';
  if (name.startsWith('Right')) return 'right';
  return 'center';
}

/** Capsule thickness per bone: torso, then fingers (thin, as real fingers are), palm, and the other limbs. */
function radiusOf(name: string): number {
  if (TORSO_BONES.has(name)) return TORSO_RADIUS;
  if (FINGER_BONE.test(name)) return FINGER_RADIUS;
  if (name.endsWith('Hand')) return HAND_RADIUS;
  return LIMB_RADIUS;
}

function vec(v: readonly number[]): THREE.Vector3 {
  return new THREE.Vector3(v[0], v[1], v[2]);
}

/**
 * Capsule-figure preview of the canonical export skeleton (contracts/bones.json).
 * Rest rotations are identity, so a bone's world rotation equals its MotionFrame world delta.
 */
export class Mannequin {
  readonly root = new THREE.Group();
  private readonly bones = new Map<string, THREE.Object3D>();
  /** Scratch world rotations, one per bone, reused every frame. */
  private readonly worldRotations = new Map<string, THREE.Quaternion>();
  private readonly materials: Record<Side, THREE.MeshStandardMaterial>;
  private readonly eyeMaterial = new THREE.MeshStandardMaterial({ color: EYE_COLOR, roughness: 0.3 });

  constructor() {
    this.root.name = 'Mannequin';
    this.materials = {
      left: new THREE.MeshStandardMaterial({ color: SIDE_COLORS.left, roughness: 0.5, metalness: 0.05 }),
      right: new THREE.MeshStandardMaterial({ color: SIDE_COLORS.right, roughness: 0.5, metalness: 0.05 }),
      center: new THREE.MeshStandardMaterial({ color: SIDE_COLORS.center, roughness: 0.6, metalness: 0.05 }),
    };
    const byName = new Map(SKELETON.map((bone) => [bone.name, bone]));
    for (const bone of SKELETON) {
      const parentBone = bone.parent ? byName.get(bone.parent) : undefined;
      const parentObject = bone.parent ? this.bones.get(bone.parent) : this.root;
      if (!parentObject) throw new Error(`Skeleton lists "${bone.name}" before its parent "${bone.parent}"`);

      const object = new THREE.Object3D();
      object.name = bone.name;
      object.position.copy(parentBone ? vec(bone.head).sub(vec(parentBone.head)) : vec(bone.head));
      object.add(bone.name === 'Head' ? this.headMesh(bone) : this.capsuleMesh(bone));
      parentObject.add(object);
      this.bones.set(bone.name, object);
      this.worldRotations.set(bone.name, new THREE.Quaternion());
    }
  }

  /** Pose the figure: world rotation = frame delta (driven) or the parent's (undriven); hips at (0, h.y, 0). */
  applyFrame(frame: MotionFrame): void {
    if (frame.r.length < FRAME_FLOATS) return;
    for (const bone of SKELETON) {
      const world = this.worldRotations.get(bone.name);
      const object = this.bones.get(bone.name);
      if (!world || !object) continue;
      const parentWorld = (bone.parent && this.worldRotations.get(bone.parent)) || IDENTITY;
      const index = DRIVEN_INDEX.get(bone.name);
      if (index === undefined) {
        world.copy(parentWorld);
      } else {
        const i = index * 4;
        const x = frame.r[i];
        const y = frame.r[i + 1];
        const z = frame.r[i + 2];
        const w = frame.r[i + 3];
        // Hold the previous rotation if a quaternion is malformed.
        if (Number.isFinite(x + y + z + w)) world.set(x, y, z, w).normalize();
      }
      object.quaternion.copy(parentWorld).invert().multiply(world);
    }
    const hips = this.bones.get('Hips');
    if (hips && Number.isFinite(frame.h[1])) hips.position.set(0, frame.h[1], 0);
  }

  boneWorldQuaternion(name: string): THREE.Quaternion {
    const object = this.bones.get(name);
    if (!object) throw new Error(`Unknown bone "${name}"`);
    return object.getWorldQuaternion(new THREE.Quaternion());
  }

  dispose(): void {
    this.root.traverse((node) => {
      if (node instanceof THREE.Mesh) node.geometry.dispose();
    });
    for (const material of [...Object.values(this.materials), this.eyeMaterial]) material.dispose();
  }

  /** Capsule from head to tail; its end caps are centred on the joints so limbs read as one piece. */
  private capsuleMesh(bone: SkeletonBone): THREE.Mesh {
    const direction = vec(bone.tail).sub(vec(bone.head));
    const radius = radiusOf(bone.name);
    const mesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(radius, direction.length(), 6, 16),
      this.materials[sideOf(bone.name)],
    );
    mesh.position.copy(direction).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(Y_AXIS, direction.clone().normalize());
    mesh.castShadow = true;
    return mesh;
  }

  /** Sphere head with two eyes on the +Z (front) side so head turns are visible. */
  private headMesh(bone: SkeletonBone): THREE.Group {
    const centre = vec(bone.tail).sub(vec(bone.head)).multiplyScalar(0.5);
    const group = new THREE.Group();
    group.position.copy(centre);
    const head = new THREE.Mesh(new THREE.SphereGeometry(HEAD_RADIUS, 32, 16), this.materials.center);
    head.castShadow = true;
    group.add(head);
    for (const x of [-0.035, 0.035]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(EYE_RADIUS, 12, 8), this.eyeMaterial);
      eye.position.set(x, 0.02, HEAD_RADIUS * 0.9);
      group.add(eye);
    }
    return group;
  }
}
