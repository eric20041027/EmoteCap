# Current Frame SDK Candidate Validation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans inline with the preserved Native authorization. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Verify the actual unmodified SDK capture/storage/withdrawal and actual captured-take export path in the latest native-frame Windows candidate.

**Architecture:** Reuse the previously reviewed actual-SDK probe in a fresh private workspace with fixed candidate paths and source guard. Extend it to export the just-recorded/imported SDK take before the separate sample/Live Link control. Independently compare the actual captured job input to its existing FBX with the maintained Blender roundtrip oracle. No application/dependency changes.

**Tech Stack:** Existing Node24.19, Python3.12.14, Edge154/SwiftShader, unmodified TasksVision1.0.1/models, native IndexedDB, local packaged Python/API, Blender4.5.14.

**Spec:** docs/release-checklist.md and docs/superpowers/specs/2026-10-06-open-source-product-design.md; actual current-source execution, input-bound export fidelity and unchanged original22requirements.

## Global Constraints

- Candidate source3967beb98c9781b18ab737d3f2f70ed8b8e6dc6d, archiveSHA256d82ce36debfedd0d4c901af67c7c09d94e6821bef17b9215c1c5e9540789c549,88518977bytes,5764members. Local qualification commits may change documentation only.
- Candidate path .superpowers/sdd/2026-10-10-camera-counter-integrity/internal-candidate-v2/candidate-a; preserve both archives and all old failed stages.
- Owned mannequin.webm SHA256a2f65e0edf8248b666386488c92f8d968bee80a32b88e6557dd08e44e4cc80c2; no physical camera, private actor image, new model/version or SDK/API doubles.
- Synthetic classification, qualification pending; real SDK solves are not physical accuracy/laptop/second-machine/five-user/complete-rights qualification.
- Default-denied and permission-only have no processing/model/external page requests; disclosed admitted SDK cleanup metrics are retained, not described as zero traffic or proof of opaque-body privacy.
- Fresh private output, frozen consumed inputs, existing owned process trees/deadlines. No unrelated process termination, source-video upload, Gemini, public pose data, main merge or release.
- Canonical FBX oracle limits are existing0.5degrees/0.001meters/one30fpsoutputframe/zero duplicate keytimes; these are export fidelity only.

## Review Focus

- Wrong-source candidate must reject before service/model startup; test a rejected prior candidate explicitly.
- Captured export must correspond to the just-restored actual-SDK take/revision, not the independent sample control; validate exact job snapshot/input SHA/clip frames.
- Withdrawal must preserve recorded checkpoint prefix, stop its owned track and close actual model graphs; retain metrics observations by phase.
- Reload/import must compare complete actual SDK arrays and new project identity, not stale Saved UI; use native IDB revision checks and backup contents.
- All source/candidate/fixture/tool bytes and owned process lifecycle must be audited; the probe cannot waive original physical/human/rights requirements.

### Task 1: Actual current-source workflow and input-bound captured export

**Files:** Private .superpowers/sdd/2026-10-10-current-frame-sdk/ probe/driver/verifier/frozen inputs/results; public docs/superpowers/reports/2026-10-10-current-frame-sdk.md. No production edits.

**Interfaces:** Consume the fixed existing candidate, reviewed packaged-runtime-probe.mjs and scripts/unity-quality.py owned process API; produce actual capture/checkpoint/withdraw/reload/import/backup plus captured and sample job/FBX receipts. Consume server/tests/blender_roundtrip.py with one extracted captured clip and the authentic captured FBX; produce frame-complete canonical fidelity samples.

- [x] Copy the reviewed previous SDK probe to this plan's fresh workspace, changing only workspace/candidate/source guard constants initially. Freeze predecessor/probe/fixture/candidate, then run a wrong-source control using the older53ea1d5 candidate while requiring3967beb. Expected: actual source assertion exit1, no service/model ownership; preserve rejected output. This is an admission test, not fabricated application RED.
- [x] Add an explicit captured-take export helper after exact backup/import. Trigger the actual UI export; poll job state, require snapshot.projectId/imported.id and snapshot.takeId/imported.takes[0].id, read input.json from that existing owned job, require its hash equals job status and snapshot matches exactly. Save actual input/clip/FBX under captured-specific names. Keep raw frames unchanged; do not claim processed export arrays equal raw take arrays.
  ```js
  assert.equal(job.snapshot.projectId,imported.id);
  assert.equal(job.snapshot.takeId,imported.takes[0].id);
  const bytes=readFileSync(path.join(artifact,'private local data/jobs',job.id,'input.json'));
  assert.equal(digest(bytes),job.inputSha256);
  const input=JSON.parse(bytes);assert.deepEqual(input.snapshot,job.snapshot);
  save('captured-job-input.json',bytes);save('captured-export-clip.json',input.clips[0]);
  ```
  The later sample export must select its own job/snapshot with two total jobs, not reuse the captured file. Update summary with distinct job IDs and hashes. Expected: captured and sample outputs exist, actual API/Blender exercised, all admission/snapshot assertions pass or actual failure retained.
- [x] Freeze the extended probe/current candidate/source and execute it under one existing owned outer job with a300sdeadline. Retain raw native IDB projects, source/hash bindings, bounded redacted network/console, actual screenshots and process results. Expected: actual SDK recording, confirmed five-second checkpoint prefix, withdrawal complete and2graphs closed, exact reload/new-namespace import, both actual jobs succeed. No fallback to model/SDK doubles to make the workflow pass.
- [x] Run the existing independent Blender roundtrip script against captured-export-clip.json/captured.fbx using the actual4.5.14binary and frozen contracts/bones.json. Expected: every processed timestamp covered,52bones/zero duplicate keys, angle/position/duration within unchanged oracle bounds. Preserve actual job input hash and processed/raw distinction. No physical/anatomical claim.
- [x] Independent read-only postflight: verify every frozen input and complete candidate manifest/ZIP, exact original/prefix/restored/imported arrays, backup/media omission, actual job input SHA/snapshot and FBX bytes, request-phase bounds/no provider/source upload, actual renderer, graph closures and all owned completion receipts. Perform timestamped targeted CIM/port queries; an observation error is not absence proof. Expected: concrete positive and negative controls pass, source/artifacts unchanged, no live owned tree.
- [x] Report scope for all original22requirements without waiving incomplete items, then complete the task via task-done running the private postflight. No duplicate full unit/build/CI merely for documentation; no application code changed. Expected: postflight exit0 and bounded report covering actual failures/limits.
- [x] One fresh strongest-model final Native review of new private harness and public report/spec/plan. Regrade every finding/declined judgment, one watched correction pass for material issues, defer minors. Preserve all artifacts. Commit scoped documentation on this local qualification branch; no extra PR/publish for unchanged application bytes.

## Self-review

One task owns all probe/export/fidelity/postflight evidence, with no shared task interface conflict. Five focus cases explicitly map to admission, exact snapshot, withdrawal, native IDB and frozen ownership checks. Existing real SDK assertions are preserved; added captured export strengthens the actual user path instead of substituting sample-only success. Human and vendor gates remain separate.
