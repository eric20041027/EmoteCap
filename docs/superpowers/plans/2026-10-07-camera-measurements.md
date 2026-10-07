# Studio camera measurement implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Collect bounded, source-traceable effective FPS, render-call latency and failure evidence from the actual Studio camera workflow.

**Architecture:** An optional capture diagnostic interface connects the existing hook, App solver and preview renderer to a private in-memory collector. A development-only HTML entry wraps Studio with declared metadata, start/stop, response observation and compact local receipt download. The collector observes the existing output without changing its numerical or persistence behavior.

**Tech Stack:** Existing pinned React/TypeScript/Vite/Vitest/Three.js/MediaPipe and Playwright Edge; no dependency/lock changes.

**Spec:** `docs/superpowers/specs/2026-10-07-camera-measurements-design.md`; parent `docs/superpowers/specs/2026-10-06-open-source-product-design.md`.

## Global constraints

- 180000ms wall interval,21601attempts,32MiB compact JSON,32interaction observations; qualification always pending.
- Same v2/48driven/192rotations/52exported contract and source history; no stored images, landmarks, motion frames, video, device IDs or pairing codes in receipts.
- Default-denied SDK/camera; explicit operator local actor permission; synthetic verification never qualifies actual hardware.
- No model/framework/dependency changes, public write, main merge, release or cleanup of retained scratch.
- Native continuous local execution is already authorized; final one fresh most-capable TypeScript reviewer; one Important/Critical TDD fix pass, no rereview, minors deferred, every ruling includes cost.

## Review focus

1. A solver reuses a frame object or preview draws an old frame repeatedly: count only the matching first new-frame render, retain overwritten attempts.
2. Startup/hand fallback, camera settings or source changes mid-run: preserve actual delegate/hand evidence and stop comparable collection when conditions change.
3. Diagnostics throw or receive invalid clocks while ordinary detection is working: terminate only diagnostics and preserve capture/recording.
4. Permission is withdrawn, camera stalls or the tab hides: preserve a bounded partial downloadable receipt, release owned timers/resources, and never falsely report a completed benchmark.
5. A user downloads synthetic/desktop/non720p/no-pose data: exact boundaries/denominators and pending classifications must prevent a supported-laptop or physical-latency claim.

---

### Task 1: In-memory diagnostic interface and receipt arithmetic

**Files:** Create `web/src/capture/diagnostics.ts`, `web/src/evaluation/cameraMeasurements.ts`, `web/src/evaluation/cameraMeasurements.test.ts`.

**Interfaces:**
- Consumes actual `MotionFrame` references solely for transient render matching, existing `CaptureQuality`, `CropMode`, `SmoothingLevel`, delegate and SDK/model pins.
- Produces `CameraDiagnostics` with `configure(context)`, `setup(setup)`, `previewReady(ready)`, `begin(inputTimeS,startedMs,width,height)`, `solved(frame)`, `end(finishedMs,status,handState)`, `rendered(frame,finishedMs)` and `interrupt(reason)`; `active` is readonly. `observeCamera(sink,action)` catches sink exceptions and attempts `interrupt('observer-failed')`, without propagating them.
- `CameraMeasurements` implements the interface and provides `start(metadata)`, `stop()`, `interaction(startedMs,finishedMs)`, `getSnapshot()` and `subscribe(listener)`. Snapshot is stable until readiness/start/stop changes, with `{ready,busy,result}`. Start throws on invalid metadata/state and preserves the prior result. Receipt has frozen declarations/context/setup, bounded attempts/interactions, started/finished times, outcome/reason, source digests and a nullable summary.
- `CameraContext` records camera generation identity internally plus quality/crop/skeleton/smoothing/workflow/calibrated/LiveLink/mirror/camera status/consent. Receipt omits camera identity. `CameraSetup` is width/height/frameRate/poseDelegate/handDelegate/handModelAvailable. `CameraMetadata` is sourceCommit/classification/environment(kind,model,os,cpu,gpu,browser)/warmupMs/localProcessingAuthorized/sourceDigests(App,usePose,PreviewCanvas,cameraMeasurements).

- [x] **Step1: Write behavior tests before implementation.** Use literal clocks and tposeFrame; prove trailing idle/warmup/failed attempts in denominator, nearest-rank p95, no-pose0/null, exhausted warmup, repeated and overwritten/mutated frame references, changed metadata/context/setup, invalid times/dimensions,21602nd attempt,32response bound, stalled timeout closure, callback isolation and source/privacy fields.

```ts
let now=1000;
const probe=new CameraMeasurements(()=>now);
// configure ready Fast/no-crop/full/medium/live-preview and1280x720GPU setup,
// then declare complete synthetic laptop metadata and0ms warmup.
probe.start(metadata);
probe.begin(0,1000,1280,720);probe.solved(frame);probe.end(1010,'ok','ran');
probe.rendered(frame,1020);probe.rendered(frame,1030);
probe.begin(.1,1100,1280,720);probe.end(1110,'no-pose','reused');
now=2000;probe.stop();
expect(probe.getSnapshot().result?.summary).toMatchObject({
  effectiveRenderedFps:1,attemptFps:2,failureRate:.5,p95DetectionToRenderCallMs:20,
});
```

