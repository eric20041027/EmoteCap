# EmoteCap

> **Act once. Animate anything.**

**Webcam motion capture for Unity.** Act out a move in front of your laptop camera or iPhone, or import a video you already have, and get a Humanoid FBX animation clip for any humanoid character: no mocap suit, no studio, and no more settling for whatever Mixamo happens to have. Live Link mirrors your pose onto a Unity character in real time.

Built in 12 hours at HackNite 2026.

## Why

Indie and student game devs animate characters with whatever premade clips they can find. The move you actually need — *your* sword slash, *your* victory dance — is never in the library, and optical mocap costs thousands. EmoteCap turns the webcam you already have into a mocap studio that speaks Unity.

## What it does

- **Real-time capture in the browser** — MediaPipe Pose (33 landmarks) plus Hand Landmarker (21 per hand) feed a custom quaternion solver; a 3D mannequin mirrors you at camera frame rate. Nothing is uploaded to capture.
- **Finger-level mocap** — 48 driven bones: full body plus all 30 finger joints, so fists, pointing, and peace signs survive all the way into Unity (or pick the lighter body-only skeleton).
- **Phone as camera** — in Safari, an iPhone mounted upright works as the camera via Continuity Camera (remembered between sessions), with an optional 3:4 portrait crop so your whole body fills the frame.
- **Steady motion** — One Euro filters on the landmarks and on every bone's rotation (Low / Medium / High), standing feet planted flat, jumps detected; Unity eases between Live Link frames.
- **Record → trim → FBX** — a one-click export runs Blender headless and writes a Humanoid-ready FBX (Mixamo bone names, T-pose rest) plus a sidecar with the clip name and loop flag.
- **Zero-setup Unity import** — the EmoteCap Unity package's `AssetPostprocessor` imports every clip as an in-place Humanoid animation, so it retargets to any humanoid (verified on Mixamo's Y Bot); an in-game menu plays and loops the clips.
- **Live Link** — stream your pose over WebSocket to a Unity character while you act; body colliders let it knock props over in a physics playground.
- **Import any video** — turn an existing clip (mp4, mov or webm, up to 3 minutes) into a take: every frame is analysed with the most accurate models, the 3D preview follows along, and the result goes through the same Gemini slicing and FBX export as a live recording.
- **Gemini one-take slicing** — record several moves in one continuous take; Gemini watches the video and splits it into named, loop-tagged clips (`Wave_Right`, `Sword_Slash`, …), with cut points snapped to your pauses. Rename, retime, and export them all in one click. Without a key, the take is split at pauses locally.

## How it works

```mermaid
flowchart LR
  cam[Webcam / iPhone] --> mp[MediaPipe Pose + Hands<br/>world landmarks]
  file[Video file] -->|frame by frame| mp
  mp --> solver[Quaternion solver<br/>smoothing + grounding]
  solver --> preview[3D mannequin preview]
  solver -->|Live Link WebSocket| relay[FastAPI relay] --> live[Unity character<br/>real time]
  solver --> rec[Recorder]
  rec -->|raw video| gemini[Gemini video understanding<br/>named segments]
  gemini --> clips[Clips]
  rec -->|manual trim| clips
  clips -->|POST /api/export| blender[Blender headless<br/>Humanoid FBX]
  blender --> unity[Unity AssetPostprocessor<br/>Humanoid + loop configured]
```

**One motion format everywhere.** Every frame is 48 quaternions — each bone's *world rotation relative to T-pose* — plus hips height ([`contracts/motion-v1.md`](contracts/motion-v1.md)). Any rig applies it as `boneWorld = delta × restWorld`, so the browser preview, the exported FBX, and the Unity Live Link all show exactly the same pose.

**The solver** builds an orthonormal frame per bone from a primary axis (e.g. shoulder → elbow) and a secondary axis (the elbow's bend-plane normal), and divides it by the same frame computed from a T-pose. Straight limbs reuse the previous bend normal so twists never flip; elbows and knees are clamped to 150°; One Euro filters on the landmarks and on each bone's rotation remove jitter without adding lag. Hands use the palm frame (wrist → knuckles, pinky → index) from Hand Landmarker, and each finger segment curls about the palm's lateral axis. Forward kinematics on the canonical skeleton keeps the lowest sole exactly on the floor and plants standing feet flat, and Unity's Live Link eases between frames and re-grounds each rig by its own sole height, so feet neither sink nor float.

**Gemini** receives the raw take with structured-output JSON (name, start, end, loop, description). Its cut points are then snapped to the nearest pause using motion energy (angular speed summed over all bones). If Gemini is unavailable, the take is split at pauses locally.

## Quick start

Requirements: Node 20+, [uv](https://docs.astral.sh/uv/), Blender 4.4+ (tested on 5.1), Unity 2021.3+ (tested on 6000.5).

```bash
cp .env.example .env          # set UNITY_EXPORT_DIR to <UnityProject>/Assets/EmoteCap; GEMINI_API_KEY is optional
(cd server && uv sync && uv run uvicorn emotecap_server.main:app --port 8787)
(cd web && npm install && npm run dev)   # open http://localhost:5173 (Safari also lists an iPhone via Continuity Camera)
```

In Unity: Package Manager → **+** → **Add package from git URL…** → `https://github.com/eric20041027/EmoteCap.git?path=/unity/com.emotecap.mocap`

1. Exported clips land in `Assets/EmoteCap/` and import as Humanoid automatically. Drag one onto any humanoid's Animator and tick **Foot IK**.
2. For Live Link, add the **EmoteCap Live Link** component to a T-pose humanoid with no Animator Controller, press Play, and switch on **Live Link** in the web app.
3. **Fast** mode (Pose Full, hands every other frame) keeps Live Link smooth; switch to **Accurate** (Pose Heavy, hands every frame) for important takes.
4. **Import video** turns an existing clip (up to 3 minutes, one person in full view) into a take, then Review works as for a recording.
5. Clip menu, physics colliders, prop reset and Live Link settings: see the [Unity package README](unity/com.emotecap.mocap/README.md).

## Tech stack

Gemini API (`google-genai`, structured video understanding) · MediaPipe Pose + Hand Landmarker · three.js · React · Vite · TypeScript · FastAPI · Python · Blender (bpy) · Unity (C#)

## Tests

`cd web && npm test` (motion solver, filters, clip resampling, segmentation, UI logic) · `cd server && uv run pytest` (export, relay, Gemini slicing with a mocked API, a real Blender smoke test).
