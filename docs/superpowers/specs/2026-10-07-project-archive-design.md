# Portable EmoteCap project archive

Parent: [M2 Studio specification](2026-10-06-studio-projects-design.md). The storage foundation is implemented and independently approved; this subsystem adds actual backup/import functions without claiming the remaining UI/browser acceptance.

## Format

`.emotecap` is a standard ZIP archive. Version1 contains `manifest.json`, `project.json`, and optional `media/<take UUID>.source` entries. ZIP stored and deflate compression are supported, including bounded ZIP64 metadata. No encryption, multi-part archives, directories, executable entries or unknown entry paths. Require an unambiguous archive, matching local filenames, valid CRC32, no overlaps and no duplicate names (including case variants). Read filenames before extracting anything.

The UTF-8 manifest is exactly `{format:"emotecap-archive",version:1,project:"project.json",projectSchema:1,contractVersion:2,media:[{takeId,path}]}`. The project JSON is the strict schema1/contractv2 document from the approved domain. Media references must correspond exactly to project media descriptors and actual archive entries, without duplicates or missing/extra payloads. Source names/MIME/size live in the project descriptors; archive paths use only stable UUIDs. JSON is decoded as strict UTF-8 and parsed/validated, never executed. No API keys or extra fields are accepted.

Export preserves original frames/provenance and edit history. Optional media defaults off; the loader must not be called when media is excluded. Selecting inclusion may add a currently available in-memory source even when browser retention is off; this changes only the exported snapshot. If a take says its retained source exists but it cannot be read, inclusion fails visibly rather than silently losing the file. A take with no source, such as a motion-only sample, remains valid without media. Use a fixed ZIP date for reproducible fixtures.

Decode returns a new project UUID, preserving take/clip identities in that new namespace. Recording checkpoints become interrupted with their exact original frames; a default recoverable clip follows the domain's recovery rule. Return included videos as separate in-memory sources and clear their browser-retention descriptors by default. Persisting an imported source still requires the later explicit Keep source video control. No decode function writes to IndexedDB or modifies an existing project.

## Bounded implementation

Use exact runtime dependency `@zip.js/zip.js@2.23.0` (BSD-3-Clause), verified from its registry metadata on 2026-10-07. The [official reader API](https://gildas-lormeau.github.io/zip.js/api/classes/ZipReader.html) supports lazy Blob access and an entries generator; [entry options](https://gildas-lormeau.github.io/zip.js/api/interfaces/EntryGetDataOptions.html) expose signatures, local-header checks and cancellation. Inspect the installed pinned declarations/source before implementation and follow those actual APIs.

- Input archive at most 512 MiB; project JSON at most 256 MiB; manifest at most 64 KiB; all decoded bytes at most 512 MiB.
- At most 22 entries (2 metadata plus 20 takes); media at most 100 MiB/take and 200 MiB/project; all domain limits stay unchanged.
- Decoder input chunks 64 KiB; maximum individual lazy-reader byte request 128 KiB, limiting central-directory/metadata allocation before library parsing. Reject oversized/invalid read ranges before loading them.
- Validate declared sizes before extraction and independently count actual decoded bytes. Stop on a per-entry/global/declared-size overflow or mismatch. A forged small uncompressed size must not bypass the real-byte limit.
- Use streaming output into bounded Blob parts with signature checks, native compression streams and no web workers/network codec loading. Inspect fallback behavior and test compressed input on the pinned runtime. JSON bytes are materialized only inside the explicit JSON cap.
- Accept a caller AbortSignal and a 30-second operation timeout; cancel streaming work and release references on failure. No partial archive or imported project is published after failure.
- Limits may be lowered for callers/tests, never raised beyond the hard caps. Error messages explain unsupported version, corruption, missing source, size limit or cancellation.

## Deliverables and acceptance

Pure codec functions with a separate bounded ZIP adapter, documented format and a committed motion-only synthetic `.emotecap` fixture. Tests exercise export/decode with and without media, compressed entries, identity isolation, checkpoint recovery, no implicit retention, invalid versions/UTF-8/motion/extra credentials, missing/extra/duplicate/traversal entries, corrupt CRC/local names, oversized headers/data/counts, forged inflation sizes, abort and lowered limit guards. An invalid import leaves an existing repository project intact because installation happens only after codec success.

Full M2 still requires UI file controls, recording checkpoint timers, diagnostics/sample onboarding and actual browser end-to-end acceptance. Large-project memory/performance, physical camera, M3–M5, licensing and publication remain in the full goal.
