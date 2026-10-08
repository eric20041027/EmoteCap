# Owner-approved MIT Adoption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the owner's confirmed MIT/header/code/contributor/four-media rights to source, standalone UPM and newly built Windows candidates.

**Architecture:** Keep one canonical root LICENSE. UPM receives identical bytes and SPDX metadata; the Windows builder archives the committed license, validates its approved digest, ships it and binds it in the frozen manifest. Historical source fixtures with no committed license remain explicitly unlicensed/pending.

**Tech Stack:** Python 3.12.14, pytest, Git, Unity UPM JSON, existing deterministic Windows builder.

**Spec:** `docs/superpowers/specs/2026-10-06-open-source-product-design.md`, M5; the human approved all four proposal items on 2026-10-08.

## Global Constraints

- MIT header: `Copyright (c) 2026 EmoteCap contributors`.
- Preserve original history, contributor attribution and all third-party text bytes; owner approval does not relicense upstream dependencies/models.
- Motion v2 stays 48 driven bones, 192 rotation values and 52 full exported bones; no solver/runtime changes.
- Keep `releaseGate=pending` for hardware/human/vendor/formal-release gates; existing binary/tarball lineage is immutable.
- Use Native implementation and one fresh final Python review; push/draft PR/CI already authorized, remote main merge/tag/formal release remain separate.

## Review Focus

- Ignored/untracked LICENSE must not silently disappear from committed source snapshots.
- Changed license text after validation must fail before candidate completion.
- Changed/dropped candidate license after copying must fail manifest/archive checks.
- Legacy unlicensed fixtures must not acquire an MIT claim; third-party terms stay separate.
- UPM manifest/license bytes/meta GUID must agree without changing dependency or runtime behavior.

### Task 1: Adopt and deliver the approved license

**Files:** Create `LICENSE`, `unity/com.emotecap.mocap/LICENSE.md` and `.meta`; modify UPM `package.json`, `scripts/package_notices.py`, `scripts/build_windows.py`; add regressions to `server/tests/test_windows_package.py`. Update English/zh-TW approval records, current README/quickstart/notices/checklist/progress and the owner's pending entry in `third_party/inventory.json`.

**Interfaces:** `project_license_record(snapshot: Path) -> dict | None` returns the canonical MIT path/size/SHA256/SPDX record or historical absence; noncanonical/linked/untracked/changed license fails with `PackageError`. `validate_notices` records it in `summary.projectLicense`; `copy_notices` revalidates source identity. `build` ships root LICENSE, adds its frozen manifest record and removes only the completed owner gate.

- [x] **Step 1: Add the independently approved MIT text and failing package-delivery tests.**

```python
def test_candidate_delivers_committed_project_mit(build_inputs, tmp_path):
    repo, prepared = build_inputs
    (repo/'LICENSE').write_bytes((ROOT/'LICENSE').read_bytes())
    git(repo,'add','LICENSE'); git(repo,'commit','-qm','owner-approved MIT')
    output=tmp_path/'candidate'
    result=builder.build(repo,prepared,output,tmp_path/'candidate.zip')
    assert (output/'LICENSE').read_bytes()==(ROOT/'LICENSE').read_bytes()
    assert result['manifest']['licensingMaterial']['projectLicense']['spdx']=='MIT'
    assert result['manifest']['releaseGate']=='pending'
```

Run: `server/.venv/Scripts/python.exe -m pytest server/tests/test_windows_package.py -q -k project_license`

Expected: delivery/mutation/ignored-license cases fail because the old builder omits the root license; existing legacy control passes.

- [x] **Step 2: Implement source-bound license delivery.** In `package_notices.py`, add the approved byte-digest constant and bounded `project_license_record`; include the record in validation and recheck it during copying. Generated README identifies MIT only when that record is present. In `build_windows.py`, require a present LICENSE to be tracked, archive it, copy exact source bytes, check the staged hash, add its frozen record and remove only the owner gate when MIT is delivered. No other release gate is removed.

```python
PROJECT_MIT_SHA256 = 'b95395a1999f99bf8d392caec287ff427dc69981fe1d5f97a83ca98fd4dc2406'
def project_license_record(snapshot: Path) -> dict | None:
    path = ordinary_path(snapshot/'LICENSE')
    if not path.exists(): return None
    if not path.is_file() or path.stat().st_size != 1078 or sha256_file(path) != PROJECT_MIT_SHA256:
        raise PackageError('Project license differs from the owner-approved MIT text')
    return {'path':'LICENSE','size':1078,'sha256':PROJECT_MIT_SHA256,'spdx':'MIT'}
```

The builder's committed-presence check prevents a deleted snapshot from being downgraded to a historical unlicensed source:

```python
project = project_license_record(snapshot)
if bool(project) != bool(license_tracked) or project != licensing_summary['projectLicense']:
    raise PackageError('Project license changed during candidate construction')
```

- [x] **Step 3: Add identical UPM LICENSE.md, unique existing-style meta GUID and `"license": "MIT"`; update current bilingual owner records and documentation.** Record the human's four approvals as assertions from the owner, without claiming independent legal authentication or final-release approval. Retain old candidate lineage and 0.2.0 development package version; no tag/release is created.

- [x] **Step 4: Run regressions and affected suite.**

```text
server/.venv/Scripts/python.exe -m pytest server/tests/test_windows_package.py server/tests/test_package_notices.py server/tests/test_source_notices.py server/tests/test_rust_notices.py -q
```

Expected: canonical license shipped/bound; invalid/ignored/changed/dropped license rejected; all earlier source/native/text safety cases pass. Run the frozen fast backend after the scoped suite, check documentation links and UPM byte/meta parity.

- [ ] **Step 5: Commit clean source and qualify fresh local artifacts, then complete independent review and authorized publication.** Build two new Windows ZIPs and two new local UPM tarballs at clean committed source; inspect actual LICENSE and metadata bytes/manifests/source bindings and deterministic hashes. Preserve previous artifacts. One fresh final reviewer covers the new source/artifact scope; fix Critical/Important findings in one watched RED→GREEN pass and refresh affected artifacts if source changes. Push reviewed source to the existing draft PR and verify both exact-head three-OS CI matrices. Formal distribution remains pending.
