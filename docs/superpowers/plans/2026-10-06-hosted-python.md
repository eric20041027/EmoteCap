# Hosted Python Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run the complete M1 suite on Windows, macOS and Linux with the existing pinned Python.

**Architecture:** Install uv directly with its pinned official action, then install its managed Python. Preserve the existing test and build steps.

**Tech Stack:** GitHub Actions, uv 0.12.6, Python 3.12.14.

**Spec:** docs/superpowers/specs/2026-10-06-hosted-python-design.md

## Global Constraints

- Keep Node 24.19.0, npm 11.21.0, Python 3.12.14, uv 0.12.6, all lockfiles and all test gates unchanged.
- Pin astral-sh/setup-uv to c771a70e6277c0a99b617c7a806ffedaca235ff9 (v9.0.0).
- No remote main integration or product release.
- Acceptance requires actual successful hosted jobs for the repaired commit.

## Review Focus

1. A fresh Windows runner must obtain the pinned Python before tests.
2. A macOS arm64 runner must obtain its own native Python build.
3. A runner with an unrelated installed Python must still use 3.12.14.
4. Missing downloads or service failures must fail rather than bypass checks.
5. Linux must retain the same application, security, backend and build gates.

---

### Task 1: Repair bootstrap and qualify the hosted matrix

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `docs/development.md`
- Modify: `docs/release-progress.md`
- Modify: `docs/superpowers/reports/2026-10-06-security-follow-up.md`
- Create: `docs/superpowers/reports/2026-10-06-hosted-python.md`

**Interfaces:**
- Consumes: existing `npm ci`, `test:assets`, `test:security`, `audit:deps`, `npm test`, `npm run build`, `uv sync --frozen --python 3.12.14`, and `uv run --frozen --python 3.12.14 pytest -q -m "not slow"`.
- Produces: verified per-OS job URLs and exact tested commit in the release ledger.

- [x] **Step 1: Confirm the observed hosted failure**

Run: `gh run view 37568728873 --repo eric20041027/EmoteCap --log-failed`
Expected: Windows x64 and macOS arm64 report missing Python 3.12.14 before any application tests. The observed run is the failing regression evidence for this configuration repair.

- [x] **Step 2: Replace the bootstrap and document why**

Replace actions/setup-python and the following pip installation step with:

```yaml
      - uses: astral-sh/setup-uv@c771a70e6277c0a99b617c7a806ffedaca235ff9 # v9.0.0
        with:
          version: '0.12.6'
          enable-cache: false
      - run: uv python install 3.12.14
```

Add to development documentation: CI installs uv directly, then the pinned managed Python; actions/setup-python does not provide this Python build on every target runner. All dependency versions and test commands remain unchanged.

- [x] **Step 3: Check the diff, commit, and update the authorized draft PR**

Run: `git diff --check` and inspect `git diff -- .github/workflows/ci.yml`.
Expected: no whitespace errors; only the bootstrap changes in the workflow.

```text
git add .github/workflows/ci.yml docs/development.md
git commit -m "ci: install pinned Python with uv on all platforms"
git push origin fix/dependency-security
```

Expected: a normal fast-forward push creates a new PR CI run; record its ID by querying the exact HEAD with `gh run list --branch fix/dependency-security --commit <verified HEAD> --json databaseId,event,status,conclusion,headSha,url`.

- [x] **Step 4: Verify actual jobs and record their evidence**

Run `gh run view <observed PR run ID> --repo eric20041027/EmoteCap --json status,conclusion,headSha,jobs,url`.
Expected: status completed, conclusion success, and all three operating-system jobs successful at the repaired commit. Check logs for interpreter version and successful unit/build gates. If a job fails, diagnose its actual log; keep the gate pending until corrected.

Record the failed and successful runs, exact SHA, each platform result, the bootstrap decision and unchanged hardware/release limits in the report and release ledger. Commit those evidence documents. Task completion command: `gh run view <observed successful PR run ID> --repo eric20041027/EmoteCap --exit-status`, after independently confirming completed/success for all jobs.

## Final Review

Create the review package from fc63378 to the completed plan HEAD. Request one fresh Native reviewer for this new CI repair, not a re-review of the earlier security patch. Record all findings and declined scopes. Any substantive correction requires another actual hosted qualification before acceptance. Keep reports separate from a remote merge or release.
