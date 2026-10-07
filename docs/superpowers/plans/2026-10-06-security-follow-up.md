# M1 Security Follow-up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Native execution is already authorized. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the known source-map-js denial of service and close M1 with real three-platform CI evidence.

**Architecture:** Retain the existing application and frozen runtime tools. Update one transitive build dependency, add a bounded security characterization and CI audit, then submit a reviewed candidate for hosted verification.

**Tech Stack:** npm lockfile, node:test, GitHub Actions, existing Vitest/pytest.

**Spec:** `docs/superpowers/specs/2026-10-06-security-follow-up-design.md`

## Global Constraints

- Start at local main ef7a76c; preserve all M1 product behavior and contract v2.
- Keep Node 24.19.0, npm 11.21.0, Python 3.12.14 and uv 0.12.6.
- Change only source-map-js from 1.2.1 to patched 1.2.2 in dependency records; no unrelated dependency upgrades.
- Use a bounded characterization test of the installed dependency; never run an unbounded malicious source-map expansion.
- All ordinary app, assets and backend tests plus typecheck/Web build must remain green.
- npm audit must report zero high/critical findings without suppressions; registry outages are failed checks, not clean scans.
- Public push/PR contents must be concrete and reviewed before any needed approval. Actual three-platform job results, not workflow text, prove M1 completion.

## Review Focus

1. A dependency downgrade must fail through observable offset rejection, not a version-string assertion.
2. Valid simple source maps must retain generated content.
3. The security test must not enter the vulnerable expansion path or allocate an enormous mapping string.
4. CI must execute the separate Node security runner on all three platforms while preserving existing checks.
5. Audit or registry failure must remain visible and must not be converted to success.

### Task 1: Targeted dependency patch and regression guard

**Files:** Create `web/scripts/dependency-security.test.mjs`; modify `web/package-lock.json`, `web/package.json`, `.github/workflows/ci.yml`, `docs/development.md`.

**Interfaces:** Consumes the installed `source-map-js` public constructors. Produces `npm run test:security` and `npm run audit:deps`, each exiting nonzero on failure; Task 2 consumes these along with existing CI checks.

- [x] **Step 1: Write the characterization.** Create exactly:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { SourceMapConsumer, SourceNode } from 'source-map-js';

const basicMap = () => ({
  version: 3, sources: ['input.js'], names: [], mappings: 'AAAA',
  sourcesContent: ['console.log(1);\n'],
});

test('installed source-map consumer rejects dangerous section offsets before expansion', () => {
  assert.throws(() => new SourceMapConsumer({
    version: 3,
    sections: [{ offset: { line: 100000001, column: 0 }, map: basicMap() }],
  }));
});

test('installed source-map consumer preserves normal generated code', () => {
  const consumer = new SourceMapConsumer(basicMap());
  const node = SourceNode.fromStringWithSourceMap('console.log(1);\n', consumer);
  assert.equal(node.toString(), 'console.log(1);\n');
});
```

- [x] **Step 2: Observe RED.** In web run `node --test scripts/dependency-security.test.mjs`. Expected first test FAIL (Missing expected exception) and second PASS. The failure must occur at the constructor assertion, without running a generator on the huge offset.
- [x] **Step 3: Patch only the transitive lock.** In web run `npm update source-map-js --ignore-scripts`. Compare parsed `packages` records against the base lock; require the only changed package key to be `node_modules/source-map-js`, with final version `1.2.2`. If other entries move, revert only this task's lock changes and use npm's targeted lock update with explicit package version; do not accept unrelated changes.
- [x] **Step 4: Add exact scripts.** Preserve all other scripts and add:

```json
{
  "test:security": "node --test scripts/dependency-security.test.mjs",
  "audit:deps": "npm audit --audit-level=high"
}
```

Insert these CI steps after `npm run test:assets`:

```yaml
      - run: npm run test:security
        working-directory: web
      - run: npm run audit:deps
        working-directory: web
```

Insert `npm run test:security` and `npm run audit:deps` into the Development setup/check list after assets. Explain in prose that the characterization protects the installed source-map boundary and the registry audit requires network access.

- [x] **Step 5: Observe GREEN and full checks.** Run `npm ci`, `npm run test:security`, `npm run audit:deps`, `npm run test:assets`, `npm test`, `npm run build`, then backend `uv run --frozen --python 3.12.14 pytest -q -m "not slow"`. Expect 2 security, 6 assets, 226 app, 380 backend passing; 2 real-Blender deselections remain explicit. Record actual audit result and the sole dependency-record diff.
- [x] **Step 6: Commit.** `git add web/scripts/dependency-security.test.mjs web/package.json web/package-lock.json .github/workflows/ci.yml docs/development.md` then `git commit -m "fix: patch source-map dependency denial of service"`.

### Task 2: Reviewed hosted candidate and three-OS evidence

**Files:** Create `docs/superpowers/reports/2026-10-06-security-follow-up.md`; update `docs/release-progress.md`.

**Interfaces:** Consumes the Task 1 scripts and committed branch. Produces the candidate commit, approved remote operation, PR URL and exact run/job evidence; no automatic production release.

- [x] **Step 1: Write the verification report.** Include baseline/head commits, local commands/results, the one-package lock diff, advisory links, frozen runtime versions and unrun hardware checks. Save a PR body to this plan's scratch directory with the exact problem, before/after behavior and validation counts.
- [x] **Step 2: Independent review.** Generate one whole-branch review package, dispatch one fresh reviewer on the most capable available model according to executing-plans. Fix confirmed Critical/Important findings with RED→GREEN and a green suite; report minor/deferred scopes honestly.
- [x] **Step 3: Resolve public-write authorization.** Present the concrete reviewed branch and PR body. If authorization is still missing, ask asynchronously to push `fix/dependency-security` and open a draft PR against main. Continue independent M2 work while awaiting the answer; do not interpret elapsed time as permission.
- [x] **Step 4: Submit the exact candidate after authorization.** Run `git push -u origin fix/dependency-security`, create a draft PR with the saved body file, attach its URL to this chat. This writes only the feature branch and PR, not remote main or a release.
- [x] **Step 5: Observe hosted verification.** Inspect actual GitHub run IDs and jobs for the candidate commit. Wait on running handles; diagnose failures from job logs. Record Windows, macOS and Linux results and links. Mark M1 completed only after all pass. If not finished, retain pending status and continue independent roadmap work.
