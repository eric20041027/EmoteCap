# Current native-frame candidate: actual SDK workflow and captured export

The Windows internal candidate built from `3967beb98c9781b18ab737d3f2f70ed8b8e6dc6d` passed the actual SDK capture, native IndexedDB checkpoint, withdrawal, reload, portable backup/import and captured-take Blender export workflow on the existing development machine. This qualification changes documentation and private validation tools only. It does not complete the M1–M5 release checklist.

## Fixed inputs and environment

| Input | Observed identity |
| --- | --- |
| Application source | `3967beb98c9781b18ab737d3f2f70ed8b8e6dc6d` |
| Internal candidate ZIP | 88,518,977 bytes; 5,764 members |
| ZIP SHA256 | `d82ce36debfedd0d4c901af67c7c09d94e6821bef17b9215c1c5e9540789c549` |
| Owned mannequin stream SHA256 | `a2f65e0edf8248b666386488c92f8d968bee80a32b88e6557dd08e44e4cc80c2` |
| Browser | Edge `155.0.4283.45`; actual SwiftShader renderer |
| SDK/runtime | Unmodified Tasks Vision 1.0.1 and candidate models; bundled Python 3.12.14; actual Blender 4.5.14 LTS |
| Source | 640×480 canvas stream from the existing self-produced fixture; native video-frame request/cancel APIs present |

The plan expected the previously observed Edge 154. The installed browser reported 155 during this run; the receipt records that version and makes no cross-version performance comparison. Only `getUserMedia` was substituted. SDK/model inference, native IndexedDB, production packaged Web/API and Blender were exercised without inference or API doubles. Gemini was disabled. The service ran with System32-only PATH and a deliberately poisoned PYTHONPATH, using the bundled isolated Python entry point.

## Observed workflow

- The default SDK choice denied processing. Granting the choice alone did not request a camera or load models, and neither phase produced external page requests.
- Actual SDK recording persisted a 19-frame native IndexedDB checkpoint while the take was still recording. Withdrawal completed the take with 27 frames; the original 19-frame prefix was unchanged. The owned source track stopped and two actual model graphs logged successful closure.
- Reload preserved all 27 original frames exactly. A 14,929-byte `.emotecap` backup contained only the manifest and project JSON, with no retained source media. Import created a new project identity and preserved the complete frame arrays. The take remains labelled `camera` by the product, while this test is explicitly classified as synthetic.
- The imported captured take produced its own successful export job at clip revision 1. Its authentic input bytes, SHA256, project/take/revision snapshot and job-specific FBX were checked. A separate sample project then produced another successful job; it did not substitute for the captured export.
- Browser/local-service Live Link acknowledgement and revocation succeeded. This run did not add Unity receiver or slow-receiver evidence.
- Actual withdrawn, desktop and 390-pixel viewport screenshots were inspected. The narrow viewport had no horizontal overflow; no page errors were recorded. This is a layout observation, not a fresh comprehensive accessibility audit.

Backup SHA256: `3efdd9006b1e0f7415b6b7bc222aaee36ce3390ce8b34b15172c558945c38df0`.

## Captured export fidelity

The 27 original frames were processed into 202 output frames at 30 FPS, ending at 6.7 seconds. A separately executed reconstruction using the frozen production `makeClip` modules reproduced the output attributes and timestamps. The largest component difference was `3.3306690738754696e-16` across 342 differing components, below the recorded `1e-12` tolerance. This is numerical agreement, not byte equality; resampling is not original-frame loss.

The independent Blender roundtrip oracle imported the actual captured FBX and compared every processed timestamp against the authentic job input:

| Measurement | Actual result | Existing bound |
| --- | --- | --- |
| Bones / samples | 52 / 202 | Complete canonical skeleton and processed timestamps |
| Maximum angular error | 0 degrees at the oracle's reported precision | ≤0.5 degrees |
| Maximum position error | 0.00010645885555426634 metres | ≤0.001 metres |
| Duration / duration error | 6.7 seconds / 0 seconds | ≤one output frame |
| Duplicate key times | 0 | 0 |

Captured input SHA256: `8e637cab8041f5f48f2fc784f4f47f1cdbdb0f117cbebeddd0eff990dbb624b3`. Captured FBX: 1,356,908 bytes, SHA256 `a12b550d61c426b3f9767cac5613329eef60bbbf84771314ccc5fdd133674802`. The independent sample FBX was 595,868 bytes, SHA256 `ae06c19042cb4d35f82140abbfa030fdf035e27b4cf17afdb092bbb9d7193d6c`.

These results establish export fidelity for this take. They do not establish physical body/finger accuracy, jitter, foot contact, anatomical Humanoid retargeting or target-laptop performance.

## Traffic, failures and lifecycle

