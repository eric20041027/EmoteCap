import { BONE_COUNT, CONTRACT_VERSION, type MotionFrame, type Vec3 } from '../motion/contract';
import { MAX_CLIPS, MAX_MEDIA_BYTES, MAX_PROJECT_FRAMES, MAX_PROJECT_MEDIA_BYTES,
  MAX_TAKE_FRAMES, MAX_TAKE_SECONDS, MAX_TAKES, MAX_UNDO, PROJECT_SCHEMA, UUID_PATTERN,
  type MediaDescriptor, type ProjectClip, type ProjectDocument, type ProjectSummary,
  type ProjectTake, type TakeProvenance } from './types';

export class ProjectDataError extends Error {
  constructor(message: string) { super(message); this.name = 'ProjectDataError'; }
}
function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new ProjectDataError(message);
}
export function fields(value: unknown, keys: readonly string[], path: string): Record<string, unknown> {
  requireValue(value !== null && typeof value === 'object' && !Array.isArray(value), `${path} must be an object.`);
  const prototype = Object.getPrototypeOf(value);
  requireValue(prototype === Object.prototype || prototype === null, `${path} must be plain data.`);
  requireValue(Object.keys(value).every(k => keys.includes(k)), `${path} contains unsupported fields.`);
  return value as Record<string, unknown>;
}
function array(value: unknown, limit: number, path: string): unknown[] {
  requireValue(Array.isArray(value) && value.length <= limit, `${path} exceeds its limit (${limit}) or is not an array.`);
  requireValue(Object.keys(value).length === value.length, `${path} must contain only indexed entries.`);
  for (let i=0;i<value.length;i++) requireValue(Object.hasOwn(value,i), `${path} cannot be sparse.`);
  return value;
}
export function text(value: unknown, limit: number, path: string, empty = false): string {
  requireValue(typeof value === 'string' && value.length <= limit && !/[\u0000-\u001f]/.test(value), `${path} must be text of at most ${limit} characters.`);
  requireValue(empty || value.trim().length > 0, `${path} cannot be empty.`);
  return value;
}
function number(value: unknown, path: string): number {
  requireValue(typeof value === 'number' && Number.isFinite(value), `${path} must be a finite number.`);
  return value;
}
export function integer(value: unknown, path: string, max = Number.MAX_SAFE_INTEGER): number {
  const result = number(value, path);
  requireValue(Number.isSafeInteger(result) && result >= 0 && result <= max, `${path} must be an integer inside [0, ${max}].`);
  return result;
}
function choice<T extends string>(value: unknown, choices: readonly T[], path: string): T {
  requireValue(typeof value === 'string' && choices.includes(value as T), `${path} is unsupported.`);
  return value as T;
}
export function identity(value: unknown, path: string): string {
  requireValue(typeof value === 'string' && UUID_PATTERN.test(value), `${path} must be a UUID.`);
  return value;
}

export function parseFrames(value: unknown, previousTime = -1): readonly MotionFrame[] {
  const values = array(value, MAX_TAKE_FRAMES, 'Take frames');
  let time = previousTime;
  const frames = values.map((raw, i) => {
    const frame = fields(raw, ['t', 'h', 'r'], `Frame ${i}`);
    const t = number(frame.t, `Frame ${i} time`);
    requireValue(t >= 0 && t <= MAX_TAKE_SECONDS && t > time, 'Frame times must strictly increase inside [0, 180].');
    time = t;
    const h = array(frame.h, 3, 'Hips').map(v => number(v, 'Hips'));
    const r = array(frame.r, BONE_COUNT * 4, 'Rotations').map(v => number(v, 'Rotation'));
    requireValue(h.length === 3 && r.length === BONE_COUNT * 4, 'Frame hips/rotation lengths are invalid.');
    requireValue(Math.abs(h[0]) <= 1e-6 && Math.abs(h[2]) <= 1e-6, 'Frame horizontal hips translation must be zero.');
    for (let j = 0; j < r.length; j += 4) {
      const norm = Math.hypot(r[j], r[j + 1], r[j + 2], r[j + 3]);
      requireValue(norm >= 0.98 && norm <= 1.02, 'Frame quaternion norm must be inside [0.98, 1.02].');
    }
    Object.freeze(h); Object.freeze(r);
    return Object.freeze({ t, h: h as Vec3, r });
  });
  return Object.freeze(frames);
}

