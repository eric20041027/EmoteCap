import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { describe, expect, it } from 'vitest';
import { assignHands } from './hands';

const point = (x: number, y: number): NormalizedLandmark => ({ x, y, z: 0, visibility: 1 });
const hand = (x: number, y: number) => Array.from({ length: 21 }, () => point(x, y));
const worldHand = (tag: number) => Array.from({ length: 21 }, () => ({ x: tag, y: 0, z: 0, visibility: 1 }));
const label = (name: string, score = 0.9) => [{ score, index: 0, categoryName: name, displayName: name }];
/** A hand whose index and little-finger knuckles are `span` apart (normalized units), wrist at (x, y). */
function spanHand(x: number, y: number, span: number) {
  const h = hand(x, y);
  h[5] = point(x - span / 2, y - 0.05);
  h[17] = point(x + span / 2, y - 0.05);
  return h;
}

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

  it("uses MediaPipe's labels as-is when there is no pose (they name the actor's own side on our camera)", () => {
    const result = { landmarks: [hand(0.3, 0.4)], worldLandmarks: [worldHand(7)], handedness: [label('Left')] };
    const hands = assignHands(result, undefined);
    expect(hands.world.Left?.[0].x).toBe(7);
    expect(hands.world.Right).toBeUndefined();
  });

  it("keeps a hand the pose wrist misplaced when MediaPipe's label is confident", () => {
    // The pose puts the right wrist at (0.3, 0.4); the right hand is really 0.28 lower, e.g. raised by the face.
    const result = { landmarks: [hand(0.3, 0.68)], worldLandmarks: [worldHand(3)], handedness: [label('Right', 0.95)] };
    expect(assignHands(result, pose()).world.Right?.[0].x).toBe(3);
  });

  it('does not trust an unsure label', () => {
    const result = { landmarks: [hand(0.3, 0.68)], worldLandmarks: [worldHand(3)], handedness: [label('Right', 0.6)] };
    expect(assignHands(result, pose()).world).toEqual({});
  });

  it('drops hands too small in the frame to read their fingers', () => {
    const frame = { width: 1000, height: 1000 };
    const result = {
      landmarks: [spanHand(0.31, 0.41, 0.02), spanHand(0.69, 0.41, 0.05)],
      worldLandmarks: [worldHand(1), worldHand(2)],
      handedness: [label('Right'), label('Left')],
    };
    const hands = assignHands(result, pose(), frame);
    expect(hands.world.Right).toBeUndefined(); // 20 px between the knuckles
    expect(hands.world.Left?.[0].x).toBe(2); // 50 px
  });

  it('returns no hands when none are detected', () => {
    expect(assignHands({ landmarks: [], worldLandmarks: [], handedness: [] }, pose())).toEqual({ world: {}, image: {} });
  });
});
