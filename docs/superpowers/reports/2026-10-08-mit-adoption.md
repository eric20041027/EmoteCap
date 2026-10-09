# Owner-approved MIT adoption and licensed delivery

On 2026-10-08 the owner approved all four [proposal items](../../release-license-proposal.md): MIT/header, original code/documentation rights, the other README contribution's permission basis and four self-produced documentation media files without third-party material. This records the owner's assertion, not independent legal authentication. Formal tag/GitHub Release and upstream redistribution approval remain separate.

## Source and recipient delivery

Clean implementation source: `84d89a7b1165c4fbb918bb8c645c21c2cd319b3b` (base `f3080d8`). Root LICENSE and standalone UPM LICENSE.md have identical canonical MIT text: **1,078 bytes**, SHA256 **`b95395a1999f99bf8d392caec287ff427dc69981fe1d5f97a83ca98fd4dc2406`**, header `Copyright (c) 2026 EmoteCap contributors`. UPM declares SPDX MIT and carries a unique license meta GUID; development version remains 0.2.0 and dependency Newtonsoft 3.2.2 is unchanged.

The Windows builder includes committed LICENSE in its Git snapshot, validates the approved text digest, checks committed presence after notice admission, copies at most the admitted size plus one byte and binds the root file in the frozen manifest/ZIP. Changed, ignored/untracked, missing-after-admission or dropped license input fails before completed candidate publication. Historical source fixtures without a committed license remain explicitly unadopted/pending. Only the named owner-rights gate is removed when MIT is delivered; all native/vendor/hardware/human/formal-release gates remain pending.

Root/UPM license paths use explicit LF attributes. Third-party licensing text bytes are unchanged; their original terms and source access remain separate. The inventory removes only the completed owner-rights pending entry. Bilingual owner records, README, quickstart, recipient startup instructions and the release checklist reflect that approval. MacBook Pro M2 is owner-reported as an available laptop candidate; RAM/macOS/camera/tool details and actual measurements remain pending.

## Fresh local artifacts

| Artifact pair | Source | Size | SHA256 |
|---|---|---:|---|
| Windows candidate a/b | `84d89a7` | 88,489,574 bytes each | `514ff1d74e6eb47aa6f28c38ccb66b27a285a86be95fa4a21dee3159c9a8e69e` |
| Licensed UPM 0.2.0 a/b | `84d89a7` | 123,106 bytes each | `ce7e2cbfecad330f2a7eb34429e9442be780a6511d952a5fe84bee696bb9ed15` |

Windows ZIPs are byte-identical and contain **5,756 members**, including root LICENSE and the source/digest-bound license record. All **96 UPM members** match the frozen source package; both tarballs are byte-identical. The independent reviewer checks the actual license bytes, manifest/source binding, SPDX/dependency/version metadata and unique GUID. Existing Windows preparation is reused with unchanged runtime/dependency pins; these are fresh builds, not a re-labelled old ZIP.

The older `a77b938` UPM archives retain their historical 94-member and installation evidence. They are **not equivalent to the current licensed package**. No old ZIP/tarball is overwritten and no binary/media archive is publicly uploaded. The existing Windows startup/SDK/Studio/Blender and Unity gameplay qualifications keep their original source/case bounds; there is no fresh physical, clean-machine, beginner-study or full runtime-workflow claim from this license-only scope.

## Tests and review

- Initial package-delivery regressions: **5 failures and 1 passing legacy control**, then six passing cases.
- Missing committed snapshot license: watched failure, then committed-presence guard passes; this prevents downgrade to the historical unlicensed mode.
- Git checkout with autocrlf true: watched byte mismatch, then LF attributes pass false/true/input settings.
- Final license/EOL cases: **10 pass**. Packaging/notice suite: **53 pass, 1 skip**. Earlier affected notice/source/Rust suite: **152 pass, 1 skip**. Local fast backend: **953 pass, 1 skip, 19 slow deselected**, before the three added EOL cases; final hosted CI must cover the committed suite.
- Static checks: canonical root/UPM parity, SPDX/version/dependency metadata, unique GUIDs and **122 local links across 11 documents** pass. A private checker initially used cp950 implicitly; its UTF-8 reader was corrected before this check passed.

One fresh independent final Python review finds **no Critical or Important code/artifact issues**. It labels superseded current-ledger owner/source-equivalence claims Minor. The executor re-grades that data issue Important because the authoritative release ledger could select a superseded package or request already-granted rights. Actual owner-record/member-set checks demonstrate the contradiction, then a single documentation correction pass makes those criteria pass. No production code or artifacts change during that pass, so existing code suites remain green and no second code review/build is used. No deferred minors remain in this scope; earlier unrelated deferred findings retain their reports.

Executor rulings and declined judgments:

1. Execute the precise approved proposal using the retained Native method, with no duplicate permission prompt. Cost: the owner's assertions are accepted as the permission basis; independent legal authentication remains outside this technical review.
2. Retain unpublished development version 0.2.0; distinguish artifacts by source and SHA256. Cost: version alone cannot identify which local pre-release archive is intended.
3. Preserve previous artifacts and evidence workspace rather than replace/delete them. Cost: additional local storage; historical qualifications do not become current package equivalence.
4. Do not reopen unrelated formatting/refactoring or unchanged runtime behavior. Cost: original case/scope limits remain, and new license delivery does not qualify physical/user workflows or all dependency rights.

Private evidence root: `.superpowers/sdd/2026-10-08-mit-adoption/`; `artifacts-84d89a7/complete.json`, per-build terminal receipts, frozen inputs, ZIPs/tarballs, watched failures/green logs and static checks retain the exact scope. Source push/draft PR/CI are already authorized. Remote main merge, formal tag/release and public binary distribution remain separate from this completed MIT adoption.
