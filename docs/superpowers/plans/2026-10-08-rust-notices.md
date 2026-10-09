# Rust Source Evidence Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Preserve the user's continuous Native method; one fresh final Python review. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Include byte-verified Rust licensing/source evidence and accurate recipient notices in the internal Windows package.

**Architecture:** A focused Rust validator binds a portable source-evidence JSON to frozen uv/prepared context, actual native files and owned licensing records. Existing notice admission/copy and fixed-source archive include its verified counts/JSON/plain notice. No application or dependency runtime changes.

**Tech Stack:** Python3.12.14stdlib/tomllib, existing package_files/package_notices/build_windows and retained verified source corpus.

**Spec:** `docs/superpowers/specs/2026-10-08-rust-notices-design.md`.

## Global Constraints

- Preserve existing116texts/three certifi source forms/material-v1context/five pins, frozen dependencies/assets/contracts/runtime behavior and pending assessment.
-480total texts/512ceiling/2MiB text/16MiB total. Rust evidence2MiB/3packages/256crates/40compiler source records/512licensing records.
- Source-lock superset remains explicit; binary enumeration/project license false; four manifest-only cases unresolved. Delivery flag true describes this scope only.
- No network/extraction/dependency execution in validator; no private paths/project LICENSE/public writes/Unity or hardware substitutes.
- One fresh final review/one watched Important or Critical correction pass/no rereview/minor polishing; preserve old evidence and outputs.

## Review Focus

1. A source file/component omission or a wrong-but-owned licensing pointer must not generate a completed candidate with misleading source coverage.
2. Native bytes changed after admission/copy must be rejected even if a forged record keeps the same package version or endpoint.
3. Archive member/compiler paths, case aliases, URL fragments/credentials and duplicate/deep/large metadata must not escape the owned bounded copy.
4. Summary/approval/source-superset flags cannot relabel partial source observations as complete linked-component or legal approval.
5. The exact evidence JSON, literal licensing expressions and four unresolved cases must reach recipients and be covered by startup integrity; legacy fixtures must still produce valid pending candidates.

---

### Task 1: Validate, copy and qualify Rust source licensing evidence

**Files:** Create `scripts/rust_notices.py`, `server/tests/test_rust_notices.py`, `docs/superpowers/reports/2026-10-08-rust-notices.md`; modify `scripts/package_notices.py`, `scripts/build_windows.py`, `third_party/inventory.json`, `third_party/rust-source-evidence.json`, `third_party/README.md`, `THIRD_PARTY_NOTICES.md`, `docs/windows-candidate.md`, `docs/release-progress.md`; add358exact original texts under `third_party/licenses/rust-crates/` and six under `third_party/licenses/rust-standard-library/`. Main agent owns all edits; final reviewer reads only.

**Interfaces:** `validate_rust_notices(components,receipt,payload,material,license_records,source_lock,receipt_sha256)->dict` returns dataFile/plaintext/summary; source_lock is the snapshot server/uv.lock Path. Summary contains rustSourceCrates/rustLicensingTexts/rustNativeBindings/rustManifestOnlyCrates. Existing validate_notices/copy_notices signatures remain; their validated snapshot context carries the uv.lock path. The builder optionally archives the single tracked `third_party/rust-source-evidence.json` path.

- [x] **Step1: Write owned fixtures and public behavior tests.** Extend build_inputs with a nonexecutable watchfiles native fixture, valid owned frozen uv entry, evidence JSON/native/source/licensing records and compiler-root license record; update receipt/context and unique ownership. Use existing public notices APIs. Pin positive counts/copied exact JSON/plain notice and negative effects:

```python
@pytest.mark.parametrize('change',['missing-file','missing-owner','wrong-owned','native-bytes','false-approval','duplicate-crate','bad-source-url','stale-context'])
def test_invalid_rust_evidence_cannot_be_admitted(rust_inputs,change):
    repo,prepared,mutate=rust_inputs
    mutate(change)
    with pytest.raises(files.PackageError):
        notices.validate_notices(repo,prepared,files.file_inventory(repo/'web/dist'))

def test_builder_delivers_rust_source_evidence(rust_inputs,tmp_path):
    repo,prepared,_=rust_inputs
    git(repo,'add','.');git(repo,'commit','-qm','Owned Rust source evidence')
    result=builder.build(repo,prepared,tmp_path/'candidate',tmp_path/'candidate.zip')
    assert result['manifest']['licensingMaterial']['rustNativeBindings']==1
    assert (tmp_path/'candidate/notices/third_party/rust-source-evidence.json').read_bytes()==(repo/'third_party/rust-source-evidence.json').read_bytes()
```

