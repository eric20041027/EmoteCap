# Observed Retargeting Investigation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quantify whether the genuine returned907-frame take survives FBX and Unity Humanoid playback on both original rigs, and identify the next required M4 repair from evidence.

**Architecture:** Existing independent Blender oracle checks the unchanged returned binary against explicitly separated raw/processed phases. A private source-bound Unity test compares production clip-player output with target bind-shape canonical FK/world-delta expectations, validated by direct application and frozen negative controls. Reconstructed processed input is not called authenticated when its job digest differs. This investigation does not modify production pose/export code.

**Tech Stack:** Python3.12.14, Blender4.5.14, Unity6000.5.9f1, Test Framework1.7.0, Newtonsoft3.2.2, current UPM0.2.0.

**Spec:** docs/superpowers/specs/2026-10-09-observed-retargeting.md

## Global Constraints

- Exact907frames/26.0928seconds and original FBX/sidecar; no cropping/retiming or public motion disclosure.
- Preserve48driven bones/192values/52exported bones, all fixtures/production code/dependencies/licenses.
- Actual two Humanoid rigs, two root angles and every source time; no image/mock proxy for pose evaluation.
- Distinguish source pose preservation, target Humanoid conversion and unmeasured human accuracy.
- Owned fresh outputs/processes only; all previous results retained; no gate silently waived.

## Review Focus

- Unmapped shoulders/toes inherit the proper parent delta; reference uses actual target bind geometry.
- Root-angle rotation and Unity handedness conversion must not manufacture direction mismatch.
- Production player lifecycle/smoothing/grounding must not contaminate the named unsmoothed comparison.
- Frozen/missing/partial outputs must fail controls/coverage; no successful-exit-only qualification.
- Source identity, frame order, sample count and all907timestamps must survive preparation/evaluation.

---

### Task 1: Run source-bound artifact and two-rig pose comparison

**Files:** Read unchanged `server/tests/blender_roundtrip.py`, `contracts/bones.json`, Unity sample builder/player/runtime contract. Create private clip/probes/runner/receipts under `.superpowers/sdd/2026-10-09-observed-retargeting/`. Create aggregate report `docs/superpowers/reports/2026-10-09-observed-retargeting.md` and update current progress after validated results; no private motion or probe-generated asset committed.

**Interfaces:** Consumes returned private `.emotecap` and FBX/sidecar, frozen current UPM and actual installed runtimes. Produces independent907-sample Blender receipt and8×907Unity pose-comparison rows (two rigs/two angles/two explicit Foot IK modes), controls and explicit limitations.

- [x] **Step 1: Prepare exact inputs.** Decode project.json from the actual personal-before-reload.emotecap, copy the sole take's frames unchanged into a full/30fps/loop=false clip with the actual sidecar name. Validate using existing Clip schema and assert parsed frames equal the archive's907original frames. Hash archive/clip/FBX/sidecar/contract/probe/package; private paths stay out of public report.
- [x] **Step 2: Run existing independent Blender probe.**

```text
blender.exe -b --factory-startup --python-exit-code 1 -P server/tests/blender_roundtrip.py -- --fbx <unchanged-returned-FBX> --bones contracts/bones.json --clip <exact-private-clip> --result <new-private-receipt>
```

Validate reference timestamps,52bones and finite results, zero duplicate keys, duration error<=1/30second. Raw907-frame versus processed FBX is a processing-phase comparison, not a source-preservation gate. Reconstruct makeClip through unchanged trusted modules and compare the candidate's783samples separately; existing source-pose tolerance is0.5degrees/0.001m. Preserve both and require actual job input/digest to authenticate the final fidelity claim. Do not require head above hips for this unlabeled bent actor.
- [x] **Step 3: Prepare real Unity comparison and controls.** Freeze package, create fresh test project, generate original rigs through actual builder, place returned FBX/sidecar under Assets/EmoteCap and private fixture/contract next to it. For each rig/angle capture bind heads/rotations before playing. Compute world delta/reference as:

```csharp
var source = new Quaternion(x, -y, -z, w); // authoritative Unity convention reflects canonical X
var deltaWorld = rootRotation * source * Quaternion.Inverse(rootRotation);
var expectedRotation = deltaWorld * restRotation;
var expectedHead = parent == null ? scaledSourceHips : expectedHeads[parent] + parentDeltaWorld * restOffset;
```

Use canonical parent-first52bone names; unmapped bones inherit parent delta. Directly apply the48driven rotations/hips to a separate original rig and require agreement<=0.1degree/0.001m; frozen reference must yield observable angular/position error on the varied source. Controls must run before accepting comparison output.
- [x] **Step 4: Run actual production player at every source time.** Use its own graph in manual mode, preserving default Foot IK=true as primary. Add an explicitly diagnostic Foot IK=false mode without changing source/asset/import settings. Verify selected real clip/source name; exact coverage is8runs×907=7256poses and48driven joint comparisons per pose. Evaluate raw-take and interpolated reconstructed-processed references at the same907timestamps, including candidate endpoint hold; report them separately and keep input-digest gap explicit. Record source times, max/worst/per-bone angular/head-position errors, segment-length variation, root movement and actual imported duration. No fabricated PASS for the Humanoid metrics; store distributions for review.
- [x] **Step 5: Verify final coverage, source fingerprints and terminal processes.** Source times and identity/count must match exactly. Preserve warnings and failure receipts. Use current delta/reference versus frozen controls to determine whether a pose defect is real; no curve/DOF patch in this diagnostic task.
- [x] **Step 6: Commit only aggregate documentation and perform one fresh Native review.** Review the private math/probes/controls plus public report/spec/plan. Re-grade findings; one correction pass with rerun of affected actual diagnostics if required. Existing public branch/draft PR authorization applies only to reviewed aggregate/code; do not expose private actor files. Whole M1–M5 goal remains active unless every independent release gate is proven.
