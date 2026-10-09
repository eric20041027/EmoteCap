# Current Windows candidate licensing material qualification

[Spec](../specs/2026-10-07-candidate-notices-design.md), [plan](../plans/2026-10-07-candidate-notices.md), [operation](../../windows-candidate.md). Review base cb170ff; task base 19fe184. This increment binds supplied licensing material to an internal package; redistribution and public release remain pending.

## Implementation and current checks

The builder validates the committed third-party index against five source pins, the prepared receipt/runtime, exact native DLL/PYD records, all referenced licensing texts and the exact built SDK WASM set. It preserves original text/index bytes and generates a local plain README. The manifest records the index digest, text/native counts and pending assessment. Existing isolated bootstrap, private data, fixed source, incomplete marker and ZIP/receipt completion rules remain unchanged.

Meaningful admission/copy tests failed before implementation: 21 failures with 16 existing controls passing and one unavailable file-symlink privilege skip. A separate extra-WASM case reproduced an unrecorded-file admission before enforcing exact correspondence. Focused checks passed 40 cases with one skip; actual NTFS junction and late-copy mutation controls passed three cases. Full fast backend passed 725 cases, with one privilege skip and 18 slow cases deselected. Current asset checks and the frozen TypeScript/Web build passed; no Web logic changed.

The actual source index validates with 114 licensing texts / 468667 bytes / 54 native records and SHA256 `5f04de638c18d687b5ec02c505d8b831452889d6beac71c82bb868fcf3ba4288`. A new candidate was built from clean source `5572c88787be43b3f0665889f4d17a8408f78a2e`, with 5385 manifest payload files, ZIP 87612108 bytes and SHA256 `db7408b810b0904e8d4f06ec8c19a1b56a7b8fdd3ccedfcee1cb821d2e1e597d`. Repeated ZIP bytes matched that digest. All 114 copied texts matched source bytes, index/manifest matched and assessment remained pending.

## Actual relocated qualification

The owned candidate and a fresh Unicode/spaces relocation are retained under this plan's ignored workspace. The supplied Windows wrapper rejected an alternate Web-root argument with exit 2. Corrupting a copied licensing text caused isolated packaged startup to exit 1 before ready output or private-data creation. Both negative controls used only System32 on PATH and poisoned PYTHONPATH.

Actual Edge 154.0.4258.62 with the relocated bundled Python and production API passed sample/edit/autosave/native IndexedDB reload/portable backup import into a new namespace, preserving original frames. The SDK choice was initially denied; granting alone caused no processing requests, and reload reset it. Paired browser/service acknowledgement and stop/revocation passed; this is not Unity receiver evidence. External Blender 4.5.14 produced a binary FBX of 595388 bytes with SHA256 `044c7095b715ea7c626f3d4f31177e71b86d9bb2a0ffe9b7b4669a9525413625`. No API mocks or development proxy were used. External/cloud/model requests and page errors were zero; actual SDK inference remains untested.

Desktop 1280×2520 and narrow 390×3785 screenshots were inspected; no horizontal overflow occurred. Owned service/browser helpers exited. Browser artifacts are retained at `browser-489ff3b9-9802-4e0b-b2d1-9714cd5c6d21`; relocation/tamper/repeated ZIP receipts at `qa-a15793ff-6fbc-4af7-a86b-8c93b206a8fc`. Current source/history audit at 5572c88 found 0 detected credentials across 152 commits / 902 historical blobs / 510 current files / 16854760 bytes. This heuristic scan does not prove secret absence.

The new artifact supersedes the older 2c019a0 candidate for current local SDK/notices qualification. All older outputs are retained. Native task-done repeated the whole fast backend: 725 passed / 1 privilege skip / 18 slow deselected in 73.37 seconds. One fresh independent Python review approved fixed cb170ff..188b66e with 0 Critical / 0 Important / 0 new Minor findings. Its focused run independently passed 41 cases with one privilege skip, including actual junction coverage, in 29.73 seconds. No correction pass or rereview was needed. Ruff/mypy/pylint/Black were unavailable; no dependency was added to run them. No redistribution or public release is approved.

