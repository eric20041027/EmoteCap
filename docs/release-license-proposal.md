# EmoteCap release license proposal

[繁體中文版本](release-license-proposal.zh-TW.md)

Prepared2026-10-07 for the accepted M5 release gate. On2026-10-08 the owner approved all four proposal items. Project-owned source now adopts MIT through [LICENSE](../LICENSE); formal binary/tag/GitHub Release approval remains separate.

Project license: **MIT**, with header `Copyright (c) 2026 EmoteCap contributors`, applied to project-owned code, documentation and original synthetic examples. MIT permits reuse/modification/distribution/commercial use subject to retaining its notice and includes an as-is warranty disclaimer. The definitive text is [SPDX MIT](https://spdx.org/licenses/MIT.html). A publicly readable repository alone does not grant the same permissions. [GitHub licensing guidance](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository).

## Concrete rights inventory

Original remote main snapshot713d349df05aa26b6b95a1b7974f7f3d8e574149 contains:

| Contributor | Commits at original snapshot | Observed contribution |
|---|---:|---|
| eric20041027 |67| Original project development/history |
| leokao0806 |1| fa91968, README.md documentation |

Counts reflect Git authorship at the original snapshot. On2026-10-08 the owner confirmed authority/permission for the original code/documentation and the other contributor's README contribution. The owner also confirmed that all four existing documentation media files are self-produced without third-party material: `docs/media/import-video.jpg`, `docs/media/gemini-slicing.jpg`, `docs/media/hero.gif` and `docs/media/dozed-off.gif`. Original history/contributor attribution is preserved. This is the owner's confirmation, not an independent legal authentication or a grant over upstream libraries/models.

The owner responded to the four numbered proposal items: “同意MIT 2 同意 3對 4.素材都是我產出的沒有第三方”. This approves MIT and `Copyright (c) 2026 EmoteCap contributors`, the original project rights, the other README contribution's permission basis and all four original media files.

## Third-party treatment

- Preserve upstream notices/licenses for locked npm/Python packages, runtime/WASM and any shipped dependencies; enumerate exact versions/file hashes and copied license texts before packaging.
- MediaPipe task weights are three separately hashed assets from Google's model storage. Primary model-card Apache2evidence is recorded separately in the [static material](../third_party/README.md); the SDK license is not assumed to cover weights or every task-archive asset. Assessment and formal package inclusion remain pending.
- Blender4.5.14 is an official hash-verified development tool/user-selected exporter, not bundled in the product. Its tool license and source are recorded separately.
- Unity editor is a user prerequisite. Official Newtonsoft3.2.2 is declared in the current UPM manifest and retains its upstream terms; dependency qualification does not confer complete redistribution approval.
- No tag/GitHub Release is created by approval of this proposal. Publication still requires the release checklist, artifacts/sourceSHA/checksums and separate owner approval.

## Approval record

Owner MIT/header/original-project decision: approved2026-10-08. Contributor permission basis: owner-confirmed2026-10-08. All four media publication rights: owner-confirmed self-produced/no third-party material2026-10-08. Root/UPM MIT text is adopted; future Windows builds deliver its source-bound record. Third-party full inventory/notices: in progress. Formal tag/GitHub Release: not authorized. Older candidate/tarball contents and source lineage remain unchanged.
