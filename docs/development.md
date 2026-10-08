# Development

Use Node 24.19.0, npm 11.21.0, Python 3.12.14, and uv 0.12.6.
Install dependencies with the committed lockfiles. Do not run an upgrade as
part of routine setup. `.env` and captured media stay local.

This guide applies to the rebuilt checkout. Start with the [English entry](../README.md)
or [Traditional Chinese walkthrough](quickstart.zh-TW.md). Current qualification and
pending human/device/rights gates are in [release progress](release-progress.md);
publication requires the [release checklist](release-checklist.md).

Private [Studio camera measurements](camera-measurements.md) and [video import measurements](video-measurements.md) run through separate development HTML entries. They retain raw failures and explicitly distinguish synthetic controls from actual authorized hardware/source qualification; default production builds omit these tools.

## Setup and checks

In `web/`:
```text
npm ci
npm run test:assets
npm run test:security
npm run test:baselines
npm run audit:deps
npm test
npm run build
```

In `server/`:
```text
uv sync --frozen --python 3.12.14
uv run --frozen --python 3.12.14 pytest -q -m "not slow"
```

The Web prebuild downloads approximately 48 MB of models when absent and
verifies their SHA256. Valid caches can be reused offline. The scripts use
Node system certificates and environment proxy support; configure your
normal proxy/certificate environment if necessary. Never disable TLS
verification or replace a recorded digest just to make a download pass.

The security characterization checks that the installed source-map consumer
rejects dangerous offsets while preserving normal mappings. The dependency
audit queries the npm registry and requires network access; a registry error
is not a clean audit.

## Run locally

After the frozen Web build setup, [one source entry](local-start.md) runs the
production Studio and service together: root `start.cmd` on Windows or
`start.sh` on POSIX, then http://127.0.0.1:8787. The launcher uses private
user-local server data and the source `.env`; explicit flags select paths,
Blender and port. Browser project migration uses a portable backup/import
when changing origin. The two-terminal development flow below remains available.

Copy the root `.env.example` to `.env` if configuration is needed. Set
`BLENDER_PATH` to your local Blender executable for FBX export. Gemini is
optional. Start the server in `server/`:
```text
uv run --frozen --python 3.12.14 uvicorn emotecap_server.main:app --host 127.0.0.1 --port 8787
```
In a second terminal in `web/` run `npm run dev`, then open
`http://localhost:5173`. Stop both terminals when finished.

Live Link is off by default and uses [paired local Live Link v1](../contracts/live-link-v1.md).
Explicitly enable it in Studio, copy the Unity pairing code and use a receiver
supporting that handshake. The service checks exact motionv2 bones and one source
per pairing.1008rejects incompatible/expired connections; Stop invalidates the code
when confirmed. Failed cleanup stays visible with its code/expiry and a retry action.
The local0.2.0paired receiver targets Unity6000.5.9f1onWindows. Enter Play mode, paste the code in its Inspector, then Connect. [Receiver guide](../unity/com.emotecap.mocap/Documentation~/paired-receiver.md) records the accepted receiver scope. [Starter Rigs](../unity/com.emotecap.mocap/Documentation~/sample-playback.md) adds actual two-rig FBX/player/Built-in graphics qualification. The historical0.1.0unpaired component remains incompatible;2021.3, other targets and physical/hardware/human acceptance remain unqualified.

## What the checks prove

The three-platform CI checks source logic, protocol parity, input validation,
model integrity, types, and the Web build. It uses no Gemini API key.
It does not run a camera, real Blender export, or Unity playback.

CI installs uv directly with its pinned official action, then installs the
pinned managed Python using `uv python install 3.12.14`. The setup-python
action does not provide this Python build on every target runner. CI keeps
the same interpreter version, dependency locks and test commands on all OSes.

With Blender configured, run `uv run --frozen --python 3.12.14 pytest -q -m slow`
from `server/` for the real export smoke tests. A skipped test is not a pass.
Before a release, also verify right-arm direction, scale, timing, and playback
in Unity using both shared fixtures and approved sample recordings.

For the actual original-rig/FBX/Unity lane, use the managed server Python and installed runtime paths from the repository root:

```text
server/.venv/Scripts/python.exe scripts/unity-quality.py --output .superpowers/sdd/2026-10-08-unity-quality/fresh-run --unity "<installed Unity6000.5.9f1 executable>" --blender "<installed Blender4.5.14 executable>" --powershell "<installed PowerShell7 executable>"
```

The output must be fresh. This creates only an owned project, runs real Blender, imports the sample, launches hidden batch Editors with actual graphics for rendered checks and exercises production local relay/player behavior. XML must contain all required original/new classes with zero failures/skips. Exact source/material hashes and owned PID/port receipts are retained. It does not establish physical capture, target-laptop performance, complete redistribution rights or public release readiness.

## Changes and review

Use small `feat:`, `fix:`, `test:`, `docs:`, `build:`, or `chore:` commits.
Run checks for the code you change and request review. Keep original motion
fixtures and valid v2 consumers working. Update contract documentation and
all consumers together if a future version changes the wire format.

Do not commit third-party character models, raw personal recordings, keys,
runtime exports, or dependency directories. Release packaging and licensing
have their own acceptance criteria in the product plan.

MediaPipe capture/import requires the [session processing choice](sdk-privacy.md),
which is separate from Gemini source-video sending. For static documentation-only
changes, verify controls, commands and local links; do not add tests that mirror
prose. See [CONTRIBUTING](../CONTRIBUTING.md) and [SECURITY](../SECURITY.md).
