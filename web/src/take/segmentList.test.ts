import { describe, expect, it } from 'vitest';
import { tposeFrame, type Segment } from '../motion/index';
import {
  EMPTY_SEGMENT_LIST,
  MIN_SEGMENT_SECONDS,
  canExportSegments,
  findNameIssues,
  segmentListReducer,
  segmentsToClips,
  type EditableSegment,
  type SegmentListState,
} from './segmentList';

const segment = (name: string, start: number, end: number, loop = false): Segment => ({
  name,
  start,
  end,
  loop,
  description: `${name} move`,
});

function loaded(segments: Segment[], duration = 10): SegmentListState {
  return segmentListReducer(EMPTY_SEGMENT_LIST, { type: 'load', segments, duration });
}

const editable = (id: number, name: string): EditableSegment => ({ ...segment(name, 0, 1), id });

describe('segmentListReducer: load', () => {
  it('assigns unique ids, sorts by start and keeps name, loop and description', () => {
    const state = loaded([segment('Kick', 4, 5, true), segment('Wave', 1, 2)]);
    expect(state.segments.map((s) => [s.name, s.start, s.end, s.loop])).toEqual([
      ['Wave', 1, 2, false],
      ['Kick', 4, 5, true],
    ]);
    expect(state.segments[1].description).toBe('Kick move');
    expect(new Set(state.segments.map((s) => s.id)).size).toBe(2);
    expect(state.duration).toBe(10);
  });

  it('clamps to the take and rounds to hundredths', () => {
    const state = loaded([segment('A', -1, 1.23456), segment('B', 8.004, 12)], 9.5);
    expect(state.segments.map((s) => [s.start, s.end])).toEqual([
      [0, 1.23],
      [8, 9.5],
    ]);
  });

  it('drops segments that end up shorter than the minimum clip', () => {
    const state = loaded([segment('Tiny', 2, 2.05), segment('Outside', 11, 12), segment('Ok', 3, 3.1)], 10);
    expect(state.segments.map((s) => s.name)).toEqual(['Ok']);
  });

  it('replaces the previous list and never reuses ids', () => {
    const first = loaded([segment('A', 0, 1)]);
    const second = segmentListReducer(first, { type: 'load', segments: [segment('B', 1, 2)], duration: 10 });
    expect(second.segments.map((s) => s.name)).toEqual(['B']);
    expect(second.segments[0].id).not.toBe(first.segments[0].id);
  });
});

describe('segmentListReducer: editing', () => {
  const base = loaded([segment('Wave', 1, 3), segment('Kick', 4, 6)]);
  const [wave, kick] = base.segments;

  it('renames one segment without touching the others or the previous state', () => {
    const next = segmentListReducer(base, { type: 'rename', id: wave.id, name: 'Hello' });
    expect(next.segments.map((s) => s.name)).toEqual(['Hello', 'Kick']);
    expect(base.segments[0].name).toBe('Wave');
    expect(next.segments[1]).toBe(kick);
  });

  it('clamps start to [0, end - minimum] and rounds it', () => {
    const edit = (start: number) => segmentListReducer(base, { type: 'setStart', id: wave.id, start }).segments[0].start;
    expect(edit(1.456)).toBe(1.46);
    expect(edit(-2)).toBe(0);
    expect(edit(5)).toBeCloseTo(3 - MIN_SEGMENT_SECONDS, 9);
  });

  it('clamps end to [start + minimum, duration]', () => {
    const edit = (end: number) => segmentListReducer(base, { type: 'setEnd', id: kick.id, end }).segments[1].end;
    expect(edit(7.25)).toBe(7.25);
    expect(edit(99)).toBe(10);
    expect(edit(1)).toBeCloseTo(4 + MIN_SEGMENT_SECONDS, 9);
  });

  it('ignores non-finite times and unknown ids', () => {
    expect(segmentListReducer(base, { type: 'setStart', id: wave.id, start: Number.NaN })).toBe(base);
    expect(segmentListReducer(base, { type: 'setEnd', id: 999, end: 2 })).toBe(base);
    expect(segmentListReducer(base, { type: 'remove', id: 999 })).toBe(base);
  });

  it('toggles loop and removes segments', () => {
    const looped = segmentListReducer(base, { type: 'setLoop', id: kick.id, loop: true });
    expect(looped.segments[1].loop).toBe(true);
    const removed = segmentListReducer(looped, { type: 'remove', id: wave.id });
    expect(removed.segments.map((s) => s.name)).toEqual(['Kick']);
  });
});

describe('findNameIssues / canExportSegments', () => {
  it('flags invalid names', () => {
    const issues = findNameIssues([editable(1, 'Wave Right'), editable(2, ''), editable(3, 'A'.repeat(25)), editable(4, 'Ok_1')]);
    expect([...issues]).toEqual([
      [1, 'invalid'],
      [2, 'invalid'],
      [3, 'invalid'],
    ]);
  });

  it('flags every copy of a duplicate name, ignoring case (Unity file names collide on macOS)', () => {
    const issues = findNameIssues([editable(1, 'Wave'), editable(2, 'Kick'), editable(3, 'wave')]);
    expect([...issues]).toEqual([
      [1, 'duplicate'],
      [3, 'duplicate'],
    ]);
  });

  it('allows export only for a non-empty list without issues', () => {
    expect(canExportSegments([])).toBe(false);
    expect(canExportSegments([editable(1, 'Wave'), editable(2, 'Wave')])).toBe(false);
    expect(canExportSegments([editable(1, 'Wave'), editable(2, 'Kick')])).toBe(true);
  });
});

describe('segmentsToClips', () => {
  const frames = Array.from({ length: 61 }, (_, i) => tposeFrame(i / 30));

  it('cuts one clip per segment with its name, loop flag and range', () => {
    const clips = segmentsToClips(frames, [segment('Wave', 0.5, 1, true), segment('Kick', 1, 2)]);
    expect(clips.map((c) => [c.name, c.loop, c.fps])).toEqual([
      ['Wave', true, 30],
      ['Kick', false, 30],
    ]);
    expect(clips[0].frames).toHaveLength(16);
    expect(clips[1].frames[0].t).toBe(0);
  });

  it('throws on an invalid name so the export shows an error', () => {
    expect(() => segmentsToClips(frames, [segment('bad name', 0, 1)])).toThrow(/Invalid clip name/);
  });
});
