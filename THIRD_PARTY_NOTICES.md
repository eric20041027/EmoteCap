# Third-party notices — draft evidence

This source checkout includes [frozen inventory and licensing material](third_party/README.md) for the observed Web/server/Windows-runtime inputs. It is not a completed licensing assessment or an approved public package. Project MIT/contributor/media approval and native/vendor/source-form coverage remain pending.

Use [third_party/inventory.json](third_party/inventory.json) to find exact component names/versions, declared licenses, upstream/supplied origins, npm integrity, native binary metadata and each copied text's path/size/SHA256. All copied texts remain under `third_party/licenses/`; their terms and attribution are retained verbatim. No model, native library, character, card PDF or recording is copied into that directory.

| Material | Evidence status |
|---|---|
|35Python production distributions | Actual verified prepared payload; supplied license texts copied; full native/vendor assessment pending |
|6Web runtime packages | Frozen package-lock and installed version match; supplied root texts copied; MediaPipe upstream source LICENSE supplementary |
|Python3.12.14/build20260825 | Pinned official archives and prepared receipt; runtime companions and pip/vendor/embedded-wheel texts preserved |
|OpenSSL4.0.2inside cryptography50.0.1 | Exact upstream Apache2LICENSE copied as supplemental evidence and linked to the observed native-file hash; full native/Rust coverage pending |
| Rust source licensing corpus |358crate texts and six compiler terms/copyright files,196source-lock entries/3native associations; exact snapshot/term/native correspondence and recipient source links validated. Build/dev/other-target superset and four manifest-only cases remain explicit; complete linked-component/rights coverage pending |
|Three certifi source copies | MPL2terms and14actual source files are declared; generated package SOURCE-ACCESS.txt identifies direct/vendor/embedded-wheel locations |
|3MediaPipe task models | Actual bytes match committed SHA256; Google model-card Apache2evidence separate from SDK; task archive coverage pending |
|Native DLL/PYD components | Exact metadata inventory; Microsoft runtime basis and native/static-link/source-form conditions unresolved |
|Blender/Unity | Separate user prerequisites; not bundled; Unity licensed execution/receiver qualification pending |

The [MediaPipe source license](https://github.com/google-ai-edge/mediapipe/blob/master/LICENSE) does not, by itself, establish complete third-party attribution for prebuilt WASM. Model-card evidence is [BlazePose GHUM](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20BlazePose%20GHUM%203D.pdf) and [Hand Tracking](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20Hand%20Tracking%20%28Lite_Full%29%20with%20Fairness%20Oct%202021.pdf). [Microsoft redistribution guidance](https://learn.microsoft.com/en-us/cpp/windows/redistributing-visual-cpp-files?view=msvc-170) describes separate native-runtime conditions; no Python/PSF blanket authorization is inferred.

Before distribution, resolve each pending assessment, satisfy applicable notices/source-form conditions, incorporate the exact material in the package, run fresh scans and the [release checklist](docs/release-checklist.md), then obtain owner publication approval. Existing internal candidate hashes identify their old contents, not this later source material.
