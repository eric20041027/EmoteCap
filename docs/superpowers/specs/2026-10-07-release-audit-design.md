# Release source and history scan

Parent: [product design](2026-10-06-open-source-product-design.md), M5.2. Continuous Native work remains authorized. No publishing, credential revocation, history rewriting or deletion is part of this increment.

Provide a read-only standard-library Python tool to scan all reachable Git history and current tracked/nonignored source candidates for recognizable credentials. Ignored environment files, runtime recordings and dependency caches are excluded from the source candidate; the distribution must separately use an explicit allowlist. This is a heuristic credential scan, not a proof that arbitrary sensitive information or licensing obligations are absent.

Scan complete blob bytes, including binary bytes, without emitting matched values or Git error text. Findings contain rule, source kind, object/file SHA256, opaque match fingerprint, byte offset, line and representative paths/commit. Record HEAD and the exact reachable commit set, unique blob count, current file count and bytes scanned. Git trees use NUL-separated output so quoted/Unicode paths are not parsed as command text. No shell interpolation is used.

The invocation is incomplete rather than clean when Git/file access fails, a current source candidate is a symlink or escapes the repository, or limits are exceeded:5000commits,50000unique blobs,50000current candidates,16MiBper blob/file,512MiBtotal scan bytes. Git commands have30second timeouts. Blob bodies are read in batches of at most16MiB, after size inspection, and identical historical blobs are scanned once. Submodules are not silently accepted as scanned source.

`audit_repository(repo, *, max_blob_bytes=16777216, max_total_bytes=536870912)` returns a JSON-compatible report. `scan_bytes(data, source)` returns redacted findings. CLI `python scripts/release_audit.py --repo PATH --output PATH` writes a new exclusive report; exit0means no detected credential,1means findings,2means incomplete/error. It never overwrites prior evidence or modifies Git, source files, processes or credentials. Human assessment is required for detections; no automatic false-positive suppression.

Source licensing/contributor and image rights, exact runtime/package/model notices, clean-machine and Unity/hardware gates remain separate. A clean scan never sets release readiness.
