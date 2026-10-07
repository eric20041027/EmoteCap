# Video Measurement Collector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans task-by-task. Continue Native inline with one fresh final TypeScript review.

**Goal:** Collect failed/successful video-import attempts and traceable timed-preview/raw-final data through a private explicit developer workflow.

**Architecture:** Optional conversion observations and opt-in SDK/tracker metadata preserve default app behavior. A bounded collector owns one video/model lifecycle, hashes the selected source and projects an eligible preview packet. A separate developer HTML entry exposes consent/metadata/run/cancel/download without adding a Studio flow or production page.

**Tech Stack:** Existing TypeScript7/React19/MediaPipe1.0.1/Vite8/Vitest5/Playwright1.62, frozen Node24.19/npm11.21; Python3.12.14 only for cross-tool validation.

**Spec:** `docs/superpowers/specs/2026-10-07-video-measurement-collector-design.md`.

## Global Constraints

- Normal conversion/48driven/192values/52full or22body/two-pass calibration/permission/error contracts unchanged; observer is optional.
- Source≤100MiB/180seconds;21601attempts/32MiB diagnostics, finite ordered spans, immutable copied frames; incomplete data never yields a comparable packet.
- Actual FileSHA/dimensions/model/SDK/delegate tracked; rights/source/environment/classification remain declarations, qualification=pending.
- Both full/body tracking supported; hand degradation explicit and nonuniform-policy packet refused. Preview/final outcomes/timings remain distinct.
- Default-denied session SDK + explicit local source/action; no permission inferred from file/metadata selection or grant alone; cancelled/late owned resources closed.
- Private developer entry excluded defaultproduction; no API/IDB/upload/rawsource/names/privatepaths/keys, no new deps or public/main/license/release action.
- Synthetic Edge+SDK mocks qualify logic/decoder/download/CLI only, not real SDK/laptop/Unity quality. Existing candidate5572c88remains source-specific and retained.
- One fresh final review/one needed Important/Critical RED→GREEN pass, no rereview/minor polishing/scratch cleanup.

## Review Focus

1. Preview calibration, fatal tenth failure, failed final solve and observer exceptions must not disappear or change the user's normal take.
2. Withdrawal/supersession during File hashing, media readiness or model creation must prevent late inference/results and close only owned resources.
3. Actual CPU fallback or hand downgrade must not become a GPU/full-finger or uniform-policy performance claim.
4. Long/oversized/invalid-clock/truncated diagnostics must retain bounded partial evidence without enabling valid packet download.
5. Imported-video preview timings/final output and synthetic controls must not be mistaken for real Studio/camera/laptop or release acceptance.

---

### Task 1: Optional raw observations, owned collector and private page with cross-tool qualification

**Files:** Modify `web/src/import/convertVideo.ts`, `detectFrame.ts`, `capture/landmarkers.ts`, `capture/hands.ts` and their relevant tests; create `web/src/evaluation/videoMeasurements.ts`, `videoMeasurements.test.ts`, `VideoMeasurementsPage.tsx`, `web/measurements.html`, `web/e2e/measurements.spec.ts`, `docs/video-measurements.md`, `docs/superpowers/reports/2026-10-07-video-measurement-collector.md`; update `docs/release-progress.md`. No main App/Studio UI, Python validation, package locks or Unity changes.

**Interfaces:** `ConversionAttempt={inputTimeS:number,seekStartedMs:number,startedMs:number,finishedMs:number,status:'ok'|'no-pose'|'detector-error'|'solver-error'|'seek-error',frame:MotionFrame|null,handTracking?:'active'|'disabled'|'failed',assignedHandSides:readonly string[]}`; ConvertSteps optional `onAttempt?:(attempt:ConversionAttempt)=>void`, `now?:()=>number`; ConvertedVideo optional `measurementState?:'complete'|'failed'`. `createLandmarkers(quality,authorize,options?:{reportDelegate?:boolean})` adds optional `poseDelegate:'GPU'|'CPU'` only when requested. `createFrameDetector(landmarkers,trackHands,authorize,reportTracking?:boolean)` adds optional FrameDetection.handTracking only when requested.

ReviewFocus3 refinement after watched independent-hand-fallback RED: `createHandLandmarker(fileset,authorize,reportDelegate?:(delegate:'GPU'|'CPU')=>void)` reports after its existing guard/owned cleanup; opted-in bundle adds `handDelegate:'GPU'|'CPU'|null`. Raw data retains both configurations/hashes. Unknown/mixed active hand configuration is raw-only because v1 has one delegate field. Shared close attempts hands in finally even if pose close throws; private cleanup failure retains raw/final data without a packet. These are ledgered refinements, not default app/schema changes.

`collectVideoMeasurements(options:{file:File,video:HTMLVideoElement,sourceCommit:string,environment:{kind:'desktop'|'laptop',os:string,cpu:string,gpu:string,browser:string},classification:'synthetic'|'observed',skeleton:'full'|'body',smoothing:SmoothingLevel,warmupMs:number,localProcessingAuthorized:boolean,processingConsent:ProcessingConsent,signal?:AbortSignal}):Promise<VideoCollection>` owns the operation; `VideoCollection={schema:'emotecap-video-collection-v1',runId:string,qualification:'pending',outcome:'completed'|'no-person'|'incomplete',reason:string|null,metadata:Record<string,unknown>,attempts:readonly ConversionAttempt[],finalFrames:readonly MotionFrame[],packet:MeasurementPacket|null}`. Packet matches the accepted emotecap-measurement-v1 exactly, annotations initiallyempty. Injected/mock modules only in tests; actual helper uses existing guarded SDK/solver/video functions.

