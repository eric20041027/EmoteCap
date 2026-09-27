# EmoteCap — submission kit

## Form fields

| Field | Value |
|---|---|
| Link to project | https://github.com/eric20041027/EmoteCap |
| Project name | EmoteCap |
| Demo URL | https://youtu.be/ETPATTBDosc |
| Technologies | Google Gemini API, MediaPipe, three.js, React, Vite, TypeScript, Python, FastAPI, Blender, Unity, C#, WebSockets |

## Description (plain text: paste into the form as is)

```text
EmoteCap turns a webcam, an iPhone, or any video you already have into Humanoid animation clips for Unity. Act once, animate anything.

Indie and student game developers are stuck with whatever premade animations they can find, and real motion capture costs thousands of dollars. EmoteCap captures your own performance in the browser and hands Unity a ready-to-use Humanoid clip.

What it does
- Full-body and finger tracking in the browser (MediaPipe Pose + Hand Landmarker), solved into 48 bone rotations by our own quaternion solver and shown on a live 3D mannequin.
- Live Link: your pose streams into Unity over WebSocket, so a character in your scene moves with you in real time and physically pushes props around.
- Import any video: drop in an mp4, mov or webm and every frame is analysed with the most accurate models; the take calibrates itself from its first T-pose and goes through the same pipeline as a live recording.
- One-take auto-slicing with Gemini: act several moves in one continuous take; Gemini watches the video and returns named, loop-tagged clips (Wave_Right, Punching_Combo, Jump_InPlace...). Cut points snap to your pauses. If a Gemini model is overloaded, the server falls back to another; without Gemini, the take is still split at pauses locally.
- One click exports every clip through headless Blender as a Humanoid FBX; our Unity package auto-configures the import so each clip retargets to any humanoid character, with an in-game menu to preview and loop clips.

How we built it
One motion format runs through the whole pipeline: each bone's world rotation relative to T-pose. The solver builds an orthonormal frame per bone from landmark directions and bend-plane normals, keeps the feet planted with forward kinematics, and removes jitter with per-bone One Euro filters; Unity eases between Live Link frames for smooth motion. The same frames drive the browser preview, the FBX and Unity, so what you see is what you export. A T-pose calibration (an on-screen outline when live, found automatically in imported videos) cancels MediaPipe's camera-angle bias: before it, a level head read as tilted 30 degrees. Gemini's structured output (name, start, end, loop, description) is validated server-side and refined with a motion-energy signal, and Gemini text-to-speech narrates our demo video.
```

## Demo video (final edit, 1:41)

File: `demo/EmoteCap_demo_final.mp4` (kept out of git), published at https://youtu.be/ETPATTBDosc.
1080p30, captions burned in, narration by Gemini TTS (`gemini-3.1-flash-tts-preview`, voice Puck), loudness −16 LUFS.

| Time | Shot | Footage | Narration |
|---|---|---|---|
| 0:00 | Title "Need a custom animation?" over the two Y Bots | A | "Every game needs custom animations. But mocap studios cost thousands, and stock libraries never have the exact move you need." |
| 0:10 | Live Link, side by side; the character knocks the table and the cube tower over | B | "This is EmoteCap. A webcam or a phone becomes your motion-capture studio, streaming straight into Unity in real time. And it's physical." |
| 0:24 | T-pose calibration outline, then one continuous take (2×) | C | "Calibrate with a quick T-pose, then act out several moves in one continuous take." |
| 0:36 | Gemini auto-slice: waiting (4×), six named clips (1.5×) | C | "Gemini watches the raw video and cuts it into named clips, with a description and whether each move should loop. Every cut snaps to a pause in your motion." |
| 0:50 | The actor walks off and the Live Link character slumps over; "Z z z" appears (0.75×) | C | "Oops, our Live Link guy just dozed off. Hope you're not sleeping as soundly as he is at this overnight hackathon!" |
| 1:00 | Export all, then the Unity clip menu plays the clips | C + D | "One click, and Blender turns every clip into a Humanoid FBX. Unity imports them automatically, ready for any humanoid character." |
| 1:12 | Import a phone video, analysed frame by frame (1.5×) | E | "Already have a video? Drop it in. EmoteCap analyzes every frame and sends it through the same pipeline." |
| 1:23 | Architecture diagram and three key facts | F | "Under the hood: our own forty-eight bone quaternion solver, and one motion format from the browser to Blender to Unity. What you see is exactly what you export." |
| 1:35 | End card: EmoteCap, tagline, GitHub URL | — | "EmoteCap. Act once. Animate anything." |

## Recording run sheet (record grouped by setup, assemble in shot order)

Before recording: turn on Do Not Disturb, hide desktop icons, close other apps using the camera, clean test clips out of `Assets/EmoteCap/`, set Smoothing to Medium, and have the phone video for shot 6 ready.

| Take | Setup | Do | Becomes |
|---|---|---|---|
| A | Unity **EmoteCapDemo** in Play mode | 10 s of Y Bot standing idle | Shot 1 |
| B | Safari on the left half, Unity **EmoteCapPlayground** (Play mode) on the right; web app **Fast**, Live Link on | Wave, peace sign, then sweep the cubes off the table; press **R** and repeat until one run looks great | Shot 2 |
| C | Web app, **Accurate** mode | Record → one take of four moves with pauses → Stop → Auto-slice with Gemini → play one clip → Export all | Shots 3, 4 and the start of 5 |
| D | Unity **EmoteCapDemo** in Play mode | Clip Player menu: pick each new clip, toggle Loop | Shot 5 |
| E | Web app + the phone video | Import video → let it finish → Auto-slice → Export all → play the dance in Unity | Shot 6 |
| F | GitHub README in the browser | Scroll to the architecture diagram | Shot 7 |

Recording tips: QuickTime → New Screen Recording, one segment at a time; keep the Unity Game view large; burn in English captions (judges may watch muted); speed up waiting (Gemini, video import) 2–4×; use your own footage and royalty-free music so YouTube does not block the video; upload as Unlisted and check it plays in a private window.
