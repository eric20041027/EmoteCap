# OneTake

> **Act once. Animate anything.**

Webcam motion capture for Unity. Act out moves in front of your laptop camera and get Humanoid FBX animation clips you can drop onto any humanoid character — no suit, no studio, no Mixamo-only menu. Live Link mirrors your pose onto a Unity character in real time.

Built at HackNite 2026. Work in progress.

## How it works

```
webcam → MediaPipe Pose (browser) → quaternion solver → 3D preview
                                   ├─ Live Link → Unity character, real time
                                   └─ record → trim → Blender → Humanoid FBX → Unity (auto-configured)
```

## Repo layout

| Path | What |
|---|---|
| `contracts/` | Shared data contract (bones, coordinate systems, MotionFrame) and fixture clips |
| `web/` | Browser app: webcam, MediaPipe pose, motion solver, 3D preview, recorder |
| `server/` | FastAPI: Blender FBX export, Live Link relay, Gemini auto-slicing |
| `unity/com.onetake.mocap/` | Unity package: automatic Humanoid import, Live Link receiver |

## Quick start

```bash
cp .env.example .env
(cd server && uv sync && uv run uvicorn onetake_server.main:app --port 8787)
(cd web && npm install && npm run dev)   # open http://localhost:5173
```

Unity: Package Manager → **Add package from disk…** → `unity/com.onetake.mocap/package.json`.