export function parseProvenance(value: unknown): TakeProvenance {
  const p = fields(value, ['appVersion','contractVersion','trackerVersion','quality','skeleton','smoothing','calibration','models'], 'Capture provenance');
  requireValue(p.contractVersion === CONTRACT_VERSION, 'Capture motion contract is unsupported.');
  const calibration = fields(p.calibration, ['state','note'], 'Calibration');
  const models = array(p.models, 3, 'Capture models').map(raw => {
    const model = fields(raw, ['file','sha256'], 'Capture model');
    const file = text(model.file, 120, 'Model file');
    requireValue(/^[A-Za-z0-9_.-]+$/.test(file), 'Model filename is invalid.');
    const sha256 = text(model.sha256, 64, 'Model SHA256');
    requireValue(/^[a-f0-9]{64}$/i.test(sha256), 'Model SHA256 is invalid.');
    return Object.freeze({ file, sha256 });
  });
  return Object.freeze({ appVersion: text(p.appVersion, 40, 'App version'), contractVersion: CONTRACT_VERSION,
    trackerVersion: text(p.trackerVersion, 40, 'Tracker version'),
    quality: choice(p.quality, ['fast','accurate','fixture'], 'Capture quality'),
    skeleton: choice(p.skeleton, ['full','body'], 'Skeleton'),
    smoothing: choice(p.smoothing, ['low','medium','high'], 'Smoothing'),
    calibration: Object.freeze({ state: choice(calibration.state, ['captured','not-captured','synthetic','unknown'], 'Calibration state'),
      note: text(calibration.note, 512, 'Calibration note', true) }), models: Object.freeze(models) });
}

export function parseMedia(value: unknown): MediaDescriptor | null {
  if (value === null) return null;
  const media = fields(value, ['name','type','size'], 'Source media');
  const type = text(media.type, 128, 'Source media type');
  requireValue(/^video\/[a-z0-9.+-]+(?:;[a-z0-9= ,.+_-]+)?$/i.test(type), 'Source media must have a video MIME type.');
  const size = integer(media.size, 'Source media size', MAX_MEDIA_BYTES);
  requireValue(size > 0, 'Source media cannot be empty.');
  return Object.freeze({name: text(media.name, 120, 'Source media name'), type, size});
}

export function parseClips(value: unknown, duration: number): readonly ProjectClip[] {
  const ids = new Set<string>();
  const clips = array(value, MAX_CLIPS, 'Clips').map(raw => {
    const c = fields(raw, ['id','name','start','end','loop','description'], 'Clip');
    const id = identity(c.id, 'Clip ID');
    requireValue(!ids.has(id), 'Duplicate clip ID.'); ids.add(id);
    const start = number(c.start, 'Clip start'), end = number(c.end, 'Clip end');
    requireValue(start >= 0 && end <= duration && end - start >= 0.1 - 1e-9, 'Clip range must stay inside the take and last at least 0.1 seconds.');
    requireValue(typeof c.loop === 'boolean', 'Clip loop must be boolean.');
    return Object.freeze({id, name:text(c.name,24,'Clip name',true), start,end,loop:c.loop,
      description:text(c.description,512,'Clip description',true)});
  });
  return Object.freeze(clips);
}

export function checkProjectLimits(takes: readonly ProjectTake[], projectId: string): void {
  requireValue(takes.length <= MAX_TAKES, 'A project can contain at most 20 takes.');
  requireValue(takes.reduce((sum,t) => sum + t.frames.length,0) <= MAX_PROJECT_FRAMES, 'Project frames exceed the 43202-frame limit.');
  requireValue(takes.reduce((sum,t) => sum + (t.media?.size ?? 0),0) <= MAX_PROJECT_MEDIA_BYTES, 'Project media exceeds the 200 MiB limit.');
  const ids = new Set([projectId]);
  for (const take of takes) { requireValue(!ids.has(take.id), 'Duplicate take ID.'); ids.add(take.id); }
  const owners = new Map<string,string>();
  for (const take of takes) for (const list of [take.clips, ...take.undo]) for (const clip of list) {
    requireValue(!ids.has(clip.id) && (!owners.has(clip.id) || owners.get(clip.id) === take.id), 'Duplicate identity across takes/clips.');
    owners.set(clip.id,take.id);
  }
}

