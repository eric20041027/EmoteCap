# Calibration and Confidence Implementation Plan

> Native inline execution with tests first; one fresh final review for this increment. Owner approved the parent design and implementation. No hardware, dependency download, merge or binary publication.

**Goal:** Reject stale, moving or non-T-pose camera calibration; honor explicit calibration samples; prevent low-confidence or nonfinite observations from corrupting landmark filters.

**Spec:** ../specs/2026-10-23-indie-game-mocap-design.md. This is R2's quality foundation, with profile-aware bounded bone hold/relax completed together with R3's inactive-bone semantics. No real-world accuracy or latency claim.

**Architecture:** A pure bounded rolling calibration window consumes image/world samples and host arrival time. The hook reads its decision after the existing five-second countdown. The motion filter admits finite observations with visibility >=0.5 and resets on reacquisition. Explicit calibration uses exactly its argument and clears smoothing history. No frame wire changes.

## Global Constraints

- Preserve existing v2 192-value frames, old saved projects, replay fixtures and original release gates.
- Keep original automatic-video T-pose selection and final whole-take re-solve; camera window qualification does not silently change imported-video selection.
- Camera window: at least8consecutive samples spanning350ms; gap at most150ms; latest arrival at most200ms old. Only the latest bounded window (at most60samples/1second) is retained. Require image T-pose, finite/visible relevant world points, and maximum35mm spread per required point from the first accepted sample. Reject unavailable, stale, insufficient, wrong-pose, low-confidence or unstable observations with useful text.
- Reacquisition resets coordinate filters, not the accepted recording buffer. Missing points return finite held/default positions with visibility0; rejected samples never enter derivative/value history.
- No stronger smoothing or worker addition without measurement. Calibration resets reference/filter state; does not mark success on failure.

## Review Focus

- Explicit calibration must not use an earlier solved pose or hand sample, including video preview before its selected middle T-pose.
- Low confidence, NaN/Infinity, time gaps and invalid timestamps cannot poison later valid coordinates; valid-input filtering stays equivalent.
- Countdown cancellation, session change and stale camera observations cannot calibrate a different camera or mark it successful.
- Window bounds and minimum time span prevent repeated/latest-only stale samples from counting as stability.

### Task 1: Explicit calibration and confidence admission

**Files:** web/src/motion/index.ts/.test.ts, oneEuro.ts/.test.ts, landmarks.ts as needed.

**Interfaces:** PoseSolver.calibrate(world,hands?) uses the supplied sample only and throws on invalid shape/nonfinite values; public solve/reset signature retained. LandmarkFilter keeps finite safe fallback coordinates, marks rejected visibility0 and recreates coordinate filters after rejection or >0.4s gap.

- [ ] Add regression tests showing an earlier non-T solved pose overrides explicit calibration today, invalid samples are silently accepted, and hidden extreme/NaN observations poison reacquisition. Expected RED before source edits.
- [ ] Implement explicit reference and filter admission, reset landmark/rotation/jump history after successful calibration. Remove redundant lastPoints/lastHands cache. Expected old visible-input solver tests unchanged, explicit sample determines reference.
- [ ] Run motion/import tests and typecheck; commit; task-done with focused tests. Expected all pass, imported final re-solve and healthy filtering retained.

### Task 2: Stable camera calibration window

**Files:** new web/src/capture/calibrationWindow.ts/.test.ts; useCalibration.ts; App.tsx; import/tpose.ts type-only decoupling; controlled browser calibration cases.

**Interfaces:** window.observe({world,image,aspect,arrivedMs,hands?}); window.read(nowMs) returns qualified original sample or reason. Hook consumes a per-camera window, reset with camera key, calls solver.calibrate only on a fresh qualified decision. Observe outside React render, no per-frame setState.

- [ ] Add RED cases for fresh stable pass, wrong pose, low visibility, moving points, nonfinite, duplicate/out-of-order arrivals, stale, insufficient span/gap, reset and bounded storage.
- [ ] Implement pure window and connect hook/camera observation with performance.now arrival time. Existing five-second countdown and consent cancellation retained. Expected stale lastWorldRef no longer enough to mark calibration successful.
- [ ] Run window/motion/import suite, types and controlled browser stable success/wrong-pose/stale/cancel flows without physical camera. Commit and task-done; preserve receipts.

### Task 3: Qualification and review

**Files:** increment report and private evidence; no further product API.

- [ ] Full Web suite/types/cached assets/security/build plus affected controlled browser tests; actual receipt counts. Expected healthy-input regression retained and deliberate rejection verified, no claimed human precision gain.
- [ ] One fresh strongest-model whole-increment review; grade by actual user effect, fix material findings in one RED/GREEN pass, ledger deferred minors/rulings. Expected no unresolved material issue.
- [ ] Commit report/source-scan; prepare draft PR/CI under existing authorization as appropriate, continue approved profiles/Unity work. Preserve old candidate binaries/receipts; no merge/tag/public release.

## Self-review

Task2 consumes Task1 explicit sample semantics; both use finite admission and visibility0. Task3 consumes both. A rejected calibration retains the previous known-valid reference but shows a warning; a new camera's calibration identity stays false. Complete motion dropout relaxation and upper-body fallback remain R3, explicitly required rather than silently claimed here.
