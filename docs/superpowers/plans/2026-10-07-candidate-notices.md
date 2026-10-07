# Candidate Notices Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Continue Native inline with one fresh final Python review.

**Goal:** Qualify a current internal Windows package containing the SDK choice and exact source-linked licensing material.

**Architecture:** A bounded notice validator binds snapshot files/index to committed source and prepared runtime/Web bytes. Existing fixed-source builder copies only verified index/texts and a generated package summary before manifest/ZIP/receipt publication. Bootstrap remains unchanged and hashes new files normally.

**Tech Stack:** Python3.12.14stdlib/existing package_files, frozen Web/SDK, existing preparedWindowsruntime; actual Edge154/Blender4.5.14.

**Spec:** `docs/superpowers/specs/2026-10-07-candidate-notices-design.md`.

## Global Constraints

- Internal pending candidate, no LICENSE/public merge/push/tag/release or assumed rights/native/vendor approval.
- Retain -I-S-B, private settings/data,127.0.0.1:8787, complete marker/ZIP/receipt and existing bounded ordinary-file rules.
- Material512texts/2MiBfile/16MiBtotal; schema/draft status/unique names/exact file set/digests/sourcepins/receipt/native/WASM correspondence mandatory.
- Copy index/licenses under notices/third_party, generate plain local package summary; no source-only broken relative links/arbitrary assets/private recordings.
- Preserve existing frozen dependencies/assets/contracts/solver/app behavior and deferred reserved-name Minor; no SDK/camera/provider execution.
- Fresh currentWeb source/archiveSHA and repeatedZIP/hash/tamper/relocation/actualbackendBlender qualification; no clean-machine or Unity evidence substituted.
- One fresh final review/one needed correction pass, no rereview; keep scratch, ledger every Ruling+cost.

## Review Focus

1. A candidate must not silently omit new notice files or mix stale inventory/lock/runtime/WASM bytes with a new source commit.
2. An extra linked/private/binary/traversal/hardlinked licensing item must not enter the package by following an index or tree alias.
3. Pending legal/product status must remain explicit even though a new package builds and local tests pass.
4. Material validation/copy failure must not expose a runnable completed directory, preserving earlier outputs and late publication guarantees.
5. Relocated end users must see understandable SDK choices/local notices and retain sample/save/backup/export behavior without developer runtimes or camera/cloud use.

---

### Task 1: Notice validation/copy, current package generation and actual qualification

**Files:** Create `scripts/package_notices.py`, `server/tests/test_package_notices.py`; modify `scripts/build_windows.py`, `server/tests/test_windows_package.py`, `packaging/windows/START-HERE.txt`, `docs/windows-candidate.md`, `docs/release-progress.md`; create `docs/superpowers/reports/2026-10-07-candidate-notices.md`. No bootstrap/server/Web/Unity implementation changes.

**Interfaces:** `validate_notices(snapshot:Path, prepared:Path, public_files:list[dict])->dict` returns validated index/text file records and summary; `copy_notices(snapshot:Path, staged:Path, validated:dict, source_commit:str)->dict` copies only validated material/generates plainREADME and returns manifestsummary with pending assessment. Existing builder build signature unchanged. Source ARCHIVE_PATHS includes third_party/inventory.json and third_party/licenses; source-onlyREADME not copied. Expected context five keys server/pyproject.toml/server/uv.lock/web/package-lock.json/web/scripts/mediapipe-assets.json/packaging/python-runtime.json; exact frozen hashes compared at snapshot.

- [ ] **Step1: Write meaningful builder/material failures.** Extend existing synthetic build_inputs with an original owned license/index linked to its five fake source pins/actual fake receipt. The index's native files reflect its payload and SDK records match any synthetic publicWASM. Add builder assertions for exact notice presence/summary/new marker behavior. Write parametric cases missingindex/changedtext/stalelock/extratext/duplicated-case/traversal/linked/hardlinked/oversized/approvedstatus/native/WASM mismatch. Expect current builder to ignore material, so meaningful admission/presence checks fail before implementation. A loadable validator stub may exist only for test admission, not be committed.

