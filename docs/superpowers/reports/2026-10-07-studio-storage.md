# M2 Studio storage foundation

Date: 2026-10-07, America/New_York. Branch: feat/studio-projects. Base: 2411625. Plan: [Studio storage](../plans/2026-10-07-studio-storage.md). Full objective remains M1–M5.

## Implemented behavior

Versioned Project/Take/Clip identities, capture/model/calibration provenance, owned frozen original frames, nondestructive clip edits and 20-step undo. Recording takes accept only appended frames; completion/recovery creates a default clip when enough motion exists, and advances its revision. Interrupted checkpoints retain their frames. Strict bounded parsing rejects corrupt data, incompatible versions, extra credential fields, sparse arrays, invalid motion, duplicate identities and dangling selections. Invalid draft export names remain saveable.

The native IndexedDB repository atomically commits documents, small list summaries and explicitly retained source media, using strict durability and transaction completion. Compare-and-save revision checks protect against a stale tab. The original-transition guard prevents rewriting previously stored original motion/provenance. Removing media retention or deleting a take/project deletes associated blobs in the same transaction. Blocked/unavailable/newer/corrupt storage reports an error and preserves existing data.

The autosave lane coalesces edits over 750 ms and writes one snapshot at a time. Only the completed latest revision receives Saved. New work staged during completion is also drained by flush. Quota/write failure preserves the latest snapshot and selected video with a visible error status; retry is explicit. Disposal lets an in-flight atomic write finish and retains newer unsaved data without starting another save.

## Verification

- Watched the project-creation characterization fail on missing version/identity/revision fields before implementing the domain.
- Watched saved project restoration return null before implementing the repository.
- Watched autosave fail to publish its staged project before implementing the lane.
- Added regressions for sparse hips, reused recording clip revision and a corrupt unique media index; each failed before its correction.
- New project tests: **68 passed** (domain/validation, native API adapter transactions, asynchronous autosave and a real repository retry integration).
- Complete Web suite: **294 passed** / 34 files; Node asset/security checks: **8 passed**; TypeScript passed; full Web build passed with all three model SHA256 caches verified.
- Exact fake-indexeddb **6.2.5** added as a test-only dependency. Parsed lock comparison confirms no existing package records changed. Installation audit reported **0 vulnerabilities**.
- Existing >500 kB bundle warning remains. Backend source is unchanged; M1's hosted evidence remains its verification, not a newly rerun backend claim.

Independent fresh-context whole-plan review (gpt-6-astra, 2411625..1178f06) approved the foundation with zero Critical, Important or Minor findings. It independently reran all 68 project tests and TypeScript, verified the sole added test dependency, and left Git clean. No fix pass is required.

## Rulings

1. Continue the authorized Native M1–M5 roadmap without another routine plan approval. Cost if wrong: choices remain open to user steering before release.
2. Store full project documents atomically with separate summaries/media first. Cost if wrong: large-take save latency/memory still requires measurement before release; synthetic tests do not establish performance.
3. Retain ignored verification scratch after the earlier cleanup approval rejection. Cost if wrong: bounded local diagnostic files remain.
4. Share synthetic testData.ts instead of duplicating known-good setup. Cost if wrong: one small test helper; no personal media is included.
5. Remove the recording-stage exception that could reuse a clip revision; completion/recovery advances revision when adding the default clip. Cost if wrong: one additional revision at capture completion.

## Review acceptance boundaries

- Real browser quota, eviction and disk durability remain required browser acceptance; the adapter proves transaction logic. Cost if wrong: physical storage behavior can differ.
- Maximum-size save latency/memory remains a measurement gate for the full-document approach. Cost if wrong: ordinary laptops may experience unacceptable pauses.
- Five-second checkpoints and unload warnings remain required Studio lifecycle work. Cost if wrong: a closing recording still lacks the promised recovery window until wiring is completed.
- Visible states, keyboard navigation, sample onboarding and diagnostics remain required UI work. Cost if wrong: these modules alone do not provide a usable Studio.
- Portable archive safety and downloadable recovery with optional media remain a separate required M2 implementation. Cost if wrong: browser storage is not yet a portable backup.
- Physical camera and the complete capture/import/reload/restore workflow remain acceptance gates. Cost if wrong: tested modules do not prove a device workflow.
- Blender/Unity quality and clean-machine acceptance remain M4/M5 requirements. Cost if wrong: actual exported animation and installation remain unproven.
- Provider transmission, licensing and the entire M3–M5 scope remain in the active goal. Cost if wrong: storage approval does not establish product-release readiness.

Deferred minor findings: none.

## Remaining M2 and release gates

These modules have not yet been wired into Studio. UI selection/editing, five-second recording checkpoint timing, no-camera sample onboarding, diagnostics, portable archives and actual browser acceptance are pending in the next M2 plans. fake-indexeddb tests establish native API transaction logic, not real browser eviction/disk behavior or a physical camera flow.

No M2 remote push or PR has been created. Main remains at verified M1 25c6cbe. The M1–M5 goal stays active; M3–M5, licensing, real Blender/Unity and hardware/clean-machine/human acceptance remain required.
