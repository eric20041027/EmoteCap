import { tposeFrame } from '../motion/contract';
import { addTake, createProject } from './model';
import type { TakeProvenance } from './types';

export function provenance(): Mutable<TakeProvenance> {
  return { appVersion: '0.1.0', contractVersion: 2, trackerVersion: '1.0.1',
    quality: 'accurate', skeleton: 'full', smoothing: 'medium',
    calibration: { state: 'captured', note: 'T-pose at 0.5 s' },
    models: [{ file: 'pose_landmarker_heavy.task', sha256: 'a'.repeat(64) }] };
}

export function readyProject() {
  return addTake(createProject('我的動畫'), {
    name: '原始錄製', source: 'video', provenance: provenance(),
    frames: [tposeFrame(0), tposeFrame(0.5), tposeFrame(1)],
  });
}

export type Mutable<T> = { -readonly [K in keyof T]: T[K] extends object ? Mutable<T[K]> : T[K] };
export function rawProject() {
  return structuredClone(readyProject()) as Mutable<ReturnType<typeof readyProject>>;
}
