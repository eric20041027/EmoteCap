# Security

This rebuild has no approved public release or declared supported-version window yet. Keep the local service on loopback. Share source and project backups only after removing credentials/private media and confirming publication rights.

## Report a vulnerability

GitHub private vulnerability reporting was checked on2026-10-07 and is **disabled** for this repository. No private reporting email or response-time promise is established. Do not post credentials, private recordings, sensitive exploit payloads or unredacted logs in public issues.

If GitHub's **Report a vulnerability** option becomes available under [Security advisories](https://github.com/eric20041027/EmoteCap/security/advisories), use that private route. Otherwise open only a non-sensitive request asking the maintainer to arrange a private contact channel; wait for that channel before sending sensitive evidence. No vulnerability details are required in that public request.

Through the agreed private route, include the source commit/package digest, OS/browser/runtime versions, minimal reproduction with owned synthetic data, expected/observed behavior and redacted diagnostic output. Keep the original evidence privately. If an actual credential was exposed, its owner should revoke/rotate it; deleting a public text file does not undo disclosure.

## Boundaries

Projects live in browser storage for their exact origin; server jobs and optional local media are separate. Download portable backups before moving origins. Do not put settings or captured videos in the Web build. Packaged SHA256 checks detect changed bytes but are not a publisher signature.

MediaPipe processing requires the [session metrics choice](docs/sdk-privacy.md); Gemini source sending requires separate explicit consent/action. Already-started operations or already-sent provider data are not recalled by a UI toggle. Local scanners and mocked tests do not establish device/provider behavior or a completed release audit. Fresh source/history/artifact scans and rights/vendor review remain release gates.
