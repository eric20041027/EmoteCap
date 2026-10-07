import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { describe, expect, it } from 'vitest';
import { tposeFrame, type PoseSolver } from '../motion/index';
import {
  convertVideo,
  MAX_FAILED_FRAMES_IN_A_ROW,
  NO_PERSON_MESSAGE,
  T_POSE_HOLD_FRAMES,
  type FrameDetection,
  type ConversionAttempt,
} from './convertVideo';
import { ARMS_DOWN_IMAGE, T_POSE_IMAGE } from './testPoses';

const NO_HANDS = { world: {}, image: {} };
/** A detected person; the world landmarks carry the frame time so tests can tell frames apart. */
const person = (timestampMs: number, image: NormalizedLandmark[] = ARMS_DOWN_IMAGE): FrameDetection => ({
  world: [{ x: timestampMs / 1000, y: 0, z: 0, visibility: 1 }],
  image,
  hands: NO_HANDS,
});

describe('optional conversion observations',()=>{
  it('retains failed attempts without changing the calibrated final take',async()=>{
    const detect=(ms:number)=>Math.round(ms)===33?NOBODY:person(ms);
    const plain=await convertVideo(.1,{...steps,detect});
    const attempts:ConversionAttempt[]=[];let clock=0;
    const observed=await convertVideo(.1,{...steps,detect,now:()=>++clock,onAttempt:event=>attempts.push(event)});
    expect(attempts.map(event=>event.status)).toEqual(['ok','no-pose','ok']);
    expect(attempts[1].frame).toBeNull();
    expect(attempts.every(event=>event.seekStartedMs<=event.startedMs&&event.startedMs<=event.finishedMs)).toBe(true);
    expect(observed.frames).toEqual(plain.frames);expect(observed.measurementState).toBe('complete');
  });
  it('reports the tenth fatal detector failure',async()=>{
    const attempts:ConversionAttempt[]=[];let clock=0;
    await expect(convertVideo(1,{...steps,detect:()=>{throw new Error('Owned detector error');},
      now:()=>++clock,onAttempt:event=>attempts.push(event)})).rejects.toThrow('Owned detector error');
    expect(attempts).toHaveLength(MAX_FAILED_FRAMES_IN_A_ROW);
    expect(attempts.every(event=>event.status==='detector-error'&&event.frame===null)).toBe(true);
  });
  it('retains all no-person attempts before the normal rejection',async()=>{
    const attempts:ConversionAttempt[]=[];
    await expect(convertVideo(.1,{...steps,detect:()=>NOBODY,onAttempt:event=>attempts.push(event)})).rejects.toThrow(NO_PERSON_MESSAGE);
    expect(attempts.map(event=>event.status)).toEqual(['no-pose','no-pose','no-pose']);
  });
  it('reports seek and preview-solver errors before preserving the original rejection',async()=>{
    const attempts:ConversionAttempt[]=[];
    await expect(convertVideo(.1,{...steps,detect:person,seek:async()=>{throw new Error('Owned seek error');},
      onAttempt:event=>attempts.push(event)})).rejects.toThrow('Owned seek error');
    expect(attempts.map(event=>event.status)).toEqual(['seek-error']);attempts.length=0;
    await expect(convertVideo(.1,{...steps,detect:person,createSolver:()=>({...fakeSolver(),solve:()=>{throw new Error('Owned solver error');}}),
      onAttempt:event=>attempts.push(event)})).rejects.toThrow('Owned solver error');
    expect(attempts.map(event=>event.status)).toEqual(['solver-error']);
  });
  it('copies preview data before an observer can mutate it',async()=>{
    const values:number[]=[];let calls=0;
    await convertVideo(.1,{...steps,detect:person,
      onAttempt:event=>{calls++;if(event.frame)event.frame.r[0]=99;},
      onProgress:progress=>{if(progress.frame)values.push(progress.frame.r[0]);}});
    expect(calls).toBe(3);expect(values).toEqual([0,0,0]);
  });
  it('disables a failed observer and reports it without losing the ordinary final take',async()=>{
    const plain=await convertVideo(.1,{...steps,detect:person});let calls=0;
    const observed=await convertVideo(.1,{...steps,detect:person,onAttempt:()=>{calls++;throw new Error('Owned sink failure');}});
    expect(calls).toBe(1);expect(observed.frames).toEqual(plain.frames);expect(observed.measurementState).toBe('failed');
  });
  it('invalid clock observation cannot destroy ordinary conversion',async()=>{
    const observed=await convertVideo(.1,{...steps,detect:person,now:()=>NaN,onAttempt:()=>{}});
    expect(observed.frames).toHaveLength(3);expect(observed.measurementState).toBe('failed');
  });
});
const NOBODY: FrameDetection = { world: undefined, image: undefined, hands: NO_HANDS };

