/**
 * Finding a T-pose in an imported video, from the 2D image landmarks: MediaPipe's 2D positions are reliable
 * where its 3D depth is not, and a T-pose is easy to judge head-on.
 */
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

type Point2 = [number, number];

const MIN_VISIBILITY = 0.5;
const MAX_ELBOW_BEND = (25 * Math.PI) / 180;
const MAX_ARM_SLOPE = (20 * Math.PI) / 180;
/** Shoulder to wrist must be at least this many shoulder widths: rules out arms pointing at the camera. */
const MIN_ARM_SHOULDER_RATIO = 1;
const POSE = { leftShoulder: 11, rightShoulder: 12, leftElbow: 13, rightElbow: 14, leftWrist: 15, rightWrist: 16, leftHip: 23, rightHip: 24 };

const sub = (a: Point2, b: Point2): Point2 => [a[0] - b[0], a[1] - b[1]];
const length = (v: Point2) => Math.hypot(v[0], v[1]);
const angleBetween = (a: Point2, b: Point2) =>
  Math.acos(Math.min(1, Math.max(-1, (a[0] * b[0] + a[1] * b[1]) / (length(a) * length(b) || 1))));

/** Straight, level, and pointing away from the body (`outward` is the sign of this side's outward x direction). */
function armOut(shoulder: Point2, elbow: Point2, wrist: Point2, outward: number, shoulderWidth: number): boolean {
  const arm = sub(wrist, shoulder);
  const straight = angleBetween(sub(elbow, shoulder), sub(wrist, elbow)) < MAX_ELBOW_BEND;
  const level = Math.abs(arm[1]) < Math.tan(MAX_ARM_SLOPE) * Math.abs(arm[0]);
  const pointsOut = Math.sign(arm[0]) === Math.sign(outward);
  return straight && level && pointsOut && length(arm) > MIN_ARM_SHOULDER_RATIO * shoulderWidth;
}

/**
 * Both arms straight out to the sides. `aspect` (frame width / height) turns normalized coordinates into
 * real proportions. Works on mirrored and un-mirrored videos alike.
 */
export function isTPose(image: readonly NormalizedLandmark[] | undefined, aspect: number): boolean {
  if (!image || image.length <= POSE.rightHip) return false;
  const points = Object.values(POSE).map((index): Point2 | null => {
    const lm = image[index];
    return (lm.visibility ?? 1) >= MIN_VISIBILITY ? [lm.x * aspect, lm.y] : null;
  });
  if (points.some((p) => p === null)) return false;
  const [leftShoulder, rightShoulder, leftElbow, rightElbow, leftWrist, rightWrist] = points as Point2[];
  const across = leftShoulder[0] - rightShoulder[0];
  const shoulderWidth = length(sub(leftShoulder, rightShoulder));
  return (
    armOut(leftShoulder, leftElbow, leftWrist, across, shoulderWidth) &&
    armOut(rightShoulder, rightElbow, rightWrist, -across, shoulderWidth)
  );
}

/** Index of the middle frame of the first run of at least `minLength` consecutive trues, or null. */
export function firstHeldRun(flags: readonly boolean[], minLength: number): number | null {
  let start = -1;
  for (let i = 0; i < flags.length; i++) {
    if (!flags[i]) {
      start = -1;
      continue;
    }
    if (start < 0) start = i;
    if (i - start + 1 === minLength) return start + Math.floor(minLength / 2);
  }
  return null;
}
