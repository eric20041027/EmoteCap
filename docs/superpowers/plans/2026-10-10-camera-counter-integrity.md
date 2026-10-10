# Camera Counter Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans with the user's preserved Native method. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make incomplete or stalled presented-input evidence ineligible for laptop performance qualification while retaining raw observations and diagnosing the browser boundary.

**Architecture:** CameraMeasurements derives a measured-interval progress state at receipt completion and CameraMeasurementsPage presents its meaning. After the owned browser probe established a playback-quality counter mismatch, a small owned frame-loop helper replaces that capture identity boundary with native video-frame metadata while preserving models/consent/solver and a RAF fallback.

**Tech Stack:** TypeScript, Vitest, React, Vite, Playwright/Edge, Python owned-process helper; existing Node24.19 and dependencies.

**Spec:** docs/superpowers/specs/2026-10-10-camera-counter-integrity.md

## Global Constraints

- qualification always pending; no automatic device/performance pass.
- Add summary.inputCounterProgress with values unavailable/insufficient/stalled/advancing.
- Preserve exact dependency locks, SDK/models, consent/cleanup, private evidence and failed attempts.
- No physical camera, actor data, remote main merge, tag or public binary release.
- Native execution and one fresh independent final review; existing authorization covers new branch/push/draft PR/CI.

## Review Focus

- Warmup-only counter advance cannot make a stalled measured interval eligible; test in Task1.
- No attempts or only one attempt must not establish progress; test in Task1.
- Missing identity, reset and failed-render observations cannot manufacture eligibility; test in Task1.
- Repeated attempts followed by a real counter increase remain deduplicated and eligible; test in Task1.
- Restart cannot inherit prior progress, and noncandidate settings still exclude observed runs; test in Task1 and retain existing condition matrix.

### Task 1: Counter evidence and candidate integrity

**Files:**
- Modify: web/src/evaluation/cameraMeasurements.ts
- Modify: web/src/evaluation/cameraMeasurements.test.ts
- Modify: web/src/evaluation/CameraMeasurementsPage.tsx
- Create: docs/superpowers/reports/2026-10-10-camera-counter-integrity.md
- Private diagnostic/receipts: .superpowers/sdd/2026-10-10-camera-counter-integrity/

**Interfaces:**
- Consumes: CameraMeasurements.begin(inputTimeS, startedMs, width, height, inputFrame), solved(frame), end(finishedMs,status,handState), rendered(frame,finishedMs), stop().
- Produces: additive CameraReceipt.summary.inputCounterProgress:'unavailable'|'insufficient'|'stalled'|'advancing'; preserves other v1 fields and pending qualification.

- [ ] Record fresh source identity and clean baseline:
  `node web/node_modules/vitest/vitest.mjs run --root web src/evaluation/cameraMeasurements.test.ts`
  Expected: existing camera tests pass before edits; retain the current empty-observed candidate behavior as a defect to change intentionally.
- [ ] Run the private browser characterization with Edge, 30fps canvas stream and visible/offscreen/visible phases. Preserve raw counters, pixel samples, visibility and actual exit/ownership. Expected: actual observations recorded, no assumed reproduction; classify the resulting mechanism only if raw values support it.
- [ ] Write failing behavioral cases using the existing ready()/ok()/metadata() helpers. For stalled observations, use two successful attempts with increasing inputTimeS but the same counter 3682 and observed metadata; stop after one second. Assert fast720pLaptopCandidate=false, inputCounterProgress=stalled, raw counts unchanged and outputFps=2. For insufficient observations, use zero or one measured attempt and assert candidate=false. For warmup-only progress, counters1,2 before warmup and counters3,3 after warmup must remain stalled. For advancing identities9,9,10,10 with real render calls, expect candidate=true, renderedCount2 and outputCount4. For all-failed advancing attempts expect candidate=false. For a restart after an advancing run, a later stalled run stays ineligible. Existing null/reset tests gain state assertions where summary exists.
  ```ts
  it('rejects stalled identities but retains observations',()=>{
    const {probe,setTime}=ready();probe.start({...metadata(),classification:'observed'});
    ok(probe,0,1000,1010,1020,3682);ok(probe,.1,1100,1110,1120,3682);
    probe.interaction(1200,1263.4);setTime(2000);probe.stop();
    const report=probe.getSnapshot().result!;
    expect(report.fast720pLaptopCandidate).toBe(false);
    expect(report.summary).toMatchObject({inputCounterProgress:'stalled',renderedCount:1,renderedOutputCount:2});
    expect(report.summary?.p95NextAnimationFrameResponseMs).toBeCloseTo(63.4,8);
  });
  ```
- [ ] Run the new tests before implementation:
  `node web/node_modules/vitest/vitest.mjs run --root web src/evaluation/cameraMeasurements.test.ts`
  Expected: new eligibility/progress assertions fail against current code, not import/setup errors; retain RED output.
