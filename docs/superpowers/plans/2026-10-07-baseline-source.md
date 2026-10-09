# Original MVP Source Preparation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare and verify exact, private original-MVP source inputs for the later M4 measurement adapter.

**Architecture:** A committed nineteen-file digest index pins the historical inputs. One Node helper reads exact Git blobs and owns a bounded private snapshot/last-written receipt; reuse is verification only. No historical app, installation or inference is executed.

**Tech Stack:** Node24.19.0 built-ins, installed Git, Node test runner; no dependencies or lock changes.

**Spec:** `docs/superpowers/specs/2026-10-07-baseline-source-design.md`

## Global Constraints

- Original713d349df05aa26b6b95a1b7974f7f3d8e574149;19source inputs;2MiB/file,8MiB total,64entries maximum.
- Fixed private destination `web/.measurement-baseline/<full-commit>`; no source/media/SDK execution, installation, network or public write.
- Validate complete parent chain, regular source Git mode, source/destination containment, link/hardlink refusal, exclusive writes and final receipt last.
- Preserve occupied/modified/partial outputs and all old scratch. Current locks and ordinary application behavior remain unchanged.
- Source-only receipt; original adapter/compiled build/actual authorized motion/hardware/Unity/rights/release acceptance remain pending.

## Review Focus

1. Existing symlink/junction/ancestor alias must never redirect writes outside the selected checkout.
2. A stale/missing/extra/hardlinked snapshot must be refused, preserving its bytes; a receipt alone cannot establish completeness.
3. Replacement Git objects, missing commits, nonregular tree modes and wrong source hashes/sizes must not yield a completed source receipt.
4. Oversized/unsafe/duplicate index paths must fail before any output or Git read; subprocess output/time remain bounded.
5. Interrupted writes retain partial evidence without falsely completing; exact verified reuse makes no mutation or runtime claim.

### Task 1: Pin and prepare the source snapshot

**Files:** create `web/scripts/baseline-sources.json`, `baseline-snapshot.mjs`, `baseline-snapshot.test.mjs`, `docs/baseline-source.md`, report; modify `.gitignore` and release progress. The root owns all edits; no implementation subagents.

**Interfaces:** `prepareBaseline(repository,index=BASELINE_INDEX):{directory,receipt,reused}` and `verifyBaseline(repository,index=BASELINE_INDEX):{directory,receipt,reused:true}`. Both derive the destination from the validated full commit under the selected repository. Export `BASELINE_INDEX` and a typed-by-validation `BaselineError`; CLI derives this checkout from its own script location, accepts no path/options, prints a bounded source-only summary and exits0/2. Validate the index's exact fields and digests; disable replacement objects for every Git read. Receipt schema `emotecap-baseline-source-v1`, sourceCommit, indexSha256, fileCount, sourceBytes and `qualification:'source-only'`; no acceptance or license field inferred.

- [x] **Step1: Read brief/preflight and write RED controls.** Build fresh owned Git fixtures with real files/commits and per-file hash/size/blob identities; test original bytes despite changed working files, exact reuse, tampered/missing/extra/receipt-only outputs, symlink/parent link/hardlink, commit missing/replacement source, nonregular tree mode, unsafe/duplicate/oversize index, bounded Git failure and no premature receipt. A loadable unimplemented helper may be used only to expose assertions, never committed.
- [x] **Step2: Watch Node RED.** `node --test web/scripts/baseline-snapshot.test.mjs`; observe actual assertion/admission failures, not missing files/executors. Record controls already GREEN honestly.
- [x] **Step3: Implement bounded snapshot and verification.** Validate index/repository/parents first; read fixed original regular blobs using Git without replacements/timeouts/output caps. Read/hash all inputs before creating output. Create only fixed parent/snapshot directories and exclusive files; verify ordinary files and complete inventory before the final receipt. Reuse validates exact receipt/index/file bytes/full inventory; no repair/overwrite/cleanup path.
- [x] **Step4: Focused GREEN and actual original invocation.** Node suite green; actual CLI prepares all19files from713d349, repeated invocation verifies reuse, independently compare output/source blob/digest bytes and original locks/model settings. Keep completion/partial evidence private.
- [x] **Step5: Documentation and relevant checks.** Explain PowerShell invocation/private destination/source-only limits and why historical npm lock must not be installed. Link later adapter/real gates; full Node asset/security/new helper tests, type/default build, private snapshot excluded from Git/defaultdist. No backend/browser repetitions when their code is unchanged.
- [x] **Step6: Commit, Native task-done and fixed review.** Task-done runs full relevant Node tests; generate wholeplanBASE..HEAD package, one fresh mostcapable TypeScript/JavaScript reviewer. Regrade every finding/decline, ledger exhaustive ruling+cost, one watched Important/Critical fix/fullGREEN, defer Minor and no rereview. Preserve scratch and continuous M1–M5 goal.

Independent local source preparation is authorized by the continuous goal. No routine plan/method approval is pending for this work; previously asked real source/hardware/Unity/rights/public questions remain separate.
