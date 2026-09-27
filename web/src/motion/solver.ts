/**
 * Landmarks -> per-bone world-delta rotations (spec §6.1).
 *
 * Every bone gets an orthonormal frame built from a primary axis and a secondary hint.
 * The delta is currentFrame * restFrame⁻¹, so a pose identical to the rest pose yields identity.
 * Rest frames come from the same code path (synthetic T-pose, or the actor's pose via calibrateRest).
 */
import { DRIVEN_BONES, type DrivenBone, type Quat, type Vec3 } from './contract';
import { FINGER_BASE, FINGERS, HAND_LM, SEGMENTS, SIDES, fingerBone, tposeHandCanonical, type Side } from './hands';
import { LM, tposeCanonical } from './landmarks';
import {
  IDENTITY,
  angleBetween,
  cross,
  dot,
  length,
  midpoint,
  normalize,
  quatConjugate,
  quatFromAxisAngle,
  quatFromBasis,
  quatMultiply,
  quatNormalize,
  quatSlerp,
  rotateVec,
  sameHemisphere,
  scale,
  sub,
} from './math';

export type Rotations = Record<DrivenBone, Quat>;
type Limb = 'leftArm' | 'rightArm' | 'leftLeg' | 'rightLeg';
type LimbNormals = Partial<Record<Limb, Vec3>>;

/** Hand landmarks (21 per hand, canonical space) for the hands detected this frame. */
export type HandPoints = Partial<Record<Side, Vec3[]>>;

export interface SolverState {
  /** World orientation of each bone frame in the reference pose. */
  readonly rest: Rotations;
  /** Reference palm frame measured from hand landmarks (used instead of the pose-based hand frame when a hand is tracked). */
  readonly palmRest: Partial<Record<Side, Quat>>;
  /** Each finger's delta relative to its hand's delta, so untracked fingers keep their pose and follow the hand. */
  readonly fingerRelative: Partial<Record<DrivenBone, Quat>>;
  /** Last emitted deltas: continuity reference and fallback for hidden bones. */
  readonly previous: Rotations | null;
  /** Last bend-plane normal per limb, reused while the limb is straight. */
  readonly normals: LimbNormals;
}

const MIN_VISIBILITY = 0.5;
const STRAIGHT_LIMB = (10 * Math.PI) / 180;
const NOISY_FLIP = (30 * Math.PI) / 180;
const MAX_BEND = (150 * Math.PI) / 180;
/** A candidate normal must keep this much length after removing its component along the limb. */
const MIN_PERPENDICULAR = 0.44;
const UP: Vec3 = [0, 1, 0];

interface LimbSpec {
  limb: Limb;
  upper: DrivenBone;
  lower: DrivenBone;
  root: number;
  joint: number;
  end: number;
  /** Arms bend toward the torso's front (+1), legs toward its back (-1). */
  bendSide: 1 | -1;
}

const LIMBS: readonly LimbSpec[] = [
  { limb: 'leftArm', upper: 'LeftUpperArm', lower: 'LeftLowerArm', root: LM.leftShoulder, joint: LM.leftElbow, end: LM.leftWrist, bendSide: 1 },
  { limb: 'rightArm', upper: 'RightUpperArm', lower: 'RightLowerArm', root: LM.rightShoulder, joint: LM.rightElbow, end: LM.rightWrist, bendSide: 1 },
  { limb: 'leftLeg', upper: 'LeftUpperLeg', lower: 'LeftLowerLeg', root: LM.leftHip, joint: LM.leftKnee, end: LM.leftAnkle, bendSide: -1 },
  { limb: 'rightLeg', upper: 'RightUpperLeg', lower: 'RightLowerLeg', root: LM.rightHip, joint: LM.rightKnee, end: LM.rightAnkle, bendSide: -1 },
];

const TORSO = [LM.leftHip, LM.rightHip, LM.leftShoulder, LM.rightShoulder];
const HEAD = [LM.leftEar, LM.rightEar, LM.nose];

