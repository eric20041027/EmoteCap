# M3 bounded export jobs

Parent: [accepted product design](2026-10-06-open-source-product-design.md). This independently testable subsystem replaces overlapping synchronous Blender exports. Media/provider consent and Live Link pairing are separate M3 plans. Native execution and the full M1–M5 goal remain authorized.

## User behavior

Export FBX captures the selected take's projectId, takeId and clipRevision together with its built clips. Later edits do not change that job. The Studio job panel shows queued, running, succeeded, failed, cancelled or interrupted, with an accessible phase/progress label. A queue-full or unavailable-service response preserves the take and explains retry. Browser refresh retrieves the service's recent jobs and their downloads. Cancel affects only the selected job; retry creates a new job with the same original input digest and revision, never silently rebuilding from newer edits.

Each result uses `/files/<job UUID>/<clip>.fbx` and a matching sidecar URL. Repeated names across jobs never overwrite. Names in one job are disambiguated case-insensitively with the existing bounded suffix convention. Optional Unity copying writes a separate job UUID directory, sidecars before FBX. A Unity-copy failure is a visible warning on a locally downloadable successful export.

## Exact bounds and state

- Motion v2, 48 driven bones,192 quaternion components and existing full/body skeleton semantics remain unchanged.
- Exactly one owned Blender subprocess, at most4waiting jobs plus1running job,120seconds/process,64KiB retained combined process output.
- At most43202aggregate frames,50clips,128MiB encoded request body. Validate byte limits before JSON/Pydantic decoding. Empty/malformed/extra job-envelope fields and invalid UUID/revision are rejected.
- At most128retained job records. Reject new work when full with an explicit delete-completed-jobs message. Delete is an explicit action on terminal jobs; never evict active work or silently delete downloads.
- Job schema1 uses optional snapshot `{projectId:UUIDv4,takeId:UUIDv4,clipRevision:integer>=0}`. The compatibility synchronous request has no snapshot; its clips still become an immutable queued job.
- A SHA256 over canonical saved submission bytes identifies immutable input. JSON input and SQLite metadata are persisted before accepting the job. Queued/running jobs become interrupted after restart; none restarts without explicit retry. Corrupt/missing inputs fail visibly rather than being reconstructed.
- Cancel queued jobs immediately; for running jobs record cancellation intent and signal only the owned runner. Serialize final publication with cancellation so a cancelled job cannot expose successful download links.
- Publish a complete validated output directory using one rename; require every sidecar and FBX, reject symlink/path escapes, never overwrite another job directory. Failure leaves previous jobs intact.
- A platform file lock admits one queue manager per data directory. A second process refuses to run another worker. SQLite transactions serialize state; worker starts/stops with FastAPI lifespan, not module import.
- Local service only. This plan makes no provider request, changes no API key or camera behavior, and performs no public push/main merge/tag/release.

## Interfaces and files

`exporter.py` keeps legacy `export_clips(clips,settings)` for source callers, now isolated; reusable write/publish helpers support the queue. `jobs/models.py` validates submissions and responses; `jobs/repository.py` owns SQLite transactions/input digests and terminal deletion; `jobs/runner.py` owns cancellable Blender and bounded output; `jobs/service.py` owns the single worker, queue, cancel/retry/recovery and lock; `jobs/api.py` mounts requests and the bounded JSON reader.

Routes: POST `/api/export-jobs`202; GET `/api/export-jobs` latest128; GET `/api/export-jobs/{id}`; POST `.../{id}/cancel`; POST `.../{id}/retry`202; DELETE `.../{id}`204 for terminal jobs. Unknown IDs404; invalid action409; capacity429; persistence/service unavailable503. POST `/api/export` remains a synchronous adapter through the same manager and isolated results. Failed export preserves legacy500 message/stderr; cancellation/interruption is explicit409. No second worker path.

`web/src/jobs/api.ts` validates job responses and same-origin canonical download paths; `controller.ts` owns serial polling and actions; `useExportJobs.ts` bridges React; `JobPanel.tsx` owns visible state and actions. Existing `useExporter` continues legacy range helpers but Studio submission uses immutable snapshot metadata. App owns the controller across take switches. Browser recovery never needs source video or camera.

## Acceptance

Tests must reproduce same-name overwrite, case-only collisions, cancellation while a real owned Python child waits, timeout, excessive output, concurrent submissions, queued/running cancellation, restart interruption, immutable retry, full queue/history, missing/corrupt inputs, write failure and complete-output publication failure. API tests run one isolated lifespan-backed manager and prove the legacy adapter uses its lane. Browser tests exercise queue/progress/cancel/retry/reload through the real UI with deterministic HTTP job responses; they do not claim actual Blender animation. M4 provides real Blender/Unity evidence. Full Python fast suite, Web/Node tests/types/model hashes/build and browser suite must pass before independent plan review.

Primary references: [FastAPI lifespan](https://fastapi.tiangolo.com/advanced/events/) and [Python3.12 subprocess](https://docs.python.org/3.12/library/subprocess.html), checked2026-10-07. Process ownership and publication rules are product design decisions, not claims that these APIs provide a queue automatically.
