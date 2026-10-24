# Upper-body Profiles Implementation Plan

> Native inline execution; tests first, one fresh final whole-increment review plus required C# domain review if C# changes. Preserve evidence. Parent design and staged implementation authorized by owner.

**Goal:** Deliver four meaningful capture presets for wave/thumbs-up/open-door clips, without requiring legs in upper-body mode or breaking old projects and fixed motion v2 frames.

**Spec:** ../specs/2026-10-23-indie-game-mocap-design.md.

**Architecture:** Shared region policy and parent-aware continuity in motion-core; settings choose region/fingers atomically; project schema2 carries optional processing provenance while reading legacy schema1 without rewriting take originals. Full legal Humanoid rigs remain52/22bones. Unity gets a separate mask example, retaining the original whole-body sample.

## Global Constraints

- Motion contract remains2:48driven bones,192rotation values, fixed bone order. Full/body export choices remain52/22; upper-body does not delete legs from the rig. Derive active driven counts from shared bone names (full48/18; upper41/11).
- Upper-body root is fixed pelvis at H0, x/z0. Ignore inferred hip/leg observations, jump lift and foot planting. Torso reference uses observed shoulder line plus canonical upright direction; shoulder-only capture cannot reliably recover forward torso lean. State this limitation in the capture hint. Inactive lower-body world deltas inherit their parent rather than independently counter-rotating it.
- Body dropout: hold parent-relative pose for0.4s, then relax toward neutral parent-relative pose with0.25s time constant; valid reacquisition uses existing rotational filter. Head follows its parent when unavailable. Preserve hand-specific relaxed finger policy; reparent finger deltas when a missing hand follows its arm. No unbounded body freeze.
- Pose visibility is meaningful; hand per-point visibility0 is not. Finite checks remain. Upper-body calibration needs visible head/shoulders/arms/palms but no hips/legs; synthetic reference lower points do not count as observations.
- Four settings are atomic; recording/import/calibration lock remains. Changing configuration creates a fresh solver/window; no mixed-profile take. New source/import metadata records actual hand availability, not merely requested full skeleton.
- Schema2 reads legacy1 as full-body legacy behavior without adding processing fields to immutable take provenance. New processing fields are validated; region/root/fingers/model combinations must agree. Archive header/project schema must agree before migration; new backups write2, motion wire stays2. Old fixture bytes/receipts preserved; add migration assertions rather than overwrite them.
- No physical tests, dependency/model/runtime/wheel downloads or new merge/tag/binary publication. Existing toolchain8.3.3/5.0.3 retained.

## Review Focus

- NaN/hidden lower landmarks must not block upper-body solve/calibration or influence pelvis height/jump/planting.
- Parent-relative fallback must preserve local neutral children under torso rotation; fingers must follow the fallback hand.
- Legacy provenance remains byte/value-equivalent on parse/save, while malformed new profile combinations and mismatched archive schema fail closed.
- Settings cannot change during countdown/record/import/calibration. Camera/import/evaluation apply the selected profile, and actual failed hand-model setup is distinguishable in provenance.
- Unity mask example must state exactly which Root/Body/legs/IK channels are enabled; it must not clear the existing Animator controller or call world-delta data additive. Do not claim gait/hips separation beyond what the mask actually excludes.

### Task 1: Shared profile and bounded continuity

**Files:** new web/src/motion/captureProfile.ts/.test.ts and trackingContinuity.ts/.test.ts; motion/index.ts/.test.ts; solver.ts tracked flags; shared skeleton helpers as needed.

**Interfaces:** CaptureRegion='full-body'|'upper-body'; profile helpers derive active bones and normalize upper-body reference landmarks. createPoseSolver(params,smoothing,region='full-body'). solveRotations additionally reports actual tracked body bones; TrackingContinuity applies parent-relative fallback using bone topology. Existing2-argument callers keep full-body behavior except approved confidence fixes.

