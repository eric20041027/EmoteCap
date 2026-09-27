# Video Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import a video file (mp4 / mov / webm, ≤ 3 min) as a take that flows through the existing Review → Gemini → FBX pipeline.

**Architecture:** A hidden-from-React async loop seeks an imported `<video>` to every 1/30 s, runs MediaPipe (Heavy + hands) on the still frame,
and solves it with a fresh `PoseSolver`. Pure pieces (`sampleTimes`, `holdFromStart`, `convertVideo`) are unit-tested with fakes; DOM and
MediaPipe glue is thin. The finished frames plus the original file enter the recorder's `recorded` phase through a new `load` action.

**Tech Stack:** React 19, TypeScript, vitest (node env), @mediapipe/tasks-vision.

Spec: `docs/superpowers/specs/2026-09-27-video-import-design.md`. All paths below are under `web/src/`. Run tests with `cd web && npm test`.

---

### Task 1: Share landmarker loading; pause flag for the camera loop

**Files:** Create `capture/landmarkers.ts`; modify `capture/usePose.ts`.

- [ ] Move `WASM_PATH`, `CaptureQuality`, `POSE_MODEL_PATH`, `CaptureError`, `Landmarkers`, `createLandmarkers` from `usePose.ts` into
      `capture/landmarkers.ts` unchanged (all exported), plus:

```ts
export function closeLandmarkers(landmarkers: Landmarkers | undefined): void {
  landmarkers?.pose.close();
  landmarkers?.hands?.close();
}
```

- [ ] In `usePose.ts`: import them from `./landmarkers`, keep `export type { CaptureQuality } from './landmarkers';` (App imports it
      from `usePose`), use `closeLandmarkers(landmarkers)` in `release()`, and add a 7th parameter `paused = false` kept in a ref
      (`pausedRef`, updated in the existing layout effect). First line after `rafId = requestAnimationFrame(tick);`:
      `if (pausedRef.current) return;`
- [ ] `npx tsc --noEmit` and `npm test` pass. Commit `refactor(web): share landmarker loading and let the camera loop pause`.

### Task 2: Frame times (pure, TDD)

**Files:** Create `import/frameTimes.ts`, `import/frameTimes.test.ts`.

- [ ] Tests:

```ts
describe('sampleTimes', () => {
  it('samples from 0 to the end at the given rate', () => {
    const times = sampleTimes(1, 30);
    expect(times).toHaveLength(31);
    expect(times[0]).toBe(0);
    expect(times[30]).toBeCloseTo(1);
  });
  it('stops at the last frame that fits', () => {
    expect(sampleTimes(0.1, 30)).toHaveLength(4);
    expect(sampleTimes(0.05, 30)).toHaveLength(2);
  });
  it('returns nothing for an empty, unknown or endless video', () => {
    expect(sampleTimes(0)).toEqual([]);
    expect(sampleTimes(Number.NaN)).toEqual([]);
    expect(sampleTimes(Number.POSITIVE_INFINITY)).toEqual([]);
  });
});
describe('holdFromStart', () => {
  it('keeps a take that already starts at 0', () => { /* [tposeFrame(0), tposeFrame(0.5)] unchanged */ });
  it('copies the first pose back to t = 0 when the video starts without a person', () => {
    const late = tposeFrame(0.4);
    const held = holdFromStart([late, tposeFrame(0.5)]);
    expect(held).toHaveLength(3);
    expect(held[0]).toEqual({ ...late, t: 0 });
    expect(held[0].r).not.toBe(late.r);
  });
  it('keeps an empty take empty', () => expect(holdFromStart([])).toEqual([]));
});
```

- [ ] Run → FAIL (module missing). Implement:

```ts
export const IMPORT_FPS = 30;
const EPSILON = 1e-6;
export function sampleTimes(duration: number, fps: number = IMPORT_FPS): number[] {
  if (!Number.isFinite(duration) || duration <= 0 || !(fps > 0)) return [];
  const count = Math.floor(duration * fps + EPSILON) + 1;
  return Array.from({ length: count }, (_, i) => i / fps);
}
export function holdFromStart(frames: readonly MotionFrame[]): MotionFrame[] {
  if (frames.length === 0 || frames[0].t <= 0) return [...frames];
  const first = frames[0];
  return [{ t: 0, h: [...first.h], r: [...first.r] }, ...frames];
}
```

- [ ] Run → PASS.

### Task 3: Conversion loop (pure, TDD)

**Files:** Create `import/convertVideo.ts`, `import/convertVideo.test.ts`.

- [ ] Tests with a fake solver (`solve: (world, t) => (world ? tposeFrame(t) : null)`), `PERSON = { world: [], image: [], hands: { world: {}, image: {} } }`,
      `NOBODY` with `world: undefined`:
  - seeks `[0, 1/30, 2/30, 3/30]` for `duration = 0.1`, detector timestamps round to `[0, 33, 67, 100]`, frames' `t` equal the seek
    times, progress `[[1,4],[2,4],[3,4],[4,4]]`;
  - person from 50 ms on → frame times `[0, 2/30, 3/30]`;
  - nobody → rejects with `NO_PERSON_MESSAGE`;
  - abort in `onProgress` at `done === 2` → rejects with `name === 'AbortError'`, exactly 2 seeks.
- [ ] Run → FAIL. Implement:

