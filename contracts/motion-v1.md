# EmoteCap motion contract v1

Source of truth for data exchanged between `web/`, `server/`, and `unity/`.
Machine-readable part: [`bones.json`](bones.json). Change either file only after telling the whole team.

## Coordinate systems

| Space | Handedness | Up | Character faces | Units |
|---|---|---|---|---|
| **Canonical** (all JSON on the wire) | right | +Y | +Z | meters |
| MediaPipe world landmarks | right | −Y (y points down) | −Z (z grows away from camera) | meters, origin = hip midpoint |
| Unity | left | +Y | +Z | meters |
| Blender | right | +Z | −Y | meters |

Conversions (pure functions, every lane implements its own copy):

| From → To | Position | Quaternion `(x, y, z, w)` |
|---|---|---|
| MediaPipe → canonical | `(x, -y, -z)` | – |
| canonical → Unity | `(-x, y, z)` | `(x, -y, -z, w)` |
| canonical → Blender | `(x, -z, y)` | `Quaternion((w, x, -z, y))` (Blender is w-first) |

The video frame fed to MediaPipe is **not mirrored**. Mirror only the on-screen display with CSS.

**Acceptance test ("raise right hand"):** the actor raises their right arm → the character raises its **right** arm with the head up, in the browser preview, in the exported FBX, and in Unity. Fixture: `fixtures/raise-right-arm.clip.json`.

## Bones

`bones.json.driven` lists the 18 driven bones in wire order (parents first). Names equal Unity's `HumanBodyBones` enum names. `bones.json.skeleton` is the export skeleton: 22 bones in T-pose with Mixamo names (`fbx`), head/tail positions in canonical meters, parents first. `LeftShoulder`, `RightShoulder`, `LeftToeBase`, `RightToeBase` are never driven and keep their rest rotation relative to their parent.

`hipsRestHeight` (`H0` = 0.95) is the canonical Hips height in T-pose.

## MotionFrame

```json
{ "t": 1.2333, "h": [0.0, 0.93, 0.0], "r": [0, 0, 0, 1, "... 72 floats total ..."] }
```

- `t` — seconds since the start of the take (or clip).
- `h` — Hips position in canonical meters, already scaled to the canonical skeleton. `x` and `z` are always 0 (in-place animation).
- `r` — 18 × 4 = 72 floats, quaternions `(x, y, z, w)` in `driven` order. Each is the bone's **world-space rotation relative to T-pose** ("world delta").
- Apply to any humanoid rig: `boneWorldRotation = r[b] * restWorldRotation[b]`, parents before children. A child that should keep its pose relative to its parent must carry the same world delta; children do **not** inherit `r` automatically.

Only flat arrays are used so Unity's `JsonUtility` can parse frames directly.

## Clip

```json
{ "name": "Idle_Breathing", "loop": true, "fps": 30, "frames": [ "MotionFrame, uniformly sampled at fps, t starts at 0" ] }
```

- `name` matches `^[A-Za-z0-9_]{1,24}$`. Duplicate names in one export get `_2`, `_3`, … appended.
- `frames` are filtered, grounded, and resampled to exactly `fps` (frame `k` has `t = k / fps`).
- `skeleton` (optional): `"full"` (default) exports all 52 bones; `"body"` leaves the 30 finger bones out of the FBX (22 bones) for characters without fingers. Frames always carry all 48 driven rotations.

## Segment (phase 3, Gemini)

```json
{ "name": "Sword_Slash", "start": 12.4, "end": 14.1, "loop": false, "description": "..." }
```

Time range inside a take; the web app cuts Clips from it.

## HTTP API (server, default `http://localhost:8787`)

| Phase | Method | Path | Body | Response |
|---|---|---|---|---|
| 1 | GET | `/api/health` | – | `{ "ok": true, "blender": bool, "gemini": bool }` |
| 1 | POST | `/api/export` | `{ "clips": Clip[] }` | `{ "files": [{ "name": str, "url": "/files/<name>.fbx" }] }` |
| 1 | GET | `/files/<name>.fbx` | – | FBX file (a `<name>.emotecap.json` sidecar sits next to it) |
| 3 | POST | `/api/takes` | multipart `video` (webm ≤ 100 MB, ≤ 3 min), `duration` | `{ "takeId": str, "segments": Segment[] }` |

Errors: `422` invalid body, `500` Blender failure (`detail` holds the last 20 lines of Blender stderr), `503` Gemini not configured, `413` take over 100 MB or 180 s, `415` upload is not a video, `502` Gemini failed or returned nothing usable (`detail = {"message": ..., "fallback": "motion-energy"}` — the web app then splits the take locally with `fallbackSegments`).

The uploaded video must be the raw, **un-mirrored** camera stream so Gemini's Left/Right clip names match the actor's own sides.

## Sidecar `<name>.emotecap.json`

```json
{ "name": "Wave_Right", "loop": false, "fps": 30 }
```

Read by the Unity importer to name the clip and set Loop Time / Loop Pose.

## Live Link WebSocket (phase 2): `ws://localhost:8787/ws/live?role=source|sink`

- Source (browser) sends once: `{"type":"hello","version":1,"bones":[...driven names...]}`, then per frame: `{"type":"frame","t":…,"h":[…],"r":[…]}`.
- The server forwards source messages unchanged to every sink (Unity).
- Quality phase: after an export the server broadcasts `{"type":"clip_ready","name":"…","url":"…","loop":true}` to sinks.
