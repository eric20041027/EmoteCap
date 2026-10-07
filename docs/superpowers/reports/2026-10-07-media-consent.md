# M3 media control and consent

Date2026-10-07. Branch feat/studio-projects; plan base38b3d32 after accepted export-job review. [Spec](../specs/2026-10-07-media-consent-design.md), [plan](../plans/2026-10-07-media-consent.md), [contract](../../../contracts/media-consent-v1.md). Full M1–M5 goal remains active.

## Behavior

The optional Gemini panel starts unchecked and resets selection/send permission. Checking it makes no request; Send selected video obtains one source-bound256bit/60second permission, then uploads its captured Blob once. The server consumes the permission before multipart parsing or SDK construction and checks identity, MIME, size and duration.32live grants, one active operation,100MiBvideo/102MiBmultipart/30singress and200MiBcombined temporary raw budget are enforced. The multipart spool closes before provider processing.

Local Find pauses and legacy slice helpers default to local work without any provider request. Suggestions are previewed before Apply, remain tied to the captured project/take/clip revision, require explicit approval to replace newer edits and preserve bounded undo/original motion. Stop waiting aborts the browser request; its message distinguishes an unsent video from potentially already transmitted work, whose server processing/cleanup can continue.

Delete source is distinct from Keep and backup inclusion. It clears retained media through confirmed autosave before releasing memory; a failed confirmation preserves the source. The original frames and clips remain. Source retention/deletion and delete-take controls wait while sending. Server temporary cleanup always runs after provider work, and recognized legacy recordings never auto-delete. Explicit inventory/deletion uses contained ordinary paths;100-item lexical pages keep history reachable.

Cleanup separates local video from Google Files not-used/deleted/failed/unknown. Files deletion failure preserves the successful suggestions or original request error with a visible warning. Unconfirmed uploads are not grounds for deleting unrelated account files. Inline transmission creates no Files resource but still sends video. Credential-bearing SDK tracebacks are removed from DEBUG logging; error/model/report text is redacted before truncation. Projects/backups do not serialize permissions, keys or cleanup state.

## Verification

- Watched22grant/storage and9API behavior failures before implementation. Missing consent previously uploaded with a configured key. One-use/expiry, strict permission/source bounds, admission, recognized ownership/local cleanup, explicit legacy deletion, ingress size/chunking/timeout and partial-spool closure now pass.
- Watched empty-directory cleanup become uninventoryable, text/plain grant acceptance, missing remote cleanup reports and a fake key in DEBUG tracebacks. Passing regressions preserve outcomes, expose cleanup and protect diagnostics.
- Whole fast Python suite **469pass/2real-Blender cases deselected**; current provider tests use fake clients or mocked HTTP, never a real key/account. The existing TestClient/httpx deprecation warning remains.
- Watched source deletion/default cloud helper failures and12cloud API/controller failures; effect replay invalidated a source probe without restarting it. Confirmed deletion/pending-source preservation, default0requests, source/revision guards, explicit apply/undo, cancellation, grant-before-single-upload, malformed reply rejection and credential-free archive tests pass.
- Whole Web suite **431pass/46files**, Node8asset/security, types,3modelSHA checks and production build179modules pass. No dependency changes.
- **17/17actual Edge154.0.4258.62 cases passed**, including the existing Studio/job/capture/production suite and two new media flows. They exercise local pauses/checkbox0cloud requests, explicit grant+upload, preview-before-apply with a visible remote cleanup warning, confirmed native-IDB/source-memory deletion and reload while preserving original motion. Source bytes and provider HTTP are synthetic/mocked; no physical camera/provider processing is claimed. Maximum-size, disk/storage and animation/hardware evidence remain outside these checks.
- Existing main-bundle>500kB and Three.js shadow fallback warnings remain. Native whole-plan independent review is pending; the complete entry-point gate will be rerun by task-done.

## Rulings made

1. Continue authorized Native M1–M5 without another routine handoff. Cost if wrong: choices remain steerable before publication.
2. Preserve ignored diagnostics after the previous cleanup rejection. Cost if wrong: local scratch remains.
3. Reserve multipart spool plus copied raw bytes before parsing, close spool before SDK processing. Cost if wrong: large uploads require explicit cleanup sooner.
4. Extend the pinned Starlette file-data callback because max_part_size applies to text fields. Cost if wrong: future parser changes must preserve callback and BaseException partial-file cleanup; current source/regression are verified.
5. Echo granted Studio UUID and add cleanup metadata; require grants for old HTTP cloud clients too. Cost if wrong: older cloud clients must adopt the new consent contract; motion remainsv2.
6. Adapt provider fixtures to grants/final cleanup and isolate all lifecycle consumers in temporary data directories. Cost if wrong: fixtures change scope while original validation/segment assertions remain.
7. Permit1ms duration serialization rounding. Cost if wrong: consent duration uses documented millisecond tolerance.
8. Inventory an empty reserved UUID directory after final removal failure. Cost if wrong: it has no ownership JSON but explicit contained deletion cannot remove user data.
9. Keep optional SDK helper reports/direct segment-list returns; HTTP always requests reports and enforces grants. Cost if wrong: direct Python callers must request reports for structured cleanup.
10. Separate inline/not-used and Files/local outcomes. Cost if wrong: users must consult provider terms instead of inferring universal data deletion.
11. Remove raw SDK tracebacks and redact safe diagnostic strings. Cost if wrong: debugging retains less raw detail, with visible bounded failure reasons.
12. Share cloud/transport.ts between granted helpers:1MiBresponse/75supload deadline and settled cancellation. Cost if wrong: slow requests require a visible failure/explicit retry; permission cannot be bypassed.
13. Keep CloudPanel/controller in App across keyed take review. Cost if wrong: one bounded result is retained across selection, guarded by original identity.
14. Reset consent on selection/start/send and freeze source/revision. Cost if wrong: users must confirm another transmission separately.
15. Confirm deletion before dropping memory and lock source controls during send. Cost if wrong: source choices wait for completion/Stop waiting.
16. Page cleanup metadata100items with nextCursor. Cost if wrong: large legacy histories need explicit page loads and server inventory performance measurement.
17. Wait for imported project identity/source readiness before save qualification. Cost if wrong: test setup waits an extra identity transition; confirmed-save/original checks are intact. Wrong-take assertions retain the domain's existing default full-range clip.
18. Move latest browser output to this plan's scratch. Cost if wrong: initial RED replaced previous latest-run artifacts; prior qualification logs/commits remain and subsequent media evidence is isolated.

Deferred minors: none before final review. Logs/ledger are retained, browser artifacts represent the latest run. Live Link controls are the remaining M3 subsystem. Real provider/camera/storage, target-laptop performance, actual Blender/Unity/two rigs, clean-machine/beginner acceptance, contributor rights/licensing and owner-approved publication remain required pending gates. No public push/main merge/tag/release occurred.
