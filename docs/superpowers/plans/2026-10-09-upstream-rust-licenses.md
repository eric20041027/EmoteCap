# Upstream Rust License Delivery Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver eight source-bound original upstream license texts for four manifest-only archives without conferring redistribution approval.

**Architecture:** Optional strict descriptor on the existing Rust owner; rust_notices validates exact crate/source/URL/text ownership and renders separate upstream locations. Existing Windows builder/copy/startup integrity checks consume the same admitted material without new network activity.

**Tech Stack:** Frozen Python3.12.14, pytest, existing Windows packaging and source corpus.

**Spec:** docs/superpowers/specs/2026-10-09-upstream-rust-licenses.md

## Global Constraints

- Preserve480original texts, all196crate/archive declarations,364old Rust license associations, locks/runtime/SDK/model/application/Unity bytes and MIT.
- Fixed base1bceeb5267046893d6beb8ea0e72030bdc1bb20e; reuse linked worktree, Native execution already authorized.
- Eight upstream files retain original bytes and raw URL/Git SHA1/SHA256; vex-sdk dirty=true is retained.
- No private motion/public binaries/source tag/main merge/third-party message without its separate explicit authorization.
- Assessment and all independent product/human/vendor release gates remain pending.

## Review Focus

- An attacker substitutes a valid different crate/version/license text: exact existing identity/checksum/terms must reject.
- Malformed repository/URL/path/commit/Boolean or duplicate ownership: reject before construction without fetching.
- Upstream text matches SHA256 but not declared Git blob: independent hash must reject.
- Legacy manifest-only source declarations: counts and original bytes remain truthful, no invented archive member.
- Late supplement mutation after admission/copy/ZIP: actual builder must reject without a completed receipt.

### Task 1: Validate and deliver upstream supplements

**Files:** Modify scripts/rust_notices.py and third_party/inventory.json; add eight original texts under third_party/licenses/rust-upstream/. Add server/tests/test_rust_supplements.py; update docs/redistribution-assessment.md/docs/release-progress.md and aggregate report. Private task evidence goes under .superpowers/sdd/2026-10-09-upstream-rust-licenses/.

**Interfaces:** Existing validate_rust_notices returns dataFile/text/summary, consumed by validate_notices/copy_notices/build_windows. Add optional owner.rustLicenseSupplements with exact schema in spec; preserve existing root evidence. New summary integer fields are rustSupplementedCrates, rustSupplementaryLicensingTexts and rustUnresolvedManifestLicenseCrates, zero/defaulted for legacy inputs.

- [x] **Step 1: Write real recipient and negative controls first.** Reuse rust_inputs/save/validate from test_rust_notices. Convert its owned crate to manifest-only and remove its owned archive text; add a distinct upstream LICENSE under exact crate/commit path, keeping original compiler terms. Render/copy and assert original count1, supplements1/text1/unresolved0, literal source URL and dirty=true visible. Parameterize identity/checksum/terms/repository/commit/path/URL/query/fragment/dirty-type/hash/blob/ownership/duplicate/extra/missing mutations; every one must raise PackageError. Include changed-after-admission copying and actual builder after-copy/before-ZIP/after-ZIP mutation cases.

```python
def test_supplement_is_delivered_without_forging_archive_members(supplement_inputs, tmp_path):
    repo, prepared, index, data = supplement_inputs
    result = validate(repo, prepared)
    assert result['summary']['rustManifestOnlyCrates'] == 1
    assert result['summary']['rustSupplementedCrates'] == 1
    assert result['summary']['rustSupplementaryLicensingTexts'] == 1
    assert result['summary']['rustUnresolvedManifestLicenseCrates'] == 0
    assert data['registryCrates'][0]['suppliedLicensingFiles'] == []
```

- [x] **Step 2: Watch meaningful RED.** Run server/.venv/Scripts/python.exe -m pytest server/tests/test_rust_supplements.py -q; save output. Expected new valid-flow/count and actual builder cases fail because existing admission has no supplement association; no import/setup failure counted as RED.
- [x] **Step 3: Implement strict offline admission and rendering.** Validate optional descriptor before accepting owned references; bind each to original manifest-only crate. Reuse _fields/_list/_digest/_string/safe_name/licensing for bounded canonical records. Check Git blob SHA1 from exact file bytes. Render upstream versus archive locations and dirty state explicitly; keep original metadata summary unmodified and add separate output counts. Implement no fetch or runtime execution.
- [x] **Step 4: Verify GREEN and integrate actual bytes.** Run new controls plus test_rust_notices/test_package_notices/test_windows_package. Copy exactly eight researched files into unique paths, construct descriptors from frozen evidence, preserve original480files/root metadata and compare all old hashes. Run actual validate_notices against the accepted prepared runtime and frozen Web. Expected488texts,4supplemented/8texts/0unresolved, original manifest-only4 and assessment pending.
- [x] **Step 5: Commit and build fixed-source artifacts.** Run full fast backend -m 'not slow'; commit only code/tests/material/docs. From clean head and existing prepared runtime, build two fresh Windows candidates/ZIPs using scripts/build_windows.py. Independently compare receipts, every ZIP member/hash and all488texts. Expected identical ZIPs, exact eight supplements and updated recipient notice, unchanged app/runtime/locks/MIT, releaseGate=pending. Run actual isolated entry plus a damaged-supplement copy, require rejection before private data creation; owned processes terminal.
- [x] **Step 6: One fresh Native review and completion.** Review whole branch and exact research/artifact evidence on the most capable model. Re-grade findings; one TDD correction pass for Important/Critical, minors deferred. Preserve evidence workspace. Standing new-branch/draft-PR/CI approval applies to reviewed public source; supplier question awaits separate authorization. Complete only this task, full M1–M5 remains active.
