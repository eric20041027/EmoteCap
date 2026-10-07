# Media consent v1

Gemini is optional. A configured backend key never authorizes video upload. Local pause slicing, ordinary project capture/editing and portable backups do not contact a provider. Motionv2/projectschema1 remain unchanged.

## Permission

POST `/api/cloud-consent` requires application/json and a configured local Gemini key:

```json
{"provider":"gemini","policyVersion":1,"allowUpload":true,"takeId":"604e37e2-814a-40f8-9c0a-6dc702c73dbb","size":5,"duration":2,"mimeType":"video/webm"}
```

Size is1..100MiB, duration>0..180seconds, takeIdUUIDv4 and a known video MIME type (codec parameters/known aliases normalize). Extra fields/implicit truthy permission are rejected. Metadata is at most4096bytes, with30second ingress. Response `{token,expiresAt}` carries a random256bit,43character URL-safe token and Unix millisecond expiry. Permissions last60seconds, at most32are live and each is consumed once. No token is stored in projects, archives, files or logs.

## Selected upload

POST `/api/takes` supplies X-EmoteCap-Consent and multipart fields: one video file, duration and takeId. The grant is checked/consumed **before parsing multipart or constructing an SDK client**. Metadata/file bytes/MIME must match the granted source; duration serialization allows at most1ms rounding. Missing/expired/replayed/mismatched grant403, invalid fields422, unsupported MIME415, oversized413, ingress timeout408, unconfigured503 and occupied single-operation slot429.

Total multipart ingress≤102MiB/30seconds; scalar fields≤512bytes, one file/twofields and streamed video bytes≤100MiBand the granted size. Pinned Starlette parsing closes partial spools on every BaseException, including timeout; a regression verifies this. Admission reserves both the multipart spool and copied video within the200MiBtemporary raw budget, including previous cleanup failures. The spool closes before provider processing. Server key stays backend-only.

New uploads use `data/cloud-tmp/<UUID>/video.webm`, with bounded ownership metadata. Local temporary video is cleaned in finally after success/provider failure/timeout; cleanup failure stays visible/inventoryable for explicit retry. The response echoes granted takeId, segments and cleanup metadata. Provider failure502 preserves a safe message, local motion-energy fallback hint and cleanup result. Error reporting does not change original motion/clips.

## Explicit local cleanup

GET `/api/media-cleanup` returns recognized temporary/legacy items with id, kind, size and active. DELETE `/api/media-cleanup/{id}` removes only a recognized contained ordinary path, never active video. Temporary UUID directories use ownership metadata; an empty reserved UUID directory left by final-directory removal failure remains safely inventoryable/retryable. Unknown files, links or arbitrary paths reject rather than being followed/deleted.

Legacy `data/takes/<32hex>.webm` files are inventoried as legacy-<32hex>; they are never auto-deleted. The user must explicitly choose deletion. The new API does not keep raw video for debugging. Browser Keep source, Include source in backup, Delete source and Send to Gemini remain separate product choices.

Google Files cleanup reporting is implemented in the following task. File deletion/48hour Files expiry does not mean all provider processing data/logs are removed; current provider terms apply. Actual provider use/cost and real source-video acceptance require separate authorization/evidence. Tests use opaque synthetic bytes and fake SDK calls.
