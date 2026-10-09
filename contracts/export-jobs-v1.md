# Export jobs v1

Local HTTP export jobs complement motion contractv2. They do not change 48driven bones/192quaternion values/full/body skeletons. The service owns one Blender worker and its process. FastAPI lifespan starts/stops it; launching a second manager on the same data directory fails its platform file lock.

## Submit and results

`POST /api/export-jobs` with application/json returns202. Envelope:

```json
{"clips":[{"name":"Wave","fps":30,"loop":false,"frames":[{"t":0,"h":[0,1,0],"r":[0,0,0,1]}]}],"snapshot":{"projectId":"a91b8760-4e75-4e11-b237-7f9eb79dd455","takeId":"604e37e2-814a-40f8-9c0a-6dc702c73dbb","clipRevision":7}}
```

The shortened r above illustrates the envelope; actual frames require192validated values. Snapshot is optional/null for source/legacy callers; supplied IDs are UUIDv4 and revision is an integer0..9007199254740991. Unknown envelope/snapshot properties are rejected. Inputs are copied, canonicalized, SHA256 hashed and fsynced; metadata commits before acceptance.

Job fields: id, schemaVersion1, state, phase, progress0..100, snapshot, inputSha256, createdAt/updatedAt (Unix milliseconds), retryOf (UUID/null), cancelRequested (boolean), files, error (message/details or null), warning (string/null). Only succeeded jobs expose files. Each file has name, `/files/<jobUUID>/<name>.fbx` url and corresponding `.emotecap.json` sidecar. These directories never overwrite another job; names within one batch are disambiguated case-insensitively, retaining at most24characters. A complete ordinary output folder is published with one rename.

## State and actions

- queued→running→succeeded or failed. Queued cancel→cancelled. Running cancellation first persists cancelRequested then signals its owned process; completion and cancellation share the publication lock. Repeating cancel on a terminal record is idempotent.
- Restart marks queued/running records interrupted; never resumes automatically. Failed/cancelled/interrupted retry uses saved digest/snapshot and creates a new ID/retryOf. Missing/tampered inputs reject retry instead of rebuilding from current edits.
- GET `/api/export-jobs` returns `{jobs:[...]}` newest first, at most128. GET `/{UUID}` returns one record. POST `/{UUID}/cancel`, POST `/{UUID}/retry`202 and DELETE `/{UUID}`204 perform explicit actions. Delete accepts terminal records only, removes service-owned input/downloads, and leaves optional copies already placed in the user's Unity project.
- POST `/api/export` is a synchronous compatibility adapter through this same queue. It returns legacy `{files:[{name,url}]}` with job-specific URLs. Its wait budget includes all five admitted120second runs plus10seconds/job for cleanup/publication. Failure preserves500 message/stderr; cancelled/interrupted returns409. A wait/service failure503 includes the accepted jobId/statusUrl for explicit recovery; never automatically resubmit. A disconnected browser does not implicitly cancel a service job.

## Limits/errors

One running+4waiting jobs,128retained records,50clips,43202aggregate frames,128MiBrequest bytes,30second request-ingress deadline,120second Blender deadline and64KiB combined output tail. Chunked and Content-Length bodies enforce the byte cap before model decoding; aggregate counts are checked before validating each frame. Capacity429 explains wait/cancel or explicit terminal deletion; no silent eviction. Invalid request422 uses sanitized loc/msg/type; media type415; oversized413; ingress deadline408; unknown job404; invalid state/action409; unavailable worker/storage503.

Browser responses are capped at64MiB before JSON parsing. This includes the worst sixfold JSON escaping of128diagnostic tails plus bounded result metadata; a legal full history remains recoverable/deletable.

Optional UNITY_EXPORT_DIR receives its own UUID subdirectory, sidecar before FBX. Copy failure is a successful local download with a visible warning, rather than losing the completed output. Interrupted/failed staging files remain inside their bounded retained job and are removed only by explicit deletion. Failed acceptance cleans only its newly owned unpublished input directory, after resolved containment/link checks.

This contract establishes export reliability. Real Blender/Unity motion direction, scale, timing, rig compatibility and export performance remain M4 qualification.
