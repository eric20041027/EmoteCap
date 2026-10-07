# Windows Portable Candidate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. The user already chose continuous Native; preserve that choice and perform one fresh final Python review of the complete plan.

**Goal:** Produce a verified local Windows candidate that starts production Studio/API without user-installed developer runtimes.

**Architecture:** Bounded file/manifest utilities support a pinned portable-Python/frozen-wheel preparer and a clean-commit candidate builder. A stdlib-only isolated bootstrap validates the payload before invoking the accepted launcher. Local artifacts retain licensing/acceptance pending gates and cannot publish.

**Tech Stack:** Windows11x64, Python3.12.14/build20260825, developer uv0.12.6, existing frozen server/Web dependencies, built-in tar, stdlib tarfile/zipfile/hashlib/subprocess; no project dependency change.

**Spec:** `docs/superpowers/specs/2026-10-07-windows-candidate-design.md`.

## Global Constraints

- Runtime SHA/size pins21980002/8e6aad12ef6fc9685e67ce66253f8f72d6e8fa02cb7187e5850bd4db5ecd9e2a and43500970/b18a69914dff8aa4541adf40579e0aea3233ad3dad5aba2d90a9e179dcf44489 precede extraction/execution.
-20000files,64MiB/file,512MiBpayload,2MiBmanifest,240character relative path; regular files/directories only; no alias/traversal/case collision or overwrite.
- Frozen production binary wheels/explicit public PyPI; no host environment install, dependency upgrade, user UVconfiguration or source builds.
- Clean fixed source commit and narrow app allowlist; copied dist/model and lock digests identify actual bytes. No private source settings/data/media or Blender/Unity bundling.
- Start via packaged Python -I -B; loopback8787/private user settings/data; no developer tools, download or application import before integrity checks.
- releaseGate=pending; full rights/native notices/human/Unity/publication gates remain incomplete. No public operation/main merge.
- Preserve previous scratch; continuous Native inline implementation plus one fresh final reviewer.

## Review Focus

1. Hostile archive/manifest names, aliases, case collisions and compressed oversize inputs must stop without writing outside the fresh destination.
2. A failed preparation/install/build must not mutate the host runtime, silently reuse old artifacts or claim a complete candidate.
3. A relocated Unicode/space-path package must boot with missing developer tools and poisoned Python environment while retaining private data outside public/app files.
4. Missing or changed bootstrap/runtime/dependency/Web/model bytes must fail before stateful application imports, data creation or browser launch.
5. Source attribution and supplied license inventories must describe actual payload bytes and pending rights/native/human gates without implying release approval.

---

### Task 1: Bounded payload utilities and verified runtime/dependency preparation

**Files:** Create `scripts/package_files.py`, `scripts/prepare_windows.py`, `packaging/python-runtime.json`, `server/tests/test_windows_prepare.py`; create `docs/windows-candidate.md` preparation section. No accepted service/Web code changes.

**Interfaces:**
- `PackageError(RuntimeError)`; `safe_name(name: str) -> str`; `copy_tree(source: Path, target: Path) -> None`; `extract_tar(archive: Path, target: Path, *, strip_prefix: str='') -> None`; `file_inventory(root: Path) -> list[dict]`; `verify_inventory(root: Path, files: list[dict]) -> None`; `write_json(path: Path, value: dict) -> None`; `zip_payload(root: Path, output: Path) -> str` in package_files. Schema file records use path/size/sha256; inventories exclude only their explicitly named manifest outside payload.
- `prepare(root: Path, cache: Path, destination: Path, uv: Path) -> dict`; `main(argv=None) -> int` in prepare_windows. CLI --repo/--cache/--output/--uv. Produces fresh destination/payload/{python,deps,notices/runtime}, requirements.txt, runtime-source.json, dependency-inventory.json and prepared.json (schema emotecap-prepared-windows-v1, input/source hashes, exact payload inventory, pending licensing disclosures). Later Task2 consumes verified prepared.json/payload only.

- [ ] **Step1: Write behavior fixtures and loadable stubs.** Use synthetic tar entries, not official inputs, to exercise traversal/Windows reserved names/duplicate-case/hardlink/symlink/oversize; changed/extra/missing file verification; symlink simulation covers accounts without Windows symlink privilege. Test hash mismatch calls no extraction/uv, existing output is preserved, failed subprocess produces no prepared.json, and missing license metadata is explicit. Add injected subprocess runners only through monkeypatch of the module's actual bounded runner; don't bypass production validation.