/** Landmarks that must be visible to solve each bone this frame. */
const REQUIRED: Partial<Record<DrivenBone, readonly number[]>> = {
  Hips: TORSO,
  Spine: TORSO,
  Chest: TORSO,
  UpperChest: TORSO,
  Neck: [...TORSO, ...HEAD],
  Head: HEAD,
  LeftUpperArm: [LM.leftShoulder, LM.leftElbow, LM.leftWrist],
  LeftLowerArm: [LM.leftShoulder, LM.leftElbow, LM.leftWrist],
  LeftHand: [LM.leftWrist, LM.leftIndex, LM.leftPinky],
  RightUpperArm: [LM.rightShoulder, LM.rightElbow, LM.rightWrist],
  RightLowerArm: [LM.rightShoulder, LM.rightElbow, LM.rightWrist],
  RightHand: [LM.rightWrist, LM.rightIndex, LM.rightPinky],
  LeftUpperLeg: [LM.leftHip, LM.leftKnee, LM.leftAnkle],
  LeftLowerLeg: [LM.leftHip, LM.leftKnee, LM.leftAnkle],
  LeftFoot: [LM.leftKnee, LM.leftAnkle, LM.leftHeel, LM.leftFootIndex],
  RightUpperLeg: [LM.rightHip, LM.rightKnee, LM.rightAnkle],
  RightLowerLeg: [LM.rightHip, LM.rightKnee, LM.rightAnkle],
  RightFoot: [LM.rightKnee, LM.rightAnkle, LM.rightHeel, LM.rightFootIndex],
};

/** Orthonormal frame (primary, secondary, primary × secondary) as a quaternion; null if degenerate. */
function frameQuat(primary: Vec3, secondaryHint: Vec3): Quat | null {
  const p = normalize(primary);
  const s = normalize(sub(secondaryHint, scale(p, dot(secondaryHint, p))));
  if (length(p) < 0.5 || length(s) < 0.5) return null;
  return quatFromBasis(p, s, cross(p, s));
}

function perpendicularTo(axis: Vec3, candidate: Vec3): Vec3 | null {
  const perpendicular = sub(candidate, scale(axis, dot(candidate, axis)));
  return length(perpendicular) > MIN_PERPENDICULAR ? normalize(perpendicular) : null;
}

/** Hinge axis of a two-bone limb; stays continuous while the limb is straight. */
function bendNormal(upper: Vec3, lower: Vec3, bendHint: Vec3, previous: Vec3 | undefined): Vec3 {
  const upperDir = normalize(upper);
  const bend = angleBetween(upper, lower);
  if (bend > STRAIGHT_LIMB) {
    const n = normalize(cross(upper, lower));
    const noisyFlip = previous !== undefined && dot(n, previous) < 0 && bend < NOISY_FLIP;
    if (!noisyFlip) return n;
  }
  const candidates: (Vec3 | undefined)[] = [previous, cross(upperDir, bendHint), cross(upperDir, UP)];
  for (const candidate of candidates) {
    const n = candidate && perpendicularTo(upperDir, candidate);
    if (n) return n;
  }
  return perpendicularTo(upperDir, [1, 0, 0]) ?? [0, 0, 1];
}

interface WorldFrames {
  frames: Partial<Record<DrivenBone, Quat>>;
  normals: LimbNormals;
}

