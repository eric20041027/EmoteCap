# Original MVP Measurement Runner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute the actual pinned original converter/solver through the private collector and produce source-linked before/after evidence.

**Architecture:** Build verified historical inputs into one bounded self-contained module. A consent-aware browser loader verifies artifact bytes; a wrapper observes original injected boundaries without editing its algorithm. The private page selects a real implementation and retains separate raw/preview/final outputs.

**Tech Stack:** Node24.19.0/Vite8.3.1, current TypeScript/React, Edge154/Playwright1.62.1, unchanged Python evaluator. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-07-original-runner-design.md`

## Global Constraints

- Source713d349df05aa26b6b95a1b7974f7f3d8e574149/indexSHA2ae375ffc2e783ca4ffe296564078bad99e18bc34d13bde19f9342e9756577b8;19pinned inputs, only runtime motion/import/contract data compiled.
- One ESM/no imports/assets≤512KiB; compact manifest≤16KiB; manifestSHAis build ID; fixed ignored runner destination, exclusive writes/receipt last/exact reuse.
- Original app/fetch/SDK factory/old lock never executed or installed. Disable Vite project config/env/public output; only verified source memory loads.
- Consent before effects and around awaits; bounded same-origin/no redirects/abort/Blob URL cleanup; actual original solver/converter selection cannot be simulated by source labels.
- Existing raw/preview/final/timing/error/hand/digest/32MiBlimits and ordinary app/packet v1 remain.
- Preserve scratch/partial output and unmodified historical inputs. No public writes or inferred real acceptance.

## Review Focus

1. Hash checked bytes must be the exact imported bytes; oversize/redirect/wrong-source/wrong-build artifacts must fail before module execution/models.
2. Cancel/withdraw during manifest/bundle/hash/import must block late inference, close owned resources and preserve bounded partial diagnostics.
3. Original fatal detector/seek/preview calibration/solver errors must remain observed once; diagnostic failures cannot change ordinary final output/error.
4. Compiler resolver/config/environment escape or artifact alias/overwrite must not execute old helpers, leak environment or falsely complete a bundle.
5. Current/original selection and metadata must bind the actual code/solver; matching packets require the same retained source and settings, not two generated files or mocked original runner.

### Task 1: Build and load the verified original implementation

**Files:** create `web/scripts/original-runner.mjs`, `.test.mjs`; `web/src/evaluation/originalRunner.ts`, `.test.ts`, `originalAdapter.ts`, `.test.ts`; modify existing videoMeasurements/page/tests/e2e; docs/report/progress. Root owns all edits. No implementation/exploration subagents.

**Interfaces:** `buildOriginalRunner(repository,index=BASELINE_INDEX):Promise<{buildId,directory,manifest,reused}>` uses accepted snapshot preparation/verification and fixed destination. Manifest records schema `emotecap-original-runner-v1`, sourceCommit/sourceIndexSha256, consumedSources, bundleSha256/bundleBytes, builderSha256, compilerLockSha256, viteVersion/nodeVersion, qualification `compiled-source`. Browser `loadOriginalRunner(buildId,{authorize,signal}):Promise<OriginalRunner>` returns compiled `convertVideo/createPoseSolver/ImportError/NO_PERSON_MESSAGE` plus verified provenance. `convertOriginalVideo(runner,duration,steps):Promise<ConvertedVideo>` observes injected boundaries. CollectionOptions adds optional `implementation:'current'|'original'` (defaultcurrent) and `originalBuildId`; original requires fixed source. Raw metadata records implementation/provenance; v1 remains.

- [ ] **Step1: Builder RED.** Real owned Git fixtures with required entry modules; watched cases for actual compiled output, deterministic artifact reuse, no config/env/extra imports/assets execution, source tamper/no complete output, output aliases/extra/altered/incomplete outputs, and bounded compilation. A loadable unimplemented builder only admits test execution, never committed.
- [ ] **Step2: Builder implementation/GREEN/actual compilation.** Verify/cache source bytes and recheck digests; isolated Vite library config plus closed memory resolver; refuse multiple/externally dependent output. Derive manifest/build ID from actual output and toolchain. Exclusive contained artifacts/complete verification/reuse. Compile actual original and independently import its pure module, confirming original exports and metadata. Node suite green; no old code with effects executed.
- [ ] **Step3: Loader/adapter RED.** Bounded response controls, hash/source/build/redirect/abort/no-effect admission and Blob lifecycle. Actual-original parity uses the compiled artifact in a private harness; unit fakes prove wrapper observation control only. Pin all ordinary/calibration/no-person/fatal10/seek/solver/cancel/observer/clock/copy behaviors; tests must reach the relevant boundary.
- [ ] **Step4: Implement loader and original instrumentation/GREEN.** Stream caps, digest before import, original fixed metadata, leased await boundaries, owned Blob cleanup. Wrap original inputs/progress/preview solver, report copied events before fatal throws, preserve default behavior and no-person classification. Record current wrapper source hashes as provenance where available; do not claim standalone original tsc.
- [ ] **Step5: Collector/private page RED→GREEN.** Wrong original source/missing build rejects before effects; bind selected implementation before hash awaits; same loader/solver actually used. Original source readonly/selectbuild/private controls; cancel keeps partial/previous result. Existing current mode and production entry unchanged.
- [ ] **Step6: Actual original parity and Edge/Python bridge.** Real compiled original/current solver+converter outputs/failures compared on controlled world/image data; no current-code substitute. Edge uses same actual synthetic File bytes for both selections, SDK-only mocks, real decoder/solver/build loader/download. Retain all source/build/raw/packet artifacts and source identities. Python --baseline comparison must accept and report pending/synthetic; no mock timing is product performance.
- [ ] **Step7: Relevant regression/docs/commit.** Full Web/new+existing Node/type/defaultbuild, affected private/SDK/camera/browser flows; source-only and compiled-source boundaries/operation/limitations clear. Snapshot and private page excluded from defaultbuild. Backend unchanged except actual evaluator invocations. Commit testable code and actual qualification report.
- [ ] **Step8: Native task-done and fresh final review.** Full relevant Web+Node gates; package wholeplanBASE..HEAD and one fresh mostcapable TypeScript/JavaScript reviewer. Regrade every finding/decline with ruling+cost; one watched Important/Critical correction pass/fullGREEN/affected workflows, no rereview; Minors deferred, all scratch retained.

Continuous Native goal authorizes this local increment. Existing missing video/hardware/Unity/rights/PR2 approvals remain separate and no public writes are performed.