- [ ] Implement the measured-attempt progress classification:
  ```ts
  const inputCounterProgress = !inputIdentityAvailable ? 'unavailable'
    : samples.length < 2 ? 'insufficient'
    : samples.some(a => a.inputFrame !== samples[0].inputFrame) ? 'advancing' : 'stalled';
  ```
  Add its literal union to summary and include the derived value. Eligibility additionally requires `summary.inputCounterProgress==='advancing' && summary.renderedOutputCount>0`. Keep existing arithmetic unchanged. Replace the empty condition-matrix input with two advancing observations, adjusting dimensions for the resolution/crop cases so each exclusion is exercised independently.
- [ ] In the actual measurement UI, show measured counter progress. When not advancing, state that this receipt cannot establish fresh-camera throughput, with output timing still retained. Show the stalled warning without disabling response measurements, changing capture or conflating output FPS. Do not claim a Mac root cause.
- [ ] Run target tests, full Web tests, non-emitting TypeScript and Vite build using installed CLIs. Expected: every invoked command exit0; full suite has no failed cases. Capture expected negative-test stderr separately from actual command failures.
- [ ] Reuse the actual synthetic browser to verify the built measurement page and receipt warning behavior. If needed expose only the owned test receipt at the component boundary in the private browser fixture; mark that phase synthetic and do not call it real camera inference.
- [ ] Write the report with exact diagnosis, before/after eligibility, source/receipt scope and remaining M4/M5 gates. Commit only public code/tests/spec/plan/report. Expected: no private returns, frames, browser profiles or new dependencies in diff.
- [ ] Record Task1 completion through task-done with full Web test command. Expected: completion line only after actual green suite.

### Task 2: Native input-frame scheduling

**Files:** Create web/src/capture/videoFrameLoop.ts and videoFrameLoop.test.ts; modify usePose.ts; update this plan's private browser probe and final report.

**Interfaces:** Consumes the ready HTMLVideoElement and emits (inputTimeS:number,inputFrame:number|null) to existing detection tick. Produces startVideoFrameLoop(video,onFrame):()=>void, an idempotent cancellation function. Task1 consumes the emitted ID via CameraMeasurements.begin.

- [ ] Write a boundary test harness whose native callback and RAF queues are under test control, with a real helper under test. Use IDs8,8,9,7: expect callbacks only for8,9,7, preserving a reset instead of hiding it. Stop, invoke a captured late callback and assert no new callback/request. Without native request/cancel pair, advance currentTime0,.1 and expect IDsnull with no invented count. For invalid metadata IDs (negative/fractional/nonfinite), expect null; for not-ready video skip inference. Also stop synchronously from the first handler, verifying cancellation of its already-scheduled successor.
  ```ts
  const seen:number[]=[];
  const stop=startVideoFrameLoop(video,(_time,id)=>{if(id!==null)seen.push(id);});
  emit(8);emit(8);emit(9);emit(7);
  expect(seen).toEqual([8,9,7]);
  stop();emitLate(10);expect(seen).toEqual([8,9,7]);
  ```
- [ ] Run `node web/node_modules/vitest/vitest.mjs run --root web src/capture/videoFrameLoop.test.ts`; Expected: fail due to missing production helper, then correct import/setup as needed until meaningful behavioral assertions run; do not claim a module-load error alone is behavioral RED. Initially supply only the existing RAF behavior to get the native behavior assertions RED before implementing native scheduling.
- [ ] Implement the helper with a cancellation-owned native callback when both native request/cancel exist; schedule the successor before the handler so a synchronous release can cancel it. Track last native ID only for equality dedup; valid IDs must be finite nonnegative safe integers. Fallback uses RAF and strictly changing currentTime, with null ID. Guard disposed/not-ready/late callbacks. `stop()` cancels only its own scheduled handle and prevents rescheduling.
- [ ] In usePose, replace RAF ownership with the returned stopper, and pass helper inputTimeS/inputFrame into the existing detection/diagnostic pipeline. Remove getVideoPlaybackQuality identity arithmetic; preserve all authorization checks, pause handling and ordinary errors. Expected: existing capture/consent/cleanup tests stay green.
- [ ] Run target and full Web tests plus non-emitting TypeScript/Vite build; Expected: exit0 and no failed test cases. Use the actual owned Edge probe to dynamically import the helper through an owned loopback Vite service; verify advancing production helper IDs and changing pixels offscreen without changing browser APIs. Verify cleanup and all consumed inputs before/after.
- [ ] Commit source/tests/report, run task-done, and obtain one whole-branch fresh strongest-model TypeScript review. Address material findings in one RED→GREEN correction pass; ledger all declined judgments and minors. Push/attach a new stacked draft PR based on fix/processed-clip-preview and check exact-head CI under existing authorization. Expected: actual CI checks green; no remote main merge/release.

## Self-review

Task1 owns eligibility/receipt/UI; Task2 supplies trustworthy frame IDs through the existing begin interface. Their shared interface is unchanged, and null identity still declines qualification. All five review focus cases are specified. Physical Mac regression remains separate from the actual Windows boundary reproduction.