```python
@pytest.mark.parametrize('name',['../escape','/absolute','C:/secret','assets\\bad','CON.txt','a./file','a /file'])
def test_unsafe_names_fail(name):
    with pytest.raises(PackageError): safe_name(name)
def test_changed_payload_is_rejected(tmp_path):
    (tmp_path/'normal').write_bytes(b'original')
    files=file_inventory(tmp_path)
    (tmp_path/'normal').write_bytes(b'changed')
    with pytest.raises(PackageError): verify_inventory(tmp_path,files)
```

- [ ] **Step2: Watch tests fail.** Run `uv run --directory server --frozen --python 3.12.14 pytest -q tests/test_windows_prepare.py`. Expected: behavioral failures at stubs, not missing test dependencies.
- [ ] **Step3: Implement bounded file utilities.** Normalize/validate each path before writing, stat each ancestor/link and every final file; reject duplicate-case identities; enforce pre-read count/size/total budgets. Tar admits only bounded regular files/dirs; no extraction helpers that follow links. Inventory hashes chunked reads; exact set/hash/size verification rejects extra files. JSON uses sorted compact UTF8/no NaN/exclusive creation; ZIP fixed sorted1980/0644/deflate9.

```python
with tarfile.open(archive, 'r:*') as incoming:
    # First validate all members/types/names/collision/size budgets; then
    # copy selected regular members via exclusive destination files.
    for member in incoming:
        name=safe_name(member.name)
        if not (member.isdir() or member.isfile()): raise PackageError('Unsupported archive entry')
```

- [ ] **Step4: Implement verified preparation.** Pin exact URLs/size/hash in python-runtime.json. Verify both archives with chunked SHA before creating payload/executing; fresh output only. Extract runtime safely under payload/python; read PYTHON.json and nineteen supplied license texts from pinned full archive using owned bounded Windows system tar calls. Check3.12.14/triple. Retain runtime's supplied pip/vendor files. Snapshot committed server locks; uv --version must0.12.6. Remove inherited UV_*environment configuration, use --no-config, fixed public index and finite commands. Export frozen hashed production requirements; install target deps using prepared Python with --require-hashes --no-deps --only-binary :all: --no-python-downloads. Runtime probe `-I -B -c`checks3.12.14 and production imports with only deps explicitly added. Inventory dist-info declarations/full supplied license files/hashes; never claim coverage of missing native notices. Failure remains partial, with no final prepared.json.

```python
commands = [
 [str(uv),'export','--directory',str(snapshot),'--frozen','--no-dev','--no-emit-project','--no-config','--output-file',str(requirements)],
 [str(uv),'pip','install','--python',str(python),'--target',str(deps),'--require-hashes','--no-deps','--only-binary',':all:','--no-python-downloads','--no-config','--default-index','https://pypi.org/simple','-r',str(requirements)],
]
```

- [ ] **Step5: Focused GREEN then actual Windows preparation.** Re-run Step2, then commit implementation and prepare a unique ignored folder using the already SHA-verified official cache. Expected: own Python3.12.14/production imports succeed, pytest/dev-only dependencies absent, no host .venv mutated; receipt lists exact versions/supplied license hashes and pending native coverage. Read actual output; retain finite logs and source/runtime receipts.
- [ ] **Step6: Whole gate/commit/task-done.** `uv run --directory server --frozen --python 3.12.14 pytest -q -m 'not slow'`. Expected: whole backend green; all RED/failure/preparation evidence recorded. Commit only source/tests/pins/docs, not payloads. task-done repeats that exact gate with Task1BASE.

### Task 2: Fixed-source candidate, isolated bootstrap and actual user-entry qualification

**Files:** Create `scripts/build_windows.py`, `packaging/windows/bootstrap.py`, `packaging/windows/start.cmd`, `packaging/windows/START-HERE.txt`, `server/tests/test_windows_package.py`, `server/tests/test_portable_bootstrap.py`, `docs/superpowers/reports/2026-10-07-windows-candidate.md`; modify `docs/windows-candidate.md`, `docs/release-progress.md`. Task1 helpers/pins are consumed unchanged unless a ledgered interface defect is discovered.

**Interfaces:**
- `build(repo: Path, prepared: Path, destination: Path, archive: Path) -> dict`; CLI --repo/--prepared/--output/--zip; returns candidate manifest plus archive SHA receipt. Uses package_files validation/inventory/ZIP and prepared schema. Clean committed HEAD full40hex; `git archive HEAD` selected server/emotecap_server,server/blender,contracts and bootstrap/wrapper/instructions; separate public dist copy/model verification and committed lock digests. No generic repository recursive copy.
- stdlib-only `validate_package(root: Path) -> dict`; `main(argv: list[str] | None=None) -> int` in packaged bootstrap. Bootstrap implementation validates schema/platform/finite exact inventory, excludes only manifest.json, preserves stdlib paths while removing runtime site-packages and adds deps/app-server, then lazily imports launcher. Verified bootstrap helper code is self-contained; no development scripts import required in a package.