export function parseProject(value: unknown): ProjectDocument {
  const p = fields(value, ['format','schemaVersion','contractVersion','id','revision','name','createdAt','updatedAt','activeTakeId','takes'], 'Project');
  requireValue(p.format === 'emotecap-project', 'This is not an EmoteCap project.');
  requireValue(p.schemaVersion === PROJECT_SCHEMA, 'Project schema is unsupported; this version supports schema 1.');
  requireValue(p.contractVersion === CONTRACT_VERSION, 'Project motion contract is unsupported; this version supports contract v2.');
  const id = identity(p.id,'Project ID');
  const rawTakes = array(p.takes,MAX_TAKES,'Takes');
  const totalFrames = rawTakes.reduce<number>((sum,raw) => {
    requireValue(raw !== null && typeof raw === 'object' && 'frames' in raw, 'Take frames are missing.');
    return sum + array(raw.frames,MAX_TAKE_FRAMES,'Take frames').length;
  },0);
  requireValue(totalFrames <= MAX_PROJECT_FRAMES, 'Project frames exceed the 43202-frame limit.');
  const takes: ProjectTake[] = rawTakes.map(raw => {
    const t = fields(raw,['id','name','source','status','createdAt','provenance','frames','clips','clipRevision','undo','media'],'Take');
    const frames = parseFrames(t.frames), duration = frames.at(-1)?.t ?? 0;
    const status = choice(t.status,['recording','complete','interrupted'],'Take status');
    requireValue(status !== 'complete' || frames.length > 0, 'A complete take cannot be empty.');
    const undo = array(t.undo,MAX_UNDO,'Undo history').map(list => parseClips(list,duration));
    const clipRevision = integer(t.clipRevision,'Clip revision');
    requireValue(clipRevision >= undo.length, 'Clip revision cannot precede undo history.');
    return Object.freeze({id:identity(t.id,'Take ID'), name:text(t.name,120,'Take name'),
      source:choice(t.source,['camera','video','sample'],'Take source'),status,
      createdAt:integer(t.createdAt,'Take created time'),provenance:parseProvenance(t.provenance),frames,
      clips:parseClips(t.clips,duration),clipRevision,undo:Object.freeze(undo),media:parseMedia(t.media)});
  });
  checkProjectLimits(takes,id);
  const activeTakeId = p.activeTakeId === null ? null : identity(p.activeTakeId,'Selected take ID');
  requireValue(activeTakeId === null || takes.some(t => t.id === activeTakeId), 'Selected take does not exist.');
  const createdAt = integer(p.createdAt,'Project created time'), updatedAt = integer(p.updatedAt,'Project updated time');
  requireValue(updatedAt >= createdAt, 'Project updated time precedes its creation.');
  return Object.freeze({format:'emotecap-project',schemaVersion:PROJECT_SCHEMA,contractVersion:CONTRACT_VERSION,id,
    revision:integer(p.revision,'Project revision'),name:text(p.name,120,'Project name'),createdAt,updatedAt,
    activeTakeId,takes:Object.freeze(takes)});
}

export function parseSummary(value: unknown): ProjectSummary {
  const s = fields(value,['id','name','revision','updatedAt','takeCount'],'Project summary');
  return Object.freeze({id:identity(s.id,'Project ID'),name:text(s.name,120,'Project name'),
    revision:integer(s.revision,'Project revision'),updatedAt:integer(s.updatedAt,'Updated time'),
    takeCount:integer(s.takeCount,'Take count',MAX_TAKES)});
}

export function assertOriginalTransition(previous: ProjectDocument, next: ProjectDocument): void {
  requireValue(previous.id === next.id && previous.createdAt === next.createdAt && next.revision > previous.revision,
    'Project identity/creation must be preserved and revision must increase.');
  const nextTakes = new Map(next.takes.map(t => [t.id,t]));
  for (const old of previous.takes) {
    const take = nextTakes.get(old.id);
    if (!take) continue; // Explicit take deletion is allowed.
    requireValue(take.source === old.source && take.createdAt === old.createdAt && JSON.stringify(take.provenance) === JSON.stringify(old.provenance), 'Original take provenance cannot be rewritten.');
    requireValue(take.frames.length >= old.frames.length && (old.status === 'recording' || (take.status === old.status && take.frames.length === old.frames.length)), 'Original completed/interrupted take cannot be rewritten.');
    for (let i=0;i<old.frames.length;i++) {
      const a=old.frames[i], b=take.frames[i];
      requireValue(a.t === b.t && a.h.every((v,k)=>v===b.h[k]) && a.r.every((v,k)=>v===b.r[k]), 'Original take frames cannot be rewritten.');
    }
    const editsChanged = JSON.stringify(take.clips) !== JSON.stringify(old.clips) || JSON.stringify(take.undo) !== JSON.stringify(old.undo);
    requireValue(take.clipRevision >= old.clipRevision && (!editsChanged || take.clipRevision > old.clipRevision || old.status === 'recording'), 'Clip edit revision must increase.');
  }
}
