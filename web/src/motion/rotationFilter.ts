/**
 * One Euro filter on rotations: slerps toward each new sample with a cutoff that grows with angular speed,
 * so held poses stop shimmering while fast moves still come through.
 */
import { BODY_BONE_COUNT, DRIVEN_BONES, type DrivenBone, type Quat } from './contract';
import { quatDot, quatSlerp, sameHemisphere } from './math';
import type { OneEuroParams } from './oneEuro';

export type SmoothingLevel = 'low' | 'medium' | 'high';

function smoothingFactor(dt: number, cutoff: number): number {
  const r = 2 * Math.PI * cutoff * dt;
  return r / (r + 1);
}

export class RotationFilter {
  private previous: Quat | null = null;
  private previousTime = 0;
  private speed = 0;

  constructor(private readonly params: OneEuroParams) {}

  filter(q: Quat, t: number): Quat {
    if (this.previous === null || t <= this.previousTime) {
      this.previous = q;
      this.previousTime = t;
      return q;
    }
    const dt = t - this.previousTime;
    const target = sameHemisphere(q, this.previous);
    const angle = 2 * Math.acos(Math.min(1, Math.abs(quatDot(this.previous, target))));
    const speedAlpha = smoothingFactor(dt, this.params.dCutoff);
    this.speed = speedAlpha * (angle / dt) + (1 - speedAlpha) * this.speed;
    const alpha = smoothingFactor(dt, this.params.minCutoff + this.params.beta * this.speed);
    const out = quatSlerp(this.previous, target, alpha);
    this.previous = out;
    this.previousTime = t;
    return out;
  }
}

/** Per-bone-group settings at "medium": short bones (hands, feet, fingers) jitter most and get the most smoothing. */
const GROUP_PARAMS: Record<'torso' | 'limb' | 'extremity' | 'finger', OneEuroParams> = {
  torso: { minCutoff: 1.2, beta: 0.2, dCutoff: 1 },
  limb: { minCutoff: 1.5, beta: 0.25, dCutoff: 1 },
  extremity: { minCutoff: 1.0, beta: 0.15, dCutoff: 1 },
  finger: { minCutoff: 0.8, beta: 0.1, dCutoff: 1 },
};

/** Cutoff multiplier per level: higher cutoff = lighter smoothing, less lag. */
const LEVEL_SCALE: Record<SmoothingLevel, number> = { low: 2.2, medium: 1, high: 0.45 };

function groupOf(bone: DrivenBone, index: number): keyof typeof GROUP_PARAMS {
  if (index >= BODY_BONE_COUNT) return 'finger';
  if (/Hand$|Foot$/.test(bone)) return 'extremity';
  if (/Arm$|Leg$/.test(bone)) return 'limb';
  return 'torso';
}

/** One RotationFilter per driven bone, tuned by bone group and the chosen smoothing level. */
export class BoneRotationFilters {
  private readonly filters: RotationFilter[];

  constructor(level: SmoothingLevel = 'medium') {
    const scale = LEVEL_SCALE[level];
    this.filters = DRIVEN_BONES.map((bone, index) => {
      const base = GROUP_PARAMS[groupOf(bone, index)];
      return new RotationFilter({ ...base, minCutoff: base.minCutoff * scale, beta: base.beta * scale });
    });
  }

  /** Filter every bone's rotation; returns a new record. */
  filter(rotations: Readonly<Record<DrivenBone, Quat>>, t: number): Record<DrivenBone, Quat> {
    return Object.fromEntries(
      DRIVEN_BONES.map((bone, i) => [bone, this.filters[i].filter(rotations[bone], t)]),
    ) as Record<DrivenBone, Quat>;
  }
}
