# Third-Party Material Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax. Continue the authorized Native workflow with one fresh whole-plan final review.

**Goal:** Provide exact, verifiable third-party inventory and copied licensing material without claiming unproven redistribution approval.

**Architecture:** Static third_party/inventory.json and licensing texts are linked to frozen locks/models/verified prepared runtime metadata. An ignored stdlib generator/checker reads data only and preserves exact text bytes. Product builder integration remains a separate increment.

**Tech Stack:** JSON/Markdown/SHA256 and existing managed Python3.12.14stdlib; no dependency upgrade or production code.

**Spec:** `docs/superpowers/specs/2026-10-07-third-party-material-design.md`.

## Global Constraints

- Exact prepared receipt716284f1597cb4afec84f7ce3d9140eae7e58e46388c2cff8ce90518d0eb2973plus manifest/current lock comparison before copying.
-35production Python distributions/6Web runtime packages/3models/Python3.12.14build20260825; include runtime-pip/vendor supplied material/native DLL/PYD inventory; external Blender/Unity not bundled.
- Normalize all public paths; copied material bounded to512files/2MiBperfile/16MiBtotal, ordinary non-linked files and fresh exclusive targets. No arbitrary payload/media copy.
- Distinguish declared license, supplied text, supplementary source evidence and pending assessed coverage. No project LICENSE, native license approval or SDK/model equivalence inferred.
- No runtime/model/provider execution, public write, private settings/recording, dependency/runtime/model change or production code.
- Static byte/source/deterministic checks instead of mirrored runtime tests. Preserve ignored evidence; one final review with explicit costs.

## Review Focus

1. A missing/mutated licensing text or stale lock must not be silently presented as exact inventory.
2. Supplied SPDX/PSF/SDK source license must not be mistaken for all native/vendor/model redistribution rights.
3. Runtime-pip/vendors and binary dependencies must not be omitted because the application does not import them.
4. Inventories/copies must not include private paths/data, arbitrary symlink targets or third-party character/PDF imagery.
5. Material completion must not mark the old Windows artifact/owner/license/public release gates complete.

---

### Task 1: Verified inventory, copied source license texts and bounded assessment record

**Files:** Create `third_party/inventory.json`, `third_party/README.md`, bounded `third_party/licenses/**`, `THIRD_PARTY_NOTICES.md`, `docs/superpowers/reports/2026-10-07-third-party-material.md`; update `docs/release-progress.md`/`docs/release-license-proposal.md` only for evidence state. Ignored generator/check receipts live in this plan workspace.

**Interfaces:** inventory schemaemotecap-third-party-material-v1; context SHA256 for server/pyproject.toml,server/uv.lock,web/package-lock.json,web/scripts/mediapipe-assets.json,packaging/python-runtime.json; preparedReceiptSha256fixed; components contain name/version/kind/declaredLicense/status/sourceEvidence/suppliedLicenses; file records are path/size/sha256 under licenses/. Native files are source-relative size/hash metadata only. No machine-specific absolute path.

- [ ] **Step1: Verify real inputs and read metadata.** Confirm prepared.json SHA and verify payload against its receipt with existing scripts/package_files.verify_inventory. Compare pyproject/uvlock/runtime pins. Traverse runtime dependencies in package-lock (exclude root/dev; assert6), parse35dist-info metadata/inventory without importing packages. Enumerate runtime license-related paths including pip/vendors and all.dll/.pyd. Keep declarations labelled unassessed. Read exact installed SDK package license absence and primary upstream/Microsoft/model-card evidence; never dump minified SDK binaries into tool output.
- [ ] **Step2: Collect supplementary evidence and exact texts.** Download official MediaPipe source LICENSE into a fresh ignored file; record URL/size/SHA and identify its source scope. Read official model-card pages for Full/Heavy and Hand Apache2evidence; record URLs and model SHA, do not add card PDFs/images to source. Copy only license/notice/copying/copyright files matching actual inventory (plus verified runtime companions and standard runtimeLICENSE), not arbitrary examples or binaries. Bounds/path confinement/ordinary-file/no overwrite checks run before each copy.

```python
def digest(data):return hashlib.sha256(data).hexdigest()
assert digest(prepared.read_bytes())=='716284f1597cb4afec84f7ce3d9140eae7e58e46388c2cff8ce90518d0eb2973'
verify_inventory(payload,receipt['files'])
for relative,expected in receipt['serverSourceHashes'].items():
    assert digest((repo/'server'/relative).read_bytes())==expected
# Public copied paths are only licenses/<controlled component>/<safe relative text>.
```

- [ ] **Step3: Write deterministic static inventory/notices.** Use sorted component/file records; include exact npm version/tarball integrity and supplied package-license paths; Python metadata source references and all42supplied dist-info text files; runtime companion and pip/vendor texts including licenses bundled inside pip's wheel if present. Record DLL/PYD hashes and unresolved native attribution/source-form requirements. THIRD_PARTY_NOTICES links exact copied materials but explicitly states draft assessment; no automatic license pass. Write supplementary model source license separately; do not infer from a source-file copyright header that all prebuilt WASM obligations are covered.
- [ ] **Step4: Verify whole material and deliberate failure controls.** Ignored checker validates confined ordinary files,512/2MiB/16MiB limits, strict file record keys/hash/size/no extra notices, exact current lock/model/receipt pins and counts35/6/3. Run on genuine material; compare regenerated inventory byte-for-byte to confirm deterministic results. In owned scratch copies, mutate one text and change a copied lock hash; checker must fail without changing source. Scan normalized JSON for workspace/user absolute paths and private settings/media inclusion. Inspect all pending classifications/source links manually, and run git diff--check. No application/network inference or broad runtime suites.
- [ ] **Step5: Record evidence/rulings, commit and Native task-done.** Commit source text/index/docs only (no PDFs/binaries/private paths). Native completion executes the ignored material checker from this brief and records success only when true. Whole fixed BASE..HEADgets one fresh most-capable review. Critical/Important corrections use a concrete failing metadata/byte check then corrected whole material; no re-review/minor polishing. All Declined decisions retain Ruling+cost. Keep ignored scratch and continue candidate integration/quality/human gates.

This material is reviewable partial licensing evidence; owner rights, native/vendor conditions, actual SDK behavior and formal publication remain gates rather than invented success.