function computeWorldFrames(p: Vec3[], previousNormals: LimbNormals): WorldFrames {
  const frames: Partial<Record<DrivenBone, Quat>> = {};
  const normals: LimbNormals = {};
  const put = (bone: DrivenBone, q: Quat | null) => {
    if (q) frames[bone] = q;
  };

  const hipMid = midpoint(p[LM.leftHip], p[LM.rightHip]);
  const shoulderMid = midpoint(p[LM.leftShoulder], p[LM.rightShoulder]);
  const torsoUp = sub(shoulderMid, hipMid);
  const hipLine = sub(p[LM.leftHip], p[LM.rightHip]);
  const shoulderLine = sub(p[LM.leftShoulder], p[LM.rightShoulder]);
  put('Hips', frameQuat(hipLine, torsoUp));
  const chest = frameQuat(shoulderLine, torsoUp);
  put('Chest', chest);
  put('UpperChest', chest);

  const earMid = midpoint(p[LM.leftEar], p[LM.rightEar]);
  put('Head', frameQuat(sub(p[LM.leftEar], p[LM.rightEar]), sub(p[LM.nose], earMid)));

  const chestForward = normalize(cross(shoulderLine, torsoUp));
  const hipsForward = normalize(cross(hipLine, torsoUp));
  for (const spec of LIMBS) {
    const upper = sub(p[spec.joint], p[spec.root]);
    let lower = sub(p[spec.end], p[spec.joint]);
    const forward = spec.bendSide === 1 ? chestForward : scale(hipsForward, -1);
    const n = bendNormal(upper, lower, forward, previousNormals[spec.limb]);
    if (angleBetween(upper, lower) > MAX_BEND) {
      lower = scale(rotateVec(quatFromAxisAngle(n, MAX_BEND), normalize(upper)), length(lower));
    }
    normals[spec.limb] = n;
    put(spec.upper, frameQuat(upper, n));
    put(spec.lower, frameQuat(lower, n));
  }

  put('LeftHand', frameQuat(sub(midpoint(p[LM.leftIndex], p[LM.leftPinky]), p[LM.leftWrist]), sub(p[LM.leftIndex], p[LM.leftPinky])));
  put('RightHand', frameQuat(sub(midpoint(p[LM.rightIndex], p[LM.rightPinky]), p[LM.rightWrist]), sub(p[LM.rightIndex], p[LM.rightPinky])));
  put('LeftFoot', frameQuat(sub(p[LM.leftFootIndex], p[LM.leftHeel]), sub(p[LM.leftKnee], p[LM.leftAnkle])));
  put('RightFoot', frameQuat(sub(p[LM.rightFootIndex], p[LM.rightHeel]), sub(p[LM.rightKnee], p[LM.rightAnkle])));
  return { frames, normals };
}

/** Palm frame from hand landmarks, with the same axes as the pose-based hand frame (wrist -> knuckles, pinky -> index). */
function palmFrame(h: Vec3[]): Quat | null {
  return frameQuat(
    sub(midpoint(h[HAND_LM.indexMcp], h[HAND_LM.pinkyMcp]), h[HAND_LM.wrist]),
    sub(h[HAND_LM.indexMcp], h[HAND_LM.pinkyMcp]),
  );
}

/** Finger segment frames: segment direction, twisted by the palm's lateral (pinky -> index) axis, the main curl axis. */
function fingerFrames(side: Side, h: Vec3[]): Partial<Record<DrivenBone, Quat>> {
  const lateral = sub(h[HAND_LM.indexMcp], h[HAND_LM.pinkyMcp]);
  const frames: Partial<Record<DrivenBone, Quat>> = {};
  for (const finger of FINGERS) {
    const base = FINGER_BASE[finger];
    for (let i = 0; i < SEGMENTS.length; i++) {
      const q = frameQuat(sub(h[base + i + 1], h[base + i]), lateral);
      if (q) frames[fingerBone(side, finger, i)] = q;
    }
  }
  return frames;
}

const identityRotations = (): Rotations =>
  Object.fromEntries(DRIVEN_BONES.map((bone) => [bone, [...IDENTITY] as Quat])) as Rotations;

/** Use the given canonical pose (and hands, when tracked) as the reference (identity) pose. */
export function calibrateRest(points: Vec3[], state: SolverState, hands: HandPoints = {}): SolverState {
  const { frames } = computeWorldFrames(points, {});
  const palmRest = { ...state.palmRest };
  for (const side of SIDES) {
    const h = hands[side];
    if (!h) continue;
    Object.assign(frames, fingerFrames(side, h));
    const palm = palmFrame(h);
    if (palm) palmRest[side] = palm;
  }
  const rest = Object.fromEntries(DRIVEN_BONES.map((bone) => [bone, frames[bone] ?? state.rest[bone]])) as Rotations;
  return { rest, palmRest, previous: null, normals: {}, fingerRelative: {} };
}

/** Straighten untracked fingers along their hand (body-only skeleton, or to reset a stale finger pose). */
export function relaxFingers(state: SolverState): SolverState {
  return { ...state, fingerRelative: {} };
}

/** Fresh state whose reference pose is the contract's T-pose. */
export function createSolverState(): SolverState {
  const empty: SolverState = { rest: identityRotations(), palmRest: {}, previous: null, normals: {}, fingerRelative: {} };
  return calibrateRest(tposeCanonical(), empty, { Left: tposeHandCanonical('Left'), Right: tposeHandCanonical('Right') });
}

