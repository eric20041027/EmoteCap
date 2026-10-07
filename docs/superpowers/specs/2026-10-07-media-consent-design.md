# M3 source deletion and explicit Gemini consent

Parent: [product design](2026-10-06-open-source-product-design.md). Native inline execution remains authorized. This subsystem preserves the accepted Studio/queue implementation and motionv2/projectschema1. Live Link pairing is a separate M3 plan. No real provider request, private recording or public release is authorized by an automated test.

## Product behavior

Find pauses always uses local motion and performs no cloud request. An explicit optional Gemini panel describes the selected source video, Google processing, possible cost and links current provider terms. Its consent checkbox defaults off and resets with project/take selection. Only the separate Send selected video action obtains a one-use upload grant and sends that frozen source. A configured API key never implies permission. No grant, restored/sample work, ordinary editing, local slicing or a checkbox change alone starts a provider request.

Gemini suggestions are previewed before Apply suggested clips. The captured projectId/takeId/clipRevision prevents installing them on another take or overwriting edits made during processing without an explicit replacement decision. Existing bounded undo preserves prior clips; original motion/provenance stays intact. Failure shows the reason and keeps local Find pauses available. Cancel stops browser waiting; already sent video may still finish processing/cleanup on the server, and the UI must say so.

Keep source video, Include source in backup and Delete source video are separate actions. Delete explicitly discards the current memory source and its retained browser blob after a confirmed transaction, without changing motion/clips. A failed save preserves source and reports failure; it never claims deletion. Media choices/deletion are locked while the selected source is being sent.

## Backend gate and cleanup

POST `/api/cloud-consent` accepts strict JSON `{provider:"gemini",policyVersion:1,allowUpload:true,takeId:UUIDv4,size:1..100MiB,duration:>0..180seconds,mimeType:known video type}`. It requires configuration, issues a random256bit URL-safe grant, expires after60seconds and keeps at most32live grants. Token exists only in memory, is never stored in projects/backups/logs, and is consumed once before multipart parsing or SDK construction.

POST `/api/takes` requires `X-EmoteCap-Consent`, validates grant/takeId/actual file size/duration/MIME and rejects unknown/replayed/expired grants403. The complete multipart request is bounded to102MiB and30second ingress, with one video and two scalar fields. One cloud request may run at a time; reject additional work429 before storing raw video. Model uses the already pinned backend SDK/configuration; no browser API key.

New raw uploads use service-owned UUID temporary directories and are removed in finally after success, provider failure, timeout or client abandonment. A local deletion failure is visible, inventoryable and explicitly retryable. Service temporary raw bytes, including failed-cleanup files, are capped at200MiB; refuse new uploads when they cannot fit. Existing legacy `data/takes/<32hex>.webm` recordings are inventoried separately and never automatically deleted. Explicit cleanup routes accept only known contained ordinary UUID/legacy paths; no arbitrary filesystem input.

Gemini Files deletion is attempted for every confirmed Files upload in finally. Return a structured cleanup report with success/failed/unknown rather than merely logging deletion failure. Preserve the original successful suggestions or original request error; append a safe warning and provider Files link if deletion cannot be confirmed. An unconfirmed upload does not justify deleting unrelated account files. Files deletion is not a promise that Google removes all processing/logging data.

## Interfaces and limits

`server/.../media/consent.py` owns bounded one-use grants/one-request admission; `storage.py` owns temporary copy/final cleanup/recognized legacy inventory; `api.py` replaces `/api/takes` and mounts consent/explicit local cleanup routes. Existing `gemini.py` gains an optional CleanupReport argument and passes it through upload/finally; direct legacy helpers remain callable. `TakeResponse` may add cleanup metadata without changing segments.

`StudioSession.deleteSource(takeId)` confirms deletion before releasing memory. `web/src/cloud/api.ts` obtains a grant and reports suggestions/cleanup; `controller.ts` owns frozen identity, source and cancellation; `CloudPanel.tsx` owns consent/preview/explicit apply. `TakeList` owns confirmed Delete source. Existing legacy requestSegments/sliceTake default to consent-required local fallback; explicit grant is required even outside the new Studio UI.

No new dependency. Motion frames/clip naming/duration, project bounds,100MiBsource/200MiBbrowser cache and clip undo limits stay intact. Returned segments are finite, bounded to50, valid names/descriptions and within the captured take. Error messages/redacted warnings never include API keys or video bytes.

## Verification and outside gates

Tests prove no HTTP/provider upload before consent, grants one-use/expiry/bounds, replay/wrong-source rejection, multipart size/timeout/admission, local cleanup on every outcome, visible local/remote deletion failure, no deletion of legacy recordings without explicit action, memory/IDB deletion with failed-save preservation, identity/revision-safe suggestions and no keys in archives. Actual-browser tests use opaque synthetic media and mocked provider HTTP; real Google processing/cost, physical camera and storage remain separately authorized acceptance.

Primary documents checked2026-10-07: [models](https://ai.google.dev/gemini-api/docs/models) lists current gemini-3.8-flash and the existing stable fallback IDs; [Files API](https://ai.google.dev/gemini-api/docs/files) describes manual deletion and48hour file expiry; [provider terms](https://ai.google.dev/gemini-api/terms) distinguish paid/unpaid data handling. Consent text links these terms and makes no blanket privacy promise.
