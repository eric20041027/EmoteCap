# EmoteCap release progress

Objective: finish the accepted M1–M5 roadmap as a usable, verifiable open-source v1 product. The user authorized continuous Native development on 2026-10-06. Keep this objective intact; local tests alone do not prove a release.

Authoritative product requirements: [product design](superpowers/specs/2026-10-06-open-source-product-design.md). Historical foundation reports describe their original snapshots; current integration starts at local main `25c6cbe` (M1 plus security/CI follow-ups, fast-forwarded on 2026-10-07).

## Current work

- Active: M2 storage foundation implemented, locally qualified and independently approved on `feat/studio-projects`; continue portable archive and Studio/browser integration. [M2 spec](superpowers/specs/2026-10-06-studio-projects-design.md), [storage report](superpowers/reports/2026-10-07-studio-storage.md). M1 remains qualified.
- Execution: main agent implements each stage; a fresh independent reviewer checks each completed implementation plan. Do not reopen the already-approved execution-method question.
- Workspace: reuse the existing linked worktree `EmoteCap-release-foundation`; do not touch unrelated workspaces or delete earlier policy-blocked scratch.
- Keep each stage in committed, testable increments. No force-push or history rewrite.
- Remote CI/publishing: prepare a reviewed branch and exact PR/release contents before requesting any still-missing public-write authorization.
- Licensing: prepare a concrete license/notice proposal and contributor inventory before asking the owner to confirm rights and license choice.

## Acceptance ledger

| ID | Required outcome | Current evidence / status |
|---|---|---|
| M1.1 | Cross-platform subprocess tests, contract parity, motion validation, verified model cache | Implemented and reviewed in main ef7a76c; 380 backend + 226 app + 6 assets pass locally |
| M1.2 | Resolve known vulnerable build dependency and guard against regression | Local fix 99a0434: only source-map-js 1.2.1 → 1.2.2; regression 2/2 and npm audit 0 vulnerabilities; independent review passed (0 findings) |
| M1.3 | Actual Windows/macOS/Linux unit + Web build CI passes | All three PR jobs passed again at final M1 HEAD 25c6cbe in [run 37569490306](https://github.com/eric20041027/EmoteCap/actions/runs/37569490306); original code qualification at 663cd33 is in the [hosted report](superpowers/reports/2026-10-06-hosted-python.md); draft [PR #1](https://github.com/eric20041027/EmoteCap/pull/1) remains unmerged |
| M2.1 | Project/Take/Clip identity and immutable original take | Domain implemented, frozen original/provenance and bounded undo; 68 storage/domain/autosave tests pass; independent review approved (0 findings); UI wiring pending |
| M2.2 | IndexedDB autosave, restore after refresh, recording checkpoint every 5 seconds | Atomic repository and ordered autosave implemented, including stale-tab/rollback/quota preservation; UI restore and 5-second capture wiring pending |
| M2.3 | Portable .emotecap import/export, version and size validation, optional source media | Implementation pending |
| M2.4 | Setup diagnostics, sample project, keyboard-accessible review and error recovery | Implementation pending |
| M2.5 | Real browser record/import → save → reload → restore → edit, quota-failure preservation | Browser evidence pending |
| M3.1 | Bounded export queue, progress, cancel, retry, immutable clip revision, job-specific outputs | Implementation pending |
| M3.2 | Restart/timeout recovery and no silent filename collisions | Implementation pending |
| M3.3 | Local media retention/deletion and explicit Gemini opt-in with no upload before consent | Implementation pending |
| M3.4 | Live Link version/pairing/source controls, slow-receiver handling | Implementation pending |
| M4.1 | Authorized motion fixtures, original/new quality and performance measurements including failures | Evaluation pending |
| M4.2 | Actual Blender export with correct direction, scale and timing within one output frame | Blender availability to establish; real smoke tests pending |
| M4.3 | Actual Unity compilation/playback on two redistributable humanoid rigs; UPM Tests/Samples/Docs | Unity 6 editors found locally; validation pending |
| M4.4 | Target-laptop Fast 720p effective FPS/p95 latency and explicit support matrix | Hardware measurement pending |
| M5.1 | Windows user distribution containing built Web and local server, reproducible one-entry startup | Implementation pending |
| M5.2 | License, contributor rights, third-party asset/model/license inventory, notices and secret/history scan | Evidence and owner license decision pending |
| M5.3 | English README + Traditional Chinese quickstart, CONTRIBUTING/SECURITY/CHANGELOG/templates | Implementation pending |
| M5.4 | Clean-machine beginner acceptance: at least 4/5 new Unity users finish sample in 10 minutes | User study not run; cannot be substituted by unit tests |
| M5.5 | Fixed-version UPM, source-linked release artifacts with SHA256, full release checklist | Packaging and validation pending |
| M5.6 | Owner-approved public tag/GitHub release after all required checks | Not published |

## Decisions and blockers

- Native means inline implementation with final independent review, preserving the agreed local Web + Python + Unity architecture. No framework rewrite is part of the accepted roadmap.
- Primary target remains Unity independent/student developers on Windows with the system browser.
- The earlier frozen dependency baseline was for the initial M1 task. The newly authorized M1–M5 work includes the documented priority security patch; permit only the targeted security dependency update in its own plan.
- No blocker stops independent local implementation now. Future changes require their own CI evidence; contributor authorization and human/hardware acceptance stay explicit pending gates.
- The user approved pushing the reviewed M1 branch and creating its draft PR on 2026-10-06. Initial hosted Python setup failed on Windows/macOS; the uv bootstrap repair preserves all version pins and passes the actual three-OS matrix. No remote main merge, tag or release has occurred.
- The prior explicit local-main integration choice also covers the verified M1 follow-ups. On 2026-10-07, clean local main fast-forwarded from ef7a76c to 25c6cbe after verifying that only documentation changed since the qualified code commit 663cd33. The receipt is local `.git/codex-m1-integration-20261007.json`; remote main remains unchanged. New M2 work is local and not included in the M1 draft PR.
- Main's local dependency installation was synchronized with the merged lockfile: source-map-js 1.2.2, npm ci audit 0 vulnerabilities, 8/8 asset/security tests passed. Main and the M2 worktree were clean after their commits. No application service was started for this integration.
