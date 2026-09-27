/**
 * Foot planting: a foot resting on the floor is laid flat (its yaw kept, pitch and roll removed).
 * MediaPipe's heel/toe depth is noisy, so standing feet otherwise tilt toes-down and the body ends up
 * on tiptoe once the lowest sole is grounded. Lifted feet (kicks, knee raises, jumps) are left alone.
 */
import { type Quat } from './contract';
import { quatFromAxisAngle, quatSlerp, rotateVec } from './math';
import { forwardKinematics, solePoints } from './skeleton';
import type { Rotations } from './solver';

/** Soles within this height of the lowest sole are fully planted (meters). */
const PLANT_FULL = 0.03;
/** Above this height the foot keeps its tracked rotation; in between the two blend smoothly. */
const PLANT_RELEASE = 0.08;
const SIDES = ['Left', 'Right'] as const;

/** Rotation about +Y that keeps only the foot's heading (the rest foot points along +Z and lies flat). */
function flatHeading(foot: Quat): Quat {
  const forward = rotateVec(foot, [0, 0, 1]);
  return quatFromAxisAngle([0, 1, 0], Math.atan2(forward[0], forward[2]));
}

export function plantFeet(rotations: Rotations): Rotations {
  const joints = forwardKinematics(rotations);
  const lowest = {
    Left: Math.min(...solePoints(rotations, joints, 'Left').map((p) => p[1])),
    Right: Math.min(...solePoints(rotations, joints, 'Right').map((p) => p[1])),
  };
  const floor = Math.min(lowest.Left, lowest.Right);
  const planted: Rotations = { ...rotations };
  for (const side of SIDES) {
    const height = lowest[side] - floor;
    const weight = Math.min(1, Math.max(0, (PLANT_RELEASE - height) / (PLANT_RELEASE - PLANT_FULL)));
    if (weight === 0) continue;
    const foot = rotations[`${side}Foot`];
    planted[`${side}Foot`] = quatSlerp(foot, flatHeading(foot), weight);
  }
  return planted;
}