- [x] **Step2: Watch RED.** Run `node web/node_modules/vitest/vitest.mjs run --root web src/evaluation/cameraMeasurements.test.ts`; test declarations/stubs may establish import/type interfaces but must fail on missing behavior. Record the actual failures; initially passing negative controls are not RED.
- [x] **Step3: Implement interface/collector.** `begin` creates one pending attempt, `solved` captures only reference/time for matching, `end` commits timing/status, `rendered` updates only the matching first-render field. Frozen inputs and validated finite monotonically increasing clocks bound data; `interrupt` emits an incomplete receipt. On stop compute literals using `count/(finished-started-warmup)*1000` and sorted durations at `ceil(.95*N)-1`; no success gives null latency. Use a compact JSON bound and strict declared metadata; reject unknown/wrong source digest keys. Observer wrapper never throws.
- [x] **Step4: Run GREEN/full checks.** Focused command above, whole `node web/node_modules/vitest/vitest.mjs run --root web`, and `node web/node_modules/typescript/bin/tsc --noEmit -p web/tsconfig.json`. Expected zero failures; default code compiles with optional diagnostics still unused.
- [x] **Step5: Commit and complete Native gate.** Commit `feat: add bounded Studio camera measurement receipts`; task-done uses the whole Web suite and this task's BASE. Read actual counts/log.

### Task 2: Actual Studio hooks, private control page and browser qualification

**Files:** Modify `web/src/capture/usePose.ts`, `web/src/App.tsx`, `web/src/preview/PreviewCanvas.tsx`; create `web/camera-measurements.html`, `web/src/evaluation/CameraMeasurementsPage.tsx`, `web/e2e/camera-measurements.spec.ts`, `docs/camera-measurements.md`, `docs/superpowers/reports/2026-10-07-camera-measurements.md`; update `docs/release-progress.md`, `docs/development.md`.

**Interfaces:** Consume Task1 sink/probe/metadata. `App({cameraDiagnostics?:CameraDiagnostics}={})` forwards optional sink to hook/preview; `usePose(...,processingConsent,diagnostics?)` and `PreviewCanvas(...,diagnostics?)` remain compatible with all default callers. The private page computes four exact raw-source SHA256 digests once; consumes probe snapshots through `useSyncExternalStore` and mounts `<App cameraDiagnostics={probe}/>`.

- [ ] **Step1: Write actual Edge cases first.** Route only SDK creation/detections; override getUserMedia with owned1280x720canvas stream. Run actual hooks/solver/preview. Pin no camera/model before explicit Start camera, grant-only nothing, actor permission required, first-render matching, no-pose/detector/hand failure, unknown delegates, settings/withdraw/tabhide incomplete receipts, privacy/source provenance, timer/subscription cleanup,320px layout and previous download preservation.

```ts
await page.goto('/camera-measurements.html');
expect(await page.evaluate(()=>Reflect.get(window,'cameraRequests'))).toBe(0);
await page.getByRole('checkbox',{name:'Allow MediaPipe performance and usage metrics'}).check();
expect(await page.evaluate(()=>Reflect.get(window,'cameraRequests'))).toBe(0);
await page.getByRole('button',{name:'Start camera',exact:true}).click();
await expect(page.getByRole('button',{name:'Start measurement',exact:true})).toBeDisabled();
// Fill declared conditions and local actor permission, then measure a fresh live preview.
// Download actual compact JSON with browser Download.saveAs into a fresh ignored artifact root.
expect(receipt).toMatchObject({schema:'emotecap-camera-measurement-v1',qualification:'pending'});
expect(receipt.summary.renderedCount).toBeGreaterThan(0);
```

- [ ] **Step2: Watch browser RED.** Installed Edge command with fresh `EMOTECAP_E2E_ARTIFACT_DIR`: `node node_modules/@playwright/test/cli.js test e2e/camera-measurements.spec.ts --project studio-development`; expected missing measurement controls. No physical camera/network inference.
- [ ] **Step3: Wire optional sink.** Hook reports setup only for diagnostic callers via existing `reportDelegate` option, begins only active diagnostics before crop/detection, reports hand state/end/error, and interrupts owned teardown/failure. App configures context with layout effects, reports solved frames only after actual live frame assignment, synchronously interrupts withdrawal, and forwards preview sink. Preview reports readiness and after actual render completion; default behavior unchanged; observer wrapper isolates all calls.
- [ ] **Step4: Build private page.** Inputs are frozen while collecting; start only ready valid metadata, separate SDK/camera action. Stop, optional next-rAF response and compact receipt download are accessible. Own180000ms timeout and visibility listener interrupt incomplete; cleanup cancels owned timer/rAF, unsubscribes and revokes Blob URL. Prior result remains available. Display explicit FPS/latency boundaries, pending status and candidate conditions. No automatic threshold or file-input digest.
- [ ] **Step5: Qualify.** New Edge cases, impacted SDK/camera cases and production sample; zero unexpected skips. Whole Web,49Node asset/security/baseline tests, TypeScript and default Vite build. Verify `dist` excludes private camera/video HTML and private collector/source payloads. Inspect narrow screenshot. Record actual version/counts/source hashes/receipt paths and synthetic boundaries. Backend unchanged; do not rerun unrelated backend suites.
- [ ] **Step6: Document, commit and complete Native gate.** Document source entry, metadata/permission/steps, compact receipt/summary/limits and actual-laptop pending. Commit `feat: collect actual Studio preview performance`; task-done uses whole Web suite and Task2 BASE.

## Final review and continuation

Package original BASEccf52dc..finalHEAD with plan/spec/ledger/report. One fresh gpt-6-astra/high TypeScript reviewer reads this whole increment and all five focus cases. Record every effect/ruling/cost; one watched Important/Critical fix pass with whole relevant GREEN; no rereview and no minor polish. Retain scratch after prior cleanup rejection. Continue full M1–M5 with actual physical/source/laptop/Unity/rights/clean-machine/new-user/publication gates explicit, without marking tool or synthetic success as release completion.
