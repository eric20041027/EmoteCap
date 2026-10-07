# M2 Studio projects and recovery

Parent: [product roadmap](2026-10-06-open-source-product-design.md). The user authorized continuous Native implementation of M1–M5. This document turns M2 into bounded subsystems; it does not remove any later release gate.

## User outcomes

Create, name, reopen and delete local projects. A project contains separately identifiable takes and clips. Capture or import another take without overwriting a previous take. Keep original motion and capture provenance unchanged when editing clip ranges, names and loop flags. Undo the last 20 clip-list changes. Save automatically, reopen after refresh, and recover a recording checkpoint as an interrupted take. Provide a portable `.emotecap` download separately from browser storage. A sample project must work without camera permission. All main actions must work with a keyboard and visible text status.

## Domain and limits

- Project schema 1; motion contract remains v2 with 48 driven bones and 192 quaternion values. No API keys, provider credentials or arbitrary extra properties in project data.
- Project, take and clip IDs are stable UUIDs generated with `crypto.randomUUID()`. On importing a portable project, assign a new project ID to avoid overwriting existing work; keep take and clip IDs within that new namespace.
- Each project has a monotonically increasing integer revision, name, created/updated timestamps, active take ID and up to 20 takes. Names for projects and takes support Unicode and are limited to 120 characters.
- Each take has a source (camera, video or sample), creation time, capture provenance, immutable frame arrays, status (recording, complete or interrupted), clip list, clip-edit revision and bounded undo history. Capture provenance records app/contract versions, selected model file names and SHA256 values, quality, skeleton selection, smoothing and the known calibration state/note. Do not invent calibration data that was not captured.
- Retain the existing 180-second and 21601-frame limits per take. Limit the project to 43202 frames in total. Frame values are finite; times strictly increase inside [0, 180]; hips x/z stay within 1e-6; quaternion norms stay in [0.98, 1.02]. An interrupted checkpoint may have no frames; a complete take must have frames. Reject unsupported schema/contract versions with a readable error instead of resetting data.
- A take contains at most 50 clips. Each clip has a stable ID, name, start/end, loop and description (up to 512 characters). Ranges stay inside the take and last at least 0.1 seconds. A shorter take remains saveable with no clips. A temporarily empty or invalid draft clip name is saveable, up to 24 characters; export remains disabled until all selected names match the existing export contract and are unique ignoring case.
- Clip edits and undo never rewrite original frames. The take's clip-edit revision increases even on undo, so later export jobs can bind an immutable revision. Recording checkpoints only append frames; a completed/interrupted original is never appended to or replaced by editing.

## Persistence and recovery

IndexedDB stores project documents, small list summaries and optional media in separate object stores. The document, summary and requested media changes commit atomically. Only a completed transaction can produce a Saved status. Request strict durability for writes; browser storage is still an automatic recovery copy, not the user's portable backup.

A save includes the expected stored revision. Reject another tab's stale save with a conflict message while retaining this tab's work in memory. Use one ordered save lane per project; a delayed earlier save must not mark newer edits saved. Changes during a save are coalesced into the latest pending snapshot, then written using the last committed revision. Failure leaves the pending snapshot available for retry or download. Do not silently overwrite a newer project, swallow quota errors, reload over unsaved work or repeatedly retry a permanent failure in a busy loop.

Capture checkpoints run every 5 seconds while recording and save the final take immediately when stopped. On reopen, mark recording checkpoints interrupted; preserve every frame from the last completed save. A completed Saved take must restore all clip edits, selected take and retained media after refresh. Closing with unconfirmed changes uses the browser's standard unsaved-work warning. Loading, unavailable/blocked storage, quota failures, conflicts, dirty, saving and saved are distinct visible states.

Raw camera/imported video stays in memory by default. A specific Keep source video control permits browser persistence. Removing that choice deletes its stored media atomically; deleting a project deletes its documents, summary and associated media. Max media is 100 MiB per take and 200 MiB per project. Include media in a portable download only when the user selects it. Sending video to Gemini remains a separate M3 decision, never implied by saving or importing a project.

The [IndexedDB standard](https://www.w3.org/TR/IndexedDB-3/) defines transaction completion and strict durability. Tests use native API semantics with the pinned fake-indexeddb 6.2.5 test implementation plus an actual Chromium acceptance flow; the test implementation cannot prove real quota/disk behavior by itself.

## Portable file

A versioned manifest identifies the project and entries for motion, edits and optional media. No executable content or secrets. Limit the input file to 512 MiB, decoded motion/metadata to 256 MiB, total decoded data to 512 MiB and the same domain/media limits above. Reject malformed JSON/entries, duplicates, traversal paths, unsupported versions, missing referenced data and decompression limit violations before installing anything into a project. Failed import leaves existing projects intact. The archive plan will specify a bounded implementation and add concrete format fixtures before exposing file import.

## Studio integration

Add a project bar with create/open/rename, storage status, retry, download, import and delete controls. Add a take list with explicit selection and New take. Reuse preview/playback and export functions; persist clip edits through the project model. Show sample data from the repository-owned right-arm fixture. Camera and MediaPipe startup become explicit; sample/open/import flows must not request a camera merely by mounting the application.

Show model availability and local export-service/Blender readiness. Missing Blender does not prevent recording, preview, project saving or downloading. Keep time fields keyboard-editable, focus visible, progress/status announced, and restore errors actionable. A saved interrupted take is clearly labelled and can be reviewed or exported without pretending the missing tail was recovered.

## Implementation boundaries and acceptance

1. Storage foundation plan: domain, validation, immutable edits/undo, atomic IndexedDB repository and ordered autosave. Pure behavior tests plus database transaction tests. No claim of complete M2 or a working UI from these modules alone.
2. Portable-format plan: bounded archive import/export, optional media, corrupt and hostile input tests, documented format fixtures.
3. Studio integration plan: project/take UI, checkpoint wiring, persisted editing, diagnostics, no-camera sample and real-browser acceptance.

Full M2 acceptance requires real browser capture/import → saved → reload → restored → edit/undo → portable download/import; recording interruption recovery; optional-media removal; quota/transaction failure with downloadable in-memory work; multi-tab conflict preservation; and keyboard completion of the main workflow. Real camera capture is distinguished from synthetic browser fixtures. Hardware, actual Blender/Unity animation quality and full clean-machine user acceptance remain M4/M5 gates.
