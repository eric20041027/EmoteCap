# M4 real Blender export qualification

Date2026-10-07; plan base394d086. [Spec](../specs/2026-10-07-blender-quality-design.md), [plan](../plans/2026-10-07-blender-quality.md). Native/full M1–M5 remains active. This is actual Blender evidence; Unity editor/two rigs, physical videos/laptop and release gates remain pending.

## Runtime and corrections

Official Windows portableBlender4.5.14LTS, build62c1db4208e8. Archive398661046bytes/SHA256b9533d2397ac1984db4466fb23a7a4649391cca93f6e84209f9bcc60d071c8b9 verified against the [official distribution](https://download.blender.org/release/Blender4.5/). Developer-only ignored cache, no system-wide installation or product bundling.

Existing full/body real smoke2/2passed. Independent reimport probes then demonstrated4/7failures: a1.7second irregular motion exported as0.0666667seconds, and animated full/body bind skeleton offsets of0.0332449/0.0282711meters with about3degree pose error. A posed-first-frame case additionally failed with0.898026meter bind displacement. Static Tpose/single-frame cases already passed. These are synthetic contract fixtures, not physical tracking-quality measurements.

Keys now use actual `t*fps`, scene end covers ceil(lastTime*fps). An excluded frame-1rest key restores true Tpose while FBX writes static model transforms, even when clip t=0 is already posed. Scene baking still starts0; no rest preroll extends exported duration. The installed official FBX code confirmed model transforms use current pose and armature-only output has no mesh bindpose override. No tolerance, bone contract, source fixture, sidecar/progress behavior or original take was weakened/changed.

## Measurements and verification

Eight roundtrip cases plus two original smoke cases **10/10pass without skips**. Full/body52/22bones, Tpose/right-arm, irregular1.7, fractional1.7152, singleframe and posed start all pass independent0.5degree/1mmtolerances. At first/middle/last source samples: maximum reported angular error0degrees at Blender float precision, position error1.5152e-6meters, bind error2.8359e-7meters. Right hand rises while left hand stays level and head remains above hips. Duration errors0..0.033300seconds, within one30FPS output frame; irregular1.7exports1.7, fractional1.7152exports1.7333333.

Whole backend **555pass**, including all10actual Blender cases, no deselection/skip. WholeWeb458/47files,8Node asset/security, types,3modelSHA and181module build pass. Existing Starlette/httpx and bundle/shadow warnings remain; unchanged browser bundle retains its19Edge qualification.

A full-runtime integration run exposed an existing Windows early-timer classification boundary:553passed/1failed; no stale frame was sent, but lifetime timeout could close1011rather than1008. The deterministic early-clock test failed before correction. A selected lifetime-budget timeout now always has expiry semantics, with ordinary receiver-stall handling retained. This minimal integration change is included in this plan's fresh final review range; the earlier relay plan is not re-reviewed.

Unique UUID result artifacts in this plan scratch include input/FBX/contract/exporter SHA and measurements; no overwritten snapshot/private recording. Qualification summary is retained locally. Original fixture hashes remain:

- tpose:fac6e37e8baa5ea37c10a82e4bc15ec89c96bec9da82ceed793de71b68b15b15
- raise-right-arm:79d5f1effc471d704c8ea6130e914324fd4b49330d4f58189438a5eca1d94837

Native task-done and one fresh final Python review remain pending before acceptance. No public push/main merge/tag/release for this increment.

## Rulings made

1. Continue independent Blender while Unity license is pending; unavailable editor is neither test RED nor PASS. Cost if wrong: Unity/M3 remains incomplete.
2. Fold real harness/correction into one green Native task. Cost if wrong: one review covers the complete export deliverable.
3. Use official verified portable developer cache. Cost if wrong:400MBarchive/expanded files remain and tool notices enter inventory.
4. Preserve earlier rejected scratch. Cost if wrong: local ignored diagnostics remain.
5. Add excluded rest key at-1, bake starts0. Cost if wrong: internal preroll must not leak into duration; real posed/single/irregular cases check it.
6. Use actualt*fps/endceil. Cost if wrong: fractional endpoints extend at most one output frame, explicitly bounded.
7. Persist unique UUID qualification with provenance hashes. Cost if wrong: ignored evidence accumulates, no overwrite/private media.
8. Include minimal early-timer integration correction in the fresh qualification review. Cost if wrong: lifetime-budget close can happen slightly early by Windows clock resolution, never ordinary reconnect.

Deferred minors:none before review. Blender results do not establish Unity/rig playback, authorized physical tracking/video/laptop performance, clean-machine/user study, contributor/model rights or publication readiness.
