import { describe, expect, it } from 'vitest';
import { tposeFrame, type MotionFrame } from '../motion/index';
import { EMPTY_TAKE_NOTICE, INITIAL_RECORDER_STATE, recorderReducer, type RecorderState } from './useRecorder';

function frameAt(t: number): MotionFrame {
  return tposeFrame(t);
}

function recordingWith(times: number[]): RecorderState {
  let state = recorderReducer(recorderReducer(INITIAL_RECORDER_STATE, { type: 'arm' }), { type: 'begin' });
  for (const t of times) state = recorderReducer(state, { type: 'push', frame: frameAt(t) });
  return state;
}

describe('recorderReducer', () => {
  it('starts idle', () => {
    expect(INITIAL_RECORDER_STATE).toEqual({ phase: 'idle' });
  });

  it('goes idle -> countdown -> recording -> recorded', () => {
    const countdown = recorderReducer(INITIAL_RECORDER_STATE, { type: 'arm' });
    expect(countdown.phase).toBe('countdown');
    const recording = recorderReducer(countdown, { type: 'begin' });
    expect(recording).toMatchObject({ phase: 'recording', frames: [] });
    const withFrame = recorderReducer(recording, { type: 'push', frame: frameAt(12) });
    const recorded = recorderReducer(withFrame, { type: 'stop' });
    expect(recorded.phase).toBe('recorded');
    expect(recorded.phase === 'recorded' && recorded.frames).toHaveLength(1);
  });

  it('ignores pushes unless recording', () => {
    const frame = { type: 'push' as const, frame: frameAt(1) };
    const idle = INITIAL_RECORDER_STATE;
    expect(recorderReducer(idle, frame)).toBe(idle);
    const countdown = recorderReducer(idle, { type: 'arm' });
    expect(recorderReducer(countdown, frame)).toBe(countdown);
    const recorded = recorderReducer(recordingWith([1, 2]), { type: 'stop' });
    expect(recorderReducer(recorded, frame)).toBe(recorded);
  });

  it('re-bases t to the first pushed frame', () => {
    const state = recordingWith([100.5, 100.6, 101.5]);
    expect(state.phase).toBe('recording');
    if (state.phase !== 'recording') return;
    expect(state.frames.map((f) => f.t)).toEqual([0, expect.closeTo(0.1, 9), expect.closeTo(1, 9)]);
  });

  it('never mutates the pushed frame or the previous state', () => {
    const before = recordingWith([5]);
    const frame = frameAt(6);
    const after = recorderReducer(before, { type: 'push', frame });
    expect(frame.t).toBe(6);
    expect(before.phase === 'recording' && before.frames).toHaveLength(1);
    expect(after.phase === 'recording' && after.frames).toHaveLength(2);
    // Recorded frames own their arrays, so a solver that reuses buffers cannot corrupt the take.
    if (after.phase === 'recording') {
      expect(after.frames[1].r).not.toBe(frame.r);
      expect(after.frames[1].h).not.toBe(frame.h);
    }
  });

  it('stopping an empty take returns to idle with a notice', () => {
    const state = recorderReducer(recordingWith([]), { type: 'stop' });
    expect(state).toEqual({ phase: 'idle', notice: EMPTY_TAKE_NOTICE });
  });

  it('discard returns to idle from countdown, recording and recorded', () => {
    const countdown = recorderReducer(INITIAL_RECORDER_STATE, { type: 'arm' });
    const recording = recordingWith([1]);
    const recorded = recorderReducer(recording, { type: 'stop' });
    for (const state of [countdown, recording, recorded]) {
      expect(recorderReducer(state, { type: 'discard' })).toEqual({ phase: 'idle' });
    }
  });

  it('ignores out-of-order transitions', () => {
    const idle = INITIAL_RECORDER_STATE;
    expect(recorderReducer(idle, { type: 'begin' })).toBe(idle);
    expect(recorderReducer(idle, { type: 'stop' })).toBe(idle);
    const recording = recordingWith([1]);
    expect(recorderReducer(recording, { type: 'arm' })).toBe(recording);
  });

  it('arming clears a previous notice', () => {
    const withNotice: RecorderState = { phase: 'idle', notice: EMPTY_TAKE_NOTICE };
    expect(recorderReducer(withNotice, { type: 'arm' })).toEqual({ phase: 'countdown' });
  });

  it('opens an imported take for review together with its source video and a note', () => {
    const video = new Blob(['video'], { type: 'video/mp4' });
    const frames = [frameAt(0), frameAt(0.5)];
    const note = { tone: 'ok' as const, text: 'Auto-calibrated from the T-pose at 1.2 s.' };
    expect(recorderReducer(INITIAL_RECORDER_STATE, { type: 'load', frames, video, note })).toEqual({
      phase: 'recorded',
      frames,
      video,
      note,
    });
  });

  it('loads only when idle and only a take with frames', () => {
    const load = { type: 'load' as const, frames: [frameAt(0)], video: new Blob(['video']) };
    const recording = recordingWith([1]);
    expect(recorderReducer(recording, load)).toBe(recording);
    expect(recorderReducer(INITIAL_RECORDER_STATE, { ...load, frames: [] })).toBe(INITIAL_RECORDER_STATE);
  });
});
