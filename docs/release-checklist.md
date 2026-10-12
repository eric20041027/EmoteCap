# Release checklist

This is a required gate for a formal release, not a claim that the rebuild has passed. Record immutable evidence/source digests and mark each item only after its actual outcome. See [release progress](release-progress.md).

## Fixed source and validation

- [ ] Choose a reviewed, clean, fixed source commit with all required changes; preserve original history/contributors.
- [ ] Run relevant frozen backend/Web/type/assets/security/build suites and actual Windows/macOS/Linux CI for that source. M1-only CI does not cover later work.
- [ ] Run fresh read-only source/current/history credential scans; resolve every finding/scan limit and retain redacted receipts. No stale scan is a final gate.
- [ ] Verify motion/project/media/export/relay contracts and coordinated consumers; preserve original take frames and recovery.
- [ ] Verify actual SDK inference/network behavior against the privacy disclosure, distinct from synthetic lifecycle/sample-only request checks.

## Rights and notices

- [x] Owner approved MIT/header and original project source rights on2026-10-08, including the permission basis for leokao0806's README contribution; [record](release-license-proposal.md). Formal tag/release approval remains separate.
- [x] Owner confirmed all four media files are self-produced with no third-party material and approved their publication: hero.gif, dozed-off.gif, import-video.jpg, gemini-slicing.jpg; [record](release-license-proposal.zh-TW.md).
- [ ] Establish separate rights for the three hashed model assets, SDK/WASM, exact npm/Python/runtime/native dependencies and any UPM dependency/fixture. Copy required full license/notice texts with source/version/hash inventory.
- [ ] Resolve native runtime redistribution conditions, including Microsoft runtime components; supplied Python licenses alone are not that approval.
- [x] Add the owner-approved project MIT LICENSE to source and standalone UPM; new Windows builds deliver/hash-bind it.
- [ ] Complete third-party notices and redistribution assessment for all included upstream material. The project LICENSE does not replace their terms.

## Actual product acceptance

- [ ] Pass actual Blender direction/meters/bind/timing checks for the fixed supported version/source; retain receipts.
- [ ] Activate an appropriate Unity Editor license through the owner, then compile/run receiver/importer and playback on two authorized redistributable Humanoid rigs. Verify paired connect/stop/reconnect/expiry, UPM tests/samples/docs and original-motion parity.
- [ ] Run authorized real-video/camera quality evaluation with original/new measurements, tracking failures, jitter/foot sliding and honest support limits.
- [ ] Measure Fast720p effective FPS and p95 latency on the agreed target laptop; record hardware/browser/settings/input and measurement definition.
- [ ] Rebuild the Windows candidate from the final source including the SDK choice/new documentation/notices; validate complete manifests, deterministic ZIP SHA256, runtime isolation, tamper/failure handling and private config/data paths.
- [ ] Test on an actual clean Windows machine without developer runtimes; verify one-entry startup, sample/save/reload/backup/import and real export. Same-machine PATH isolation is not clean-machine evidence.
- [ ] Run the beginner study with five new Unity users; at least four independently finish the agreed sample workflow in ten minutes. Record timings/failures/assistance with participant consent; scripted browser tests do not replace this gate.

## Reviewable publication

- [ ] Prepare fixed-version UPM/source-linked release files, artifact SHA256 and support/operation/privacy/known-limit documentation. Inspect final packaged contents and scan for credentials/private media/unapproved assets.
- [ ] Verify every required gate above is green and any optional limitation is explicitly owner-accepted; no mandatory pending box is silently waived.
- [ ] Show the exact source commit, artifacts/checksums, tag, release title/body and publication destination for owner approval.
- [ ] Confirm authorization covers the exact final publication actions and contents. New branch pushes, draft PRs and CI are already authorized in this session; PR1/2merges were separately approved and completed. Do not infer approval for additional remote main merges, public tags or binary/GitHub releases from those earlier permissions.
- [ ] Publish only the approved contents and verify the resulting URLs/digests/state; attach any created PR to the task. Record publication separately from local completion.

Checked rights items rely on the owner's explicit2026-10-08confirmation. Existing software/artifact qualifications retain their linked source scopes; remaining boxes are not waived. This document does not merge, tag or publish a release.
