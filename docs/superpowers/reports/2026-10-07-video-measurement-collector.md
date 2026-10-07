# Private video collection qualification

[Spec](../specs/2026-10-07-video-measurement-collector-design.md), [plan](../plans/2026-10-07-video-measurement-collector.md), [operation](../../video-measurements.md). Review base8e3cf20; task baseacbeeea. Current implementation is local developer collection, not M4 real/hardware acceptance.

## Implemented behavior

Optional conversion observations retain attempt failures/preview spans without changing ordinary conversion or final two-pass calibration. Observations are copied; failed clock/sink diagnostics stop explicitly while ordinary work remains intact. Shared SDK/tracker metadata is opt-in, preserving default object shape/permissions/body fallback. Successful pose/hand delegate configurations and both hashes are recorded. Owned hands are closed even if pose close throws.

The collector snapshots source/video/signal/consent references and declared metadata before async work, hashes the actual File bytes, validates idle ownership/limits and keeps one active job in its module context. It guards awaited boundaries and owns late/current cleanup. Budget, clock, metadata, downgrade and cleanup failures retain explicit bounded partial results, without comparable packets. Preview attempts and final calibrated output remain separate. Pre-conversion failures have unavailable conversion timings. Both full/body modes are supported; mixed/unknown active hand delegates remain raw-only under the v1 single-delegate limitation.

A private responsive developer HTML entry requires explicit source/metadata/local authority/session SDK choice/Run, supports cancel and explicit downloads, and preserves previous/partial results. It has no main App/Studio/API/IDB/upload integration. Default build excludes measurements.html.

## Current checks

Meaningful initial RED20new failures/19existing controls before implementation. Additional RED5cases proved source binding, environment extras, final clock bounds, raw loss on cleanup and skipped owned hand close. Hand-delegate RED2 and unstarted-conversion timing RED1 were watched before their changes. Final focused55cases pass; whole Web503/51files, Node6asset+2security checks and TypeScript/defaultproduction build pass. Python/runtime/locks/Unity are unchanged.

Private-page browser RED3 proved missing entry/controls with actual Edge. Initial GREEN2/3 retained one video-read-failed fixture; source generation now paints an opaque first frame, requests supported VP8 and retains every owned video. One actual successful decoder/download workflow passed after fixture correction. This is not counted as a product decoder fix, and the first failed fixture's exact bytes were not retained. Fresh regression passed17Edge154.0.4258.62workflows in1.4minutes:3private collection,9SDK-consent,4camera lifecycle and1built production sample/backup/reload/import. Controlled SDK outputs/streams remain synthetic; no actual SDK inference or physical camera is claimed.

Initial downloaded packet passed the unchanged Python CLI with actual selected-file SHA256 matching `b9d44d880bc2b7121fd6ded162453cc5425591c42800482036d854b6e5e20c8a`:11attempts/10ok/1no-pose. The fresh full regression's packet also passed with SHA256 `f5d1e3f178cd60c8b37bcb6660d53955b71d36d55cacbb1bdef25b5755335615`:16attempts/15final frames/1no-pose; actual packet/raw counts/source digest agree. Both are synthetic/pending, and their mocked timing/throughput is not product performance. New page reported0external/API/model-file requests in the synthetic successful workflow; owned models/video closed, SDK choice reset on reload. Narrow390px screenshot was inspected, with no horizontal overflow. Exact artifact roots/receipt paths remain in the ignored ledger. Native task-done and one fresh final review remain pending. Current source-specific Windows candidate5572c88is retained; final-source packaging will need rebuilding after subsequent changes.

## Rulings and costs

- Ruling: Implement private import collection now — saved successful frames omit failure/timing evidence — cost if wrong: actual source/SDK-network/laptop/Unity/users/rights/public gates remain pending; import throughput is not Studio FastFPS.
- Ruling: Retain preview attempts and final calibrated frames separately — two passes have different calibration state — cost if wrong: preview quality cannot be described as final saved output.
- Ruling: Opt-in metadata only — default app/test consumers retain exact object shape — cost if wrong: diagnostic callers must explicitly ask; no GPU/hand state is inferred.
- Ruling: Require observer/hash activity in RED controls — no-op stubs otherwise passed vacuously — cost if wrong: tests must reach the relevant lifecycle, not claim denial/immutability from inactivity.
- Ruling: Reuse existing project.parseFrames — canonical finite/time/norm/in-place validation already exists — cost if wrong: diagnostic rejection cannot create a separate application contract.
- Ruling: Stop only the private collection on diagnostic budget/invalid data — main app has no observer — cost if wrong: partial private evidence remains without a packet; unrelated resources are preserved.
- Ruling: Pin File/video/signal/consent references with metadata — mutable options changed decoded source after hashing — cost if wrong: changed selection requires a new run; source hash/media cannot be mixed.
- Ruling: Reject extra/nonplain environment data — structural supersets could include private/unbounded fields — cost if wrong: callers must supply the exact five declared fields.
- Ruling: Preserve raw data on cleanup failure and attempt owned hand close after pose-close error — watched errors lost evidence/skipped cleanup — cost if wrong: cleanup remains explicitly incomplete; default error propagation remains.
- Ruling: Keep the large-budget control as positive coverage — the existing guard already passed it — cost if wrong: this specific control was GREEN on first execution and is not claimed as watched RED.
- Ruling: Report hand configuration independently — it can fall back separately from pose — cost if wrong: v1 cannot represent mixed/unknown active configuration, so raw is retained without a packet; future format work needs actual baseline evidence.
- Ruling: Hand reporting stays after the existing guard and owned cleanup — diagnostics must respect SDK admission — cost if wrong: reporting failure follows existing hand fallback, without fabricated delegate or late inference.
- Ruling: Use an opaque initial canvas frame/explicit supported VP8 and preserve fixture bytes — the first synthetic video did not decode — cost if wrong: the exact initial rejection is not independently isolated and is not called a product repair; failed screenshots/logs remain.
- Ruling: Pre-conversion timing is unavailable — clock origin zero was not an executed conversion — cost if wrong: failures cannot appear to have valid full conversion latency.
- Ruling: Preserve scratch and old source-specific candidates — prior recursive cleanup was rejected — cost if wrong: disk usage remains, with no cleanup workaround.
- Ruling: Source commit is a declaration rather than an implementation switch — this runs the checked-out converter/solver/SDK — cost if wrong: original-MVP comparisons need a separately verified adapter/build, with no substitute by changing a label.
- Ruling: Native full-Web gate uses direct pinned Node/Vitest with --root web — root ledger commands cannot rely on a missing bare npm — cost if wrong: this invokes the same frozen test config/full suite; no npm pretest hook exists to omit.

No actual SDK/model/network/camera/authorized actor/target laptop/Unity/two-rig/clean-machine/new-user/license/publication PASS is inferred. Original-MVP instrumentation still needs a verified adapter and frozen source/build; editing the declared source field does not select a different implementation.