- [x] **Step1: Write meaningful RED controls.** Add onAttempt tests to existing converter controls, with deterministic `now` increments and fake solvers: ordinary result unchanged, no-pose/detector errors retained, tenth fatal observed, seek/solver failure and callback exception surfaced without losing ordinary frames. Pin opt-in actualGPU/CPU metadata/default exact object, hand failure status/default detection shape. Write collector admission/latecleanup/report immutability/budget/uniformity cases using owned File and mocked SDK/video dependency points; a loadable collector stub only admits assertion failures and is not committed.

```typescript
const attempts:ConversionAttempt[]=[];
const output=await convertVideo(.1,{...steps,detect:ms=>ms===0?NOBODY:person(ms),
  now:()=>++clock,onAttempt:event=>attempts.push(event)});
expect(attempts.map(event=>event.status)).toEqual(['no-pose','ok','ok']);
expect(output.frames).toEqual(plain.frames);
expect(attempts[0].frame).toBeNull();
```

- [x] **Step2: Watch focused RED.** Frozen Web test command `npm test -- --run src/import/convertVideo.test.ts src/import/detectFrame.test.ts src/capture/landmarkers.test.ts src/evaluation/videoMeasurements.test.ts`; use the configured pnpm dlx npm11.21runtime and redirect finite logs. Require assertion/admission failures, not missing modules/executors. Read task brief and ledger before implementing.
- [x] **Step3: Implement optional metadata/observations.** Only invoke clocks/observer when requested. Copy observed frames and report before each existing fatal throw; final poses remain existing results. Observer exceptions disable observations, warn with fixed text and set explicit failed state while normal conversion completes. Default factory/detector objects remain byte-semantically unchanged; report actual successful delegate and persistent hand-failure state only on opt-in.

```typescript
const report=(event:ConversionAttempt)=>{
  if(!observer)return;
  try{observer(structuredClone(event));}
  catch{observer=undefined;measurementFailed=true;console.warn('Measurement collection stopped.');}
};
```

- [x] **Step4: Implement bounded owned collector.** Validate metadata/source/idle video before effects, lease authorization around async boundaries, hash File bytes, open current video, initialize Accurate SDK with delegate reporting, convert with observed detector/solver and injected observation clock. Bound serialized records before retention. Copy final output separately; classify complete/no-person/incomplete without raw exception strings. Finally closes only owned video/models; no fallback fabricated metadata. Project v1 only when attempt completion/window/warmup/hand uniformity are proven; report source dimensions and private-free metadata. Incomplete outcomes retain raw data and packetnull.

```typescript
authorize();const bytes=await file.arrayBuffer();authorize();
const inputSha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
authorize();
// The existing guarded open/model/convert operations follow; owned cleanup runs in finally.
```

- [x] **Step5: Focused GREEN and private page.** Run full focused suites. Page uses shared ProcessingConsentPanel, explicit local-authority choice, File/metadata and Run; cancel/withdraw aborts one owned run and invalidates stale results. Preserve previous/partial result for explicit raw/packet downloads. Only strict metadata enables Run. Use a separate HTML entry with its own root and responsive controls; no App edit/default production build entry.
- [x] **Step6: Actual Edge workflow and Python bridge.** Add real canvas-generated synthetic WebM input, mock SDK model creation/detections with explicit synthetic classification, and use real open/seek/convert/solver/download. Check defaultdenied/grant-alonenothing/selectedsourceSHA/dimensions/failed attempt/final frames/withdraw/ownedcleanup/noexternalAPI. Save named byte payloads into short fresh artifact paths. Downloaded valid packet must pass `evaluate_motion.py` with matching attempt counts/sourceSHA/pending status; raw incomplete packet must remain unavailable. No physical camera/actual SDK/network inference.
- [x] **Step7: Relevant regression/build/documentation.** Full frozen Web/8Node/type/assets/build, existing SDK/camera Edge journeys and new page. Default production dist excludes measurements.html. Document exact developer launch with declared commit, source rights/SDK action, raw/preview/final meanings, handfallback/truncation and standalone output/CLI steps. Update report/progress with actual gates and pending physical/user/rights/CI. Commit clear increments.
- [x] **Step8: Native task-done and final review.** Full Web command is the final Native gate; generate fixed wholeplanBASE..HEAD review package and one fresh TypeScript reviewer on mostcapable model. Regrade every finding/decline by effect, ledger exhaustiveRuling+cost, one necessary Important/Critical watchedfix/fullGREEN/affectedbrowserbridge checks, no rereview. Preserve scratch and continuous goal.

No routine plan/method approval pause: independent local preparation is authorized by the continuous goal. Actual source/model/hardware qualification and public writes retain their separate unanswered gates.
