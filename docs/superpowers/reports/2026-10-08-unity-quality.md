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

## Task2: first real export/import/playback evidence (not complete)

Production Blender4.5.14 exported7public synthetic clips and14FBX/sidecar files with frozen job/contract/exporter/output SHA: original60frame Raise_Right_Arm (1.9667s), Tpose, posed-first, irregular/subframe, body22, single-frame and fingers. Initial real Unity import6/7passed; a zero-duration single-frame take produced a clip with humanMotion=false. This was a genuine importer behavior RED. Extending only that degenerate take's lastFrame by one output frame produces7/7actual forced reimport passes. No fixture/time tolerance/rest preroll was changed. Actual graphs on both original rigs confirm the sole posed source remains raised and held throughout its1/30second imported clip, not an empty or Tpose substitute.

Actual Humanoid Playables evaluated all60original source times on Standard/Tall at root0/37degrees (240pose samples). Standard right-hand rise0.5400001m, Tall0.6203763m; maximum otherwise-still left-hand movement approximately0.001996/0.002822m. Head remains up, root remains in-place, real skeletal segment lengths stay within1mm and all joint/rigidly skinned baked mesh samples remain finite. The initial length assertion mistakenly treated Hips-to-GameObject distance as a fixed limb; its1.026mm difference was an oracle error, not product failure. Hips/body Y is recorded separately and actual skeletal/root checks remain enforced. These Humanoid measurements are distinct from Blender's canonical0.5degree/1mm checks.

Fixed incremental source4ca8cf3was qualified in fresh task-2-fixed-import-playback receipts: Editor70/70, Play31/31, zero failures/skips, including original55/29and7real relay cases. All22imported sample source/meta copies match tracked bytes; current importer SHA captured. Owned47364/46852/17528/46104/8712/45800/15952/43868/48060terminal,55179zero listeners independently checked2026-10-08T06:57:32.7872499Z. Initial RED, first GREEN and final receipt paths are distinct and retained.

Task2 remains incomplete: ready-to-play scene/menu, actual production player controls, mirrored/frozen negative acceptance controls, broad fixture playback, reusable owned orchestrator and source/asset provenance. Task3consumer documents and one fresh final whole-plan review also remain pending. No local acceptance of the complete sample workflow, physical capture qualification or public release is claimed.

Additional ruling: Hips-to-GameObject distance is animated root/body translation, not a fixed skeletal segment; exclude it from limb-length invariant and retain separate hips Y/root/head/hand measurements. Cost if wrong: subsequent translation/pose acceptance must detect real drift rather than accepting it as a limb-test artifact.