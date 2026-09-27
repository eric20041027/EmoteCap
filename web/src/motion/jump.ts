/**
 * Airborne height from the camera image, so jumps leave the floor instead of being pinned by grounding.
 *
 * A jump moves the whole body up in the image: the lowest foot AND the head rise together. Squats and bows
 * lower the head with the feet fixed; stepping back raises the feet but lowers the head; walking in place
 * keeps one foot down. Taking the smaller of the two rises (relative to recent "lowest on screen" baselines)
 * rejects all of those. Image units become meters through the shoulder width, which stays parallel to the
 * image plane while the actor faces the camera.
 */
import type { Vec3 } from './contract';
import { LM, type PoseLandmark } from './landmarks';
import { length, sub } from './math';

const BASELINE_SECONDS = 2;
/** Canonical meters; smaller lifts are tracking wobble. */
const MIN_LIFT = 0.05;
const CANONICAL_LEG = 0.85;
const MIN_VISIBILITY = 0.5;
const FEET = [LM.leftHeel, LM.rightHeel, LM.leftFootIndex, LM.rightFootIndex];

interface Sample {
  t: number;
  feetY: number;
  headY: number;
}

export interface JumpState {
  readonly history: readonly Sample[];
}

export const createJumpState = (): JumpState => ({ history: [] });

function legLength(world: Vec3[]): number {
  const leg = (hip: number, knee: number, ankle: number) =>
    length(sub(world[knee], world[hip])) + length(sub(world[ankle], world[knee]));
  return (leg(LM.leftHip, LM.leftKnee, LM.leftAnkle) + leg(LM.rightHip, LM.rightKnee, LM.rightAnkle)) / 2;
}

/**
 * @param image normalized, un-mirrored image landmarks (x right, y down)
 * @param world canonical world points (meters)
 * @returns lift in canonical meters (0 when grounded) and the next state
 */
export function solveJumpLift(
  image: readonly PoseLandmark[] | undefined,
  world: Vec3[],
  visibility: readonly number[],
  t: number,
  state: JumpState,
): { lift: number; state: JumpState } {
  const isVisible = (i: number) => (visibility[i] ?? 0) >= MIN_VISIBILITY;
  const feet = FEET.filter(isVisible);
  if (!image || image.length < world.length || feet.length === 0 || !isVisible(LM.nose)) return { lift: 0, state };
  if (!isVisible(LM.leftShoulder) || !isVisible(LM.rightShoulder)) return { lift: 0, state };

  const sample: Sample = { t, feetY: Math.max(...feet.map((i) => image[i].y)), headY: image[LM.nose].y };
  const history = [...state.history.filter((s) => t - s.t <= BASELINE_SECONDS), sample];
  const feetRise = Math.max(...history.map((s) => s.feetY)) - sample.feetY;
  const headRise = Math.max(...history.map((s) => s.headY)) - sample.headY;
  const riseImage = Math.min(feetRise, headRise);

  const shoulderImage = Math.hypot(image[LM.leftShoulder].x - image[LM.rightShoulder].x, image[LM.leftShoulder].y - image[LM.rightShoulder].y);
  const shoulderWorld = length(sub(world[LM.leftShoulder], world[LM.rightShoulder]));
  const actorLeg = legLength(world);
  if (riseImage <= 0 || shoulderImage <= 0 || shoulderWorld <= 0 || actorLeg <= 0) return { lift: 0, state: { history } };

  const lift = (riseImage * shoulderWorld) / shoulderImage * (CANONICAL_LEG / actorLeg);
  return { lift: lift >= MIN_LIFT ? lift : 0, state: { history } };
}