/** Solves any detected pose to a T-pose at the frame's time; logs every call. */
function fakeSolver(log: string[] = []): PoseSolver {
  return {
    solve: (world, t) => {
      log.push(`solve ${t.toFixed(3)}`);
      return world ? tposeFrame(t) : null;
    },
    calibrate: (world) => {
      log.push(`calibrate ${world[0].x.toFixed(3)}`);
    },
    relaxFingers: () => {},
    setSmoothing: () => {},
    reset: () => {},
  };
}

const steps = { seek: async () => {}, createSolver: () => fakeSolver(), aspect: 1 };

describe('convertVideo', () => {
  it('seeks, detects and solves every frame at 30 fps, timed in video time', async () => {
    const seeks: number[] = [];
    const stamps: number[] = [];
    const progress: [number, number][] = [];

    const { frames } = await convertVideo(0.1, {
      ...steps,
      seek: async (t) => {
        seeks.push(t);
      },
      detect: (timestampMs) => {
        stamps.push(timestampMs);
        return person(timestampMs);
      },
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

  it('calibrates the whole take from the first T-pose held for a moment', async () => {
    const logs: string[][] = [];
    const firstTPose = 5;
    const isTPoseFrame = (ms: number) => Math.round((ms * 30) / 1000) >= firstTPose;

    const { frames, calibratedAt } = await convertVideo(1, {
      ...steps,
      createSolver: () => {
        const log: string[] = [];
        logs.push(log);
        return fakeSolver(log);
      },
      detect: (ms) => person(ms, isTPoseFrame(ms) ? T_POSE_IMAGE : ARMS_DOWN_IMAGE),
    });

    const calibrationFrame = firstTPose + Math.floor(T_POSE_HOLD_FRAMES / 2);
    expect(calibratedAt).toBeCloseTo(calibrationFrame / 30);
    const [preview, final] = logs;
    // The final take is calibrated before its first frame, so frames before the T-pose are corrected too.
    expect(final[0]).toBe(`calibrate ${(calibrationFrame / 30).toFixed(3)}`);
    expect(final.slice(1)).toHaveLength(frames.length);
    // The live preview switches to the calibration as soon as the T-pose has been held long enough.
    expect(preview.indexOf(`calibrate ${(calibrationFrame / 30).toFixed(3)}`)).toBe(firstTPose + T_POSE_HOLD_FRAMES - 1);
  });

  it('leaves the take uncalibrated when no T-pose is held long enough', async () => {
    const logs: string[][] = [];
    const { calibratedAt } = await convertVideo(1, {
      ...steps,
      createSolver: () => {
        const log: string[] = [];
        logs.push(log);
        return fakeSolver(log);
      },
      detect: (ms) => {
        const frame = Math.round((ms * 30) / 1000);
        return person(ms, frame >= 3 && frame < 3 + T_POSE_HOLD_FRAMES - 1 ? T_POSE_IMAGE : ARMS_DOWN_IMAGE);
      },
    });

    expect(calibratedAt).toBeNull();
    expect(logs.flat().some((line) => line.startsWith('calibrate'))).toBe(false);
  });

  it('holds the first pose from t = 0 when the person appears late', async () => {
    const { frames } = await convertVideo(0.1, {
      ...steps,
      detect: (ms) => (ms < 50 ? NOBODY : person(ms)),
    });

    expect(frames.map((frame) => frame.t)).toEqual([0, 2 / 30]);
  });

  it('skips a frame whose detection fails and keeps going', async () => {
    const { frames } = await convertVideo(0.1, {
      ...steps,
      detect: (ms) => {
        if (Math.round(ms) === 33) throw new Error('one bad frame');
        return person(ms);
      },
    });

    expect(frames.map((frame) => frame.t)).toEqual([0, 2 / 30]);
  });

  it('gives up when frame after frame fails', async () => {
    let calls = 0;
    const run = convertVideo(1, {
      ...steps,
      detect: () => {
        calls += 1;
        throw new Error('WebGL context lost');
      },
    });

    await expect(run).rejects.toThrow('WebGL context lost');
    expect(calls).toBe(MAX_FAILED_FRAMES_IN_A_ROW);
  });

  it('rejects when nobody is found in any frame', async () => {
    await expect(convertVideo(0.1, { ...steps, detect: () => NOBODY })).rejects.toThrow(NO_PERSON_MESSAGE);
  });

  it('stops as soon as it is cancelled', async () => {
    const controller = new AbortController();
    let seeks = 0;

    const error = await convertVideo(1, {
      ...steps,
      seek: async () => {
        seeks += 1;
      },
      detect: (ms) => person(ms),
      signal: controller.signal,
      onProgress: ({ done }) => {
        if (done === 2) controller.abort();
      },
    }).catch((reason: unknown) => reason);

    expect(error).toMatchObject({ name: 'AbortError' });
    expect(seeks).toBe(2);
  });
});
