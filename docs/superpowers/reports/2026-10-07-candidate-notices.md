# Current Windows candidate licensing material qualification

[Spec](../specs/2026-10-07-candidate-notices-design.md), [plan](../plans/2026-10-07-candidate-notices.md), [operation](../../windows-candidate.md). Review base cb170ff; task base 19fe184. This increment binds supplied licensing material to an internal package; redistribution and public release remain pending.

## Implementation and current checks

The builder validates the committed third-party index against five source pins, the prepared receipt/runtime, exact native DLL/PYD records, all referenced licensing texts and the exact built SDK WASM set. It preserves original text/index bytes and generates a local plain README. The manifest records the index digest, text/native counts and pending assessment. Existing isolated bootstrap, private data, fixed source, incomplete marker and ZIP/receipt completion rules remain unchanged.

Meaningful admission/copy tests failed before implementation: 21 failures with 16 existing controls passing and one unavailable file-symlink privilege skip. A separate extra-WASM case reproduced an unrecorded-file admission before enforcing exact correspondence. Focused checks passed 40 cases with one skip; actual NTFS junction and late-copy mutation controls passed three cases. Full fast backend passed 725 cases, with one privilege skip and 18 slow cases deselected. Current asset checks and the frozen TypeScript/Web build passed; no Web logic changed.

The actual source index validates with 114 licensing texts / 468667 bytes / 54 native records and SHA256 `5f04de638c18d687b5ec02c505d8b831452889d6beac71c82bb868fcf3ba4288`. New package generation, repeated ZIP equality, relocated production/Blender QA and fresh final review are pending at this commit. The prior candidate remains retained; no new artifact is selected yet.

## Rulings and costs

- Ruling: Continue private packaging while the earlier cb170ff public-source request is pending — independent local work is authorized — cost if wrong: no later code is implicitly published by a displayed question.
- Ruling: Generate a plain packaged notices README — source-only document links are outside the package — cost if wrong: detailed assessment stays in the source, while the package retains exact index/texts and pending status.
- Ruling: Validate source/runtime/WASM relationships rather than hardcoded component counts — future frozen inputs and owned synthetic fixtures need different counts — cost if wrong: correspondence is enforced, without claiming complete legal assessment.
- Ruling: Overwrite only owned test indexes and skip empty fixture commits — exclusive JSON output and ignored Web edits otherwise fail before behavior — cost if wrong: negative controls must reach admission, without runtime or public effects.
- Ruling: Allow normal HTTP(S) evidence URLs while rejecting drive paths — the first broad path expression rejected HTTPS suffixes — cost if wrong: the corrected drive token boundary must preserve private-path rejection.
- Ruling: Require the exact built WASM set — an extra file was admitted before the new failing control — cost if wrong: unrecorded binaries now stop packaging, without an SDK upgrade.
- Ruling: Use an actual owned NTFS junction control when file-symlink privilege is unavailable — directory reparse rejection still needs Windows evidence — cost if wrong: file-symlink privilege remains a reported skip; no system privileges are changed and target bytes remain intact.
- Ruling: Retain earlier scratch/candidates and the deferred reserved-name Minor — cleanup was previously rejected and this plan does not reopen accepted scope — cost if wrong: disk usage and the documented validation limitation remain explicit.

No camera, SDK inference, cloud provider, Unity, target laptop, clean second machine or new-user qualification is inferred from these checks. Owner/contributor/four-media and native/vendor/model/source-form assessments remain pending. No project LICENSE, public push, remote-main merge, installer upload, tag or release occurs in this plan.
