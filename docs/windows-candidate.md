# Local Windows development candidate

This packaging work targets Windows11 x64. It prepares a local development candidate while licensing, Unity, physical hardware and beginner acceptance remain pending. It is not an approved public release. [Release progress](release-progress.md) records those gates.

## Developer preparation

Use the pinned source developer tools and frozen Web build in [development](development.md). Python runtime inputs are fixed in [python-runtime.json](../packaging/python-runtime.json): official Python Build Standalone3.12.14, build20260825, x86_64-pc-windows-msvc. Obtain both exact official archives from their listed URLs into a local cache; do not replace their SHA256 pins when a download differs.

Run with the managed source Python; use absolute paths and a fresh output directory:

```text
uv run --directory server --frozen --python 3.12.14 python ../scripts/prepare_windows.py --repo "C:\work\EmoteCap" --cache "C:\work\runtime-cache" --output "C:\work\prepared-unique" --uv "C:\tools\uv.exe"
```

Preparation checks both archives before extraction/execution, retains the complete stripped runtime and supplied companion licenses, and snapshots server lock inputs. Developer uv must be exactly0.12.6. Production requirements are exported frozen without developer groups or an absolute-path command header. Only hashed binary wheels are installed into the selected target from the public PyPI index; cache links are copied so a candidate cannot modify a host/cache file through a hardlink. Host environments, user settings and source .env are not installed or copied.

`prepared.json` is written only after the owned interpreter/import probe and bounded payload inventory succeed. Each actual installed distribution lists its declaration and supplied licensing texts/hashes. This is an inventory, not a conclusion that all native/transitive notices are complete. Runtime pip/vendor files and supplied texts remain included; pip is not needed for eventual user startup. [Upstream distribution/licensing documentation](https://github.com/astral-sh/python-build-standalone/blob/main/docs/running.rst) explains the separate runtime/dependency licensing.

Failed preparations retain a partial directory and finite owned logs. Preserve it and choose a new output for a retry. There is no overwrite, cleanup, system-install or public-upload operation. Paths/archives/payloads have finite budgets and reject aliases/traversal/Windows device names/case collisions. ZIPs from identical complete inputs use fixed paths/timestamps/compression; changing inputs requires a new receipt.

The candidate builder and actual packaged-entry qualification follow this preparation. An actual clean second machine, Unity receiver/two rigs, authorized physical/laptop measurements, owner MIT/contributor/image rights, complete vendor notices and five new users remain required before a formal release.
