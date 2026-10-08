# FBX Sampling Precision Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve the full animation timeline when normal `index / fps` source timestamps nearly coincide with regular Blender bake frames.

**Architecture:** Keep canonical solving and source key insertion unchanged. Deduplicate the source/regular bake union in Blender's native single-precision frame coordinates, then supply a sorted double-precision sampling array to the existing bounded adapter. Independently inspect raw FBX key times and actual reimport duration/geometry.

**Tech Stack:** Python 3.12.14, Blender 4.5.14, bundled NumPy, actual FBX exporter/importer, pytest.

**Spec:** `docs/superpowers/specs/2026-10-06-open-source-product-design.md`, M4 direction/proportion/timing and real failed-case reporting.

## Global Constraints

- Source contract v2, canonical solving and recorded clip frames stay unchanged.
- Timing error at most one output frame; keep existing geometry bounds (1mm position, 0.5 degrees rotation) and close-source rejection.
- Existing bounded 0..180s, 1..120fps and 43,202-sample adapter checks remain.
- Native execution is already authorized; this is a necessary M4 correction, with one fresh independent final review and one correction pass.
- A green regression does not qualify fingers, physical camera, laptop or independent new users.

## Review Focus

- Floating `i / fps` timestamps: no duplicate raw FBX time keys or shortened reimport animation.
- Fractional fast source changes: all original poses survive existing independent geometry checks.
- Supported fps extremes 1/120 and single-frame clips: preserve existing timing/hold behavior.
- Native single-precision source collisions: existing key-insertion check must reject lost source samples.
- NumPy adapter scope and budget: only the add-on's local binding changes and is restored, including exceptions.

### Task 1: Bake once per representable Blender frame

**Files:** Modify `server/blender/export_fbx.py`, `server/tests/blender_roundtrip.py`, `server/tests/test_blender_quality.py`; update release progress and add an attributed diagnostic report after execution.

**Interfaces:** Consume `_ScheduledNumpy(numpy, clip)` and actual `roundtrip(clip, tmp_path)`; produce unchanged FBX/sidecar names and probe field `duplicateKeyTimes: int`.

- [ ] Add independent raw-FBX probe before import:

```python
from io_scene_fbx import parse_fbx
tree, _ = parse_fbx.parse(args.fbx)
objects = next(elem for elem in tree.elems if elem.id == b'Objects')
duplicate_key_times = 0
for curve in objects.elems:
    if curve.id == b'AnimationCurve':
        times = next(elem.props[0] for elem in curve.elems if elem.id == b'KeyTime')
        duplicate_key_times += len(times) - len(set(times))
```

- [ ] Add a real regression using `irregular_fixture([index / 30 for index in range(126)])`; assert `duplicateKeyTimes == 0`, then the existing `assert_duration` and `assert_geometry` on all 126 samples. Run it before production edits with the actual Blender path; expected FAIL on duplicate times or shortened duration.

```python
@pytest.mark.slow
def test_real_fbx_float_frame_times_keep_unique_keys_and_full_animation(tmp_path):
    clip = irregular_fixture([index / 30 for index in range(126)])
    report = roundtrip(clip, tmp_path)
    assert report['duplicateKeyTimes'] == 0
    assert_duration(report, clip)
    assert_geometry(report, clip)
```

Run with the installed runtime: `$env:BLENDER_PATH=(Resolve-Path '.superpowers/tools/blender-4.5.14/blender-4.5.14-windows-x64/blender.exe').Path; server/.venv/Scripts/python.exe -m pytest server/tests/test_blender_quality.py::test_real_fbx_float_frame_times_keep_unique_keys_and_full_animation -q`.
- [ ] Replace only the bake-union construction:

```python
self.samples = numpy.unique(numpy.array(
    sorted(set(range(self.end + 1)).union(times)), dtype=numpy.float32,
)).astype(float)
```

- [ ] Run the watched regression to GREEN, then actual `tests/test_blender_quality.py tests/test_blender_export.py` with the installed Blender; expected zero failures/skips, all retained irregular/finger/fps/close-timestamp cases pass. Run the fast backend suite excluding slow cases.
- [ ] Export the pinned observed 126-frame job to a fresh folder; inspect duplicate-key count, actual full action coverage and all sampled bone lengths. Retain earlier invalid Blender receipt and exclude it from qualification. Compare Foot IK on/off only on this clip/these rigs; keep accuracy unqualified.
- [ ] Commit source/tests/plan/report changes, obtain one fresh independent review over base `2e58786` through the final commit, correct Critical/Important findings once with watched regression tests, then run affected checks. No repeated review or unrelated cleanup.
- [ ] Push the authorized branch; wait for all exact-head Windows/macOS/Linux push/PR CI jobs. Update the draft PR and requirement ledger with actual evidence, leaving full M1–M5 active while hardware/human/rights requirements remain.

Self-review: this plan covers the observed duplicate-time/export regression only. The complete M1–M5 objective and its pending gates remain in `docs/release-progress.md`; no replacement acceptance criteria are introduced.
