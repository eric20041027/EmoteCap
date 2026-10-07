# M1 security follow-up verification

Date: 2026-10-06. Base: ef7a76c. Implementation: 99a0434.
Status: local verification and independent review passed; hosted CI pending.

## Change

The locked source-map-js 1.2.1 accepted section offsets capable of expensive expansion in build tools. Update only that transitive dependency to 1.2.2. The installed dependency now rejects a huge offset before any expansion. Normal generated-code reconstruction remains unchanged.

Primary sources: [maintainer fix](https://github.com/7rulnik/source-map-js/pull/79), [patched release](https://github.com/7rulnik/source-map-js/releases/tag/v1.2.2).

## Evidence

- Before patch: the dangerous-offset characterization failed with Missing expected exception, while the normal-code control passed. No giant mapping was expanded.
- After patch and npm ci: 2 security tests pass.
- Parsed before/after lock comparison: only node_modules/source-map-js changed, from 1.2.1 to 1.2.2; runtime and other dependency records preserved.
- npm run audit:deps: 0 vulnerabilities, exit 0. This is a registry scan result, not a complete product security audit.
- Assets: 6 pass; app: 226 pass; backend: 380 pass, 2 real-Blender tests deselected.
- TypeScript and full Web build pass. All three model caches pass their recorded SHA256.
- Tools unchanged: Node 24.19.0, npm 11.21.0, Python 3.12.14, uv 0.12.6.
- Existing large-bundle and Starlette/httpx deprecation warnings remain.

## Review and remote integration

Independent fresh-context review (gpt-6-astra, range ef7a76c..6b6bd05) approved the candidate with zero Critical, Important or Minor findings. It independently reran all 8 Node asset/security tests and verified the sole-package lock diff and clean working state. No fix pass is required. The candidate PR includes the previously reviewed foundation commits because remote main has not received those local commits. Its title and body describe the full foundation plus security patch.

No remote push, PR, tag or release has been performed for this follow-up. Actual Windows/macOS/Linux job URLs and outcomes must be recorded before M1 is called complete.

## Rulings

1. Continue the user-authorized Native M1–M5 roadmap without a redundant execution-method or routine-plan approval pause. Cost if wrong: product choices remain open to user steering before release.
2. The initial M1 dependency freeze preserved a baseline; this explicitly targeted follow-up changes only the known vulnerable dependency. Cost if wrong: both local and hosted qualification are required for its changed behavior.
3. Review the completed local implementation before the external integration steps rather than waiting for a CI result that requires a reviewed push. Cost if wrong: any later CI-driven code fix needs its own regression evidence and must not inherit the old passing status.

## Remaining product gates

Camera, paid Gemini service, real Blender export, Unity playback and clean-machine/user acceptance are unchanged pending gates. Track the entire objective in [release progress](../../release-progress.md).

## Review acceptance boundaries

- Hosted jobs remain pending until an authorized push runs them; otherwise cross-platform failures can remain undiscovered.
- The foundation before ef7a76c retains its earlier independent review; this patch review does not supersede that evidence. Pre-existing product limitations remain visible.
- The bounded constructor characterization guards the known dependency regression, not every malicious-map variant; a broader upstream defect may still exist.
- The successful registry audit and inspected maintainer fix are dated evidence, not a guarantee of future advisory completeness; rescan before release.
- Real camera/Gemini/Blender/Unity/hardware/clean-machine acceptance remains explicit pending work; no unit test substitutes for it.
- All M2–M5 implementation, licensing and publication requirements remain in the full active goal; this candidate is not a released product.

Deferred minor findings: none.
