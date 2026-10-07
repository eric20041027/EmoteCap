# Camera and video processing

EmoteCap uses MediaPipe Tasks Vision 1.0.1 for camera and imported-video tracking. Its [upstream privacy notice](https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/tasks/web/vision/README.md), dated June 5, 2026, says image and video inputs are processed on the device and performance and utilization metrics are sent to Google. Read the [Google Privacy Policy](https://policies.google.com/privacy) before choosing whether to use this processing.

The **Allow MediaPipe performance and usage metrics** checkbox starts unchecked. Checking it grants a choice for the current page session; it does not open a camera, load a model or start detection. Use **Start camera** or **Import video** explicitly afterward. Reloading the page resets the choice. It is not saved in projects, browser storage or `.emotecap` backups.

Samples, saved motion, clip editing, project backup and FBX export remain available with the checkbox unchecked. Blender is required for FBX export; it does not require MediaPipe processing permission.

## Turning processing off

Uncheck the same checkbox at any time, including while capture or import is busy. EmoteCap invalidates the current processing authorization immediately, stops new processing, closes owned camera/model resources and cancels an unfinished video import. A recording ends through its normal stop and save path, preserving the original motion frames already captured. A countdown ends without adding an empty take. Completed projects and retained source-video choices stay available.

An operation that already started may finish. Turning processing off cannot recall metrics already sent to Google. EmoteCap does not claim to disable undocumented SDK telemetry or delete provider metrics.

## Separate source-video choices

**Keep source video** controls local retention. **Include source video in backup** controls what is placed in a downloaded backup. **Allow sending the selected source video to Google Gemini** is a separate choice, followed by an explicit **Send selected video** action. MediaPipe permission grants none of these choices and does not authorize a Gemini upload.

## Qualification

Lifecycle checks use owned synthetic camera streams, controlled model promises and a synthetic video decoder in actual Edge. Production sample checks observe requests with camera/model processing unused. These checks establish the application's admission, cancellation and saved-motion behavior; they do not measure real MediaPipe telemetry, physical-camera tracking or provider retention. Actual SDK inference/network qualification remains a release gate.