```python
def test_candidate_preserves_exact_notice_bytes(build_inputs,tmp_path):
    repo,prepared=build_inputs
    result=builder.build(repo,prepared,tmp_path/'candidate',tmp_path/'candidate.zip')
    assert (tmp_path/'candidate/notices/third_party/licenses/owned/LICENSE').read_bytes()==b'Owned license fixture\r\n'
    assert result['manifest']['licensingMaterial']['assessment']=='pending'
```

- [ ] **Step2: Watch focused RED.** `uv run --directory server --frozen --python 3.12.14 pytest -q tests/test_windows_package.py tests/test_package_notices.py`, redirect/read the plan log. Confirm missing copying/admission, not an absent Python import/executor. Ordinary existing builder controls remain valid.
- [ ] **Step3: Implement bounded validator and atomic integration.** Reuse ordinary_path/safe_name/file_inventory/verify_inventory/sha256_file/copy_tree/write_json; reduce notice-specific bounds before copies. Strictly parse sourceJSON, reject extra/missing/duplicate/invalid references and status/context/native/WASM mismatch. Native metadata matches prepared receipt; SDK wasm paths map only to built mediapipe/wasm entries, rawroot bundles stay source evidence. Verify before copy and again destination exact inventory. Generate plainREADME with fixed sourcecommit/indexSHA, copiedcount and pending legal/product qualifiers. Add index/materialsummary to manifest; include actualSDK network and all existing gates. Existing source change checks and .incomplete/ZIP/receipt sequence remain unchanged.
- [ ] **Step4: Focused/full GREEN and source docs.** Run focused suites, then all fast backend. No unrelated Web tests repeat when Webcode unchanged; run frozen build and existing assets gates because actual candidate requires current bytes. START-HERE names the new checkbox/reload behavior/separateGemini and noticesREADME/index. Record actual pending qualification, do not approve rights or remove deferredMinor.
- [ ] **Step5: Commit source and build from fixed clean HEAD.** Reuse existing prepared-a061d583-e393-4f89-a96d-89e94b5d7140 only after pin verification. Run build_windows.py with fresh owned Unicode/spaces candidate/ZIPpaths in this plan's workspace; record fixed source/manifest/textcounts/SHA. Re-zip unchanged candidate to a new filename and require identical SHA. Inspect exact notice bytes/index againstsource and generatedsummary pendingflags. Failed outputs remain preserved.
- [ ] **Step6: Actual relocated qualification.** Reuse/adapt owned existing Windows candidate harness; fresh relocated copy and distinct private data/settings. Poison Pythonpath/remove developerPATH, verify supplied wrapper/readyorigin, Edge154defaultSDKunchecked/no model/0external/cloud sample/edit/nativeIDB/reload/archiveimport/pairedackstop/realBlender4.5.14FBX. Require notice file corruption tofail beforeapp/private-data startup. Inspect desktop/narrow screenshots. No physicalcamera/actualSDK inference/Unity/targetlaptop/clean-machine claims. Shutdown only ownedPIDs/browser contexts and read all outcomes.
- [ ] **Step7: Report/commit/Native task-done/finalreview.** Record exact gates/hash/currentcandidate selection/oldartifact supersession and allrulings/costs inreport/progress. Native task-done repeats full fastbackend command fromStep4. One freshPythonreview wholefixedBASE..HEAD; regradeeffects, oneImportant/Criticalwatchedfix/wholegreen/actualartifactrebuild ifsourcechanges, no rereview/minorpolish. No publiccandidate upload/mainmerge/tag/release; continue remaining real/human gates.

Source push/second draftPR/three-OSCI request for earlier reviewedcb170ff is pending independently; do not publish this later code merely because the question is displayed or preselected.
