# Windows Runtime Terms Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans inline under the preserved Native authorization. One fresh strongest-model final reviewer; at most one material correction pass, minors deferred. Preserve workspaces and previous evidence.

**Goal:** Require an explicit local first-launch Microsoft-runtime terms choice before starting the packaged Windows service.

**Architecture:** Keep the supplied isolated start.cmd/bootstrap integrity boundary. Add a stdlib-only runtime_terms module loaded from the verified package; it presents the two bundled summaries/original Python license, binds a local atomic receipt to relevant verified content, and fails closed. Extend the existing fixed-source builder to deliver/hash-bind these assets.

**Tech Stack:** Pinned Python 3.12.14 stdlib, existing build_windows/OwnedProcess and pytest; no dependencies or downloads.

**Spec:** docs/superpowers/specs/2026-10-11-windows-runtime-terms.md; owner-approved WINDOWS-RUNTIME-TERMS-PROPOSAL-2026-10-10.zh-TW.md; docs/release-checklist.md.

## Global Constraints

- All original22 M1-M5 requirements remain; Mac B2 source3967beb unchanged. No main merge/tag/binary publication or new human/rights claim.
- Verify package before gate import, then require consent before application import/browser/service. Supplied runtime remains -I -S -B.
- Explicit READ/ACCEPT/EXIT; blank/EOF/interruption decline. --read-runtime-terms reads then exits; no automatic acceptance argument/environment variable.
- Receipt is private data/runtime-terms-acceptance.json, bounded8192bytes, exact schema/types/UTC timestamp and content fingerprint; atomic write, fail closed on IO/aliases. No identifiable data/network.
- Fingerprint gate/summaries/python license and all executable/native manifest records; unrelated Web changes do not invalidate acceptance.
- Do not turn Microsoft restrictions into project/Python/other third-party license restrictions or force developer indemnity on recipients. Complete exact binary rights remain pending.
- Use existing verified prepared runtime/wheels; preserve old/partial outputs. Fresh branch feat/windows-runtime-terms starts6a7db80; reuse existing isolated worktree.

## Review Focus

- Redirected input/EOF/blank/unknown answers must not create implicit consent or reach application import; explicit typed ACCEPT is the sole new-consent action.
- Malformed/duplicate/negative/stale/oversized receipts and changed native/terms bytes must not skip the prompt; unchanged runtime plus changed unrelated Web may reuse consent.
- Receipt/path symlink/junction/hardlink/nonregular files and write failures must fail closed without changing another file or prior receipt.
- Read-only entry/decline/integrity rejection must create no private state, service or browser; no-browser must not bypass consent.
- Full fixed-source builder delivery must include summaries/gate/Python license, exact manifest/deterministic ZIP; old artifact/input scopes and all22 remain intact.

### Task 1: Implement and qualify the complete packaged terms gate

**Files:** Create packaging/windows/runtime_terms.py, RUNTIME-TERMS.en.txt, RUNTIME-TERMS.zh-TW.txt; modify bootstrap.py/START-HERE.txt, scripts/build_windows.py, server/tests/test_windows_package.py/test_portable_bootstrap.py; create server/tests/test_runtime_terms.py and report docs/superpowers/reports/2026-10-11-windows-runtime-terms.md. Private evidence in this plan workspace.

**Interfaces:** `runtime_terms.ensure_accepted(root: Path, manifest: dict, data_dir: Path) -> bool`; `runtime_terms.show_terms(root: Path, *, original: bool = False) -> None`; `runtime_terms.TermsError(RuntimeError)`. bootstrap calls these only after validate_package. Receipt fields schema/termsSHA256/accepted/acceptedAtUTC. Builder consumes committed assets without special external inputs.

- [x] Write actual subprocess-entry regression tests using owned synthetic package/spy app import marker; EOF and decline must return2 with no marker/data. Add READ/ACCEPT/cached/read-only/corrupt/stale/native-change/unrelated-Web/alias/write-failure/no-browser cases. Existing fixture adds delivered Python license and copies new source assets when they exist.

```python
def test_first_launch_eof_never_imports_app_or_creates_private_data(terms_candidate):
    root, data, marker = terms_candidate
    result = run_entry(root, data, input_bytes=b'')
    assert result.returncode == 2
    assert not marker.exists() and not data.exists()
```

- [x] Run `server/.venv/Scripts/python.exe -B -m pytest server/tests/test_runtime_terms.py::test_first_launch_eof_never_imports_app_or_creates_private_data -q`. Expected: RED actual existing entry reaches spy application/exit0.
- [x] Implement stdlib gate, summaries, isolated post-validation import, read-only option and builder asset delivery. Gate decision is `if cached_receipt_matches: return True; choice=input(...); if choice=='READ': show_original; elif choice=='ACCEPT': atomic_write_receipt; return True; else: return False`; handle EOF/interrupt as False. Use exclusive UUID temp file, flush/fsync and os.replace only for the owned receipt after ordinary-path checks; remove only own leftover temp on failure. Receipt parse rejects duplicate keys/nonfinite values and >8192bytes. Fingerprint canonical sorted relevant manifest records with SHA256.
- [x] Run new gate tests plus existing portable/bootstrap/package/notices suites. Expected: all pass, observed app marker only after explicit acceptance or valid matching receipt; old integrity/isolation behavior retained. Run full backend `server/.venv/Scripts/python.exe -B -m pytest -q -m 'not slow'` from server. Expected: no failures; actual skips/counts retained.
- [x] Commit scoped implementation/docs; freeze clean source. Build two fresh complete candidates using existing prepared input and 600s owned builder processes. Expected: both exit0, identical ZIPs/all manifest/member bytes and492 old licensing texts intact; no download.
- [x] Exercise actual supplied start.cmd with owned private test paths: EOF/EXIT/read-only cause no service/private state; synthetic explicit ACCEPT launches health, matching receipt relaunches without prompt; corrupted new summary is rejected before state. Terminate only owned services, record actual exits/PIDs/ports. Expected: full package outcomes, not human/legal acceptance. Preserve all files.
- [x] Write qualification report/all22 completion audit, commit docs, run task-done with gate/packaging suite. One fresh gpt-6-astra review whole branch including private evidence; apply at most one material TDD correction pass, ledger every ruling/decline/cost and deferred Minor; no cleanup.

## Self-review

One task owns the complete pre-import gate and delivery contract. Every review focus is exercised through actual entry or real filesystem/package artifacts. Native authorization plus direct owner instruction covers implementation now; implementation does not assume final redistribution/publishing approval. Baseline59 existing package/bootstrap tests passed before changes.
