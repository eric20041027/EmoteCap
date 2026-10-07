# EmoteCap release license proposal

Prepared2026-10-07 for the accepted M5 release gate. This is a reviewable proposal; no LICENSE or public release is authorized by this file.

Proposed project license: **MIT**, with header `Copyright (c) 2026 EmoteCap contributors`, applied to project-owned code, documentation and original synthetic examples. MIT permits reuse/modification/distribution/commercial use subject to retaining its notice and includes an as-is warranty disclaimer. The definitive text is [SPDX MIT](https://spdx.org/licenses/MIT.html). A publicly readable repository alone does not grant the same permissions. [GitHub licensing guidance](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository).

## Concrete rights inventory

Original remote main snapshot713d349df05aa26b6b95a1b7974f7f3d8e574149 contains:

| Contributor | Commits at original snapshot | Observed contribution |
|---|---:|---|
| eric20041027 |67| Original project development/history |
| leokao0806 |1| fa91968, README.md documentation |

Counts reflect Git authorship at that snapshot, not proof of ownership/permission. No root or UPM LICENSE/NOTICE was found in the current tracked tree. Existing `docs/media/import-video.jpg` and `gemini-slicing.jpg` require confirmation that project publication is permitted. No third-party character or private recording is to be added. Original history/contributor attribution is preserved.

The owner decision needed is: approve MIT and this contributor header, and confirm authority/permission for the original project code/documentation, the other contributor's README contribution and those two existing documentation images. If any item is not covered, identify it before adding the license or publishing. This request does not ask the owner to relicense third-party libraries/models.

## Third-party treatment

- Preserve upstream notices/licenses for locked npm/Python packages, runtime/WASM and any shipped dependencies; enumerate exact versions/file hashes and copied license texts before packaging.
- MediaPipe task weights are three separately hashed assets from Google's model storage. Their model-license evidence must be established independently; the SDK license is not assumed to cover weights. Packaging inclusion stays pending that inventory.
- Blender4.5.14 is an official hash-verified development tool/user-selected exporter, not bundled in the product. Its tool license and source are recorded separately.
- Unity editor is a user prerequisite. Planned official Newtonsoft3.2.2 is an explicit future UPM dependency, not an already-installed or approved project license.
- No tag/GitHub Release is created by approval of this proposal. Publication still requires the release checklist, artifacts/sourceSHA/checksums and separate owner approval.

## Approval record

Owner license/rights decision: pending. Contributor permission basis: pending owner confirmation. Image publication rights: pending owner confirmation. Third-party full inventory/notices: in progress. Public release: not authorized.
