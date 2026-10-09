# Actual SDK renderer-crash checkpoint qualification

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans inline. Continuous Native execution and one fresh strongest-model final review are already authorized. Steps use checkbox syntax.

**Goal:** Exercise the original M2 forced-interruption recovery requirement against the retained current production candidate with real SDK inference, rather than normal reload with model substitutions.

**Architecture:** Reuse the current reviewed packaged probe's startup, source guard, owned synthetic stream and native IndexedDB readers. After a committed recording checkpoint and a visibly larger unsaved frame count, use CDP Page.crash on this test page only, confirm a native page crash event, and open a fresh page in the same browser context. Compare restored original checkpoint bytes/identity/status and test backup/import. Wrap the entire driver/service/browser tree in the existing Windows job helper; freeze inputs, retain failed runs and independently verify output. No production code changes unless this actual acceptance test exposes a reproducible product defect.

**Tech Stack:** Existing Node24.19/Playwright/Edge154, Python3.12.14 ownership helper, unmodified TasksVision1.0.1/models, SwiftShader640x480.

**Spec:** docs/superpowers/specs/2026-10-06-open-source-product-design.md section6: forced-close recording recovery loses at most the last unconfirmed checkpoint interval. docs/superpowers/specs/2026-10-06-studio-projects-design.md and docs/release-checklist.md remain binding. This scoped renderer failure is not power loss/full-browser-process failure, arbitrary-hardware durability, physical camera quality or complete release acceptance.

## Global Constraints

- Retained candidate source53ea1d5434bbaaeb8755a8b3f1d421edd3ca1694, ZIP SHA4c3ffe2a66aec1cf614d3d79c08564655d71a2e9183c802ad471f8be80e5148a; owned fixture SHAa2f65e0edf8248b666386488c92f8d968bee80a32b88e6557dd08e44e4cc80c2.
- No SDK/API/model doubles; replace getUserMedia only with the already-owned mannequin stream. No physical camera/private actor/provider upload/vendor message/main merge/publication.
- Confirm stored transaction completion and recording status before crash; confirm UI frames exceed saved frames without submitting Stop/withdrawal or normal navigation. Do not infer absent raw tail data from a counter as a fidelity oracle.
- Observe a page crash event, then destroy only that already-crashed page; restart UI in the same origin/context, require consent reset and interrupted status, exact original saved frames/IDs and media=null. Track monotonic pre-crash checkpoint observation times; assert crash control occurs within5000ms of the last observed committed prefix. This observed bound is not exact sensor-to-screen timing.
- All original22requirements and remaining Mac, physical, rights, second-machine/five-user/formal release gates remain intact. Retain private evidence and timestamped cleanup.

## Review Focus

- A crash must be actual renderer failure, not normal reload/pagehide or a fabricated counter; only the owned test page is targeted.
- Saved prefix equality must use full native persisted frames and identities; normal finalization must not manufacture the recovered tail.
- The observed unsaved interval and frame-count evidence must retain timing/measurement limitations, especially if a checkpoint races the crash.
- Recovery must not silently restart consent/camera or replace the original take; archive import must use a new project identity.
- Owned-tree cleanup and unchanged candidate/source must be independently checked without certifying full-browser/power-loss/human/physical acceptance.

### Task 1: Actual crash, recover and source-bound proof

**Files:** Create .superpowers/sdd/2026-10-09-renderer-crash/{packaged-runtime-probe.mjs,run-renderer-crash.py,verify-renderer-crash.py,inputs.json,progress.md} and fresh owned run outputs; write docs/superpowers/reports/2026-10-09-renderer-crash.md after actual execution.

**Interfaces:** Consume reviewed startup/probe from .superpowers/sdd/2026-10-09-current-sdk-runtime/ and scripts/unity-quality.py run_owned/freeze_sources/verify_sources/git_identity. Produce original committed checkpoint, crash event/control timing, actual native recovered/imported frames/archive, redacted network/logs, ownership/completion and postflight. Production interface unchanged.

- [x] **Step 1: Build bounded actual acceptance probe.** Copy only reviewed startup through first checkpoint; change workspace path. Replace graceful withdrawal/remainder with: wait until `/^\d+ frames captured$/` exceeds persisted length; read committed prefix; observe `page.once('crash',...)`; `await context.newCDPSession(page).send('Page.crash')` with a bounded15second race; close crashed page; open fresh page in same context/origin; require interrupted warning, Saved, exact saved prefixes/IDs and unchecked SDK consent/zero additional camera requests. Export/import actual backup and require new project identity/full original frames. Use existing owned driver with240second deadline. Expected: actual crash observed and recovery/backup/import exact; no fabricated feature RED for a validation-only increment. A resolved CDP call is allowed if the separate native crash event is observed.
- [x] **Step 2: Execute, inspect and independently postflight.** Original `run-renderer-crash.py` actually crashes but its earlier-prefix exact-size oracle fails on a later committed checkpoint; preserve that exit1/terminal outcome. Ledger ruling adds `packaged-runtime-probe-2.mjs`/`run-renderer-crash-2.py`/`inputs-2.json`: after confirmed renderer death, load same-origin health JSON and read native stored project before product JS initialization; require recovered frames equal this latest committed snapshot and retain the exact earlier prefix. Run `server/.venv/Scripts/python.exe -B .superpowers/sdd/2026-10-09-renderer-crash/run-renderer-crash-2.py`. Expected: exit0/full-tree terminal, hashes unchanged and recovered/imported42frames equal latest native commit. Independently inspect archive/digests/executable/finite values/consent reset/crash event. The <5000ms bound applies only to observed read-to-control interval, not exact prior commit/max-loss timing; the independent snapshot settles the racing-prefix ambiguity. Do not demand graceful graph-closing logs from a crashed renderer.
- [ ] **Step 3: Record and final review.** Commit scoped report/plan status, then task completion runs `server/.venv/Scripts/python.exe -B .superpowers/sdd/2026-10-09-renderer-crash/verify-renderer-crash.py`. Expected: all scoped assertions pass. One fresh strongest-model Native reviewer checks full branch/private helpers/actual receipts using requesting-code-review template and the five focus lines verbatim. Important/Critical fixes use one watched failure-to-pass pass; defer Minor. Retain evidence/local qualification branch and original release gates; no unnecessary public push/CI for unchanged product.
