# Release source/history credential scan

Date2026-10-07. [Spec](../specs/2026-10-07-release-audit-design.md), [plan](../plans/2026-10-07-release-audit.md). This increment prepares M5.2locally; it is not a license decision or release-readiness approval.

## Actual repository result

At HEAD8a4683ef67456c2fb3505b6c09757f93166c86bf with the current audit implementation/tests/spec refinements present, the read-only invocation returned0: **127reachable commits,694unique historical blobs,339current candidates,14649472bytes,0detected credentials**. Commit metadata/messages and all locally reachable annotated tag chains are inspected too; this snapshot contains0annotated tag objects. The exclusive redacted receipt is `.superpowers/sdd/2026-10-07-release-audit/0a260058-0ff1-47a8-b1e7-6d49c9ebe5d1.json`; its source digest records the current source as actually read. Future changes/publication require a fresh scan.

The first invocation produced8generic-assignment detections,7historical/1current, grouped into2fingerprints in the Gemini media/legacy main implementations. All8were independently checked against their exact blobs/current bytes: the unquoted values parse as Python attribute access ending in `gemini_api_key`, not literal key values. No values were printed. A watched regression then narrowed generic assignment detection to quoted literals and uppercase dotenv assignments; recognizable provider/private-key rules are unchanged and never suppressed. The old receipt438a9a20-9b4c-4123-ada3-c558bf2d0ca6remains intact rather than rewritten into a clean result.

## Qualification

29behavior cases cover recognizable provider/private-key markers, generic literals, expression/placeholder distinction, binary bytes, historical deletion, commit/tag messages, Unicode/credential-shaped paths, untracked/ignored source, shallow history, Git errors, byte limits before reads, links and immutable CLI reports. The initial characterization tests failed before implementation; commit/tag/attribute/budget counterexamples were also watched RED→GREEN. Whole fast backend582pass/18real-Blender tests deselected; the unchanged exporter remains qualified by its previous571full/18actual-Blender run. Native task-done/final fresh reviewer are still pending before this tool is accepted.

The tool never changes Git, history, credentials, source or other processes. Blob bodies are deduplicated/batched; current reads share the byte budget. Git stderr is discarded and failures are constant messages. Output records rule/location/object and SHA256/fingerprint, with credential-shaped paths redacted; reports use exclusive creation. Exit1means detected candidates requiring assessment,2means incomplete,0means no match under these heuristics. No automatic allowlist or false-positive suppression file exists.

## Scope and pending release gates

Current source includes all tracked files plus nonignored untracked candidates. Untracked ignored `.env`, recordings, dependencies and scratch are excluded; a tracked ignored file is still examined because it is source/history, not private merely by adding an ignore rule. Replacement objects are disabled, shallow history and submodules require explicit completion rather than a clean result. At most4representative historical paths are retained per unique blob; all blob bytes remain scanned.

Bounds:5000commits/5000annotated tags/50000blobs/50000current candidates/10000findings;16MiBper item,512MiBtotal; each Git command30seconds and file-backed20MiBread limit. The heuristics cannot establish absence of every secret shape, arbitrary PII or secrets in unfetched/unreachable Git objects. A distribution must separately allowlist its contents and retain its own hashes/notices.

Owner MIT/contributor/image confirmation, exact third-party runtime/package/model notices, Unity Editor licensing/runtime/two-rig checks, physical-video/laptop evidence, clean-machine/new-user study and publication authorization remain pending. No public push/main merge/tag/release is performed.

## Rulings made

1. Continue authorized Native local preparation without another execution-method approval. Cost if wrong: local reviewable tool only; publication stays gated.
2. Keep heuristic scan separate from rights/notices/release readiness. Cost if wrong: additional gates remain pending instead of a false release claim.
3. Use file-backed bounded Git output, discard stderr, disable replacements and reject shallow/submodule views; inspect commit/tag metadata too. Cost if wrong: Git/runtime/output limits require an explicit incomplete result, with no silent fallback or raw diagnostics.
4. Keep at most4representative paths and10000findings rather than unlimited diagnostic growth. Cost if wrong: aliases may need object-based investigation; finding overflow is incomplete, never clean.
5. Treat all tracked current files as candidates, including later-ignored files; ignore exclusions apply to untracked environments/caches. Cost if wrong: accidentally tracked sensitive data is assessed as source and may block publication.
6. Refine generic assignments to actual quoted/dotenv literal forms after8verified attribute-expression false positives. Cost if wrong: other unquoted config/dynamic secret forms need human assessment; known provider/private-key patterns remain active.
7. Fail known insufficient remaining budgets before body requests/current opens. Cost if wrong: a large repository must use an explicitly reviewed scan strategy, not a truncated clean report.

Deferred minors:none before final review. All receipt files and earlier policy-blocked ignored scratch are preserved.
