# Original Unity starter rigs and playback qualification

Plan/spec: [plan](../plans/2026-10-08-unity-quality.md), [spec](../specs/2026-10-08-unity-quality-design.md). Native execution is continuous. Task1 starts at81f3548; Task2 real FBX/playback and Task3 final consumer/report/review acceptance are still pending. This report is incremental, not M4/M5 or formal release completion.

## Task1: original persistent rigs

Two original Standard/Tall skinned humanoids use exactly copied canonical52bone data, full48driven mappings and visible box geometry rigidly weighted to corresponding bones. AvatarBuilder creates valid Human Avatars. Tall changes leg1.20/arm1.15/torso0.90segment offsets and hips1.10 rather than changing root scale; measured limb/torso ratios differ. Mesh52bindposes/weights/finite vertices are checked. The sample contains source/provenance, not downloaded character assets, private recordings or a new project-license grant.

Seven intended sample behavior failures were watched in actual Unity6000.5.9f1 XML, then7/7passed. An independent executeMethod Editor11152persisted original meshes/materials/Avatars/prefabs; a fresh Editor45228then ran the additional prepared-prefab reload assertion and original55protocol cases,63/63passed with zero failures/skips. This proves persistent assets survive a process boundary, not just temporary objects in one test. Source sample15files/metadata were byte-verified against their isolated imported copies and canonical bones.json remains exact. Stable GUIDs are original deterministic values.

Asset creation admits only the documented Assets/EmoteCap/StarterRigs destination or GUID-owned test destination, rejects foreign/traversal/link ancestors and existing directories/metas, and persists dependencies before prefab save. Actual collision assertions compare all existing bytes afterward. New renderer/materials have no third-party model provenance; broader license approval remains pending.

The bounded Unity/relay helpers now admit exactly two enumerated plan names while preserving default receiver workspace, sibling/parent/link/fresh-output/XML guards. Selected-quality-workspace test was watchedRED(APIshape absent)→GREEN; current fixture suite11pass, existing Starlette/httpx warning. Actual PowerShell controls reject an unknown plan and a foreign sibling path before launching Editor/output. An initial control used duplicate parameters and tested binder rejection; that harness attempt is retained conceptually but is not ownership proof. Corrected unique-argument controls establish the claimed boundaries.

The package samples metadata is present. The starter scene menu and public sample animation depend on the real FBX delivery in Task2 and are intentionally not claimed complete yet. Remaining importer/player/time/direction/finite/rig proportions gates require real playback tests, followed by one fresh final C# whole-plan review and one correction pass. No external publication or unrelated project/process modification.

## Rulings and costs so far

- Continue Native under the user's continuous M1–M5 instruction, overriding routine writing-plans confirmation handoff; cost if wrong: local changes remain reviewable before external publication.
- Admit two enumerated Unity plan names rather than arbitrary workspace overrides; cost if wrong: existing sibling/traversal/link/fresh-output controls must remain rejecting.
- Keep StarterScene menu integration in Task2 because its real FBX dependency is created there; Task1 produces usable saved rig assets and owned preparation API; cost if wrong: the sample workflow is not accepted until Task2 closes this interface.
- Tall's changed proportions can put the bind toe below root zero; do not silently alter canonical offsets or claim floor/animation qualification from Avatar validity; cost if wrong: actual sample floor/grounding behavior must be measured in Task2 before acceptance.
- Original physical/rights/publication gates remain pending and cannot be filled by procedural sample tests; cost if wrong: source/package/sample success could otherwise be mistaken for full product approval.


Fixed Task1source3ca0b57was rerun via Native task-done using the newly selected workspace and actual production relay: Editor63/63and Play29/29, zero failures/skips. Real protocol/lifecycle/7TCPcases were retained. Independent owned-process/port cleanup is recorded in task-1-done/independent-cleanup.json. No whole-plan final review yet; Task2/3follow.
