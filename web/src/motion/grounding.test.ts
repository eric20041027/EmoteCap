import { describe, expect, it } from 'vitest';
import { createGroundingState, solveHipsHeight } from './grounding';
import { LM } from './landmarks';
import { tpose, translatePoints } from './poses.testutil';

const ALL_VISIBLE = new Array(33).fill(1);
const UPPER_BODY_AND_HIPS = Array.from({ length: 25 }, (_, i) => i); // landmarks 0..24

describe('solveHipsHeight', () => {
  it('puts the canonical T-pose at the rest hips height', () => {
    const { hipsY } = solveHipsHeight(tpose(), ALL_VISIBLE, createGroundingState());
    expect(hipsY).toBeCloseTo(0.95, 2);
  });

  it('lowers the hips when the actor crouches', () => {
    let state = createGroundingState();
    for (let i = 0; i < 30; i++) state = solveHipsHeight(tpose(), ALL_VISIBLE, state).state;
    const crouch = translatePoints(tpose(), UPPER_BODY_AND_HIPS, [0, -0.2, 0]);
    const { hipsY } = solveHipsHeight(crouch, ALL_VISIBLE, state);
    expect(hipsY).toBeCloseTo(0.75, 2);
  });

  it('scales a tall actor down to the canonical skeleton', () => {
    const tall = tpose().map(([x, y, z]) => [x * 1.2, y * 1.2, z * 1.2] as [number, number, number]);
    const { hipsY } = solveHipsHeight(tall, ALL_VISIBLE, createGroundingState());
    expect(hipsY).toBeCloseTo(0.95, 2);
  });

  it('keeps the previous height when both feet are hidden', () => {
    const first = solveHipsHeight(tpose(), ALL_VISIBLE, createGroundingState());
    const hidden = [...ALL_VISIBLE];
    for (const i of [LM.leftAnkle, LM.rightAnkle, LM.leftHeel, LM.rightHeel, LM.leftFootIndex, LM.rightFootIndex]) hidden[i] = 0;
    const crouch = translatePoints(tpose(), UPPER_BODY_AND_HIPS, [0, -0.3, 0]);
    expect(solveHipsHeight(crouch, hidden, first.state).hipsY).toBeCloseTo(first.hipsY, 5);
  });
});
