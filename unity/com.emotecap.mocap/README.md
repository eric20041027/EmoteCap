# EmoteCap Mocap (Unity package)

Imports EmoteCap FBX clips as Humanoid animations and drives characters live from the EmoteCap web app.

## Install

Package Manager → **+** → **Add package from git URL…** → `https://github.com/eric20041027/EmoteCap.git?path=/unity/com.emotecap.mocap`
(while developing: **Add package from disk…** → this folder's `package.json`).

Set `UNITY_EXPORT_DIR` in the repo's `.env` to `<YourProject>/Assets/EmoteCap` so exported clips land in your project automatically.

## Components

| Component | Add it to | What it does |
|---|---|---|
| **Importer** (automatic) | — | FBX files with their `.emotecap.json` sidecars under `Assets/EmoteCap/` import as in-place Humanoid clips with the sidecar's name and loop flag. |
| **EmoteCap Live Link** | A T-pose Humanoid with an Avatar and **no** Animator Controller | Listens on `ws://host:8787/ws/live?role=sink` and poses the character. **Smooth Time** (default 0.05 s, 0 = off) eases between the 30 fps frames. **Ground Feet** keeps the lowest sole on the floor unless it rises above **Airborne Threshold** (a jump). |
| **EmoteCap Body Colliders** | The Live Link character | Kinematic capsules follow the limbs, head and torso, so the character can knock Rigidbody props over. |
| **EmoteCap Reset Props** | The parent of your props | Press **R** (or the on-screen button) to put every Rigidbody back where it started. |
| **EmoteCap Clip Player** | Any Humanoid | On-screen menu: pick a clip from `Assets/EmoteCap` (newest first), toggle **Loop**, or play all in order. Runs on Playables, so no Animator Controller is needed. |

Menu **EmoteCap → Play Latest Export** rebuilds every Animator Controller named `EmoteCapClips` as a looping playlist of the newest export (this also happens automatically after each export).

## Tips

- To use a clip in your own Animator Controller, drag it in as a state and tick **Foot IK** on that state.
- Live Link needs the EmoteCap server running (`cd server && uv run uvicorn emotecap_server.main:app --port 8787`) and **Live Link** switched on in the web app.