- [ ] **Step1: Write loadable fixtures/RED behavior.** A tiny committed fixture Git repo contains only allowed sources, locked model fixture plus private .env/server/data sentinel. A fixture preparation has a verified inventory. Test dirty source failure, no private payload, changed prep/model, exact source/locks, deterministic identical zip, old output preserved and pending gate metadata. Bootstrap fixtures test malformed schemas/duplicate paths/extra/missing/changed runtime/application files and denied web override before import/data. Test selected user private settings/data arguments and isolated import path via subprocess spy without loading real private env.

```python
def test_two_builds_have_identical_zip_bytes(clean_repo, prepared, tmp_path):
    build(clean_repo,prepared,tmp_path/'one',tmp_path/'one.zip')
    build(clean_repo,prepared,tmp_path/'two',tmp_path/'two.zip')
    assert (tmp_path/'one.zip').read_bytes()==(tmp_path/'two.zip').read_bytes()
def test_corrupt_package_never_imports_app(package,monkeypatch):
    (package/'app/server/emotecap_server/__init__.py').write_text('changed')
    with pytest.raises(PackageError): validate_package(package)
```

- [ ] **Step2: Watch new behavior fail.** Run `uv run --directory server --frozen --python 3.12.14 pytest -q tests/test_windows_package.py tests/test_portable_bootstrap.py`. Expected: build/validation behavior fails at stubs, clean fixture Git/setup remains functional.
- [ ] **Step3: Implement build and bootstrap.** Exclusive fresh destination/zip; fixed archive extraction, exact allowlist, valid prepared inventory and public model SHA checks. Generate finite sorted manifest with full source/runtime/lock/Web/file digests and required releaseGate/pending gates. Wrapper quotes own absolute paths and forwards flags preserving exit code. Bootstrap independently verifies every selected file before imports; reject --web-dir; use user-local settings/data and existing stable loopback launcher. Readiness/camera/model/cloud/Blender remain accepted app behavior, no launch-triggered processing or bundled proprietary software.

```bat
@echo off
"%~dp0python\python.exe" -I -B "%~dp0bootstrap.py" %*
exit /b %errorlevel%
```

- [ ] **Step4: Focused GREEN, commit then actual candidate.** Run Step2 green and whole fast gate; commit complete builder/bootstrap/report before actual fixed-source build. Build unique candidate in Unicode/space ignored workspace with prepared Task1input. Expected: source commit matches fixed HEAD, ZIP SHA is recorded, repeat identical inputs yield identical ZIP. No partial candidate is labeled complete.
- [ ] **Step5: Actual runtime/production browser.** Owned fresh service via candidate start.cmd/packaged Python, no developer tools on PATH, PYTHONPATHpoisoned, empty cloud/export environment and unique private data/settings. Real HTTP health/jobs/static/host checks then production Edge sample/edit/save/reload/backup/import; inspect actual screenshots. Use the existing plan's owned QA harness adapted only in this ignored workspace, no Vite/mock APIs. Optional verified development Blender export stays external. Deliberately corrupt a separate candidate copy and require nonzero before data/readiness. Stop only the owned process/browser, retain receipts. Expected: runtime works without installed developer tools; a real clean-machine/Unity/user qualification is still pending.
- [ ] **Step6: Record evidence/whole gate/commit/task-done.** `uv run --directory server --frozen --python 3.12.14 pytest -q -m 'not slow'`. Expected: entire fast backend green; actual qualification/known pending gates/all rulings in report. Commit final source/docs and task-done with Task2BASE/exact gate. Do not rebuild a candidate merely to pretend it includes later evidence-only docs; identify its actual source commit.

## Final review and continuation

Self-check spec coverage/no placeholders/exact interfaces/five focus cases before Task1. Package review from plan BASE through final HEAD; one fresh Python reviewer on the most capable model using requesting-code-review. Re-grade all findings/declined-to-judge effects; one Important/Critical TDD correction pass/full green, no re-review; ledger/report every Ruling+cost and deferred minor. Preserve ignored evidence after the earlier deletion rejection. Continue independent authorized M1–M5work; no routine confirmation, publication or false human/rights gate completion.
