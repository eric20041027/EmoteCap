# M4 real Blender export qualification

Date2026-10-07; plan base394d086. [Spec](../specs/2026-10-07-blender-quality-design.md), [plan](../plans/2026-10-07-blender-quality.md). Native/full M1–M5 remains active. This is actual Blender evidence; Unity editor/two rigs, physical videos/laptop and release gates remain pending.

## Runtime and corrections

Official Windows portableBlender4.5.14LTS, build62c1db4208e8. Archive398661046bytes/SHA256b9533d2397ac1984db4466fb23a7a4649391cca93f6e84209f9bcc60d071c8b9 verified against the [official distribution](https://download.blender.org/release/Blender4.5/). Developer-only ignored cache, no system-wide installation or product bundling.

Existing full/body real smoke2/2passed. Independent reimport probes then demonstrated4/7failures: a1.7second irregular motion exported as0.0666667seconds, and animated full/body bind skeleton offsets of0.0332449/0.0282711meters with about3degree pose error. A posed-first-frame case additionally failed with0.898026meter bind displacement. Static Tpose/single-frame cases already passed. These are synthetic contract fixtures, not physical tracking-quality measurements.

Keys now use actual `t*fps`, scene end covers ceil(lastTime*fps). An excluded frame-1rest key restores true Tpose while FBX writes static model transforms, even when clip t=0 is already posed. Scene baking still starts0; no rest preroll extends exported duration. The installed official FBX code confirmed model transforms use current pose and armature-only output has no mesh bindpose override. No tolerance, bone contract, source fixture, sidecar/progress behavior or original take was weakened/changed.

## Measurements and verification

The initial10real cases passed, but the final review demonstrated that they omitted subframe fast motion and relied on imported rest rotations. That initial snapshot does not establish the final acceptance below.

After the single correction pass, **18actual Blender cases pass without skips**:14valid roundtrips,2original smoke cases,1altered-head negative control and1explicit precision-loss rejection. All235original samples in the valid roundtrips are assessed. Full/body52/22bones, Tpose/right-arm, posed start, moving fingers/sign-equivalent quaternions, irregular/subframe/fractional/single-frame timelines and FPS1/120boundaries retain the unchanged0.5degree/1mmtolerances. Maximum reported angular and bind-rotation error0degrees at Blender float precision; position error3.2924e-5meters, bind position2.8359e-7meters, bind scale2.3842e-7. All duration errors stay within one respective output frame. The independent expected rest transforms use only canonical head/tail data plus zero roll, with exact hierarchy/name validation; they never use imported rest rotations as the reference.

Final whole backend **571pass**, including all18actual Blender cases, no deselection/skip,32.51seconds. WholeWeb458/47files,8Node asset/security, types,3modelSHA and181module build were previously qualified and are unchanged by this correction; the browser bundle retains its19Edge qualification. Existing Starlette/httpx and bundle/shadow warnings remain.

A full-runtime integration run exposed an existing Windows early-timer classification boundary:553passed/1failed; no stale frame was sent, but lifetime timeout could close1011rather than1008. The deterministic early-clock test failed before correction. A selected lifetime-budget timeout now always has expiry semantics, with ordinary receiver-stall handling retained. This minimal integration change is included in this plan's fresh final review range; the earlier relay plan is not re-reviewed.

Unique UUID result artifacts in this plan scratch include input/FBX/contract/exporter SHA and measurements; no overwritten snapshot/private recording. The final14valid roundtrip FBX, synthetic inputs and canonical contract copies were also retained from the completed571run in `review-qualified`, with an exclusive summary. The optional qualification environment path was empty in that run; controlled artifacts were collected from its owned pytest output afterwards, not inferred from the older receipts. Original fixture hashes remain:

- tpose:fac6e37e8baa5ea37c10a82e4bc15ec89c96bec9da82ceed793de71b68b15b15
- raise-right-arm:79d5f1effc471d704c8ea6130e914324fd4b49330d4f58189438a5eca1d94837

Native task-done passed555tests at a19a4d8. The one fresh Python reviewer assessed bbe008e..a19a4d8 and independently ran20focused tests. Three Important findings entered one TDD correction pass: lost subframe poses, a self-referential orientation oracle and optional-skip behavior in mandatory qualification. The first two had actual Blender RED counterexamples; the missing-runtime test explicitly converted the incorrect skip into a watched failure. Nonfinite-geometry regressions also failed before validation. Final571/571is green; no second review is dispatched. **Accepted locally after that correction pass.** No public push/main merge/tag/release for this increment.

The exporter supplies the existing official FBX baker with the bounded union of regular output frames and exact source sample times (maximum43202), rather than selecting a step from the smallest source gap. Only the add-on's local NumPy binding is adapted during one owned export, restored in finally, and its expected sampling call must occur exactly once. Actual key-count validation rejects source times Blender has merged; the tiny-gap counterexample previously exported silently and now fails with a clear error. Required qualification fails on unavailable Blender; deterministic nonzero/timeout/missing/malformed/nonfinite probe cases cannot count as success.

## Rulings made

1. Continue independent Blender while Unity license is pending; unavailable editor is neither test RED nor PASS. Cost if wrong: Unity/M3 remains incomplete.
2. Fold real harness/correction into one green Native task. Cost if wrong: one review covers the complete export deliverable.
3. Use official verified portable developer cache. Cost if wrong:400MBarchive/expanded files remain and tool notices enter inventory.
4. Preserve earlier rejected scratch. Cost if wrong: local ignored diagnostics remain.
5. Add excluded rest key at-1, bake starts0. Cost if wrong: internal preroll must not leak into duration; real posed/single/irregular cases check it.
6. Use actualt*fps/endceil. Cost if wrong: fractional endpoints extend at most one output frame, explicitly bounded.
7. Persist unique UUID qualification with provenance hashes. Cost if wrong: ignored evidence accumulates, no overwrite/private media.
8. Include minimal early-timer integration correction in the fresh qualification review. Cost if wrong: lifetime-budget close can happen slightly early by Windows clock resolution, never ordinary reconnect.
9. Use a temporary adapter for the official FBX sampling grid, without vendoring the exporter or changing global NumPy. Cost if wrong: a different add-on implementation fails explicitly and needs its own qualification; only4.5.14is currently qualified.
10. Derive canonical zero-roll rest bases with Blender's public Bone.MatrixFromAxisRoll primitive, independently of the imported skeleton. Cost if wrong: an unsupported primitive or basis change fails the actual negative control and geometry gate.
11. Reject inputs whose rotation keys Blender merges instead of exporting altered motion. Cost if wrong: an otherwise contract-valid extremely dense take cannot export in that Blender version; immutable input remains available and the job reports failure.
12. Retain final synthetic FBX/input/contract copies together with unique hash receipts; earlier hash-only receipts remain historical. Cost if wrong: ignored disk use grows, but no private video or overwritten evidence is introduced.
13. Declined interpolation choice: preserve existing Blender interpolation between source samples; this gate proves source-time fidelity, not a preferred interpolation model or tracking improvement. Cost if wrong: between-sample motion needs a later measured resampling decision.
14. Declined separate gates: keep Unity/two-rig, physical video/laptop, licensing, clean-machine and release acceptance pending. Cost if wrong: release cannot be called complete from Blender evidence alone.

Deferred minors:none. All three declined areas have the explicit retention/interpolation/separate-gate rulings above. Blender results do not establish Unity/rig playback, authorized physical tracking/video/laptop performance, clean-machine/user study, contributor/model rights or publication readiness.
