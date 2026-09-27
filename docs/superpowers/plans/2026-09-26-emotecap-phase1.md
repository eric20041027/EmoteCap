# EmoteCap Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Webcam motion capture whose recorded, trimmed clips export as Humanoid FBX and play on a Mixamo character in Unity — checkpoint **C2 at 01:00 EDT**.

**Architecture:** The browser runs MediaPipe Pose plus the TypeScript motion-core solver, which emits world-delta quaternions per `contracts/motion-v1.md`. A recorded, trimmed clip is POSTed to the FastAPI server, which runs Blender headless to write `<name>.fbx` + `<name>.emotecap.json`, optionally straight into the Unity project. The Unity package's AssetPostprocessor imports those files as in-place Humanoid clips.

**Tech Stack:** Vite 8, React 19, TypeScript, three.js 0.186, `@mediapipe/tasks-vision` 1.0.1 · Python ≥ 3.12, FastAPI, uv, pytest · Blender 5.1 (headless) · Unity 2021.3+ (C#)

**Execution model (decided 21:50):** everything runs on the lead Mac. Tracks S and W run in parallel as subagents; track M runs in the lead session; track U code is written by the lead session and verified by smallfire in Unity. **Subagents never run git** — the lead session reviews and commits each track. Spec: `docs/superpowers/specs/2026-09-26-emotecap-design.md`.

**Plan style note:** time-boxed hackathon plan. Tasks give exact files, interfaces, behaviors, and test cases; the implementer writes the code test-first. The two highest-risk pieces (Blender exporter, Unity importer) are already implemented and validated.

---

## Track S — Server (subagent)

Folder: `server/` only. Commands: `cd server && uv run pytest -q`.

### Task S1: Blender exporter — ✅ done 21:50

- File: `server/blender/export_fbx.py`
- Validated: fixture `Raise_Right_Arm` → FBX → re-imported in Blender. On the last frame `mixamorig:RightArm` points +Z (up), `LeftArm` is unchanged, heights are in meters. Export of two clips takes ~1.5 s.

### Task S2: Blender smoke test

**Files:** Create `server/tests/test_blender_export.py`

- [ ] Test runs `[settings.blender_path, "-b", "--factory-startup", "-P", "server/blender/export_fbx.py", "--", "--in", <job.json>, "--out", <tmp_path>, "--bones", "contracts/bones.json"]` with `cwd=REPO_ROOT`, where `<job.json>` is `{"clips": [<contracts/fixtures/raise-right-arm.clip.json>]}`.
- [ ] Assert `Raise_Right_Arm.fbx` exists and is > 10 KB; assert the sidecar equals `{"name": "Raise_Right_Arm", "loop": false, "fps": 30}`.
- [ ] `pytest.skip` when `shutil.which(settings.blender_path)` is None. Mark it `@pytest.mark.slow`; register the marker in `pyproject.toml`.
- [ ] Run `uv run pytest -q` → all pass.

### Task S3: Export service

**Files:** Create `server/emotecap_server/exporter.py`, `server/tests/test_exporter.py`

Interface:

```python
class ExportError(Exception):
    """Blender failed. `stderr_tail` holds the last 20 lines of combined stderr/stdout."""
    def __init__(self, message: str, stderr_tail: str = "") -> None: ...

def unique_names(names: list[str]) -> list[str]:
    """["A", "A", "B", "A"] -> ["A", "A_2", "B", "A_3"]; truncate the base so results stay <= 24 chars."""

def run_blender(settings: Settings, job_json: Path, out_dir: Path) -> None:
    """subprocess.run(..., capture_output=True, text=True, timeout=120, cwd=REPO_ROOT).
    Raise ExportError on non-zero exit, timeout, or missing Blender."""

def export_clips(clips: list[Clip], settings: Settings) -> list[ExportedFile]:
    ...
```

`export_clips` behavior:

1. Apply `unique_names` to the clip names (on copies — never mutate the input models).
2. Job dir `settings.data_dir / "jobs" / <uuid4 hex>`; write `clips.json` = `{"clips": [clip.model_dump() for ...]}`.
3. `run_blender(settings, job/"clips.json", job/"out")`.
4. Move every `<name>.fbx` and `<name>.emotecap.json` into `settings.data_dir / "exports"` (overwrite existing).
5. If `settings.unity_export_dir` is set: create it, copy the **sidecar first**, then the FBX via a temp name + `os.replace` (so Unity never imports a half-written FBX or an FBX without its sidecar).
6. Return `[ExportedFile(name=n, url=f"/files/{n}.fbx")]`.

Tests (monkeypatch `exporter.run_blender` with a fake that writes dummy `<name>.fbx` / `<name>.emotecap.json` into `out_dir`; build `Settings` with `tmp_path` dirs via `dataclasses.replace(load_settings(), ...)`):

- [ ] `unique_names` handles duplicates and the 24-char limit.
- [ ] `export_clips` puts both files in `data_dir/exports` and returns `/files/<name>.fbx` URLs.
- [ ] With `unity_export_dir` set, both files are copied there.
- [ ] A fake `run_blender` raising `ExportError` propagates unchanged.
- [ ] Real `run_blender` with `blender_path="/nonexistent"` raises `ExportError`.

### Task S4: HTTP endpoints

**Files:** Modify `server/emotecap_server/main.py`; create `server/tests/test_export_api.py`

- [ ] `POST /api/export` accepts `ExportRequest`, returns `ExportResponse`; `ExportError` → HTTP 500 with `detail = {"message": ..., "stderr": ...}`. Use a sync `def` endpoint (FastAPI runs it in a threadpool).
- [ ] Mount `StaticFiles` at `/files` → `settings.data_dir / "exports"` (create the dir at startup).
- [ ] Tests with a monkeypatched `export_clips`: valid fixture → 200 and URLs; clip name `"bad name!"` → 422; `ExportError` → 500 with `detail.stderr`.
- [ ] Manual acceptance (server running on 8787):

```bash
cd server && uv run uvicorn emotecap_server.main:app --port 8787 &
curl -s -X POST localhost:8787/api/export -H 'Content-Type: application/json' \
  -d "{\"clips\":[$(cat ../contracts/fixtures/raise-right-arm.clip.json)]}"
curl -sI localhost:8787/files/Raise_Right_Arm.fbx | head -1
```

Expected: `{"files":[{"name":"Raise_Right_Arm","url":"/files/Raise_Right_Arm.fbx"}]}` and `HTTP/1.1 200 OK`.

---

## Track W — Web app (subagent)

Folder: `web/` except `web/src/motion/` (motion-core is track M; import it only via `web/src/motion/index.ts`, whose current interim solver returns the T-pose — the signatures will not change). Commands: `cd web && npm run dev`, `npm test`, `npx tsc --noEmit`. UI text in English (judges read it).

### Task W1: MediaPipe assets served locally (venue Wi-Fi is unreliable)

**Files:** Create `web/scripts/fetch-mediapipe.mjs`; modify `web/package.json`, root `.gitignore`

- [ ] Script copies `node_modules/@mediapipe/tasks-vision/wasm/*` → `web/public/mediapipe/wasm/` and downloads `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/latest/pose_landmarker_heavy.task` → `web/public/models/pose_landmarker_heavy.task` only when missing.
- [ ] `package.json`: `"predev"` and `"prebuild"` run it. `.gitignore`: add `web/public/mediapipe/` and `web/public/models/`.

### Task W2: Camera + pose loop

**Files:** Create `web/src/capture/usePose.ts`

- [ ] `getUserMedia({ video: { width: 1280, height: 720, facingMode: 'user' }, audio: false })`.
- [ ] `FilesetResolver.forVisionTasks('/mediapipe/wasm')`; `PoseLandmarker.createFromOptions(fileset, { baseOptions: { modelAssetPath: '/models/pose_landmarker_heavy.task', delegate: 'GPU' }, runningMode: 'VIDEO', numPoses: 1 })`; if GPU creation throws, retry with `delegate: 'CPU'`.
- [ ] `requestAnimationFrame` loop: when `video.currentTime` changed, `detectForVideo(video, performance.now())` → callback `{ landmarks: NormalizedLandmark[] | undefined, worldLandmarks: Landmark[] | undefined, timestampMs }`. Track fps (EMA).
- [ ] State `status: 'loading' | 'ready' | 'error'` with a readable message; `NotAllowedError` → "Camera permission denied. Allow camera access and reload."
- [ ] Cleanup on unmount: cancel rAF, stop tracks, `landmarker.close()`.

### Task W3: 3D mannequin preview

**Files:** Create `web/src/preview/mannequin.ts`, `web/src/preview/mannequin.test.ts`, `web/src/preview/PreviewCanvas.tsx`

`mannequin.ts` — `export class Mannequin { readonly root: THREE.Group; applyFrame(frame: MotionFrame): void; boneWorldQuaternion(name: string): THREE.Quaternion }`:

- One `THREE.Object3D` per `SKELETON` bone (parents first). Rest local position = `head − parent.head` (root at its own `head`); rest rotation = identity (canonical T-pose world rotations are identity by construction).
- Each bone gets a capsule from head to tail (torso radius 0.06, limbs 0.035) plus a 0.1 m sphere on `Head`. Left-side bones blue, right-side bones orange, center gray — makes the "raise right hand" check obvious.
- `applyFrame`: walk `SKELETON` in order. `world[name] = driven ? quat(r[4i..4i+3]) : (world[parent] ?? identity)`; `local = world[parent]⁻¹ · world[name]`; set `object.quaternion`. Hips position = `(0, frame.h[1], 0)`.
- Tests (vitest, no WebGL needed): T-pose frame → every bone world quaternion is identity; a frame where `RightUpperArm`, `RightLowerArm`, `RightHand` all carry `quatAboutZ(−90°)` → the RightHand bone's world position is above the RightUpperArm head (right arm points up) and its x < 0.

`PreviewCanvas.tsx` — props `{ frameRef: React.MutableRefObject<MotionFrame | null> }`:

- Own rAF loop applies `frameRef.current` then renders — no React re-render per frame.
- Scene: dark background, `GridHelper` floor, small `AxesHelper`, hemisphere + directional light, camera at `(0, 1.2, 3.2)` looking at `(0, 1, 0)` (front view: the character faces +Z), `OrbitControls` from `three/addons/controls/OrbitControls.js`. Resize with the container.

### Task W4: Recorder, trim, export

**Files:** Create `web/src/record/useRecorder.ts`, `web/src/record/useRecorder.test.ts`, `web/src/record/RecordPanel.tsx`

- [ ] `useRecorder` state machine `idle → countdown(3 s) → recording → recorded`; `push(frame)` only while recording, re-basing `t` to the first pushed frame; `discard()` returns to idle. Keep the pure reducer in its own exported function and unit-test it.
- [ ] `RecordPanel`: Record button (3-2-1 countdown overlay so the actor can step back) / Stop. After stop: duration, start/end range sliders (0.01 s step), Play button that replays `[start, end]` into the preview `frameRef` (live pose paused while reviewing), name input validated by `CLIP_NAME_PATTERN` (default `Clip_01`, auto-increment after export), Loop checkbox, Export, Discard.
- [ ] Export: `makeClip(frames, { start, end, name, loop })` → `fetch('/api/export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clips: [clip] }) })`. Show returned files as download links; show errors with status and `detail`.

### Task W5: App layout

**Files:** Modify `web/src/App.tsx`; create `web/src/App.css`

- [ ] Left: camera `<video>` mirrored with CSS `transform: scaleX(-1)` plus an overlay `<canvas>` (same mirror) drawing `DrawingUtils.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS)` and `drawLandmarks`. Right: `PreviewCanvas`. Below: `RecordPanel`.
- [ ] `const solver = useMemo(() => createPoseSolver(), [])`. Per pose result: `frame = solver.solve(worldLandmarks, timestampMs / 1000)`; when not reviewing set `frameRef.current = frame`; `recorder.push(frame)`.
- [ ] Status bar: fps, pose detected, hint "Step back so your whole body is in frame" when there is no pose or both ankles (landmarks 27, 28) have visibility < 0.5.
- [ ] "Calibrate T-pose" button: 3-second countdown, then `solver.calibrate(worldLandmarks)`.
- [ ] Dark, clean UI with the EmoteCap name and "Act once. Animate anything."

Manual acceptance: `npm run dev` → camera and overlay visible, mannequin visible (T-pose until track M lands, then it follows you), record 5 s → trim → Export (server running) → download link works. `npm test` and `npx tsc --noEmit` pass.

---

## Track M — motion-core (lead session, TDD)

Folder: `web/src/motion/`. Algorithm: spec §6.1. Public API stays exactly as in `web/src/motion/index.ts`.

- [ ] **M1 `math.ts`** — vec3 (add, sub, scale, dot, cross, length, normalize, lerp), quat (multiply, conjugate, normalize, fromAxisAngle, fromBasis(x, y, z columns), slerp, dot, rotateVec, sameHemisphere). Tests: fromBasis(identity) = identity; fromAxisAngle(Z, 90°) rotates +X to +Y; slerp midpoint.
- [ ] **M2 `landmarks.ts`** — MediaPipe indices, `toCanonical(lm) = (x, −y, −z)`, test helper `tposeWorldLandmarks()` built from the canonical skeleton (+ hand, ear, nose, heel, toe points) and `rotateLandmarks(lms, pivotIndex, quat, indices)`.
- [ ] **M3 `solver.ts`** — per-bone primary/secondary frames (spec §6.1 table), rest frames computed from the synthetic T-pose through the same code path, bend-normal fallbacks, hemisphere continuity, elbow/knee 150° clamp, visibility < 0.5 holds the previous rotation, `calibrate()` replaces rest frames. Tests: T-pose → all identity; left arm up 90° → LeftUpperArm ≈ `quatAboutZ(+90°)`; right arm up → RightUpperArm ≈ `quatAboutZ(−90°)`; left elbow bent 90° forward → LeftLowerArm ≈ `quatAboutY(−90°)`, LeftUpperArm ≈ identity; head turned 45° left → Head ≈ `quatAboutY(+45°)`; arm swept from T-pose to straight down over 20 frames → consecutive quaternion dots > 0.9.
- [ ] **M4 `oneEuro.ts`** — scalar filter + 33×3 landmark filter (`minCutoff 1.0, beta 0.01, dCutoff 1.0`). Test: noisy constant → lower variance than input.
- [ ] **M5 grounding** — `h.y = (H0 − 0.93) + hipHeightActor × (0.85 / actorLegLength)`; leg length = median of the last 30 frames. Tests: T-pose → `h.y ≈ 0.95 ± 0.01`; crouch → lower.
- [ ] **M6 `clip.ts`** — `makeClip` with resampling to exact fps (linear `h`, slerp `r`), `t = k / fps`. Tests: t starts at 0, uniform 1/30 spacing, invalid name throws.
- [ ] **M7 `index.ts`** — `createPoseSolver()` wires filter → solver → grounding; export `makeClip` from `clip.ts`.

---

## Track U — Unity

- [x] **U1** `unity/com.emotecap.mocap/Editor/EmoteCapImporter.cs` — FBX under `Assets/EmoteCap/` → Humanoid, CreateFromThisModel, no materials; clip name/loop from `<name>.emotecap.json`; root rotation/height/XZ baked into pose (in-place).
- [ ] **U2 (smallfire, in Unity)**
  1. Package Manager → **+** → **Add package from disk…** → `unity/com.emotecap.mocap/package.json`.
  2. Set `UNITY_EXPORT_DIR=<UnityProject>/Assets/EmoteCap` in the repo-root `.env`.
  3. Export the fixture (track S acceptance command) or copy `Raise_Right_Arm.fbx` + `.emotecap.json` into `Assets/EmoteCap/`.
  4. Check: Rig tab = Humanoid, **Configure** shows every required bone mapped, no errors.
  5. Drop a Mixamo character into a scene, give it an Animator Controller whose state plays `Raise_Right_Arm` with **Foot IK** ticked → Play → the character raises its **right** arm, stays in place, and is life-size.
  6. Commit the `.meta` files Unity generated inside `unity/com.emotecap.mocap/`.

---

## Checkpoints

| Time | Gate |
|---|---|
| 23:00 | **C1**: S1–S4 green; W1–W3 working (mannequin visible); M1–M3 tests green; U2 raise-right-arm passes in Unity |
| 01:00 | **C2**: record in the browser → trim → export → the clip plays on a Mixamo character in Unity |

Phase 2 (Live Link) and phase 3 (Gemini) get their own plans once C1 passes.
