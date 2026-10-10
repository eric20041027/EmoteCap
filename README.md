# EmoteCap

Act once. Animate anything.

A local motion studio for turning camera or video performance into Humanoid animation. This rebuild keeps the core of our hackathon-winning, twelve-hour MVP and adds saved projects, editable clips, portable backups, durable exports and explicit processing choices.

**Status: unreleased development preview.** These instructions apply to the rebuilt checkout; use the fixed development source recorded in release progress. Default main, stacked development PRs and the historical demo have separate scopes. No approved public installer or release of this rebuild is available yet. [繁體中文快速上手](docs/quickstart.zh-TW.md) · [Release progress](docs/release-progress.md)

## What works in the local rebuild

| Workflow | Current qualification |
|---|---|
| Synthetic sample → edit → save → reload → backup/import | Actual Edge with native browser storage; no camera or cloud key needed |
| Camera/video → original take → editable clips | Actual SDK capture/storage/export workflow and scoped physical Mac observations exist; complete tracking/encoder/hardware quality remains pending |
| `.emotecap` project backup, optional source video | Validated archives; import creates a new project identity; original motion preserved |
| FBX jobs, cancel/retry/restart recovery | Local service and Blender export qualified; each job preserves its submitted clip revision |
| Paired local Live Link | Service/browser/paired Unity receiver accepted locally; original-rig FBX/player/render evidence added; sample review/corrections verified locally; physical acceptance pending |
| Windows package | Current internal candidate includes SDK choice and native frame capture; actual SDK/save/import/Blender export passed locally; complete notices/rights, clean-machine and new-user acceptance remain pending |

The current motion contract has **48 driven bones**, with **52 full-skeleton export bones** or **22 body-only export bones**. Coordinates, meters, bone order and validation are defined in the [motion v2 contract](contracts/motion-v1.md); its historical filename is retained.

## Start from this source checkout

Use Node **24.19.0**, npm **11.21.0**, and uv **0.12.6**. The launcher selects Python **3.12.14**. Keep the committed lockfiles. In a Windows terminal at the repository root:

```powershell
cd web
npm ci
npm run build
cd ..
.\start.cmd
```

The first Web build downloads and verifies approximately48MB of model assets. Studio opens in your system browser at **http://127.0.0.1:8787**. Keep the terminal running; Ctrl+C stops the service. An occupied port reports an error without stopping another application. If the browser does not open, use the printed address after startup succeeds.

For Linux/macOS source development use root `./start.sh` after the same build. Current Windows candidate tests, scoped Mac M2/Unity observations and exact-source three-OS CI retain their own limits; they do not establish complete product/platform support. See [source operation](docs/local-start.md), [development](docs/development.md), [internal Windows candidate](docs/windows-candidate.md) and [platform evidence](docs/release-progress.md#platform-evidence-and-pending-support).

## Try it without a camera

1. Select **Use sample project**. The synthetic right-arm take contains60original frames.
2. Rename **Clip 1 name**, adjust its time range, or use **Find pauses**. Wait for **Saved**.
3. Select **Download project** to keep an `.emotecap` backup.
4. Reload the page; your clip edits and original take remain. Select **Import project** to restore the downloaded backup into a new project identity.

Browser saving is a recovery copy for that browser and exact address. Download a backup before changing browser, port, address or machine, then import it at the new location. Source video is optional and has its own retention/backup choices.

Clip **Play** previews the same trimmed, resampled and smoothed motion prepared for export. **Play original take** reviews the captured frames. The source label identifies the current preview; editing a clip stops its preview until you press Play again. Both controls preserve the original take.

## Capture and export

For a new take, read **Camera and video processing** and choose whether to allow MediaPipe performance and usage metrics. Then explicitly select **Start camera** or **Import video**. Use **Calibrate T-pose**, **Record** and **Stop**, then review clips. Turning processing off stops new work and preserves recorded motion through final save. The choice resets on reload. Real camera/video quality and target-laptop performance remain release gates.

FBX export requires a separate Blender installation. Actual qualification covers **Blender4.5.14LTS**; other versions need verification. Start with your quoted executable path, for example:

```powershell
.\start.cmd --blender "C:\Program Files\Blender Foundation\Blender 4.5\blender.exe"
```

Select **Export FBX** and follow **Export jobs** for completion/download, cancellation or a new retry. Blender and Unity are not bundled. The local Unity UPM0.2.0requires6000.5; actual Windows6000.5.9f1Editor and paired receiver tests run locally. Enter Play mode first, paste Studio’s code in the receiver Inspector, then Connect. Source is available through stacked draft PRs, but no approved rebuilt release is available; install the package from your fixed checkout using Add package from disk. [Receiver guide](unity/com.emotecap.mocap/Documentation~/paired-receiver.md). The original [Starter Rigs sample](unity/com.emotecap.mocap/Documentation~/sample-playback.md) creates a saved two-character scene and plays real FBX without a camera/key/pairing. Actual Windows6000.5.9f1/Built-in checks and focused Mac6000.5.9f1 ordinary Package Manager/sample playback passed in their tested scopes. Complete physical/hardware/new-user/rights/publication gates remain pending;2021.3is unqualified.

## Data and processing choices

MediaPipe processes image/video inputs on the device and its APIs send performance/utilization metrics to Google, according to the [upstream privacy notice](https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/tasks/web/vision/README.md). EmoteCap requires a session choice before camera/video processing. Checking alone starts neither. Already-started operations may finish and already-sent metrics cannot be recalled. [SDK privacy guide](docs/sdk-privacy.md)

**Keep source video** controls local retention; **Include source video in backup** controls portable media. Optional Gemini suggestions require a separate selected-source consent and explicit **Send selected video**. A Gemini key is unnecessary for samples, tracking, local pause detection, backup or export. Source settings use private root `.env`; packaged settings use `%LOCALAPPDATA%\EmoteCap\settings.env`. Never place settings or captured media in the public Web directory. Server jobs and browser projects are separate stores. [Source operation](docs/local-start.md)

## Development and release

Read [CONTRIBUTING](CONTRIBUTING.md), [development checks](docs/development.md), [SECURITY](SECURITY.md) and [CHANGELOG](CHANGELOG.md). Motion/relay/archives have versioned contracts; keep their consumers coordinated. Publication requires the [release checklist](docs/release-checklist.md), fresh validation and explicit owner approval.

Project-owned code, documentation and original assets are [MIT licensed](LICENSE), following the owner's [confirmed rights record](docs/release-license-proposal.md). Dependencies, models and runtimes retain their upstream terms; complete redistribution assessment and formal release acceptance remain separate.

## Origin

EmoteCap began as the winning HackNite MVP described in the [historical submission](docs/submission.md). The [original demo](https://youtu.be/ETPATTBDosc) shows that prototype, including its earlier Unity/cloud flow. Original contributors include **eric20041027** and **leokao0806**; their history and attribution are preserved. The owner confirmed the four existing demo images/GIFs are self-produced and approved their publication on2026-10-08; this entry keeps them unembedded.
