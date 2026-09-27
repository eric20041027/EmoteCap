/**
 * One Euro filter (Casiez et al. 2012): low lag during fast motion, strong smoothing at rest.
 * Landmark units are meters, so beta is much larger than the pixel-space defaults
 * (spec §6.1 suggested 0.01; 1.0 keeps a fast arm swing within ~2 frames). Tune live if needed.
 */
import type { PoseLandmark } from './landmarks';

export interface OneEuroParams {
  /** Cutoff frequency at rest (Hz). Lower = smoother but laggier. */
  minCutoff: number;
  /** How fast the cutoff grows with speed (per m/s). Higher = less lag on fast moves. */
  beta: number;
  /** Cutoff for the derivative estimate (Hz). */
  dCutoff: number;
}

export const DEFAULT_ONE_EURO: OneEuroParams = { minCutoff: 1.0, beta: 1.0, dCutoff: 1.0 };

function smoothingFactor(dt: number, cutoff: number): number {
  const r = 2 * Math.PI * cutoff * dt;
  return r / (r + 1);
}

export class OneEuroFilter {
  private previousValue: number | null = null;
  private previousDerivative = 0;
  private previousTime = 0;

  constructor(private readonly params: OneEuroParams = DEFAULT_ONE_EURO) {}

  /** Filter one sample taken at time t (seconds). */
  filter(value: number, t: number): number {
    if (this.previousValue === null || t <= this.previousTime) {
      this.previousValue = value;
      this.previousTime = t;
      return value;
    }
    const dt = t - this.previousTime;
    const derivative = (value - this.previousValue) / dt;
    const smoothedDerivative =
      smoothingFactor(dt, this.params.dCutoff) * derivative +
      (1 - smoothingFactor(dt, this.params.dCutoff)) * this.previousDerivative;
    const cutoff = this.params.minCutoff + this.params.beta * Math.abs(smoothedDerivative);
    const alpha = smoothingFactor(dt, cutoff);
    const smoothed = alpha * value + (1 - alpha) * this.previousValue;
    this.previousValue = smoothed;
    this.previousDerivative = smoothedDerivative;
    this.previousTime = t;
    return smoothed;
  }
}

/** One Euro filter per coordinate of every landmark. Returns new landmark objects. */
export class LandmarkFilter {
  private filters: OneEuroFilter[][] = [];
  private readonly params: OneEuroParams;

  constructor(params: Partial<OneEuroParams> = {}) {
    this.params = { ...DEFAULT_ONE_EURO, ...params };
  }

  filter(landmarks: readonly PoseLandmark[], t: number): PoseLandmark[] {
    while (this.filters.length < landmarks.length) {
      this.filters.push([new OneEuroFilter(this.params), new OneEuroFilter(this.params), new OneEuroFilter(this.params)]);
    }
    return landmarks.map((lm, i) => {
      const [fx, fy, fz] = this.filters[i];
      return { x: fx.filter(lm.x, t), y: fy.filter(lm.y, t), z: fz.filter(lm.z, t), visibility: lm.visibility };
    });
  }
}