```ts
export class ImportError extends Error {} // message is user-facing
export interface FrameDetection { world: Landmark[] | undefined; image: NormalizedLandmark[] | undefined; hands: TrackedHands }
export interface ConvertProgress { done: number; total: number; frame: MotionFrame | null; detection: FrameDetection }
export interface ConvertSteps {
  seek: (t: number) => Promise<void>;
  detect: (timestampMs: number) => FrameDetection;
  solver: PoseSolver;
  onProgress?: (progress: ConvertProgress) => void;
  signal?: AbortSignal;
}
export const NO_PERSON_MESSAGE = 'No person found in this video. Use a clip where one whole body is visible.';
export async function convertVideo(duration: number, steps: ConvertSteps): Promise<MotionFrame[]> {
  const { seek, detect, solver, onProgress, signal } = steps;
  const times = sampleTimes(duration);
  const frames: MotionFrame[] = [];
  for (const [index, t] of times.entries()) {
    signal?.throwIfAborted();
    await seek(t);
    signal?.throwIfAborted();
    const detection = detect(t * 1000);
    const frame = solver.solve(detection.world, t, detection.hands.world, detection.image);
    if (frame) frames.push(frame);
    onProgress?.({ done: index + 1, total: times.length, frame, detection });
  }
  if (frames.length === 0) throw new ImportError(NO_PERSON_MESSAGE);
  return holdFromStart(frames);
}
```

- [ ] Run → PASS. Commit Tasks 2–3: `feat(web): frame-by-frame video conversion core`.

### Task 4: Recorder `load` (TDD)

**Files:** Modify `record/useRecorder.ts`, `record/useRecorder.test.ts`.

- [ ] Tests: `load` from idle → `{ phase: 'recorded', frames, video }`; ignored while recording; ignored with no frames.
- [ ] Implement: `recorded` state gets `video?: Blob`; action `{ type: 'load'; frames; video: Blob }` →
      `state.phase === 'idle' && action.frames.length > 0 ? { phase: 'recorded', frames, video } : state`; `Recorder.load(frames, video)`.
- [ ] Run → PASS. Commit `feat(web): recorder can open an imported take`.

### Task 5: Browser glue

**Files:** Create `import/videoSource.ts`, `import/detectFrame.ts`, `import/useVideoImport.ts`.

- [ ] `videoSource.ts`: `waitFor(video, type, timeoutMs)` (rejects with `ImportError` on `error`/timeout);
      `seekTo(video, t)` (skip when already there; then `while (video.seeking) await waitFor(video, 'seeked', …)` to ignore stale events);
      `openVideoFile(file, video)` → duration: type/extension check, `loadedmetadata`, Infinity fix (`currentTime = 1e9`,
      wait `durationchange`, wait out the seek), `> MAX_TAKE_SECONDS` refused, ends on frame 0; `closeVideoFile(video)` revokes the URL.
- [ ] `detectFrame.ts`: `createFrameDetector(landmarkers, trackHands)` → `(video, ms) => FrameDetection`; pose every frame, hands via
      `assignHands` every frame, hands switched off for the rest of the import after one failure.
- [ ] `useVideoImport.ts`: state `idle { error? } | loading { fileName } | converting { fileName, done, total, startedAt }`, `aspect`,
      `start(file)`, `cancel()`. An effect keyed on the picked file runs: open → `createLandmarkers('accurate')` → `convertVideo` with a
      fresh `createPoseSolver({}, smoothing)`; each frame draws the overlay and calls `onFrame`; progress state at most every 200 ms;
      `onDone(frames, file)` at the end; cleanup aborts and closes the file. Errors: `ImportError`/`CaptureError` messages as-is, else
      `Import failed: …`.

### Task 6: UI and wiring

**Files:** Create `import/ImportButton.tsx`, `import/ImportProgress.tsx`, `import/ImportView.tsx`, `import/import.css`;
modify `record/CaptureControls.tsx`, `record/RecordPanel.tsx`, `App.tsx`.

- [ ] `ImportButton`: secondary button + hidden `<input type="file" accept="video/*">` (value reset after each pick).
- [ ] `ImportProgress`: Cancel, "Analysing frame N / M · about X s left" (or "Loading … and the pose models…"), `<progress>`.
- [ ] `ImportView`: `.camera` box with the un-mirrored `<video>` + overlay canvas and an "Analysing <file>" badge.
- [ ] `CaptureControls`: `onImport`, `importError` props; button after Calibrate; error as a `capture__note--warn`.
- [ ] `RecordPanel`: `importer` prop; `ImportProgress` while importing; take video = `{ status: 'ready', blob: state.video }` for imports.
- [ ] `App`: `useVideoImport({ … onFrame: preview + Live Link, onDone: recorder.load })`; `usePose(…, isImporting)`;
      camera view wrapped in `<div hidden={isImporting}>` (keeps the webcam element mounted); `ImportView` while importing.
- [ ] `npx tsc --noEmit`, `npm test` pass. Commit `feat(web): import a video file as a take`.

### Task 7: Manual end-to-end check

- [ ] Serve a stored take (`server/data/takes/*.webm`) to the page, feed it to the file input, watch progress and the 3D preview.
- [ ] Review → Auto-slice (Gemini) → Export FBX → the clip appears in Unity (`Assets/EmoteCap/`).
- [ ] README: one line under features. Commit `docs: video import`.
