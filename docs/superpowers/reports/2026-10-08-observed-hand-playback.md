# Observed hand motion through packaged FBX and Unity

The 127-frame CC0 BIM motion from the [dynamic-hand pilot](2026-10-08-dynamic-hands.md) now passes the actual Windows candidate's job API, independent Blender reimport and two-rig production Unity playback. The source frames are unchanged. Runtime finger articulation is observed; physical tracking/finger accuracy, anatomical hand labels and release acceptance remain unqualified.

## Lineage and actual export

| Item | Source / identity |
|---|---|
| Qualification worktree | Clean `6c936edab38ad164badecbade33ea28a585bdf31` |
| Existing Windows candidate | `8a9261eae77d704f82fd01af62c862a5dd3ae525`; manifest SHA256 `8632467284bf2688608c974e89c3b897176e3ab9fc92087a1935a273d78a24b7` |
| Inference and final motion | `3299e7df29773e5cfd6c17bf9609c8ad3ba91619`; original SDK inference retained, not rerun |
| Licensed source | PeaceSeekers, [BIM sains.webm](https://commons.wikimedia.org/wiki/File:BIM_sains.webm), CC0 1.0; input SHA256 `6e026bb518eeaee5e6730c03dad429463bec3610bc05c6b4223d878e1699e64e` |
| Retained raw collection SHA256 | `d92c79a26a3eb6a84d3cb7f5b455559bf093046ccf59b0f6d822e696062186a9` |
| Production-validated job SHA256 | `c3fcaf9ecaae7d58819caa81028a235bef26977e1483458de3256b5c182eb87a`; all 24,892 motion numbers retained |
| Actual packaged job | `e15a50f9-05a5-477b-8159-9e3409a512f8`, succeeded, progress 100%; stored input digest `64cd0b29af219f70d6115093ddbab7a236cd1d9055234c173ac5759b2243d715` |
| Downloaded `Public_Hands_Pilot.fbx` | 733,004 bytes; SHA256 `36b33aeb7b82f812283297f95d25333122c210e1eab32620cc75df07912b8a6d` |

The existing candidate is reused; there is no new ZIP or UPM build. Its exporter bytes match current source. The actual bundled interpreter starts in isolated mode with a System32-only PATH and a poisoned PYTHONPATH. The job is submitted and polled through the real local API, and the FBX is downloaded through its advertised file URL. The service is deliberately closed after completion.

The actual generated sidecar is byte-copied from this completed job's output and verified against its advertised job identity. It contains `name`, `loop` and `fps`; it is not a newly invented metadata file or an API-download claim. A first diagnostic wrongly expected `version`/`skeleton` fields and failed before Unity launched. That partial preparation workspace is retained; the corrected attempt uses a fresh v2 workspace.

Independent Blender 4.5.14 reimport checks all **52 bones and 127 timestamps**. Duration is **4.2s**, duplicate raw FBX time keys **0**, maximum measured angular difference **0°**, maximum position difference **1.509069×10⁻⁶m** (about **0.001509mm**). This measures preservation of the estimated source pose, not its accuracy against the person.

## Actual production-player observations

Unity **6000.5.9f1** imports the FBX as a valid Humanoid clip and uses the production-created `EmoteCapClipPlayer` graphs. The test manually evaluates all 127 source times on Standard and Tall rigs at root angles 0° and 37°: **508 rig poses**. One actual PlayMode case passes with zero failures/skips, and six synchronized graphics captures show both characters and changing geometry. Frozen package, prepared original rig receipts and all 250 consumed input files are checked before/after execution.

Every sampled pose records 30 finite local finger quaternions, giving **15,240 quaternion samples**. The runtime test confirms at least one changing articulated joint per hand on each rig/angle; it does not claim an accuracy threshold for every finger. Local rotations measure movement relative to each joint's parent, so global wrist/body movement alone cannot satisfy this observation.

The subsequent analysis restricts comparisons to the source attempts where that side was actually assigned. It uses the first assigned frame as the baseline, excluding unassigned initial rest poses:

| Assigned side | Input frames per rig/angle | First assigned time | Maximum local-joint variation from that baseline |
|---|---|---|---|
| Left | 120 | 0.233333s | about 85.5372° |
| Right | 102 | 0.833333s | about 48.1242° |

Both rigs and root angles yield those maxima within floating-point rounding. They prove changing local finger joints on assigned input frames; they do not quantify physical flexion error or establish that every joint matches the actor.

## Review, decisions and limits

Independent Python wrapper review, C# diagnostic review and the separate new post-run analysis review each report **0 Critical, Important or Minor findings**, without rerunning inference, Blender or Unity. The C# reviewer independently checks every quaternion sample and recomputes the runtime maxima within 0.0001°. Analysis review confirms sign-invariant shortest quaternion differences, side ordering and assigned-frame baselines. Numeric PID absence is supplemental; the owned-process terminal receipts establish cleanup.

Executor rulings on declined review judgments:

1. Physical camera, finger fidelity, pose/proportion and segment stability remain unqualified because no physical reference comparison is present. Cost: those M4 acceptance checks remain open.
2. Whole-character images and local quaternion changes qualify observed runtime articulation only. Cost: finger-level visual correctness and mesh deformation still need inspection against a reference.
3. Manually sampled production graphs qualify time coverage, not real-time cadence, latency or autonomous playback progression. Cost: those performance behaviors remain separate tests.
4. Source rights and upstream tracking/export correctness retain their existing, separately attributed evidence. This new test does not broaden rights approval or make anatomical labels ground truth. Cost: upstream/public-distribution gates remain open.
5. Unchanged receiver/importer/player behavior is not re-reviewed; current frozen source and actual new-input execution supply the requested incremental coverage. Cost: earlier qualifications remain limited to their original cases.

Additional rulings: retain the failed preparation (local storage cost); use actual generated sidecar bytes after service teardown (sidecar HTTP delivery is not newly tested); reuse the existing candidate and inference (no fresh installer or camera-performance claim); keep derived animation/screenshots local (raw audit requires local access). No deferred minors.

All three owned driver PIDs are terminal and independently absent: service 14012, Blender probe 44264 and Unity 46600. Port 64250 is released. The service's exit code 1 records deliberate teardown; Blender and Unity exit 0. No unrelated process is stopped.

Local wrapper/export/analysis evidence: `.superpowers/sdd/2026-10-08-observed-hand-delivery-6c936ed/`. Actual Unity project, XML, six captures, frozen package/inputs and terminal receipts: `.superpowers/sdd/2026-10-08-unity-quality/observed-hands-6c936ed-v2/`. The failed v1 preparation remains separate.

This closes the missing observed-hand **pipeline observation**, not the whole M4/M5 milestones. Cropped legs, original tracking labels, ground-truth motion/finger quality, camera/calibration, target-laptop Fast 720p, second clean machine, five independent new users, complete rights and formal-release approval remain pending.
