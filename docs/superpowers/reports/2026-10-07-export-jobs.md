# M3 export jobs

Date2026-10-07. Branch feat/studio-projects; plan base e6e631f. Parent goal remains M1–M5. [Spec](../specs/2026-10-07-export-jobs-design.md), [plan](../plans/2026-10-07-export-jobs.md), [wire contract](../../../contracts/export-jobs-v1.md).

## Behavior

Studio submits immutable project/take/clip revision metadata and actual built clips. One owned Blender lane accepts4waiting jobs plus1running, with128retained records and bounded frame/request/output limits. Cancellation terminates only its owned process; complete-directory publication serializes against cancel and isolates UUID download folders. Within-batch names are disambiguated case-insensitively. Unity copies use separate UUID folders; a copy failure leaves valid local downloads and a visible warning.

Canonical inputs are fsynced and SHA256 identified before SQLite acceptance. Queue/running records recover as interrupted after restart; explicit retry uses the saved digest/revision and a new job ID. Missing/tampered input rejects instead of rebuilding current clips. A per-directory platform lock rejects another manager. Failed metadata acceptance cleans only its newly created, contained unpublished directory. Explicit terminal deletion removes service downloads/input; user-project Unity copies remain.

The job panel shows phase/progress, submitted revision, errors/warnings and Cancel/Retry/Delete/downloads. Serial bounded polling restores service jobs after refresh, preserves last-known jobs when offline and rejects stale lists after actions. Clip editing remains available while queued/running. Closing the UI stops HTTP polling without cancelling service work. The old synchronous API uses this same queue, with isolated returned URLs.

## Evidence

- Watched same-name overwrite and case-only collisions; owned-runner characterization lacked progress/cancel/timeout/errors. New regressions pass. Actual owned Python children test cancellation, deadline cleanup and bounded output, including multibyte UTF8 and progress-persistence failure.
- Watched19repository/service failures and10API404/legacy-lane failures. Durable restoration, digest-preserving retry, active/queued cancel, final-boundary cancel, queue/history capacity, parallel admission/single worker, corrupt/missing input, persistence failure/orphan cleanup and safe terminal deletion now pass.
- Backend whole fast suite **423pass/2real-Blender cases deselected**. No actual Blender/Unity/provider/camera used. Existing Starlette TestClient/httpx deprecation warning remains; no dependency was changed to suppress it.
- Web whole suite **409pass/44files**, Node8asset/security, TypeScript,3model SHA256 checks and production build174modules pass.25newjob API/controller cases include malformed metadata/unsafe links, eagerly fixed bytes, queue failure,9MiBresponse cap,15sdeadline, serial/no-late polls, immutable retry identity, stale-delete response and effect-replay action release.
- **15/15actual Edge154.0.4258.62 browser cases passed together**, including the built application and the existing Studio/capture recovery suite. The new job workflow passes sample→export→edit while queued→cancel→retry original revision→refresh→paired downloads. Job HTTP responses are deterministic test routes, and do not claim real Blender execution. Existing synthetic/injected physical-camera/storage evidence boundaries still apply.
- No new runtime or development dependency. Existing main-bundle>500kB and Three.js shadow fallback warnings remain; this work makes no performance/quality-improvement claim.

Final independent Native review is pending. M3 media/provider consent and Live Link controls are separate required plans. Physical camera/storage, actual Blender/Unity on two rigs, target-laptop performance, clean-machine/beginner acceptance and licensing/public-release gates remain pending in the full goal. No M3 public push/main merge/tag/release occurred.

## Rulings made

1. Continue already-authorized Native work without another routine plan handoff. Cost if wrong: choices remain steerable before publication.
2. Preserve ignored scratch after the earlier cleanup rejection. Cost if wrong: bounded diagnostics remain local.
3. Replace historical flat overwrite behavior with returned job URLs/subdirectories; keep synchronous source callers callable. Cost if wrong: outside callers must consume returned locations.
4. Add sidecar links only in job responses; keep legacy ExportedFile fields unchanged. Cost if wrong: source callers derive the paired URL.
5. Accept native CRLF diagnostic output and compare final split line. Cost if wrong: newline normalization is not promised.
6. Share test-only job helpers and isolate the relay TestClient's new app lifespan. Cost if wrong: test fixture footprint grows. One earlier full run created only ignored empty queue metadata in the worktree default data; later contexts use temporary data and no default input/job was submitted.
7. Persist cancelRequested and reject revisions outside JavaScript-safe integers. Cost if wrong: oversized non-Studio revisions are rejected rather than rounded.
8. Separate repository persistence/lock methods from service admission/state checks. Cost if wrong: future callers must not bypass the service.
9. Use import-free shared browser/unit fixtures. Cost if wrong: tests duplicate a trivial identity pose, not the production motion code.
10. Move runner output into this plan's scratch. Cost if wrong: initial consuming RED replaced earlier latest-run artifacts; prior logs/reviewed commits remain, and subsequent job evidence is isolated.
11. Abort serial polls on UI shutdown, let service submissions continue, and reject stale action-era lists. Cost if wrong: unconfirmed submissions require Refresh before resubmission.
12. Export the frozen take's skeleton provenance; keep legacy helpers on the compatibility adapter. Cost if wrong: later global skeleton changes apply to new takes rather than an old snapshot.
13. Delete service input/downloads only, retaining user-project Unity copies. Cost if wrong: users decide separately when deleting Unity assets.
14. Scope project recovery assertions to their unchanged expected alert text when independent jobs also reports offline. Cost if wrong: tests verify their required error without assuming exactly one global alert; data-preservation checks remain intact.

Deferred minors: none before final review. Logs/ledger are retained; browser output is the latest run rather than a permanent history of earlier failure traces.
