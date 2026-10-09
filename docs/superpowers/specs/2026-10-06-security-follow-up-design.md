# M1 security and hosted verification follow-up

## Goal
Remove the known build-tool denial-of-service dependency and establish a reviewed candidate for the real three-OS M1 CI gate.

## Global Constraints

- Start at local main ef7a76c; preserve all M1 product behavior and contract v2.
- Keep Node 24.19.0, npm 11.21.0, Python 3.12.14 and uv 0.12.6.
- Change only source-map-js from 1.2.1 to patched 1.2.2 in dependency records; no unrelated dependency upgrades.
- Use a bounded characterization test of the installed dependency; never run an unbounded malicious source-map expansion.
- All ordinary app, assets and backend tests plus typecheck/Web build must remain green.
- npm audit must report zero high/critical findings without suppressions; registry outages are failed checks, not clean scans.
- Public push/PR contents must be concrete and reviewed before any needed approval. Actual three-platform job results, not workflow text, prove M1 completion.

## Acceptance

S1: An indexed source map with line offset 100000001 is rejected before expansion; a normal source map reconstructs the original generated code.
S2: Only source-map-js changes in locked dependency entries; clean locked install and all local checks pass; npm audit succeeds.
S3: CI invokes the security characterization and npm audit in addition to the existing tests/build. Reviewed PR body states actual counts, scope and external limitations.
S4: Following authorized push, GitHub Actions Windows/macOS/Linux jobs pass at the submitted commit; record exact run/job URLs. While waiting, M2 work may proceed on another branch from the reviewed S1–S3 commit.

Upstream evidence: https://github.com/7rulnik/source-map-js/pull/79 and https://github.com/7rulnik/source-map-js/releases/tag/v1.2.2 . The patched constructor bounds section offsets; the characterization does not expand attacker-controlled gaps.
