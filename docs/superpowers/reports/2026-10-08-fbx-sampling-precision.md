# FBX sampling precision and Foot IK diagnosis

Corrected product source: clean `71e159b0dd43c49d3ab7501c7d3059d49e1923aa`. This fixes an observed export timeline defect; physical capture, finger accuracy and full release acceptance remain pending.

## User-visible defect and correction

Source timestamps generated as `index / 30` can nearly coincide with regular integer bake frames. The previous union kept both double-precision values even though Blender FCurve frame coordinates use single precision. The real 126-frame regression produced 2,385 duplicate FBX time keys. Blender reimport emitted an invalid-value warning and shortened the action to frames 1..32 (approximately 1 second) despite raw FBX timing extending to 4.2 seconds. Counting requested samples beyond this imported range was invalid evidence.

The corrected adapter deduplicates bake coordinates in native float32 frame precision, then exposes the sorted float64 sampling array. Source clip frames, solving, original key insertion, geometry limits and existing close-source rejection are unchanged. No dependency or contract change was made.

Watched regression: **FAIL, 2,385 duplicate keys → PASS, zero duplicates/full duration/all 126 original poses**. Actual affected Blender suites pass **27 tests, zero skips**, including fractional/fast source changes, fingers, single-frame clips, body/full skeletons, fps 1/120 and too-close source rejection. Fast local backend passes **946, one platform skip, 19 slow deselected**; existing Starlette deprecation warning remains.

## Corrected observed-person export

The exact previously retained 126-frame real-person job (SHA256 `aff52507d24f7ad83dc2f2d178d128ffce65cc88d3e2793a8912b944e944e963`) was exported by the corrected production script, with a separately executed actual Blender roundtrip probe:

- FBX: 759,388 bytes, SHA256 `a9cd38cdecc261e7af9448a58a7f96f80de59173350f809a4d85a4a5f9091ced`.
- Zero duplicate raw time keys, actual reimport action 1..127 at 30fps; all 126 mapped timestamps inside the action. Duration 4.2s, one 30Hz output frame beyond source end 4.166666666666667s.
- Independent canonical pose comparison across all original samples: maximum measured angular difference 0 degrees, maximum position difference 0.000002044013524m (approximately 0.002044mm). This measures export preservation against the supplied motion, not the person's anatomical ground truth.
- Reimported non-root bone distances varied at most 0.000000481053086m. No importer invalid-value warning appeared in this corrected run.
- All three actual owned Blender stages exited 0 with terminal process trees. Frozen consumed exporter/probe/contract copies matched the recorded repository snapshot after execution.
- The new FBX passed the established focused actual Unity production-player test: Standard/Tall, root angles 0/37, all 126 timestamps (504 rig poses), six synchronized rendered images with changing colored geometry, zero failed/skipped cases. This is manual sampling of the player's graph, not live throughput or camera qualification.

Local immutable evidence: `.superpowers/sdd/2026-10-08-unity-quality/fixed-observed-71e159b/` and `fixed-observed-unity-71e159b/`. Earlier FBX, timeline warnings and invalid comparison outputs are retained and excluded from corrected evidence. Raw source media/animation binaries are not published.

## Foot IK cause bounded to the observed pilot

Before the export fix, a separate actual Unity control at clean `2e58786` used eight fresh rig conditions: Standard/Tall × root angles 0/37 × Foot IK on/off. It asserted the production default was on, then varied only that flag. Every condition sampled all 126 timestamps on the same old FBX; no production setting was changed.

Foot IK on reproduced the earlier approximately 11.784mm maximum variation from the first animated pose. Variation from the bind pose reached 15.78664mm. Foot IK off reduced maximum variation from the first pose to 0.000328mm, and from bind pose to 0.000366mm. Both avatars report arm/leg stretch 0.05. [Unity's legStretch documentation](https://docs.unity3d.com/6000.0/Documentation/ScriptReference/HumanDescription-legStretch.html) describes IK translating knee/ankle transforms and the default 5% stretch allowance. The controlled result supports Foot IK's effect for this clip and these two rigs; it does not prove desirable foot contacts or justify changing the production default.

That control passed one focused PlayMode case with zero failures/skips. Its original Blender comparison was withdrawn: imported action 1..32 did not cover the 126 requested frame coordinates. The corrected diagnostic guard records actual imported fps/frame mapping and rejects uncovered timestamps; actual unchanged old FBX runs then exit 1 rather than emitting a qualified comparison. The Unity control remains separately valid. One fresh harness review found this Important coverage issue; the single correction pass rejects it. No Minor findings were deferred.

## Decision boundary

Ruling: quantize only the bake union to the already-used native frame precision; keep lost-source detection and all geometry/timing tolerances. Cost if wrong: a representable fast pose could be dropped, which is why the actual fast/fractional/fps/close-source cases remain mandatory.

Ruling: retain the Foot IK production default while reporting its measured effect; constant segment tests and contact/pose-quality acceptance are distinct. Cost if wrong: the default may still produce undesirable stretching/contact on a real motion case, which remains a required M4 annotated-quality check.

Ruling: withdraw the incomplete old Blender comparison instead of rescaling its shortened action to fit. Cost if wrong: valid original evidence would need to be recovered through a verified time mapping; the corrected actual export now supplies complete coverage.
