# Deep runtime receipt recovery follow-up

**Goal:** Implement the owner's explicitly requested fix for the previously deferred deeply nested JSON receipt Minor, then update existing draft PR #9.

**Spec:** docs/superpowers/specs/2026-10-11-windows-runtime-terms.md. A bounded but unparsable receipt must require a new explicit choice. Decline preserves its bytes and prevents application import; only ACCEPT may replace it. Keep the 8192-byte limit, original schema, path checks and atomic write behavior.

**Execution:** superpowers:executing-plans inline; one fresh strongest-model final Python review, one material correction pass maximum. Preserve all prior artifacts and receipts. The owner explicitly authorizes this Minor fix and updating PR #9; do not merge main, publish binaries, change Mac B2 or download dependencies.

## Review Focus

- Deep arrays and objects below the size cap must reach the prompt without a traceback.
- EOF, EXIT and READ then EXIT must preserve the exact invalid receipt and prevent app import.
- READ then ACCEPT must display the original license, write a valid bounded receipt and start the app; a later cached launch must retain it unchanged.
- Valid receipts, oversized records and other integrity/path/IO failures retain existing behavior.

### Task 1: Recover from bounded deeply nested JSON

**Files:** packaging/windows/runtime_terms.py; server/tests/test_runtime_terms.py; this plan; docs/superpowers/reports/2026-10-11-windows-runtime-terms.md. Private evidence in this plan's workspace.

- [x] Add actual isolated-entry regression tests for array/object receipts with nesting beyond the default parser recursion limit, decline/read and explicit recovery.
- [x] Run the new tests before the fix. Expected: RED, current entry returns1 with RecursionError instead of the requested prompt/recovery.
- [x] Catch RecursionError with existing invalid-receipt parse errors. Expected: GREEN, without changing recursion limits or auto-consenting.
- [ ] Run affected entry/bootstrap/package/notices tests and full fast backend. Expected: no failures; retain actual counts and skips.
- [ ] Commit the scoped code/tests/report. Run task-done with the affected suite, then one fresh final review over the new increment from e1cc1e9; record findings/declined judgments and costs. Preserve historical artifacts; they do not contain this fix.
- [ ] Run a fresh final-source/history scan, push the existing branch and update PR #9's description. Expected: no unresolved content findings and all new hosted CI jobs successful at the pushed head. Mac results remain pending.

## Self-review

One small recovery change, no dependency or interface changes. Test through the actual isolated bootstrap so a swallowed exception cannot accidentally authorize app import. Existing full packaged artifacts remain historical evidence, not rebuilt/fixed artifact claims.
