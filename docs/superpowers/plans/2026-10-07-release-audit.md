# Release Source Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Continuous Native authorization preserves the method; one fresh final reviewer follows this independent tool.

**Goal:** Produce a bounded, redacted, repeatable current/history credential scan with explicit failure status.

**Architecture:** A standalone standard-library tool reads Git without a shell and deduplicates historical blobs. Tests use owned synthetic Git repositories and fake credentials; no provider or private environment access is required.

**Tech Stack:** Python3.12.14, Git, pytest9.1.1; no new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-07-release-audit-design.md`.

## Global Constraints

- No publishing, credential revocation, history rewriting or deletion is part of this increment.
- Current candidates include all tracked files plus nonignored untracked files; untracked ignored environments, runtime recordings and dependency caches are excluded. The distribution must separately use an explicit allowlist.
- Findings never emit matched credential values or Git error text.
- Bounds:5000commits,5000annotated tag objects,50000unique blobs,50000current candidates,10000findings,16MiBper blob/file/commit/tag,512MiBtotal scan bytes; Git30second timeouts/file-backed20MiBread limit; body batches≤16MiB.
- Reports are exclusive, immutable writes; exit0clean detection result,1findings,2incomplete. No automatic false-positive suppression or release-readiness claim.

## Review Focus

1. A credential removed or renamed in current source must still be detected in reachable history without disclosure.
2. NUL/binary bytes and Unicode/quoted path names must not bypass the scanner or become shell instructions.
3. Missing objects, unreadable candidates, size limits and Git failures must not produce a clean result.
4. Ignored private environments and outside-repository links must not be opened or packaged by implication.
5. Existing report paths and repeated invocations must preserve the earlier evidence and clearly report incomplete work.

---

### Task 1: Bounded read-only Git audit and actual repository receipt

**Files:**
- Create: `scripts/release_audit.py` — pure scanner/Git orchestration/CLI.
- Create: `server/tests/test_release_audit.py` — synthetic credential/history/error/output tests.
- Create: `docs/superpowers/reports/2026-10-07-release-audit.md` — exact scope and findings/blockers.
- Modify: `docs/release-progress.md` — M5.2 scan evidence only.

**Interfaces:**
- Consumes: existing Git refs/current candidates; no other task API.
- Produces: `scan_bytes(data: bytes, source: dict) -> list[dict]`; `audit_repository(repo: Path, *, max_blob_bytes: int=16777216, max_total_bytes: int=536870912) -> dict`; `AuditIncomplete`; `main(argv: list[str] | None=None) -> int`.
- Report: `schema='emotecap-release-scan-v1'`, `head`, `commits`, `historyBlobs`, `currentFiles`, `bytesScanned`, `findings`, `scope`; no field containing match values. A finding adds `rule`, `fingerprint`, `offset`, `line` to the supplied source descriptor.

- [ ] **Step 1: Write synthetic behavior tests before implementation.** Load the new standalone module by adding the repo's `scripts` directory to test `sys.path`. Test Google/GitHub/AWS/Slack/OpenAI/private-key patterns, high-entropy explicit credential assignments, binary detection, historical deletion, untracked candidates, ignored environments, Unicode paths, Git failure, limits, links and exclusive output. Build synthetic tokens by concatenating separate prefix components so the source test does not itself contain credential-shaped literals.

```python
token = 'AI' + 'za' + 'A' * 35
findings = audit.scan_bytes(b'\0' + token.encode(), {'kind': 'current', 'path': 'binary.dat'})
assert findings and findings[0]['rule'] == 'google-api-key'
assert token not in json.dumps(findings)
# A synthetic temp repository commits that token and then removes it.
report = audit.audit_repository(repo)
assert any(f['kind'] == 'history' for f in report['findings'])
assert token not in json.dumps(report)
with pytest.raises(audit.AuditIncomplete):
    audit.audit_repository(repo, max_blob_bytes=8)
output.write_text('original receipt')
assert audit.main(['--repo', str(repo), '--output', str(output)]) == 2
assert output.read_text() == 'original receipt'
```

- [ ] **Step 2: Watch the missing scanner fail.** A loadable characterization stub may expose the declared names and raise `NotImplementedError`; no stub is committed.

Run: `uv run --directory server --frozen --python 3.12.14 pytest -q tests/test_release_audit.py`.
Expected: FAIL at the scanner/history/exclusive-write behavior, not a broken test environment.

- [ ] **Step 3: Implement detection and bounded Git enumeration.** Use compiled byte regexes for recognizable credential prefixes/private-key markers and high-entropy explicit credential assignments. Hash matches; do not store values. Use `subprocess.run(['git','-C',str(repo),...], input=..., capture_output=True, timeout=30, check=False)` and turn failures into constant `AuditIncomplete` messages. Decode tree records as `metadata TAB path NUL`, inspect blob sizes with `cat-file --batch-check`, then read bounded `cat-file --batch` groups. Validate every returned header/size/newline, scan unique history blobs and current candidate bytes within shared budgets. Read ignored paths never; reject links/outside paths before reading.

```python
def checked_git(repo, arguments, *, data=None):
    result = subprocess.run(['git', '-C', str(repo), *arguments], input=data,
                            capture_output=True, timeout=30, check=False)
    if result.returncode:
        raise AuditIncomplete('Git operation failed; scan is incomplete')
    return result.stdout

def finding(match, rule, source, data):
    return {**source, 'rule': rule, 'offset': match.start(),
            'line': data.count(b'\n', 0, match.start()) + 1,
            'fingerprint': hashlib.sha256(match.group()).hexdigest()}
```

- [ ] **Step 4: Implement exclusive CLI output and run the tests.** Catch failures without traceback/Git stderr, print only counts/status and return2. Write JSON with `open('x')`; never replace an existing receipt. Findings return1 after writing the redacted report; clean returns0.

Run: the Step2command.
Expected: all audit behavior tests PASS, fake secrets absent from returned JSON and captured CLI output; no ignored-file read.

- [ ] **Step 5: Scan the actual repository into a fresh UUID receipt under this plan's scratch.** No credentials/history are changed. Inspect only the redacted findings, source identifiers and counts. Record detections as unresolved until actually assessed; never summarize an incomplete/error scan as clean.

Run: `server/.venv/Scripts/python.exe scripts/release_audit.py --repo . --output .superpowers/sdd/2026-10-07-release-audit/<fresh-uuid>.json`.
Expected: exit0or1with a new redacted receipt;2is an incomplete gate requiring a ledgered correction. Report the actual counts/result and scope, including excluded ignored files and heuristic limits.

- [ ] **Step 6: Run integration checks and commit.**

Run: `uv run --directory server --frozen --python 3.12.14 pytest -q -m 'not slow'`; `git diff --check`.
Expected: whole fast backend green; no new Blender/browser consumer code or dependency change. Commit exact tool/tests/report/progress paths, then Native task-done reruns the same fast gate. The final fresh reviewer gets the fixed range, spec, five focus lines and all Rulings. One TDD correction pass handles any Important/Critical findings; no re-review or scratch deletion workaround.

## Self-review

Single task owns the whole read-only deliverable; no shared interfaces. The spec's scope/failure/budget/redaction/exclusive-write requirements map to explicit tests and CLI behavior above. Scan success is deliberately distinct from licensing or release readiness. Continuously authorized local preparation resolves the usual plan handoff without another approval pause; cost if wrong is a local reviewable tool, not an external publication.
