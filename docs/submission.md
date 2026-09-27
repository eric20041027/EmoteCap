# EmoteCap — submission kit

## Form fields

| Field | Value |
|---|---|
| Link to project | https://github.com/eric20041027/EmoteCap |
| Project name | EmoteCap |
| Demo URL | YouTube (unlisted) link to the demo video |
| Technologies | Google Gemini API, MediaPipe, three.js, React, Vite, TypeScript, Python, FastAPI, Blender, Unity, C#, WebSockets |

## Description (plain text: paste into the form as is)

```text
EmoteCap turns a webcam, an iPhone, or any video you already have into Humanoid animation clips for Unity. Act once, animate anything.

Indie and student game developers are stuck with whatever premade animations they can find, and real motion capture costs thousands of dollars. EmoteCap captures your own performance in the browser and hands Unity a ready-to-use Humanoid clip.

What it does
- Full-body and finger tracking in the browser (MediaPipe Pose + Hand Landmarker), solved into 48 bone rotations by our own quaternion solver and shown on a live 3D mannequin.
- Live Link: your pose streams into Unity over WebSocket, so a character in your scene moves with you in real time and physically pushes props around.
- Import any video: drop in an mp4, mov or webm and every frame is analysed with the most accurate models, producing the same take as a live recording.
- One-take auto-slicing with Gemini: act several moves in one continuous take; Gemini watches the video and returns named, loop-tagged clips (Wave_Right, Punching_Combo, Jump_InPlace...). Cut points snap to your pauses; if Gemini is unavailable, the take is split at pauses locally.
- One click exports every clip through headless Blender as a Humanoid FBX; our Unity package auto-configures the import so each clip retargets to any humanoid character, with an in-game menu to preview and loop clips.

How we built it
One motion format runs through the whole pipeline: each bone's world rotation relative to T-pose. The solver builds an orthonormal frame per bone from landmark directions and bend-plane normals, keeps the feet planted with forward kinematics, and removes jitter with per-bone One Euro filters; Unity eases between Live Link frames for smooth motion. The same frames drive the browser preview, the FBX and Unity, so what you see is what you export. Gemini's structured output (name, start, end, loop, description) is validated server-side and refined with a motion-energy signal.

Built with: Gemini API, MediaPipe, three.js, React, TypeScript, FastAPI, Blender, Unity (C#).
```

## Demo video shot list (≤ 3 min)

| Time | Shot | What to say (one line each) |
|---|---|---|
| 0:00–0:15 | You in front of the laptop; Unity with Mixamo's menu | "Mixamo only has what it has. What if your webcam was the mocap studio?" |
| 0:15–0:45 | Split screen: web app + Unity playground, Live Link on; wave, make a fist, push the cubes off the table | "My body and fingers drive the Unity character in real time, with physics." |
| 0:45–1:10 | One continuous take: 3–4 moves with a pause between each | "One take, four moves." |
| 1:10–1:30 | Auto-slice: named clips appear on the timeline | "Gemini watches the take and names each move; cuts snap to my pauses." |
| 1:30–1:55 | Import video: pick an mp4 → skeleton on the video, preview follows → Review | "Already have a video? Import it: same pipeline." |
| 1:55–2:30 | Export all → Unity → clip menu plays the clips on Y Bot | "One click to Humanoid FBX; Unity imports it ready to retarget." |
| 2:30–2:50 | Architecture diagram from the README | "48-bone solver, one motion format from browser to Blender to Unity." |
| 2:50–3:00 | Logo + GitHub URL | "EmoteCap. Act once. Animate anything." |

Recording tips: QuickTime → New Screen Recording (full screen, internal mic); record the live-link and one-take segments separately and cut them together; keep the Unity Game view large.
