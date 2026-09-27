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

## Demo video shot list (about 2:50)

| # | Time | Screen | Narration | Aims at |
|---|---|---|---|---|
| 1 | 0:00–0:12 | Y Bot standing idle in Unity; title card "Need a custom animation?" | "Every game needs custom animations. Mocap studios cost thousands, and stock libraries never have the exact move you need." | Overall (usefulness) |
| 2 | 0:12–0:40 | Split screen: actor + web skeleton on the left, Unity playground on the right. Wave, peace sign, then sweep the cubes off the table | "This is EmoteCap. My webcam becomes a motion-capture studio: full body and all ten fingers, streamed into Unity in real time. And it's physical." | People's Choice |
| 3 | 0:40–1:00 | Record → countdown → one take: wave, punch combo, jump, victory pose, one-second pause between moves (2× speed in the edit) | "To make game clips, I act out several moves in one take." | Overall |
| 4 | 1:00–1:30 | Auto-slice with Gemini → named clips with descriptions and loop flags → play one on the 3D preview | "Gemini watches the raw video and cuts it into named clips, with a description and whether each move should loop. We snap its cuts to my pauses, so every clip starts and ends cleanly." | Gemini |
| 5 | 1:30–1:55 | Export all → Unity: FBX files appear in Assets/EmoteCap → clip menu plays them on Y Bot, loop on/off | "One click: Blender turns every clip into a Humanoid FBX, and Unity imports them ready for any humanoid character." | Overall (execution) |
| 6 | 1:55–2:20 | Import video: a teammate's phone video → skeleton on the video, preview follows (sped up) → Y Bot does the same moves in Unity | "Already have a video? Drop it in. Same pipeline, frame by frame." | People's Choice |
| 7 | 2:20–2:40 | README architecture diagram + three key facts on screen | "Under the hood: our own 48-bone quaternion solver and one motion format from browser to Blender to Unity. What you see is exactly what you export." | Overall (technical depth) |
| 8 | 2:40–2:50 | Logo + GitHub URL | "EmoteCap. Act once. Animate anything." | |

Recording tips: QuickTime → New Screen Recording, one segment at a time; keep the Unity Game view large; burn in English captions (judges may watch muted); speed up waiting (Gemini, video import) 2–4×; use your own footage and royalty-free music so YouTube does not block the video; upload as Unlisted and check it plays in a private window.
