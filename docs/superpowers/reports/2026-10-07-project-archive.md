# M2 portable project archive

Date: 2026-10-07, America/New_York. Branch: feat/studio-projects. Plan base: 6184b1f. [Plan](../plans/2026-10-07-project-archive.md), [spec](../specs/2026-10-07-project-archive-design.md), [format](../../../contracts/emotecap-project-v1.md). Task 1 code: eee06ca. The full objective remains M1–M5.

## Implemented behavior

Standard ZIP .emotecap export and decode preserve versioned projects, original motion including signed zero, provenance, take/clip identities and undo history. Import creates a new project namespace and recovers recording checkpoints as interrupted takes. These pure operations never write to IndexedDB or overwrite the caller's work.

Source video inclusion defaults off and never invokes the loader when excluded. Explicit inclusion can use an in-memory source even when browser retention is off. Export references apply only to a copy. Import returns included sources separately in memory and clears retention flags; keeping a source across reloads requires a separate user choice. No cloud request or provider consent is part of the format.

The lazy bounded reader rejects oversized metadata requests before allocation. Streaming extraction enforces declared and actual entry/global sizes, 22 entries, permitted names, CRC and strict local-header/layout checks. Encrypted, unknown, duplicate/case-variant, traversal, overlapping and unsupported entries are rejected. Strict UTF-8 and resource guards run before JSON object construction, followed by the existing schema validators. Cancellation and a 30-second deadline also cover an uncooperative source loader, with abandoned promise rejections consumed.

The motion-only synthetic sample decodes through the production codec and matches every frame of the shared right-arm fixture. It contains no personal recording. Format limits and regeneration instructions are documented with an explicit distinction between synthetic codec evidence and physical tracking acceptance.

## Verification

- Watched a loaded no-op codec fail the original Unicode-name roundtrip before implementation; this was a behavioral assertion, not a missing-module failure.
- Watched synchronous cancellation expose two unhandled rejections, and watched nested/wide/long-string JSON regressions fail before their corrections.
- Watched the fixture consumer fail ENOENT before generation. Original frame equality then exposed JSON.stringify normalizing signed zero; the dedicated signed-zero roundtrip failed before its serialization fix.
- **36 codec tests and 2 fixture tests passed; 106 total project tests passed.** Cases use actual ZIP entries and the committed binary, including stored/deflated/ZIP64 inputs, headers/CRC tampering, lower resource limits, media decisions, cancellation and an offline roundtrip with zero fetch calls.
- **332 full Web tests passed / 36 files; 8 Node asset/security checks passed.** TypeScript passed, all three cached model SHA256 checks passed, and the production Web build passed. Full output is retained in the ignored plan workspace.
- The fixture was generated twice with identical SHA256 on the pinned runtime: **e8a79081c44474187550cc1accb609fde8ab868303c696d2733872880ea8767b**. Native compression and ZIP date representation can affect bytes across hosts; semantic decoding is the compatibility requirement.
- Exact runtime dependency **@zip.js/zip.js 2.23.0**, BSD-3-Clause, is the sole added package record in this plan. Parsed lock comparison found no existing dependency changes; installation audit reported **0 vulnerabilities**. Installed declarations/source were checked against the [upstream API](https://gildas-lormeau.github.io/zip.js/api/classes/ZipReader.html).
- The existing >500 kB bundle warning remains. Backend source is unchanged; M1's hosted backend evidence is not described as a fresh local rerun.

The fresh Native whole-plan review (gpt-6-astra, 6184b1f..2a94df6) approved with zero Critical, Important or Minor findings. It independently passed 106 project tests and TypeScript, checked the fixture hash and sole dependency addition, and rejected an additional 3,000-record forged directory before extraction. Active decode cancellation also rejected correctly. No fix pass is required. M2 acceptance remains incomplete.

## Rulings made

1. Continue user-authorized Native M1–M5 development without another routine plan approval. Cost if wrong: product choices remain open to user steering before release.
2. Decode video into memory and clear browser-retention flags because import and Keep source video are separate choices. Cost if wrong: a user must choose retention before expecting raw video to survive a reload.
3. Use the pinned streaming ZIP library with a bounded BlobReader. Cost if wrong: actual-browser behavior and large-file memory remain required measurements before release.
4. Generate fixtures through the existing Vitest/Vite resolver rather than plain Node stripping, because frontend imports use bundler resolution. Cost if wrong: regeneration requires the existing development dependencies.
5. Retain ignored verification scratch after the earlier cleanup approval rejection. Cost if wrong: bounded local diagnostic files remain.
6. Classify forged tiny uncompressed-size headers as corruption when the native decoder rejects them before the sink receives data; test the public safe rejection instead of forcing an inaccurate limit label. Cost if wrong: future upstream decoder changes must still satisfy the independent byte counters.
7. Apply generic structural JSON caps before JSON.parse, with yielding scans. Cost if wrong: future schema versions need explicitly revised caps; all allowed schema1 shapes fit the current bounds.
8. Installed getEntriesGenerator options have no signal parameter; enforce cancellation in BoundedReader, each extraction pipeline and the outer race. Cost if wrong: a small metadata read may finish before observing cancellation, without publishing data.
9. Preserve signed zero as standard JSON -0.0 rather than weakening original-motion equality. Cost if wrong: the extra serialization pass needs large-project performance measurement.

## Review acceptance boundaries

1. Studio file controls, visible progress/errors, keyboard operation and sample onboarding remain required consuming UI work. Cost if wrong: codec approval alone provides no usable workflow.
2. Actual IndexedDB installation/reload, quota/eviction and five-second checkpoint scheduling remain required Studio wiring and browser acceptance. Cost if wrong: pure decoding does not prove durable recovery.
3. Real Chrome/Edge and unsupported-browser UX remain acceptance gates. Cost if wrong: native compression support or bundling can differ from Node.
4. Maximum-size browser memory, responsiveness and wall-clock timing during synchronous JSON operations remain measurement gates. Cost if wrong: a large allowed project can pause the page or exceed the intended deadline.
5. Existing storage/domain behavior outside this range keeps its prior approval, with new integration behavior tested in the next plan. Cost if wrong: newly composed workflows may expose an interaction defect.
6. Filesystem permissions and symbolic-link semantics do not apply to this in-memory codec; entries use fixed data paths and are never installed on a filesystem. Cost if wrong: any future filesystem consumer needs a separate path/permission review.
7. Video stays bounded opaque data; this format does not validate content authenticity or scan malware. Cost if wrong: a future playback consumer must preserve its own security boundary.
8. ZIP integrity and strict data validation do not establish cryptographic provenance. Archives are untrusted input, not authenticated backups. Cost if wrong: a signed-backup use case needs a separate versioned trust design.
9. Physical tracking/camera, Blender/Unity, M3–M5, contributor rights, clean-machine distribution and owner-approved release remain required full-goal gates. Cost if wrong: subsystem approval is mistaken for product readiness.

Deferred minor findings: none.

## Remaining acceptance

Studio controls, no-camera onboarding, five-second capture checkpoints, reload restoration, keyboard editing, error recovery and real browser workflows remain required M2 work. The production bundle has not yet consumed this archive module through App; a successful build alone does not prove browser ZIP compatibility. Real quota/eviction/disk behavior and maximum-size latency/memory also remain acceptance gates.

No M2 push or PR has been created. Local main remains verified M1 25c6cbe. M3–M5, actual Blender/Unity, authorized motion/hardware measurements, contributor rights, clean-machine and beginner acceptance, and an owner-approved public release remain in the active goal.