Also test malformed/duplicate JSON keys, traversal/case duplicates, counts/size/total bounds, wrong source/wheel pin, missing native/copy-stage change, incorrect summaries/manifest-only claims, foreign/shared ownership and preserved literal licensing expression/source URL. Run `server/.venv/Scripts/python.exe -m pytest -q -c server/pyproject.toml server/tests/test_rust_notices.py` with workspace log. Expected: ignored negative metadata and missing positive delivery fail meaningfully; no missing helper import/setup error counts as product RED.

- [x] **Step2: Implement bounded Rust evidence validator and notice integration.** Derive current source/wheel pin and native/license correspondence; never trust reported summary/approval. Enforce derived portable locations:

```python
expected_license='licenses/rust-crates/'+record['archiveMember']
if expected_license not in owned or license_records[expected_license]['sha256']!=record['sha256']:
    raise PackageError('Rust licensing reference differs from source evidence')
```

Add admission/counts, prepared/staged revalidation, exact evidence copying/hash checks, deterministic RUST-SOURCE-ACCESS.txt and README pointer. Add optional tracked source archive path via exact `git ls-files -z -- third_party/rust-source-evidence.json` output. Run focused Rust/source/notice/builder suites then whole fast backend. Expected: every defined negative rejects; positives and legacy pending fixtures pass; preserve platform skips/warnings.

- [x] **Step3: Integrate actual retained corpus without network or upstream-byte changes.** Read `.superpowers/sdd/2026-10-08-native-rust-assessment-f920e922/` as accepted readonly input. Copy each of358text records and six compiler-root files with exclusive destination writes and original size/SHA256checks. Add one owning component/source-evidence file record, flip only scoped delivery flag, derive new index records with public origin URLs and preserve original116records/context/native/SDK bytes. Expected:48components/480texts, all196source entries/3native/4manifest-only cases; all existing text hashes unchanged; actual public admission passes. Log any count deviation and its cost before changing scope.

- [x] **Step4: Record exact scope and commit clean implementation/material.** Document source-superset limits, literal terms/URLs, four unresolved cases and remaining product/rights gates. Run git diff --check and full fast backend; confirm no Web/server-runtime/contract/entry/dependency change relative to qualifiedf9d5fc2. Commit `feat: include verified Rust source licensing material`. Expected: fixed clean source suitable for builder; no release approval.

- [x] **Step5: Qualify corrected fixed-source package.** Use retained prepared-a061d583-e393-4f89-a96d-89e94b5d7140 with fresh candidateA/B/ZIP paths in this plan workspace. Independently verify identical ZIPs, every length/hash/timestamp/mode, all480original licensing bytes, exact source-evidence JSON and generated source links/terms/counts, unchanged prior116and application/entry records. Start actual owned bundledPython-I-S-B/System32-onlyPATH/poisonedPYTHONPATH/private data and require real health/Web200. A copied damaged Rust notice must exit1before private data/settings; stop only owned processes and independently verify terminal PIDs/port. Expected: artifact/runtime pass; all rights/Unity/physical/human/publication gates pending.

- [x] **Step6: Finish Native task and one fresh final review.** Record test logs/counts/artifact hashes/native association/source ownership/all rulings and costs. Commit qualification docs; task-done repeats full fast backend with explicit server config. Generate planBASE..HEADreview package; dispatch one fresh gpt-6-astra/high Python reviewer with spec/plan/focus/ledger/evidence. Effect-regrade findings and every declined behavior; one watched Important/Critical correction pass/full GREEN and affected artifact refresh if needed; no rereview/minor polishing. Expected: locally accepted evidence-delivery increment with unresolved complete linked/rights/product gates intact.