## Rulings and costs

- Ruling: Continue private packaging while the earlier cb170ff public-source request is pending — independent local work is authorized — cost if wrong: no later code is implicitly published by a displayed question.
- Ruling: Generate a plain packaged notices README — source-only document links are outside the package — cost if wrong: detailed assessment stays in the source, while the package retains exact index/texts and pending status.
- Ruling: Validate source/runtime/WASM relationships rather than hardcoded component counts — future frozen inputs and owned synthetic fixtures need different counts — cost if wrong: correspondence is enforced, without claiming complete legal assessment.
- Ruling: Overwrite only owned test indexes and skip empty fixture commits — exclusive JSON output and ignored Web edits otherwise fail before behavior — cost if wrong: negative controls must reach admission, without runtime or public effects.
- Ruling: Allow normal HTTP(S) evidence URLs while rejecting drive paths — the first broad path expression rejected HTTPS suffixes — cost if wrong: the corrected drive token boundary must preserve private-path rejection.
- Ruling: Require the exact built WASM set — an extra file was admitted before the new failing control — cost if wrong: unrecorded binaries now stop packaging, without an SDK upgrade.
- Ruling: Use an actual owned NTFS junction control when file-symlink privilege is unavailable — directory reparse rejection still needs Windows evidence — cost if wrong: file-symlink privilege remains a reported skip; no system privileges are changed and target bytes remain intact.
- Ruling: Retain earlier scratch/candidates and the deferred reserved-name Minor — cleanup was previously rejected and this plan does not reopen accepted scope — cost if wrong: disk usage and the documented validation limitation remain explicit.
- Ruling: Import the exact downloaded backup as a named byte payload in the owned browser harness — deep artifact-backed files previously caused Edge file-read failures — cost if wrong: byte/namespace/frame checks remain real, while this run does not qualify Edge's deep filesystem-path behavior.

## Final review rulings and deferred limitation

- Final Ruling: Physical camera, actual SDK inference/network, Unity/two rigs, target laptop, clean-machine and new users remain pending — synthetic and same-host qualification cannot establish these outcomes — cost if wrong: formal release remains gated on actual evidence.
- Final Ruling: Legal ownership/redistribution/vendor/model/source-form sufficiency remains pending — technical byte correspondence cannot approve rights — cost if wrong: the material must not be interpreted as a legal grant or complete attribution assessment.
- Final Ruling: Frozen Web rebuild evidence is separate from code inspection — the builder binds observed built bytes and source pins but cannot alone prove source derivation — cost if wrong: final-source qualification must retain the actual frozen-build receipt and cannot rely on a copied dist.
- Final Ruling: Deep-path Edge backup-file behavior remains unqualified — this actual import used the exact downloaded bytes as a named payload — cost if wrong: backup content/restore passes here, while unusually deep filesystem selections may still fail.
- Final Ruling: File-symlink creation remains a privilege skip — link rejection was inspected and an actual NTFS directory junction passed — cost if wrong: this host supplies no execution result for file-symlink creation, and privileges are not altered.
- Final Ruling: Previously deferred reserved Windows names remain outside this accepted increment — the earlier Minor is explicitly retained — cost if wrong: those names remain a known validation gap before a formal supported distribution.
- Final Ruling: Adversarial concurrent replacement of prepared files is not newly qualified — the existing copy/verification rules, fixed prepared receipt and isolated startup remain in force, and no concurrent writer was used — cost if wrong: hostile host mutation could break the prepared-input binding even with a self-consistent output manifest; this workflow requires immutable prepared inputs and does not authenticate the host or publisher.

Deferred Minor: the prior `CONIN$` / `CONOUT$` / `CON .txt` / `NUL .txt` reserved-name admission gap remains recorded in the original Windows report. No new Minor was reported.

No camera, SDK inference, cloud provider, Unity, target laptop, clean second machine or new-user qualification is inferred from these checks. Owner/contributor/four-media and native/vendor/model/source-form assessments remain pending. No project LICENSE, public push, remote-main merge, installer upload, tag or release occurs in this plan.
