import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { describe, expect, it } from 'vitest';
import { assignHands } from './hands';

const point = (x: number, y: number): NormalizedLandmark => ({ x, y, z: 0, visibility: 1 });
const hand = (x: number, y: number) => Array.from({ length: 21 }, () => point(x, y));
const worldHand = (tag: number) => Array.from({ length: 21 }, () => ({ x: tag, y: 0, z: 0, visibility: 1 }));
const label = (name: string) => [{ score: 0.9, index: 0, categoryName: name, displayName: name }];

/** Pose with the actor's left wrist on the image's right side (un-mirrored camera) and right wrist on the left. */
function pose(): NormalizedLandmark[] {
  const p = Array.from({ length: 33 }, () => point(0.5, 0.5));
  p[15] = point(0.7, 0.4); // left wrist
  p[16] = point(0.3, 0.4); // right wrist
  return p;
}

describe('assignHands', () => {
  it('matches hands to the nearest pose wrist, ignoring MediaPipe labels', () => {
    const result = {
      landmarks: [hand(0.31, 0.41), hand(0.69, 0.42)],
      worldLandmarks: [worldHand(1), worldHand(2)],
      handedness: [label('Right'), label('Right')],
    };
    const hands = assignHands(result, pose());
    expect(hands.world.Right?.[0].x).toBe(1);
    expect(hands.world.Left?.[0].x).toBe(2);
    expect(hands.image.Left?.[0].x).toBeCloseTo(0.69);
  });

  it('ignores a hand far from both wrists (someone else in frame)', () => {
    const result = { landmarks: [hand(0.05, 0.9)], worldLandmarks: [worldHand(1)], handedness: [label('Left')] };
    const hands = assignHands(result, pose());
    expect(hands.world).toEqual({});
  });

  it('falls back to swapped MediaPipe labels when there is no pose', () => {
    const result = { landmarks: [hand(0.3, 0.4)], worldLandmarks: [worldHand(7)], handedness: [label('Left')] };
    const hands = assignHands(result, undefined);
    expect(hands.world.Right?.[0].x).toBe(7);
    expect(hands.world.Left).toBeUndefined();
  });

  it('returns no hands when none are detected', () => {
    expect(assignHands({ landmarks: [], worldLandmarks: [], handedness: [] }, pose())).toEqual({ world: {}, image: {} });
  });
});
