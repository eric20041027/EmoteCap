# Observed dynamic-hand qualification

This adds genuine moving-hand evidence at clean source `3299e7df29773e5cfd6c17bf9609c8ad3ba91619`. Production source, models, the 28px hand-size threshold and pairing policy are unchanged. Physical capture, angle accuracy, physical handedness, target-laptop performance and full release acceptance remain pending.

## Inputs and attribution

| Input | Author / source license | Unchanged original SHA256 | Scope |
|---|---|---|---|
| [BIM sains.webm](https://commons.wikimedia.org/wiki/File:BIM_sains.webm) | PeaceSeekers, CC0 1.0; source revision 1167059437 | `6e026bb518eeaee5e6730c03dad429463bec3610bc05c6b4223d878e1699e64e` | 1,827,291 bytes, 1440×1440, 4.24s. Cropped upper body signing; legs absent. |
| [Finger-counting in Dutch.webm](https://commons.wikimedia.org/wiki/File:Finger-counting_in_Dutch.webm) | S. Perquin, CC BY-SA 4.0; source revision 1252975483 | `f7a935305dcba7385a382121bf2bcc143696d26427f7e5a7c83f9e9fc36a5a4d` | 5,721,399 bytes, 1920×1080, decoded 13.256s. Two hands unfolding fingers; body absent. |

Sources, derived contact sheets, motion downloads and SDK metric bodies remain private local evidence. This report publishes attribution and numeric observations only; it does not adopt a project license or authorize public binary/media distribution.

## Production collector and core preservation

BIM runs use the actual Accurate/Heavy production video collector, full skeleton, medium smoothing, zero warmup, 30Hz planned samples, MediaPipe 1.0.1 and the unchanged Hand model. Both GPU delegates execute through software SwiftShader in Edge 154.0.4258.62. SDK metrics permission and local-input authority are explicitly selected. Default denial and permission alone produce no model/external requests; each admitted run records six external requests and zero page errors. Metrics may be sent to Google; image/video processing is local.

The rebuilt and original MVP converter/solver runs each complete **127 successful attempts and 127 final frames**, spanning sampled input time 0–4.2s. The original source is `713d349df05aa26b6b95a1b7974f7f3d8e574149`, selected with build digest `4916fce7616d8b8e7a3b1db59f54b539938311d36d21fa8625cc4718064d26db`; both runs share the current pinned SDK/models. This is original converter/solver preservation, not reconstruction of the historical inference environment.

All **24,892** final frame numbers (`t`, three hips values, 192 rotation values per frame) match exactly: maximum absolute difference **0**. Attempt-level assigned hand sides also match. Left is assigned in 120 frames, Right in 102, with at least one side in 120 frames (222 side assignments). These are production assignments, not independently verified anatomical labels or accuracy measurements.

Offline collection wall times are 148,626.1ms rebuilt and 148,508.6ms original. These desktop software-rendered observations do not qualify comparative performance, real-time camera FPS or the target-laptop Fast 720p gate.

## Hand-only sparse temporal control

The Dutch control uses the unchanged production Hand factory and VIDEO inference at **14 prespecified times, 0–13s at 1Hz**. The Fast pose model is loaded by the shared factory but is not inferred; no body pose or pose-wrist association is supplied. The unchanged no-pose assignment policy is called separately. This diagnostic is not a full-body capture or continuous 30Hz replay.

There are **26 raw hand detections and 20 assigned sides**. At times 5, 6, 7, 8, 9 and 10 seconds the SDK labels both detected hands with the same side; the existing policy retains one per side. No detection is below the 28px threshold (minimum measured knuckle span 275.623px). These six omitted assignments reflect duplicate labels in this control, not the size filter.

PIP inner angles are computed from SDK world landmarks with a bounded cosine. Grouping by screen wrist position yields 13 observations per screen region:

| Screen region | Index | Middle | Ring | Little |
|---|---|---|---|---|
| Left half | 120.6–176.4° | 100.3–150.8° | 103.0–163.0° | 97.9–166.2° |
| Right half | 100.3–175.9° | 79.0–153.2° | 81.3–171.8° | 78.3–168.6° |

These varying estimates complement the source's visually observed unfolding. Screen halves do not establish physical handedness or identity across frames. No measured ground-truth joint angles, error bound, dropout accuracy or solver finger-quality acceptance is claimed.

## Retained failures, review and completion gates

- The first hand diagnostic fails before inference because a bare browser module import cannot resolve the SDK. The retry uses the actual production factory.
- The full 30Hz hand diagnostic exceeds its 180s owned-driver bound while run concurrently with the initial original BIM probe. It retains no completed result and is excluded. The precise timeout stage is unknown because that harness had no per-frame progress.
- The initial original BIM probe exceeds its 170s download-link wait during that concurrency. It is excluded; no product defect or performance conclusion follows from the timeout alone.
- Fresh bounded probes preserve these failures in separate immutable output directories. The sparse hand probe adds per-stage/frame receipts and decode/seek deadlines; the serial original probe adds periodic page-state receipts, a 360s inner wait and a 420s outer bound. Both complete with exit 0 and terminal owned-process-tree receipts.

One independent review of the new private harness/analysis source reports **0 Critical, Important or Minor findings**. It approves diagnostic source only; at its inspection the bounded original run was active. The implementer subsequently verifies that run's successful terminal receipt before executing final analysis. No second code review or inference rerun is used to imply broader acceptance.

Rulings: retain all audit evidence rather than overwrite failed runs (cost: local storage); use a declared sparse hand-only control after the incomplete full replay (cost: continuous dropout/transition behavior remains unmeasured); preserve threshold/pairing policy and report duplicate labels (cost: anatomical identity and crowded-hand behavior remain unqualified); publish numeric report only (cost: reviewers need local evidence access for raw media). Declined accuracy/performance/handedness judgments remain explicit pending gates. No deferred minors.

Local evidence root: `.superpowers/sdd/2026-10-08-dynamic-hands-3299e7d/`. `current/`, `original-bounded/`, `finger-sparse/`, source receipts and `dynamic-analysis.json` bind the observations. Failed `original/`, `finger-current/` and `finger-current-v2/` remain separate. All owned drivers and servers are terminal; ports 53542/53543 are released as recorded in `postflight.json`.

M4 still needs broader annotated motion/finger quality, contact/jitter/direction checks, actual camera/calibration and the target laptop. M5 still needs rights clearance, a second clean machine, five independent new Unity users and owner-approved formal release. This scope changes no release gate to complete.
