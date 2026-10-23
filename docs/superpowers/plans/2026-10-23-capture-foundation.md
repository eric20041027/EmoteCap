# Capture Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans, preserved Native inline method; no implementer agents. One fresh strongest-model final review after this independently qualified increment; preserve all evidence.

**Goal:** Remove unused hand-model initialization and per-frame whole-take copies without changing accepted motion, project, recovery or consent behavior.

**Architecture:** Detector intent is explicit in the shared model factory. A pure recorder session owns append-only validated frames; React subscribes to a stable summary, and checkpoint/stop request immutable array snapshots. Existing browser/Blender/Unity boundaries remain intact.

**Tech Stack:** Existing pinned Node24.19.0/npm11.21.0/TypeScript/React/Vitest; cached MediaPipe assets; no package/runtime/wheel downloads.

**Spec:** ../specs/2026-10-23-indie-game-mocap-design.md (owner-approved). This is R1's first independently testable increment. Calibration/confidence, upper-body/provenance/Unity mask, graph-proven dead-UI cleanup and stage profiling remain approved subsequent increments, not waived.

## Global Constraints

- Original motion v2 remains48driven/192values/52full-or22body exported bones; old projects/fixtures/receipts preserved.
- Preserve finite/unit-quaternion/strict-time validation,180seconds/21601frame limits/project capacity,5second checkpoint and immutable saved prefix.
- Consent leases/cancel/error cleanup still gate every model operation; body mode must never create a hand model; returning to fingers restarts the owned camera models.
- No physical tests/camera/provider calls; no claim of FPS/precision improvement from unit controls. Actual measurement and originalM1–M5release gates remain pending.
- Owner explicitly approved plans and execution with retained Native method. Do not repeat approval for these implementation choices; main merge/publication remains separate.

## Review Focus

- Switching fingers off/on with a slow model initialization must close stale owned resources and never bypass withdrawn consent (Task1 factory/controlled-browser cases).
- Recorder snapshots/checkpoints cannot change after future pushes or share arrays with solver buffers (Task2 mutation and prefix tests).
- Stop/capacity/invalid-frame/consent withdrawal includes the last valid frame immediately, even before a UI publish (Task2 immediate-state tests and Task3 browser checks).
- Timer callbacks after discard/unmount and StrictMode subscribe churn must not resurrect an old take (Task2 lifecycle controls/Task3 browser checks).
- Long recording UI summaries must not read/copy the frame history on each inference;5second checkpoint remains actual source of persisted snapshots (Task2 API and Task3 long replay).

### Task 1: Explicit detector selection

**Files:** web/src/capture/landmarkers.ts/.test.ts, usePose.ts; web/src/import/useVideoImport.ts; web/src/evaluation/videoMeasurements.ts; relevant controlled-browser cases.

**Interfaces:** consumes existing `SdkAuthorization` lease; produces `createLandmarkers(quality,authorize,{trackHands?:boolean,reportDelegate?:boolean})`, default true preserves callers. hands undefined/handDelegate null when off. Camera/import/diagnostic factory calls pass effective hand intent.

- [ ] Add `body request never creates hands`, `body request remains authorization gated`, `enabled hands still independently fallback` tests. Expected: first new opt-out behavior fails against existing unconditional factory.
- [ ] Add `trackHands` option, conditionally create hands, retain owned cleanup/rejection; propagate to camera/import/evaluation and restart camera effect on intent change. Expected: no model/lock/version changes.
- [ ] Run `node node_modules/vitest/vitest.mjs run src/capture/landmarkers.test.ts` from web, then affected capture/privacy/import tests and `node node_modules/typescript/bin/tsc --noEmit`. Expected: all pass; no hand factory in body mode, prior cancellation cases retained.
- [ ] Commit exact task files and run task-done with focused suite. Expected: clean record, old artifacts retained.

### Task 2: Recorder buffer and stable UI summary

**Files:** new web/src/record/recorderSession.ts/.test.ts; modify useRecorder.ts/.test.ts, CaptureControls.tsx, App.tsx, studio/useCaptureProject.ts; existing checkpoint tests.

**Interfaces:** `RecorderSession` owns frames and phase; `getSnapshot():RecorderState`, `subscribe(listener):unsubscribe`, `arm()/begin()/push(frame,maxFrames?)/publish()/stop()/discard()/load(...)`, `snapshotFrames():readonly MotionFrame[]`. Recording state exposes frameCount/durationSeconds, no frames array. Recorded state retains immutable frames. Hook exposes snapshotFrames to checkpoint;100ms UI publication does not copy arrays.

- [ ] Write session tests for exact rebasing/owned h+r arrays, immutable snapshot after more pushes, valid prefix on invalid/nonincreasing/nonfinite/capacity/180s, empty stop, load guards, synchronous transitions and stable summary until publish. Expected: new session API missing/behavior fails before implementation; prior recorder behavioral coverage retained during migration.
- [ ] Implement append-only private buffer and summary subscription; retire whole-array reducer from production and migrate tests to actual session API. Hook owns100ms publish timer; lifecycle cleanup clears timer and subscriptions. Expected: no frame-list copy in push or UI publish; snapshots only on explicit reader/finish.
- [ ] Adapt App/CaptureControls to summary and checkpoint reader to snapshotFrames. Expected: five-second checkpoint/finalization reads current buffer even before next render/publish; stop/auto-stop synchronous.
- [ ] Run recorder/session/checkpoint/project affected tests plus types. Expected: all cases pass; UI draw count separate from captured frame count; no dropped final frame or rewritten saved prefix.
- [ ] Commit task files and task-done with focused suite. Expected: proof attached to task base range.

### Task 3: Integrated qualification and handoff

**Files:** controlled browser tests under web/e2e as needed; docs increment report; private replay/profile receipts in this plan workspace.

**Interfaces:** consumes Task1 detector option and Task2 session/hook/snapshot API; no new product API. Existing ordinary Studio entry and isolated owned browser fixture run without physical camera.

- [ ] Run frozen Web full suite/types/assets/security/default cached build and relevant Node baseline checks; run controlled Studio recording/stop/withdrawal/restore and hand-intent transitions. Expected: actual browser integration passes, no real hardware/provider calls and all owned processes closed.
- [ ] Replay bounded long valid recording into actual session; preserve snapshot/limits/checkpoint controls and record actual wall-time/summary events. Expected: no unsupported FPS or human-accuracy conclusion; report measured scope only.
- [ ] One fresh whole-increment Native review on strongest model; comply with TS/code-review requirements. Regrade issues by effect; one watched material correction pass; record all rulings/deferred minors/costs; preserve workspace per owner instruction. Expected: material issues resolved, covering suite green.
- [ ] Commit report, final read-only source scan and authorized branch/draft PR/CI if network/tools permit; never auto-merge new main or publish binaries. Expected: exact-source evidence, honest pending gates; then continue approved calibration/profile increments.

## Self-review

Task1 andTask2 are independent implementation seams;Task3 consumes both. RecorderUI consumers change with Task2, not before its API. No new runtime or dependency is needed. R1 does not pretend to complete R2/R3/R4 or physical acceptance; original22outcomes remain the full release objective.
