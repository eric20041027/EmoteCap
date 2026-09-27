# Video import — design

Date: 2026-09-27 · Lane: Web (+ motion-core untouched) · Status: approved in chat

## Goal

Turn an existing video file (mp4 / mov / webm, up to 3 min) into the same take a live recording produces, so it flows through the
existing Review → Gemini auto-slice → Export FBX → Unity auto-import pipeline unchanged.

## User flow

1. The capture dock gets an **Import video** button (file picker: `video/*`).
2. While converting:
   - live camera tracking is paused (the GPU goes to the import);
   - the Camera panel shows the video frame being analysed with the skeleton overlay;
   - the 3D preview (and Unity, when Live Link is on) follows each solved frame;
   - the dock shows progress, time left, and **Cancel**.
3. When done, the take opens in the existing Review panel. Gemini slices the **original file**; export is unchanged.

## Frame reading: seek per frame

Measured in Chromium on a 27 s, 1706×1280 VP8 take: ~54 ms per `currentTime` seek, stable. Pause/play stepping with
`requestVideoFrameCallback` stalled after 60 frames, so it is not used.

- Sample times `0, 1/30, 2/30, … ≤ duration` (30 fps, the export rate).
- For each time: set `currentTime`, wait for `seeked`, run PoseLandmarker (Heavy) on the `<video>` element and, for the
  Body + Fingers skeleton, HandLandmarker on every frame. MediaPipe timestamps are video time in ms.
- MediaRecorder WebM files report `duration = Infinity` until scanned: seek far past the end, wait for `durationchange`, then seek to 0.

## Solving

- A fresh `createPoseSolver()` per import: no live T-pose calibration (the person in the video is someone else); the current
  smoothing level applies.
- Auto-calibration (added after the first version): pass 1 reads every frame and marks T-pose frames from the 2D image
  landmarks (straight, level arms held for 8 frames); pass 2 re-solves the whole take with a fresh solver calibrated from the
  first such frame. Review shows where the take was calibrated, or warns when no T-pose was found.
- Frame `t` = video time in seconds (not re-based), so Gemini's timestamps line up with the motion.
- If the first frames have no person, the first solved frame is copied to `t = 0`.

## Units

| Unit | Purpose |
|---|---|
| `capture/landmarkers.ts` | `createLandmarkers(quality)` moved out of `usePose.ts`, shared by the camera and the import |
| `import/videoSource.ts` | `openVideoFile(file, video)`: load, fix Infinity duration, validate; `seekTo(video, t)` |
| `import/frameTimes.ts` | pure: `sampleTimes(duration, fps)`, `holdFromStart(frames)` |
| `import/convertVideo.ts` | the loop: seek → detect → solve → report progress; honours an `AbortSignal` |
| `import/useVideoImport.ts` | state: idle / loading / converting (progress) / failed; `start(file)`, `cancel()` |
| `import/ImportButton.tsx`, `import/ImportProgress.tsx` | dock UI |
| `useRecorder` | new `load(frames, video)` action: idle → recorded with the source file |
| `usePose` | new `paused` flag: skip detection while importing |

## Errors

- Not a video / cannot decode → message in the dock, back to idle.
- Longer than 180 s → refused (Gemini limit, `MAX_TAKE_SECONDS`).
- Larger than 100 MB → converted anyway; auto-slice uses the existing split-at-pauses fallback (`too-large`).
- No person found in any frame → "No person found in this video".
- Cancel → back to idle, nothing kept.

## Testing

- TDD (vitest, node): `sampleTimes`, `holdFromStart`, `convertVideo` with a fake reader/detector (progress, abort, no-person),
  recorder `load` reducer action.
- Manual: import a stored take (`server/data/takes/*.webm`) → Review → auto-slice → Export FBX → clip appears in Unity.
