import type { Quat, Vec3 } from './contract';

// ---------- vectors ----------

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const length = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);
export const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => add(a, scale(sub(b, a), t));
export const midpoint = (a: Vec3, b: Vec3): Vec3 => lerp(a, b, 0.5);

export function normalize(a: Vec3): Vec3 {
  const len = length(a);
  return len > 1e-9 ? scale(a, 1 / len) : [0, 0, 0];
}

/** Angle in radians between two vectors. */
export function angleBetween(a: Vec3, b: Vec3): number {
  const d = dot(normalize(a), normalize(b));
  return Math.acos(Math.min(1, Math.max(-1, d)));
}

// ---------- quaternions [x, y, z, w] ----------

export const IDENTITY: Quat = [0, 0, 0, 1];

/** Hamilton product: rotating by (a * b) applies b first, then a. */
export function quatMultiply(a: Quat, b: Quat): Quat {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

export const quatConjugate = (q: Quat): Quat => [-q[0], -q[1], -q[2], q[3]];
export const quatDot = (a: Quat, b: Quat): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];

export function quatNormalize(q: Quat): Quat {
  const len = Math.hypot(q[0], q[1], q[2], q[3]);
  return len > 1e-9 ? [q[0] / len, q[1] / len, q[2] / len, q[3] / len] : [...IDENTITY];
}

export function quatFromAxisAngle(axis: Vec3, angle: number): Quat {
  const n = normalize(axis);
  const s = Math.sin(angle / 2);
  return [n[0] * s, n[1] * s, n[2] * s, Math.cos(angle / 2)];
}

/** Rotation whose matrix columns are the given orthonormal axes (where +X, +Y, +Z end up). */
export function quatFromBasis(x: Vec3, y: Vec3, z: Vec3): Quat {
  const [m00, m10, m20] = x;
  const [m01, m11, m21] = y;
  const [m02, m12, m22] = z;
  const trace = m00 + m11 + m22;
  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2;
    return quatNormalize([(m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, 0.25 * s]);
  }
  if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    return quatNormalize([0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s]);
  }
  if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    return quatNormalize([(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s]);
  }
  const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
  return quatNormalize([(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s]);
}

export function rotateVec(q: Quat, v: Vec3): Vec3 {
  const u: Vec3 = [q[0], q[1], q[2]];
  const uv = cross(u, v);
  const uuv = cross(u, uv);
  return add(v, add(scale(uv, 2 * q[3]), scale(uuv, 2)));
}

/** Return q or -q, whichever lies in the same hemisphere as the reference (same rotation, no flip). */
export function sameHemisphere(q: Quat, reference: Quat): Quat {
  return quatDot(q, reference) < 0 ? [-q[0], -q[1], -q[2], -q[3]] : q;
}

export function quatSlerp(a: Quat, b: Quat, t: number): Quat {
  const target = sameHemisphere(b, a);
  const cos = Math.min(1, quatDot(a, target));
  if (cos > 0.9995) {
    return quatNormalize([
      a[0] + (target[0] - a[0]) * t,
      a[1] + (target[1] - a[1]) * t,
      a[2] + (target[2] - a[2]) * t,
      a[3] + (target[3] - a[3]) * t,
    ]);
  }
  const theta = Math.acos(cos);
  const sin = Math.sin(theta);
  const wa = Math.sin((1 - t) * theta) / sin;
  const wb = Math.sin(t * theta) / sin;
  return [
    a[0] * wa + target[0] * wb,
    a[1] * wa + target[1] * wb,
    a[2] * wa + target[2] * wb,
    a[3] * wa + target[3] * wb,
  ];
}
