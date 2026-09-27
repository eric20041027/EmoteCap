# EmoteCap — submission kit

## Form fields

| Field | Value |
|---|---|
| Link to project | https://github.com/eric20041027/EmoteCap |
| Project name | EmoteCap |
| Demo URL | YouTube (unlisted) link to the demo video |
| Technologies | Google Gemini API, MediaPipe, three.js, React, Vite, TypeScript, Python, FastAPI, Blender, Unity, C# |

## Description (paste into the form)

**EmoteCap turns your laptop webcam into a motion-capture studio for Unity. Act once, animate anything.**

Indie and student game developers animate characters with whatever premade clips they can find — the exact sword slash, dance, or emote a game needs is never in the library, and real mocap costs thousands of dollars. EmoteCap captures your own performance and hands Unity a ready-to-use Humanoid animation.

**What it does**
- Tracks your body *and all ten fingers* in the browser with MediaPipe Pose + Hand Landmarker, solved into 48 bone rotations by our own quaternion solver and shown on a live 3D mannequin.
- **Live Link** streams your pose into Unity over WebSocket, so a character in your scene moves with you in real time.
- **One-take auto-slicing with Gemini**: act several moves in one continuous take; Gemini watches the video and returns named, loop-tagged clips (`Wave_Right`, `Sword_Slash`, `Victory_Dance`…). We snap Gemini's cut points to the pauses in your motion, and fall back to pause detection if Gemini is unavailable.
- One click exports every clip through headless Blender as a Humanoid FBX; our Unity package auto-configures the import (Humanoid avatar, loop, in-place root) so the clip retargets onto any humanoid character.

**How we built it**
One motion format runs through the whole pipeline: each bone's world rotation relative to T-pose. The solver builds an orthonormal frame per bone from landmark directions and bend-plane normals (continuous through straight limbs, clamped at the elbows and knees, One Euro filtered), and grounds the lowest sole with forward kinematics. The same frames drive the browser preview, the FBX, and Unity, so what you see is what you export. Gemini's structured output (name, start, end, loop, description) is validated server-side, then refined in the browser with a motion-energy signal.

**Stack**: Gemini API · MediaPipe · three.js · React · TypeScript · FastAPI · Blender · Unity/C#.

## Demo video shot list (≤ 3 min)

| Time | Shot | What to say (one line each) |
|---|---|---|
| 0:00–0:15 | You in front of the laptop; Unity with Mixamo's menu | "Mixamo only has what it has. What if your webcam was the mocap studio?" |
| 0:15–0:45 | Split screen: web app + Unity, Live Link on, you move, wave, make a fist | "Live Link: my body and fingers drive the Unity character in real time." |
| 0:45–1:15 | One continuous take: wave → jumping jacks → sword slash → victory dance, pauses in between | "One take, four moves." |
| 1:15–1:40 | Auto-slice: "Gemini is watching your take…" → named clips appear on the timeline | "Gemini watches the take and names each move; cuts snap to my pauses." |
| 1:40–2:20 | Export all → switch to Unity → clips in Assets/EmoteCap → two Y Bots play them | "One click to Humanoid FBX; Unity imports it ready to retarget." |
| 2:20–2:45 | Architecture diagram from the README | "48-bone solver, one motion format from browser to Blender to Unity." |
| 2:45–3:00 | Logo + GitHub URL | "EmoteCap. Act once. Animate anything." |

Recording tips: QuickTime → New Screen Recording (full screen, internal mic); record the live-link and one-take segments separately and cut them together; keep the Unity Game view large.
