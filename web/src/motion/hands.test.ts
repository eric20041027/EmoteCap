import { describe, expect, it } from 'vitest';
import type { DrivenBone, Quat, Vec3 } from './contract';
import { HAND_LM, tposeHandCanonical } from './hands';
import { normalize, quatDot, quatFromAxisAngle, quatMultiply as quatMultiplyPublic, rotateVec as rotate, sub } from './math';
import { DEG, rotatePoints, tpose } from './poses.testutil';
import {
  HAND_HOLD_S,
  RELAXED_FINGERS,
  createSolverState,
  handRelaxAmount,
  relaxFingers,
  relaxHandToward,
  solveRotations,
  type Rotations,
} from './solver';

const ALL_VISIBLE = new Array(33).fill(1);
const IDENTITY: Quat = [0, 0, 0, 1];

function expectRotation(rotations: Rotations, bone: DrivenBone, expected: Quat) {
  expect(Math.abs(quatDot(rotations[bone], expected)), bone).toBeCloseTo(1, 3);
}

describe('tposeHandCanonical', () => {
  it('places the left wrist at the skeleton hand and the fingers along +X', () => {
    const hand = tposeHandCanonical('Left');
    expect(hand).toHaveLength(21);
    expect(hand[HAND_LM.wrist]).toEqual([0.72, 1.4, 0]);
    expect(hand[HAND_LM.middleTip][0]).toBeGreaterThan(0.9);
  });

  it('mirrors the right hand across x', () => {
    expect(tposeHandCanonical('Right')[HAND_LM.indexMcp][0]).toBeCloseTo(-tposeHandCanonical('Left')[HAND_LM.indexMcp][0], 6);
  });
});

describe('solveRotations with hand landmarks', () => {
  const both = () => ({ Left: tposeHandCanonical('Left'), Right: tposeHandCanonical('Right') });

  it('keeps every finger at identity for T-pose hands', () => {
    const { rotations } = solveRotations(tpose(), ALL_VISIBLE, createSolverState(), both());
    for (const bone of ['LeftHand', 'LeftIndexProximal', 'LeftThumbDistal', 'RightLittleIntermediate'] as DrivenBone[]) {
      expectRotation(rotations, bone, IDENTITY);
    }
  });

  /** Curl about the palm's lateral (pinky -> index) axis; palm down, so fingertips move toward -Y. */
  const curlOf = (hand: Vec3[]) =>
    quatFromAxisAngle(normalize(sub(hand[HAND_LM.indexMcp], hand[HAND_LM.pinkyMcp])), -60 * DEG);

  it('curls the left index finger toward the palm', () => {
    const hand = tposeHandCanonical('Left');
    const curl = curlOf(hand);
    const curled = rotatePoints(hand, [HAND_LM.indexPip, HAND_LM.indexDip, HAND_LM.indexTip], hand[HAND_LM.indexMcp], curl);
    const { rotations } = solveRotations(tpose(), ALL_VISIBLE, createSolverState(), { Left: curled });
    expectRotation(rotations, 'LeftIndexProximal', curl);
    expectRotation(rotations, 'LeftIndexDistal', curl);
    expectRotation(rotations, 'LeftMiddleProximal', IDENTITY);
    expectRotation(rotations, 'LeftHand', IDENTITY);
  });

  it('turns the whole hand when the wrist bends, taking the fingers with it', () => {
    const hand = tposeHandCanonical('Left');
    const bend = quatFromAxisAngle([0, 1, 0], 30 * DEG);
    const bent = rotatePoints(hand, [...hand.keys()], hand[HAND_LM.wrist], bend);
    const { rotations } = solveRotations(tpose(), ALL_VISIBLE, createSolverState(), { Left: bent });
    expectRotation(rotations, 'LeftHand', bend);
    expectRotation(rotations, 'LeftRingIntermediate', bend);
  });

  it('holds finger rotations while the hand is not detected', () => {
    const hand = tposeHandCanonical('Left');
    const curl = curlOf(hand);
    const curled: Vec3[] = rotatePoints(hand, [HAND_LM.indexPip, HAND_LM.indexDip, HAND_LM.indexTip], hand[HAND_LM.indexMcp], curl);
    const first = solveRotations(tpose(), ALL_VISIBLE, createSolverState(), { Left: curled });
    const second = solveRotations(tpose(), ALL_VISIBLE, first.state, {});
    expectRotation(second.rotations, 'LeftIndexProximal', curl);
  });
});

