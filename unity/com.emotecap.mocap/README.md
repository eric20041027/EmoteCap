# EmoteCap Mocap (Unity package)

Imports EmoteCap FBX clips as Humanoid animations and drives characters live from the EmoteCap web app.

## Install

This local0.2.0candidate requires Unity6000.5or newer. Actual qualification targets Windows/6000.5.9f1. Original Starter Rigs and real FBX playback are tested in the Built-in Render Pipeline; other Editors/platforms/rendering pipelines/player builds are unqualified. The former2021.3declaration is unsupported by this candidate. This source has not been publicly published; sample review/corrections are verified locally; broader release gates remain pending.

Package Manager → **+** → **Add package from disk…** → this folder's `package.json`. After reviewed source publication, use the Git package URL pinned to its qualified commit/tag; remote main still contains the historical unpaired receiver.

Set `UNITY_EXPORT_DIR` in the repo's `.env` to `<YourProject>/Assets/EmoteCap` so exported clips land in your project automatically.

## Components

| Component | Add it to | What it does |
|---|---|---|
| **Importer** (automatic) | — | FBX files with their `.emotecap.json` sidecars under `Assets/EmoteCap/` import as in-place Humanoid clips with the sidecar's name and loop flag. |
| **EmoteCap Live Link** | A T-pose Humanoid with an Avatar and **no** Animator Controller | Defaults disconnected; explicit in-memory pairing with the same computer's service. **Smooth Time** (default0.05s,0=off) eases received poses. **Ground Feet** keeps the lowest sole on the floor unless it rises above **Airborne Threshold**. |
| **EmoteCap Body Colliders** | The Live Link character | Kinematic capsules follow the limbs, head and torso, so the character can knock Rigidbody props over. |
| **EmoteCap Reset Props** | The parent of your props | Press **R** (or the on-screen button) to put every Rigidbody back where it started. |
| **EmoteCap Clip Player** | Any Humanoid | On-screen menu: pick a clip from `Assets/EmoteCap` (newest first), toggle **Loop**, or play all in order. Runs on Playables, so no Animator Controller is needed. |

Menu **EmoteCap → Play Latest Export** rebuilds every Animator Controller named `EmoteCapClips` as a looping playlist of the newest ordinary export (this also happens automatically after ordinary exports). The reserved Starter Rigs sample paths are excluded so creating a sample preserves unrelated controllers.

## Original Starter Rigs

Import **Starter Rigs** in Package Manager, choose **EmoteCap → Create Starter Scene** before Play mode, then press Play. Two original colored Humanoids play the bundled right-hand-raise clip without a camera, key or pairing. Assets and scene references persist; existing destinations reject. [Sample workflow and qualification](Documentation~/sample-playback.md) covers controls, your own exports and the exact supported target.

## Tips

- To use a clip in your own Animator Controller, drag it in as a state and tick **Foot IK** on that state.
- Live Link needs the EmoteCap server running (`cd server && uv run uvicorn emotecap_server.main:app --port 8787`) and **Live Link** switched on in the web app.

## Pair in Play mode

1. Start the local EmoteCap service and enable Live Link in Studio.
2. In Unity enter **Play mode** with the receiver on a valid Humanoid Avatar, in its bind/T-pose with no Animator Controller.
3. Copy Studio's current pairing code, paste it into the receiver Inspector and press **Connect**. Input clears after Connect; no code is saved in a scene or prefab.
4. **waiting for Studio** means the pairing is accepted but no source is connected; **receiving** means valid motion frames arrived. Press **Stop**, disable the component or leave Play mode to close the owned connection.

Use localhost/127.0.0.1/::1and the local service port,8787by default. Ordinary disconnection retries after2seconds; invalid/expired/revoked pairing or incompatible messages stop retries and require an explicit new Connect. Studio Stop requests revocation; a service restart invalidates all old codes. Do not paste a code before entering Play mode: domain reload deliberately does not preserve it.

For Avatar/controller, expiry and source troubleshooting and actual test commands, see [receiver guide](Documentation~/paired-receiver.md). [Dependency material](ThirdParty~/notice-inventory.json) records the frozen JSON dependency and exact upstream terms; it does not grant a project license or complete redistribution approval.

## License

Project-owned package code, documentation and original samples are MIT licensed; see [LICENSE.md](LICENSE.md). [Dependency material](ThirdParty~/notice-inventory.json) retains the upstream terms and does not establish complete binary redistribution approval.
