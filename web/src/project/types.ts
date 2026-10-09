import type { MotionFrame } from '../motion/contract';

export const PROJECT_SCHEMA = 1;
export const MAX_TAKES = 20;
export const MAX_TAKE_FRAMES = 21601;
export const MAX_PROJECT_FRAMES = 43202;
export const MAX_TAKE_SECONDS = 180;
export const MAX_CLIPS = 50;
export const MAX_UNDO = 20;
export const MAX_MEDIA_BYTES = 100 * 1024 * 1024;
export const MAX_PROJECT_MEDIA_BYTES = 200 * 1024 * 1024;
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface TakeProvenance {
  readonly appVersion: string;
  readonly contractVersion: number;
  readonly trackerVersion: string;
  readonly quality: 'fast' | 'accurate' | 'fixture';
  readonly skeleton: 'full' | 'body';
  readonly smoothing: 'low' | 'medium' | 'high';
  readonly calibration: { readonly state: 'captured' | 'not-captured' | 'synthetic' | 'unknown'; readonly note: string };
  readonly models: readonly { readonly file: string; readonly sha256: string }[];
}
export interface MediaDescriptor { readonly name: string; readonly type: string; readonly size: number }
export interface ProjectClip {
  readonly id: string;
  readonly name: string;
  readonly start: number;
  readonly end: number;
  readonly loop: boolean;
  readonly description: string;
}
export interface ProjectTake {
  readonly id: string;
  readonly name: string;
  readonly source: 'camera' | 'video' | 'sample';
  readonly status: 'recording' | 'complete' | 'interrupted';
  readonly createdAt: number;
  readonly provenance: TakeProvenance;
  readonly frames: readonly MotionFrame[];
  readonly clips: readonly ProjectClip[];
  readonly clipRevision: number;
  readonly undo: readonly (readonly ProjectClip[])[];
  readonly media: MediaDescriptor | null;
}
export interface ProjectDocument {
  readonly format: 'emotecap-project';
  readonly schemaVersion: typeof PROJECT_SCHEMA;
  readonly contractVersion: number;
  readonly id: string;
  readonly revision: number;
  readonly name: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly activeTakeId: string | null;
  readonly takes: readonly ProjectTake[];
}
export interface ProjectSummary {
  readonly id: string;
  readonly name: string;
  readonly revision: number;
  readonly updatedAt: number;
  readonly takeCount: number;
}