- [ ] RED: upper solve works with hidden/nonfinite legs, fixed pelvis/no jump, active counts, finite192values; hidden head/arm eventually follows parent, short hold preserves relative pose and fingers attach. Expected old API either missing or fails upper policy.
- [ ] Implement profile normalization and continuity; apply before rotation filtering, keep reference/filter reset. Expected valid full-body solver fixtures unchanged; upper masked bones neutral, no leg-based grounding.
- [ ] Focused motion/import suite and types; commit/task-done. Expected confidence dropout bounded and existing SDK-hand visibility regression stays green.

### Task 2: Schema migration, presets and integration

**Files:** project/types.ts/validation.ts and archive/manifest.ts/codec.ts +tests; studio/provenance.ts/.test.ts; settings/skeleton.ts/SkeletonSelect.tsx; capture/calibrationWindow.ts/.test.ts, captureChecks.ts/.test.ts, CameraView.tsx/usePose.ts; import/useVideoImport.ts/convertVideo.ts/tpose.ts +tests; evaluation settings/callers; App.tsx/CaptureControls.tsx/ProjectReview.tsx; contracts/emotecap-project-v1.md.

**Interfaces:** optional provenance.processing={version:'indie-mocap-v1',region,root:'fixed-pelvis'|'grounded-in-place',hands:'off'|'available'|'unavailable'}; absence means legacy full-body with original skeleton mapping. New projects/schema backups2; parse1 migrates document only, never writes new metadata into old takes. Settings expose four atomic presets while retaining existing full/body skeleton values for old consumers. Camera reports owned hand model availability; import returns it with completion.

- [ ] RED schema1 migration/preserved original provenance, invalid profile combinations, header mismatch, upper calibration/framing without legs, preset count/locking and actual hand unavailable metadata.
- [ ] Implement parsers/migration and four presets; propagate region through camera, import and evaluation; use selected take provenance in review/export. Fixed wire passes unchanged through server/Blender/Unity.
- [ ] Full Web/types and controlled browser upper record/checkpoint/reload/import/legacy sample/locked presets; server non-slow validation as relevant. Commit/task-done. Expected all tests pass and old fixture bytes retained.

### Task 3: Unity override-mask example

**Files:** new Editor mask factory/menu and tests/metadata, package documentation; existing whole-body sample unchanged. Update test asmdef references only if required; no production dependency additions.

**Interfaces:** create independent AvatarMask assets with unique paths, no overwrite/controller mutation. Default arms/head/fingers-only excludes Root/Body/legs/IK to preserve base torso/pelvis. Optional torso mask includes Humanoid Body, explicitly documents body/hips coupling; Root/legs/IK remain disabled. Use Override layer, not additive; explain weight0/1 and base locomotion setup.

- [ ] RED actual Unity Editor tests for masks/flags and existing asset/controller preservation; implement factory/menu and documented example. Expected mask choices accurately named; no false promise torso-inclusive Humanoid Body independently excludes hips.
- [ ] Run only owned isolated Unity Editor tests with cached pinned dependencies, preserve XML/logs and existing projects; C# domain review on changed C# as part of final qualification. Expected actual compilation/tests pass or clearly record unavailable qualification; do not claim physical gait test.

### Task 4: Qualification, focused cleanup and profiling

**Files:** graph-proven unused UI only; private stage/replay receipts; docs increment report.

- [ ] Inspect actual import graph before removing unused RecordPanel/review-only chain; retain shared playback/TimeField/server compatibility. Expected no dangling imports, same main workflow.
- [ ] Complete full Web/types/assets/security/build/browser profile cases; unchanged wire server tests and targeted synthetic export/Unity checks. Record solver/recorder stage costs and original limits, no camera FPS/human precision claim. No worker unless actual measurements justify it.
- [ ] Fresh whole-increment TypeScript review and scoped C# domain review; material one-pass RED/GREEN fixes, ledger all minors/rulings. Source scan, update draftPR11/CI under existing authorization. Expected all available automated gates green; no main merge/tag/binary.

## Self-review

Task2 consumes Task1 profile and region-specific reference/continuity. Task3 consumes existing valid Humanoid FBX, not a new wire shape. Task4 integrates all; archive migration coordinated across header/document. Default Unity arms/head mask deliberately leaves captured torso unused to preserve locomotion pelvis; optional Body-inclusive variant exposes the wider mask's real scope. This is a documented example choice, not a change to upper-body capture's torso output.