Five model/WASM requests were local and occurred during admitted processing. Two external POST requests to the disclosed Google ODML `/v1/log` endpoint were observed during withdrawal, with body lengths 140 and 141 bytes. The private network receipt retains phase, origin, path hash, method, body length and body hash, without body contents. Opaque bodies were not decoded; these observations do not prove absence of image data, provider retention behaviour, or all traffic outside the observed page. Withdrawal is not described as zero traffic or retroactive deletion.

The explicit wrong-source control rejected the older `53ea1d5` candidate before service/model startup, with actual exit 1 and its executed probe bytes retained. The first current-source run also exited 1 after captured export: the inherited test helper checked Saved text and then independently read a switching project ID, throwing on a not-yet-returned IndexedDB row. Its raw projects, captured output and failure remain intact. The second run used a coherent DOM identity/revision/save tuple and exact native IndexedDB row, retrying missing rows and rechecking project identity. No production data-loss defect or fix is claimed from that harness failure.

The successful SDK run and independent Blender oracle each recorded actual exit 0 and terminal owned process trees. Service termination remains explicitly `SIGTERM` with a null normal exit code. Successful targeted CIM and TCP queries at `2026-10-10T05:40:22Z` found none of the six recorded owned PIDs and no listeners on the two owned ports. Original successful, failed and rejected outputs were preserved.

Full candidate manifest/ZIP contents, frozen consumed application/tool/fixture files, actual executed probe, job inputs and FBX bytes were independently verified after execution. Existing exact-source CI from the preceding implementation is retained; no duplicate product test/CI run is implied by this documentation-only qualification.

## Original requirement audit

All original 22 outcomes remain in scope. Earlier qualifications retain their original source/environment limits. No mandatory release gate is waived.

| Requirement | Effect of this run and remaining limits |
| --- | --- |
| M1.1 subprocess/contracts/validation/cache | Previous software evidence retained; no new full suite. |
| M1.2 vulnerable build dependency | Previous reviewed fix retained; no new dependency change. |
| M1.3 Windows/macOS/Linux CI | Previous exact `3967beb` six successful checks retained. |
| M2.1 identities/immutable take | Current actual SDK checkpoint prefix and full arrays preserved. |
| M2.2 autosave/refresh/5-second checkpoint | Current native IndexedDB checkpoint and refresh proved in this controlled stream; not all hardware or arbitrary crash modes. |
| M2.3 portable backup/import/validation/media | Current exact backup/import without media proved; prior other format checks retain their scope. |
| M2.4 diagnostics/sample/keyboard/recovery | Current sample and layout observations; prior checks retained, no new full accessibility audit. |
| M2.5 record/save/reload/restore/edit/quota | Current actual SDK record/reload/import/export proved; no fresh quota-failure or physical-camera proof. |
| M3.1 bounded jobs/revision/cancel/retry/outputs | Actual captured and sample revision-bound outputs; other queue/cancel/retry checks retained. |
| M3.2 restart/timeout/collisions | Prior checks retained; no fresh interruption test here. |
| M3.3 media/Gemini consent | Actual SDK admission/withdrawal and disclosed cleanup observations; Gemini disabled, no new provider-retention proof. |
| M3.4 paired Live Link/slow receiver | Browser/service acknowledgement and revocation only; prior Unity evidence retained. |
| M4.1 authorized original/new motion quality | Synthetic capture cannot close broader body/finger/occlusion/jitter/foot quality. |
| M4.2 Blender direction/metres/timing | Authentic captured export canonical fidelity passed for all 202 timestamps. |
| M4.3 two Humanoid rigs/UPM | Earlier Windows/Mac Unity evidence retained; no new Unity run here. |
| M4.4 Fast720p laptop/support matrix | Pending fixed-source physical Mac B2 and final support measurements; this stream is 640×480/software WebGL. |
| M5.1 Windows distribution/startup | Current internal candidate actual SDK workflow passed on the same isolated machine; second clean Windows still pending. |
| M5.2 rights/notices/security | Owner MIT/asset approvals retained; remaining SDK/model/native redistribution and final-source scans are not closed. |
| M5.3 bilingual/community documentation | Previous deliverables retained; this report adds bounded validation evidence. |
| M5.4 five new Unity users/4 of 5 in 10 minutes | Pending five distinct consenting users; automation does not replace them. |
| M5.5 versioned UPM/artifact hashes/checklist | Internal reproducible candidate and hashes retained; formal artifact gate pending. |
| M5.6 owner-approved public release | Pending full gates and exact publication approval; no merge/tag/release performed. |

Private artifacts are retained under the ignored workspace `.superpowers/sdd/2026-10-10-current-frame-sdk/`. Recorded poses, local settings, jobs, pairing material and source video are not included in this public report.

## Final review

One fresh strongest-model Native reviewer approved the scoped documentation and private validation changes: zero Critical, Important or Minor findings. The reviewer independently reran the read-only postflight successfully and did not repeat SDK/camera/service/Blender execution. The six excluded judgment areas above remain pending or retain earlier evidence limits; no correction pass was needed. Private receipts and failed runs remain preserved for audit.