describe('finger poses while a hand is not tracked', () => {
  const armDown = () => {
    const p = tpose();
    return rotatePoints(p, [13, 15, 17, 19, 21], p[11], quatFromAxisAngle([0, 0, 1], -90 * DEG));
  };

  it('keeps fingers attached to the hand when the arm moves without hand tracking', () => {
    const hand = tposeHandCanonical('Left');
    const curl = quatFromAxisAngle(normalize(sub(hand[HAND_LM.indexMcp], hand[HAND_LM.pinkyMcp])), -60 * DEG);
    const curled = rotatePoints(hand, [HAND_LM.indexPip, HAND_LM.indexDip, HAND_LM.indexTip], hand[HAND_LM.indexMcp], curl);
    const first = solveRotations(tpose(), ALL_VISIBLE, createSolverState(), { Left: curled });
    const second = solveRotations(armDown(), ALL_VISIBLE, first.state, {});
    const handTurn = second.rotations.LeftHand;
    // Finger world delta = new hand delta x (finger relative to hand), so the curl rides along with the hand.
    const expected = quatMultiplyPublic(handTurn, curl);
    expectRotation(second.rotations, 'LeftIndexProximal', expected);
  });

  const curledIndexState = () => {
    const hand = tposeHandCanonical('Left');
    const curl = quatFromAxisAngle(normalize(sub(hand[HAND_LM.indexMcp], hand[HAND_LM.pinkyMcp])), -60 * DEG);
    const curled = rotatePoints(hand, [HAND_LM.indexPip, HAND_LM.indexDip, HAND_LM.indexTip], hand[HAND_LM.indexMcp], curl);
    return { curl, state: solveRotations(tpose(), ALL_VISIBLE, createSolverState(), { Left: curled }).state };
  };
  const relaxedOn = (rotations: Rotations, bone: DrivenBone, handBone: DrivenBone) =>
    quatMultiplyPublic(rotations[handBone], RELAXED_FINGERS[bone] ?? IDENTITY);

  it('relaxes fingers into a loose resting curl after relaxFingers', () => {
    const relaxed = solveRotations(armDown(), ALL_VISIBLE, relaxFingers(curledIndexState().state), {});
    expectRotation(relaxed.rotations, 'LeftIndexProximal', relaxedOn(relaxed.rotations, 'LeftIndexProximal', 'LeftHand'));
    expectRotation(relaxed.rotations, 'LeftThumbDistal', relaxed.rotations.LeftHand);
  });

  it('curls resting fingers toward the palm on both hands', () => {
    const { rotations } = solveRotations(tpose(), ALL_VISIBLE, createSolverState(), {});
    for (const side of ['Left', 'Right'] as const) {
      const tip = quatMultiplyPublic(rotations[`${side}Hand`], RELAXED_FINGERS[`${side}MiddleDistal`] ?? IDENTITY);
      // In the T-pose the palm faces down: a resting fingertip segment points partly down (-Y).
      const x = side === 'Left' ? 1 : -1;
      const dir = rotate(tip, [x, 0, 0]);
      expect(dir[1], side).toBeLessThan(-0.3);
    }
  });

  it('eases a held finger pose toward the resting hand, one side at a time', () => {
    const { curl, state } = curledIndexState();
    const held = solveRotations(tpose(), ALL_VISIBLE, relaxHandToward(state, 'Left', 0), {});
    expectRotation(held.rotations, 'LeftIndexProximal', curl);
    const rested = solveRotations(tpose(), ALL_VISIBLE, relaxHandToward(state, 'Left', 1), {});
    expectRotation(rested.rotations, 'LeftIndexProximal', relaxedOn(rested.rotations, 'LeftIndexProximal', 'LeftHand'));
    const otherSide = solveRotations(tpose(), ALL_VISIBLE, relaxHandToward(state, 'Right', 1), {});
    expectRotation(otherSide.rotations, 'LeftIndexProximal', curl);
  });
});

describe('handRelaxAmount', () => {
  it('holds a hand that just dropped out', () => {
    expect(handRelaxAmount(HAND_HOLD_S / 2, 1 / 30)).toBe(0);
  });

  it('eases a hand that has been gone longer than the hold, faster for longer frames', () => {
    const short = handRelaxAmount(HAND_HOLD_S + 0.1, 1 / 30);
    const long = handRelaxAmount(HAND_HOLD_S + 0.1, 1 / 10);
    expect(short).toBeGreaterThan(0);
    expect(long).toBeGreaterThan(short);
    expect(long).toBeLessThan(1);
    expect(handRelaxAmount(Number.POSITIVE_INFINITY, 1 / 30)).toBeGreaterThan(0);
  });
});
