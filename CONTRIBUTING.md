# Contributing

EmoteCap is an unreleased local rebuild. Read the [README](README.md), [development guide](docs/development.md), [release progress](docs/release-progress.md) and the active task spec/plan before changing behavior. Project license/contributor publication rights remain pending; do not assume a MIT contribution grant before that decision is recorded.

## Make a change

Describe the user problem and expected behavior in a small issue or PR. Keep fixes scoped; preserve others' work, original take frames and project identities. Coordinate changes to the [motion contract](contracts/motion-v1.md), [Live Link](contracts/live-link-v1.md), [project format](contracts/emotecap-project-v1.md), [export jobs](contracts/export-jobs-v1.md) or [media consent](contracts/media-consent-v1.md) across their consumers. Changing coordinates/order/version requires an explicit migration, not a silent parser fallback.

Use committed locks and Node24.19.0/npm11.21.0/Python3.12.14/uv0.12.6. Follow existing module boundaries and use behavior tests for data, algorithms and lifecycle fixes. Reproduce the failure before fixing it; run the checks relevant to your change and obtain review. Documentation-only edits need factual/control/link checks, not new tests that merely mirror their text.

The [development guide](docs/development.md) contains exact Web/type/assets/security/build and backend commands. Actual Blender/browser/Unity/hardware gates have their own procedures and limits. Report unrun, skipped or mocked checks; an existing M1 CI pass does not validate new code. Prefer small `feat:`, `fix:`, `test:`, `docs:`, `build:` or `chore:` commits.

## Keep inputs and credentials private

Do not commit `.env`, settings, runtime data/exports, private recordings, third-party characters, dependency directories or real credentials. Use original synthetic or explicitly authorized fixtures and record their rights. New settings belong in `.env.example` with placeholders. Redact logs/screenshots before sharing; security vulnerabilities follow [SECURITY](SECURITY.md).

Source and release packages have different prerequisites/settings paths. Preserve SDK session choice, independent source retention/Gemini consent, bounded jobs and explicit recoverable errors. Publication requires the [release checklist](docs/release-checklist.md) and separate owner authorization; opening a PR does not authorize a tag or release.
