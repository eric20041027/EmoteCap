# Real Blender Qualification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove real FBX direction/scale/timing and fix any demonstrated timestamp compression.

**Architecture:** Existing exporter produces fixture FBX; a separate Blender reimport probe measures evaluated bones/time against the canonical contract. Slow pytest assertions own output/runtime provenance, while fast tests preserve other product behavior.

**Tech Stack:** Official pinnedBlender4.5.14, Python3.12.14/pytest, current Blender exporter; no package changes.

**Spec:** `docs/superpowers/specs/2026-10-07-blender-quality-design.md`.

## Global Constraints

- Motionv2/48driven/192rotations/full52/body22, existing root/quaternion/rest transforms and sidecars unchanged.
- Real full/body smoke must run. Roundtrip tolerance0.5degree/1mm and duration<=one output frame; preserve valid irregular timestamps.
- Official archive hash/size verified before executable use; owned120second processes, synthetic fixtures, temporary outputs only.
- No Unity/camera/provider/two-rig/laptop claim, publication, unrelated process termination or scratch deletion.
- Authorized Native inline, one fresh most-capable Python final reviewer; one Important/Critical TDD fix pass/no re-review.

## Review Focus

1. Irregular/single-frame/fractional-end timelines must retain actual time without compression or unbounded baking.
2. FBX axis/unit conversion and rest rotations must keep the right arm/head orientation and meter scale after reimport.
3. Full/body paths and quaternion signs must preserve the same accepted motion without losing finger/body hierarchy.
4. Probe/Blender failures must fail qualification with bounded diagnostics, never become a skipped or false pass.
5. Fixture/export/source provenance must remain inspectable without private video, overwritten outputs or changed original frames.

### Task 1: Real roundtrip qualification and timestamp correction

**Files:** Create `server/tests/blender_roundtrip.py`, `test_blender_quality.py`; extend `test_blender_export.py`; modify `server/blender/export_fbx.py` and relevant fast tests; create report/update release-progress/contract.
**Interfaces:** Existing `run_export(clips,tmp_path)->Path` remains. `blender_roundtrip.py --fbx --bones --clip --result` imports FBX with explicit sceneFPS/zero anim offset, evaluates original sample times, emits bounded JSON `{durationSeconds,bones,samples}`. Samples contain measured world hips/head/arm positions and rotation error against independent canonical conversion. Python helper owns subprocess timeout/returncode and JSON validation; no exporter implementation imported into the expected-value calculation.

- [ ] Step1: Verify downloaded tool/record runtime, run the two existing slow smoke cases with explicit BLENDER_PATH. Expected2pass/no skip; tool absence is a prerequisite failure, not RED.
- [ ] Step2: Write timing/direction/scale RED including T-pose/full/body/raise-right-arm, valid irregular t=[0,.4,1.7]at30FPS, fractional endpoint and one-frame clip.

```python
def test_irregular_timeline_retains_duration(tmp_path):
    clip=irregular_fixture([0,.4,1.7]);result=roundtrip(clip,tmp_path)
    assert abs(result['durationSeconds']-1.7)<=1/30
```

`irregular_fixture(times)` copies canonical synthetic poses under a new ASCII clip name without modifying shared files. `roundtrip(clip,tmp)` calls real export+probe and rejects missing/failed/nonfinite results. Run `uv run --directory server --frozen --python 3.12.14 pytest tests/test_blender_quality.py -q` with explicit pinned path. Expected demonstrated timing failure inspected; other measured assertions characterize actual behavior.
- [ ] Step3: Record the watched RED and inspect source; keep harness and correction in the same independently green task, with no failing completion commit.

#### Minimal correction and qualification receipt

**Files:** Modify `server/blender/export_fbx.py`, relevant fast exporter tests, quality fixtures/probe if a measured implementation mismatch requires it; update report/release-progress/contract.
**Interfaces:** Keys use `frame.t*clip.fps`; scene frame_end covers ceil(lastTime*fps), startingzero, bounded180seconds/120FPS by accepted input. Preserve original pose solving, bone/sidecar/progress behavior. `roundtrip` output assertions from Task1 are binding; do not loosen accuracy to make them green.

- [ ] Step4: Watch focused fast/real timing RED before correction; inspect actual exporter source/cause.
- [ ] Step5: Apply minimal timestamp change, with actual helper signature adjusted from frame count to duration where needed.

```python
key_time=frame['t']*clip['fps']
pose_bone.keyframe_insert('rotation_quaternion',frame=key_time)
scene.frame_end=math.ceil(clip['frames'][-1]['t']*clip['fps'])
```

- [ ] Step6: Full fast backend+whole slow Blender suite, full Web/types/assets/build for unchanged contract consumers. Expected all pass/no Blender skip and original fixture hashes unchanged. Record runtime/input/output/sourceSHA and direction/scale/time measurements, pending Unity/hardware gates and all rulings. Commit `fix: preserve motion timestamps in real FBX export`; task-done runs whole backend with configured actual Blender. Assemble fixed range/fresh Python review; one correction pass/no re-review; continue Unity when licensed and M5 independently.