/**
 * Solve one frame of canonical points (33) with per-landmark visibility, plus any tracked hands.
 * Pure: returns the next state.
 */
export function solveRotations(
  points: Vec3[],
  visibility: readonly number[],
  state: SolverState,
  hands: HandPoints = {},
): { rotations: Rotations; state: SolverState } {
  const { frames, normals } = computeWorldFrames(points, state.normals);
  const isVisible = (indices: readonly number[]) => indices.every((i) => (visibility[i] ?? 0) >= MIN_VISIBILITY);
  const previousOf = (bone: DrivenBone): Quat => state.previous?.[bone] ?? IDENTITY;
  const delta = (bone: DrivenBone): Quat => {
    const frame = frames[bone];
    if (!frame || !isVisible(REQUIRED[bone] ?? [])) return previousOf(bone);
    return quatMultiply(frame, quatConjugate(state.rest[bone]));
  };
  const handDelta = (side: Side): Quat => {
    const h = hands[side];
    const palm = h ? palmFrame(h) : null;
    const rest = state.palmRest[side];
    return palm && rest ? quatMultiply(palm, quatConjugate(rest)) : delta(`${side}Hand`);
  };

  const handDeltas: Record<Side, Quat> = { Left: handDelta('Left'), Right: handDelta('Right') };
  const fingers: Partial<Rotations> = {};
  const fingerRelative = { ...state.fingerRelative };
  for (const side of SIDES) {
    const h = hands[side];
    const hand = handDeltas[side];
    const fingerFrame = h ? fingerFrames(side, h) : {};
    for (const finger of FINGERS) {
      for (let i = 0; i < SEGMENTS.length; i++) {
        const bone = fingerBone(side, finger, i);
        const frame = fingerFrame[bone];
        if (frame) {
          const tracked = quatMultiply(frame, quatConjugate(state.rest[bone]));
          fingers[bone] = tracked;
          fingerRelative[bone] = quatMultiply(quatConjugate(hand), tracked);
        } else {
          // Not tracked this frame: keep the last pose relative to the hand so the finger moves with it.
          fingers[bone] = quatMultiply(hand, state.fingerRelative[bone] ?? IDENTITY);
        }
      }
    }
  }

  const hips = delta('Hips');
  const chest = delta('Chest');
  const head = delta('Head');
  const raw = {
    ...fingers,
    Hips: hips,
    Spine: isVisible(REQUIRED.Spine ?? []) ? quatSlerp(hips, chest, 0.5) : previousOf('Spine'),
    Chest: chest,
    UpperChest: chest,
    Neck: isVisible(REQUIRED.Neck ?? []) ? quatSlerp(chest, head, 0.5) : previousOf('Neck'),
    Head: head,
    LeftUpperArm: delta('LeftUpperArm'),
    LeftLowerArm: delta('LeftLowerArm'),
    LeftHand: handDeltas.Left,
    RightUpperArm: delta('RightUpperArm'),
    RightLowerArm: delta('RightLowerArm'),
    RightHand: handDeltas.Right,
    LeftUpperLeg: delta('LeftUpperLeg'),
    LeftLowerLeg: delta('LeftLowerLeg'),
    LeftFoot: delta('LeftFoot'),
    RightUpperLeg: delta('RightUpperLeg'),
    RightLowerLeg: delta('RightLowerLeg'),
    RightFoot: delta('RightFoot'),
  } as Rotations;
  const rotations = Object.fromEntries(
    DRIVEN_BONES.map((bone) => [bone, sameHemisphere(quatNormalize(raw[bone]), previousOf(bone))]),
  ) as Rotations;

  const nextNormals: LimbNormals = { ...state.normals };
  for (const spec of LIMBS) {
    if (isVisible([spec.root, spec.joint, spec.end])) nextNormals[spec.limb] = normals[spec.limb];
  }
  return { rotations, state: { ...state, previous: rotations, normals: nextNormals, fingerRelative } };
}

/** Flatten rotations into the wire format (BONE_COUNT x 4 floats in DRIVEN_BONES order). */
export function flattenRotations(rotations: Rotations): number[] {
  return DRIVEN_BONES.flatMap((bone) => rotations[bone]);
}
