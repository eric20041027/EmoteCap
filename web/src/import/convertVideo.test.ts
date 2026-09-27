import { describe, expect, it } from 'vitest';
import { tposeFrame, type PoseSolver } from '../motion/index';
import { convertVideo, MAX_FAILED_FRAMES_IN_A_ROW, NO_PERSON_MESSAGE, type FrameDetection } from './convertVideo';

const PERSON: FrameDetection = { world: [], image: [], hands: { world: {}, image: {} } };
const NOBODY: FrameDetection = { world: undefined, image: undefined, hands: { world: {}, image: {} } };

/** Solves any detected pose to a T-pose at the frame's time; nothing without a pose. */
function fakeSolver(): PoseSolver {
  return {
    solve: (world, t) => (world ? tposeFrame(t) : null),
    calibrate: () => {},
    relaxFingers: () => {},
    setSmoothing: () => {},
    reset: () => {},
  };
}

describe('convertVideo', () => {
  it('seeks, detects and solves every frame at 30 fps, timed in video time', async () => {
    const seeks: number[] = [];
    const stamps: number[] = [];
    const progress: [number, number][] = [];

    const frames = await convertVideo(0.1, {
      seek: async (t) => {
        seeks.push(t);
      },
      detect: (timestampMs) => {
        stamps.push(timestampMs);
        return PERSON;
      },
      solver: fakeSolver(),
      onProgress: ({ done, total }) => progress.push([done, total]),
    });

    expect(seeks).toEqual([0, 1 / 30, 2 / 30]);
    expect(stamps.map(Math.round)).toEqual([0, 33, 67]);
    expect(frames.map((frame) => frame.t)).toEqual(seeks);
    expect(progress).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
  });

  it('holds the first pose from t = 0 when the person appears late', async () => {
    const frames = await convertVideo(0.1, {
      seek: async () => {},
      detect: (timestampMs) => (timestampMs < 50 ? NOBODY : PERSON),
      solver: fakeSolver(),
    });

    expect(frames.map((frame) => frame.t)).toEqual([0, 2 / 30]);
  });

  it('skips a frame whose detection fails and keeps going', async () => {
    const frames = await convertVideo(0.1, {
      seek: async () => {},
      detect: (timestampMs) => {
        if (Math.round(timestampMs) === 33) throw new Error('one bad frame');
        return PERSON;
      },
      solver: fakeSolver(),
    });

    expect(frames.map((frame) => frame.t)).toEqual([0, 2 / 30]);
  });

  it('gives up when frame after frame fails', async () => {
    let calls = 0;
    const run = convertVideo(1, {
      seek: async () => {},
      detect: () => {
        calls += 1;
        throw new Error('WebGL context lost');
      },
      solver: fakeSolver(),
    });

    await expect(run).rejects.toThrow('WebGL context lost');
    expect(calls).toBe(MAX_FAILED_FRAMES_IN_A_ROW);
  });

  it('rejects when nobody is found in any frame', async () => {
    const run = convertVideo(0.1, { seek: async () => {}, detect: () => NOBODY, solver: fakeSolver() });

    await expect(run).rejects.toThrow(NO_PERSON_MESSAGE);
  });

  it('stops as soon as it is cancelled', async () => {
    const controller = new AbortController();
    let seeks = 0;

    const error = await convertVideo(1, {
      seek: async () => {
        seeks += 1;
      },
      detect: () => PERSON,
      solver: fakeSolver(),
      signal: controller.signal,
      onProgress: ({ done }) => {
        if (done === 2) controller.abort();
      },
    }).catch((reason: unknown) => reason);

    expect(error).toMatchObject({ name: 'AbortError' });
    expect(seeks).toBe(2);
  });
});
