# Corrected-source local Windows delivery

Candidate source: clean `8a9261eae77d704f82fd01af62c862a5dd3ae525`, including the [FBX sampling correction](2026-10-08-fbx-sampling-precision.md). This supersedes the earlier Windows candidate for testing the corrected exporter; it remains a local development candidate with release/licensing gates pending.

## Artifacts and source binding

| Artifact | Bytes | SHA256 |
| --- | ---: | --- |
| Corrected Windows ZIP, two identical builds | 88,488,689 | `02e74ede0f37bdc05cfe66a9953a13998988ed52befabfd1d1d751dd43f1b5fe` |
| Retained UPM0.2.0, source-equivalent package | 122,316 | `6b09b51fcec6b7edf20d9b88aae680bf16efe56b7edf1d3e6ca11d3c8c586aba` |

The Windows builder reused the existing pinned, inventoried Python/dependency preparation after verifying its lock hashes and every prepared byte. Both builds independently constructed fresh candidates and ZIPs. A separate verifier reread every 5,755 ZIP entry against the manifest, deterministic headers, actual hashes and byte counts; all 480 licensing texts, 196 Rust source records, three native bindings and 14 certifi source files were checked. Text presence/source records do not complete redistribution assessment.

Among the 44 application/entry records used in the earlier qualification, 43 are byte-identical to `a77b938`; the sole changed record is `app/server/blender/export_fbx.py`, verified against its current committed Git blob. The frozen production Web's 14 records are independently verified. Prior SDK/Studio/backup/pairing evidence remains attributed to `a77b938`; those workflows were not rerun or re-labelled as new physical acceptance.

No new UPM tarball was generated. Both retained original `a77b938` tarballs were independently reread: exactly 94 ordinary entries under `package/`, every entry byte-equal to its current `8a9261e` Git blob and both tarballs retaining the SHA256 above. Its earlier actual tarball-install 81 Editor/37 Play evidence therefore remains attributed to the unchanged artifact. A convenience copy in the new acceptance kit preserves the original artifact name/source.

## Actual bundled runtime and corrected export

Actual candidate Python started using `-I -S -B`, System32-only PATH and a poisoned PYTHONPATH. The real health endpoint and production Web succeeded; notices were not Web-served. A damaged Rust notice in a separate candidate copy exited 1 before private data/settings creation. The runtime test driver exited 0 and its owned tree terminated.

A separate real service run used the bundled Python and application, with the installed Blender4.5.14 path explicitly selected. It accepted the unchanged licensed real-person 126-frame job through `/api/export-jobs`, reached succeeded/100%, and served a real 759,388-byte FBX. No API/SDK/model mock or development proxy was used for this export; inference was not rerun.

Downloaded FBX SHA256: `daecaeb04803756b2000491ceb8eeeaca86c8fdeef347c89b2acb1eaa36c7fd6`. The independent actual Blender roundtrip probe verifies zero duplicate time keys, all 126 source samples, duration 4.2s and maximum position error 0.000002044013524m. This is export preservation against supplied motion; it is not ground-truth person/finger/foot-contact accuracy. FBX per-run hashes are recorded independently; the ZIP reproducibility claim does not imply deterministic FBX output.

The service was intentionally terminated after successful download (exit 1, owned tree terminal); the canonical Blender probe exited 0 with terminal cleanup. Independent postflight checks verify all owned build/runtime/service/probe PIDs absent and test listeners released. No unrelated process was stopped.

One fresh independent review of the new local qualification drivers/probes approved with zero Critical/Important/Minor findings, without rerunning tests or reopening unchanged production packaging behavior. No production code/dependency change was made in this delivery increment.

## Evidence and acceptance still needed

Immutable evidence and both ZIPs: `.superpowers/sdd/2026-10-08-local-delivery-8a9261e/`. The updated `acceptance-kit/` includes artifact/source lineage, Chinese clean-machine/hardware/beginner guides and five blank participant rows. Completed independent new users: **0**.

This verifies the corrected candidate's bytes, one-entry startup and real packaged export on the development machine. Remaining M1–M5 acceptance includes broader authorized annotated motion and dynamic fingers, actual camera/calibration, target-laptop Fast720p performance, a second clean machine and at least four of five independent new users finishing the defined workflow within ten minutes, complete project/contributor/media/native/vendor rights, and owner-approved formal release. No archive, source media, animation binary, tag or GitHub Release was published by this increment.
