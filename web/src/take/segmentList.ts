import { CLIP_NAME_PATTERN, makeClip, type Clip, type MotionFrame, type Segment } from '../motion/index';

/** Shortest clip the editor allows, in seconds. */
export const MIN_SEGMENT_SECONDS = 0.1;
/** Step of the start/end inputs, in seconds. */
export const TIME_STEP_SECONDS = 0.05;
/** Float slack so 3.1 - 3.0 still counts as 0.1 s. */
const EPSILON = 1e-9;

export interface EditableSegment extends Segment {
  /** Stable React key, never reused while the editor lives. */
  id: number;
}

export interface SegmentListState {
  /** Take length in seconds; every segment stays inside [0, duration]. */
  duration: number;
  segments: readonly EditableSegment[];
  nextId: number;
}

export type SegmentListAction =
  | { type: 'load'; segments: readonly Segment[]; duration: number }
  | { type: 'rename'; id: number; name: string }
  | { type: 'setStart'; id: number; start: number }
  | { type: 'setEnd'; id: number; end: number }
  | { type: 'setLoop'; id: number; loop: boolean }
  | { type: 'remove'; id: number };

export type NameIssue = 'invalid' | 'duplicate';

export const EMPTY_SEGMENT_LIST: SegmentListState = { duration: 0, segments: [], nextId: 1 };

const roundTime = (t: number): number => Math.round(t * 100) / 100;
const clamp = (value: number, lo: number, hi: number): number => Math.min(Math.max(value, lo), hi);

function load(state: SegmentListState, segments: readonly Segment[], duration: number): SegmentListState {
  const safeDuration = Math.max(0, duration);
  const kept = segments
    .map((s) => ({
      name: s.name,
      start: clamp(roundTime(s.start), 0, safeDuration),
      end: clamp(roundTime(s.end), 0, safeDuration),
      loop: s.loop,
      description: s.description,
    }))
    .filter((s) => s.end - s.start >= MIN_SEGMENT_SECONDS - EPSILON)
    .sort((a, b) => a.start - b.start)
    .map((s, i) => ({ ...s, id: state.nextId + i }));
  return { duration: safeDuration, segments: kept, nextId: state.nextId + kept.length };
}

function update(
  state: SegmentListState,
  id: number,
  change: (segment: EditableSegment) => EditableSegment,
): SegmentListState {
  if (!state.segments.some((s) => s.id === id)) return state;
  return { ...state, segments: state.segments.map((s) => (s.id === id ? change(s) : s)) };
}

/** Pure editor for the auto-sliced clip list; times are clamped to the take and rounded to 0.01 s. */
export function segmentListReducer(state: SegmentListState, action: SegmentListAction): SegmentListState {
  switch (action.type) {
    case 'load':
      return load(state, action.segments, action.duration);
    case 'rename':
      return update(state, action.id, (s) => ({ ...s, name: action.name }));
    case 'setStart': {
      if (!Number.isFinite(action.start)) return state;
      const start = action.start;
      return update(state, action.id, (s) => ({
        ...s,
        start: clamp(roundTime(start), 0, Math.max(0, roundTime(s.end - MIN_SEGMENT_SECONDS))),
      }));
    }
    case 'setEnd': {
      if (!Number.isFinite(action.end)) return state;
      const end = action.end;
      return update(state, action.id, (s) => ({
        ...s,
        end: clamp(roundTime(end), Math.min(roundTime(s.start + MIN_SEGMENT_SECONDS), state.duration), state.duration),
      }));
    }
    case 'setLoop':
      return update(state, action.id, (s) => ({ ...s, loop: action.loop }));
    case 'remove':
      if (!state.segments.some((s) => s.id === action.id)) return state;
      return { ...state, segments: state.segments.filter((s) => s.id !== action.id) };
  }
}

/**
 * Names that would break the export: not matching CLIP_NAME_PATTERN, or used more than once.
 * Duplicates ignore case because Wave.fbx and wave.fbx are the same file on macOS and Windows.
 */
export function findNameIssues(segments: readonly EditableSegment[]): ReadonlyMap<number, NameIssue> {
  const counts = segments.reduce(
    (acc, s) => acc.set(s.name.toLowerCase(), (acc.get(s.name.toLowerCase()) ?? 0) + 1),
    new Map<string, number>(),
  );
  return new Map(
    segments.flatMap((s): [number, NameIssue][] => {
      if (!CLIP_NAME_PATTERN.test(s.name)) return [[s.id, 'invalid']];
      return (counts.get(s.name.toLowerCase()) ?? 0) > 1 ? [[s.id, 'duplicate']] : [];
    }),
  );
}

export function canExportSegments(segments: readonly EditableSegment[]): boolean {
  return segments.length > 0 && findNameIssues(segments).size === 0;
}

/** One resampled clip per segment (throws like makeClip on an invalid name or empty range). */
export function segmentsToClips(frames: readonly MotionFrame[], segments: readonly Segment[]): Clip[] {
  return segments.map((s) => makeClip(frames, { start: s.start, end: s.end, name: s.name, loop: s.loop }));
}
