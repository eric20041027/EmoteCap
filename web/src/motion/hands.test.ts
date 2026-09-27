import { describe, expect, it } from 'vitest';
import type { DrivenBone, Quat, Vec3 } from './contract';
import { HAND_LM, tposeHandCanonical } from './hands';
import { normalize, quatDot, quatFromAxisAngle, sub } from './math';
import { DEG, rotatePoints, tpose } from './poses.testutil';
import { createSolverState, solveRotations, type Rotations } from './solver';

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
