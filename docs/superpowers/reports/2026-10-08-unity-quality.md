# Original Unity starter rigs and playback qualification

Plan/spec: [plan](../plans/2026-10-08-unity-quality.md), [spec](../specs/2026-10-08-unity-quality-design.md). Native execution is continuous. Task1 starts at81f3548; Tasks1–2 are complete with fixed-source evidence; Task3 final whole-plan review is still pending. This report is incremental, not M4/M5 or formal release completion.

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

## Task2: earlier incremental evidence at4ca8cf3 (incomplete snapshot)

Production Blender4.5.14 exported7public synthetic clips and14FBX/sidecar files with frozen job/contract/exporter/output SHA: original60frame Raise_Right_Arm (1.9667s), Tpose, posed-first, irregular/subframe, body22, single-frame and fingers. Initial real Unity import6/7passed; a zero-duration single-frame take produced a clip with humanMotion=false. This was a genuine importer behavior RED. Extending only that degenerate take's lastFrame by one output frame produces7/7actual forced reimport passes. No fixture/time tolerance/rest preroll was changed. Actual graphs on both original rigs confirm the sole posed source remains raised and held throughout its1/30second imported clip, not an empty or Tpose substitute.

Actual Humanoid Playables evaluated all60original source times on Standard/Tall at root0/37degrees (240pose samples). Standard right-hand rise0.5400001m, Tall0.6203763m; maximum otherwise-still left-hand movement approximately0.001996/0.002822m. Head remains up, root remains in-place, real skeletal segment lengths stay within1mm and all joint/rigidly skinned baked mesh samples remain finite. The initial length assertion mistakenly treated Hips-to-GameObject distance as a fixed limb; its1.026mm difference was an oracle error, not product failure. Hips/body Y is recorded separately and actual skeletal/root checks remain enforced. These Humanoid measurements are distinct from Blender's canonical0.5degree/1mm checks.

Fixed incremental source4ca8cf3was qualified in fresh task-2-fixed-import-playback receipts: Editor70/70, Play31/31, zero failures/skips, including original55/29and7real relay cases. All22imported sample source/meta copies match tracked bytes; current importer SHA captured. Owned47364/46852/17528/46104/8712/45800/15952/43868/48060terminal,55179zero listeners independently checked2026-10-08T06:57:32.7872499Z. Initial RED, first GREEN and final receipt paths are distinct and retained.

At the earlier4ca8cf3snapshot, Task2 remained incomplete: ready-to-play scene/menu, actual production player controls, mirrored/frozen negative acceptance controls, broad fixture playback, reusable owned orchestrator and source/asset provenance. Task3consumer documents and one fresh final whole-plan review also remain pending. No local acceptance of the complete sample workflow, physical capture qualification or public release is claimed.

Additional ruling: Hips-to-GameObject distance is animated root/body translation, not a fixed skeletal segment; exclude it from limb-length invariant and retain separate hips Y/root/head/hand measurements. Cost if wrong: subsequent translation/pose acceptance must detect real drift rather than accepting it as a limb-test artifact.
## Task2 completion at8617763

The imported sample menu now creates the saved StarterScene, two persisted original prefab/Avatar/mesh/material dependency sets and the frozen original594572byte FBX/SHA256dab229c1221428757784f994df9aef6a82c07bf7f086c6f4f044c7693a2963f6. Scene creation rejects existing/foreign destinations before scene changes, prompts to save modified scenes before activation, aligns each original mesh bottom to the sample floor and exposes one Standard-player menu. Tall independently starts the same sample. All source and animation provenance remain original/synthetic with pending project-license approval.

Three scene behavior failures were watched after excluding separate compiler/untitled-scene setup errors. The scene save/reload/collision checks pass. A separate actual byte-preservation test reproduced automatic rebuilding of unrelated user controllers; excluding only reserved StarterRigs sample paths fixes it while ordinary exports retain their previous callbacks. The player's actual disable case reproduced its still-running graph; owned Stop/Play on disable/enable fixes it. Actual advance/final hold/loop/playAll/destroy cases pass. Real mirrored/frozen FBX negative controls fail the same positive right-hand predicate (rightRise0; mirroredleftMotion0.7636757m, frozen0). Moving fingers produce22.96343/22.96347degree Humanoid changes. Body/full/posed/irregular/subframe/single/finger playback is checked on both rigs.

The independent Generic FBX geometry oracle derives heads and bone directions from only the canonical head/tail offsets and source world-delta quaternions. It never reads imported rest matrices. All7valid clips/every original timestamp pass unchanged1mm/0.5degree thresholds: maxposition1.058041e-6m (0.001058mm), maxdirection0.02797646degrees. Raw Generic zero-duration warnings are diagnostic; the product Humanoid importer independently holds the actual posed source for1/30s. No rest preroll, source-time mutation or tolerance relaxation.

Actual graphics render both colored rigs at0/1seconds in separate rendered frames: bluecoloredpixels3159/top258→3132/top282; orange2921/top267→2939/top305. Original PNGs and hand values are retained. Two renders in the same frame had stale GPU skin buffers; the corrected observation yields a frame without changing the pixel thresholds. Installed builtin imageconversion1.0.0 supplies PNG encoding; the missing-module attempt was a compiler/setup failure. Qualification targets the current Windows6000.5.9f1/Built-in desktop renderer, not another renderer/player/laptop performance.

The reusable owned orchestrator validates static material, fresh output/ancestor ownership, exact original/new test classes/counts and zero failure/skip XML. Ten new behavior checks were watchedRED→GREEN; focused runner14+productionfixture11=25pass. It copies the sample into an explicit isolated project, freezes exact package bytes, runs real Blender9clips, prepares the saved scene in an owned Editor, then runs all actual tests and relay. Final receipt records clean source8617763(sourceDirty=false) and verifies package bytes remain unchanged during qualification.

Whole fixed pipeline and Native task-done independently pass81Editor/37Play/zero failures/skips, retaining original55/29. Fastbackend912pass/1platform skip/18slow deselected204.71s; Web566/types/models/defaultbuild pass, Node49 remains in the required current verification lane. Existing Starlette/httpx/chunk-size warnings remain. Task2done cleanup independently proves41740/46464/46384/11372/41692/10376terminal and64467zero listeners at2026-10-08T08:01:17.6818688Z. Exact two Unity dependency notices and all480unchanged Windows licensing texts verified;48local doc links/50unique package GUIDs checked. Evidence lives in this plan's ignored workspace, including all RED/setup/GREEN/graphics/fixed-source/task-done snapshots.

## Exhaustive decisions and costs before final review

- Ruling: Continue Native under the user's continuous M1–M5 instruction, overriding routine writing-plans confirmation handoff — cost if wrong: local implementation remains reviewable before external publication.
- Ruling: Reuse bounded runner with two enumerated plan names, not arbitrary workspace roots — cost if wrong: existing sibling/traversal/link/fresh-output guards must still reject.
- Task1 Ruling: menu/scene integration belongs to Task2's real FBX dependency, not a placeholder playback scene in Task1 — cost if wrong: Task2 must close CreateScene before sample workflow acceptance.
- Task1 Ruling: changed Tall limb proportions place bind toe below root zero; preserve exact specified offsets and measure sample floor/grounding during real playback — cost if wrong: Avatar validity alone cannot admit foot/floor quality.
- Ruling: preserve all existing physical/rights/publication gates — procedural sample success cannot establish full release acceptance — cost if wrong: product approval could be overclaimed.
- Task2 Ruling: initial limb test counted Hips-to-GameObject distance as a fixed segment; this is animated body/root translation, so exclude it from limb-length invariant and record hips Y separately — cost if wrong: actual in-place root/head/hand/real skeletal-length checks and subsequent canonical translation measurements must expose true drift. Initial1.026mmhips discrepancy was a test-oracle defect, not product RED.
- Task2 Ruling: sample import unexpectedly rewrote other EmoteCapClips controllers; actual byte-preservation test watchedRED→GREEN after excluding only reserved StarterRigs/StarterRigsTests-GUID paths from preview-playlist callbacks — cost if wrong: exports intentionally placed in this reserved sample folder use the clip player's Refresh rather than global controller auto-rebuild; ordinary export folders remain eligible.
- Task2 Ruling: visual acceptance requires an actual graphics context, so opt-in hidden batch graphics tests replace no-graphics only for the sample pipeline; original receiver default remains no-graphics — cost if wrong: this is current desktop/Built-in renderer evidence, not laptop performance or other render-pipeline acceptance.
- Task2 Ruling: minimal isolated graphics project requires installed builtin imageconversion1.0.0 (metadata/DLL proved); missing EncodeToPNG module was setup/compiler failure, not productRED — cost if wrong: actual PNG/XML gate must fail rather than skip; no dependency upgrade or vendor binary.
- Task2 Ruling: GPU skin buffers are observed on separate rendered frames, not two Camera.Render calls in one frame — first oracle showed unchanged top pixels despite changed pose; yield ordinary frames and retain both PNGs/hand values before assertions — cost if wrong: actual color pixel counts/top bounds must still prove changed visible geometry. Final blue3159/258→3132/282, orange2921/267→2939/305; same thresholds preserved.

Final whole-plan review is next. Complete rights, physical capture/authorized actors/calibration/target-laptop measurements, clean second machine/five-user acceptance and exact updated public source/CI/tag/release authorization remain pending. This does not mark the M1–M5 goal complete.


## Final review and one watched correction pass

The independent review of81f3548..130173c returned **not ready**, with0Critical/3Important/0Minor. Its original verdict and repros remain unchanged in `.superpowers/sdd/2026-10-08-unity-quality/reviewer-final-130173c/`. All three Important severities were retained by effect: false admission, abandoned owned processes and false source attribution. No second review was dispatched.

Correction source **ecc06499c3dbb70f472369f2d9b5cfe11f8802e4** resolves all three in one watched pass:

- Require all81Editor/37Play exact class/fullname identities, including parameterizations; reject missing mandatory cases, duplicate identities, nonpassing results and inconsistent aggregate counts.
- Create Windows processes suspended, assign a kill-on-close Job Object before resuming, and terminate/verify the complete owned tree on every exit path. Blender, preparation Editor, relay and PowerShell→test Editor share containment. Actual harmless timeout/interrupt/ownership-write-failure controls pass. Existing Hub/licensing/GPU processes are not selected by name or stopped. Unix uses a new session; non-Windows runtime acceptance remains pending.
- Freeze consumed package/contracts/exporter/server/helper/lock/mandatory-case bytes, inventory/timestamps and Git HEAD/status before execution. Copy/verify executed exporter/contract/package snapshots and check live source/Git plus executed snapshot before/after each external stage and before success. Additions/removals and source/helper edits reject success. Five explicitly simulated mid-stage controls check rejection; these are not Blender/Unity acceptance.

The first20regressions failed before implementation (`final-correction-red.log`) and all20nowpass. Five additional mid-stage controls plus existing25runner/relay tests yield **50focused passes** (`final-correction-focused.log`). Synthetic reduced XML and simulated stages do not replace actual acceptance.

Fresh **final-correction-ecc0649/** evidence binds clean sourceDirty=false, actual Blender4.5.14/9clips/18FBX-sidecars and WindowsUnity6000.5.9f1/Built-in preparation. All **81Editor/37Play** cases pass with zero failures/skips, including original55/29, seven real TCP cases and graphics rendering. Source-snapshot and frozen-input receipts bind executed bytes. Independent cleanup at2026-10-08T08:37:57.9558157Z confirms owned47444/46392/42084/43184/44720/41692terminal and60903zero listeners (`independent-cleanup-final.json`). The earlier observation briefly saw41692in enumeration and is retained as incomplete evidence; no unrelated process was stopped.

The three local findings are closed by correction and direct verification. The original review verdict is retained, and no independent review of the corrected commit is claimed. Broader product gates remain pending.

## Every declined behavior: ruling and cost

| Review limit | Ruling | Cost / next evidence |
| --- | --- | --- |
| Authorized actor collection/consent | Retain physical collection gate; no actors used | Obtain consent before private recording |
| Real camera/calibration | Outside procedural acceptance | Acquire actual cameras/calibration and measure accuracy |
| Real tracking/model accuracy | Synthetic geometry is insufficient | Compare authorized original/new performances |
| Target laptop FPS/p95 | Hardware gate pending | Measure on the identified target laptop |
| Second clean machine | Local evidence insufficient | Repeat installation and sample flow elsewhere |
| Five new users | No usability pass inferred | At least4/5complete defined flow in10minutes |
| Other Unity versions | Only6000.5.9f1qualified | Additional Editor testing before support claims |
| Non-Windows systems | Platform runtime gate pending | M1CIis not sample/runtime evidence |
| URP/HDRP/other pipelines | Built-in desktop only | Verify materials/shader behavior separately |
| Standalone players | No player-build claim | Build and execute consumer sample separately |
| Native dependency rights | Full approval pending | Complete component/source/terms evidence |
| SDK rights | Prebuilt attribution gap retained | Establish exact component/source rights |
| Microsoft rights | Conditional rights unresolved | Confirm applicable redistribution terms |
| Owner/contributor license | Review grants no license | Obtain owner/contributor decision |
| Historical media rights | Procedural assets do not clear old media | Obtain source-specific permission or replacement |
| Current Windows distribution | Olde5aa6e5ZIPpredates source | Rebuild and qualify current candidate/notices |
| Public branch/CI/tag/release | M1permission does not authorize current release | Prepare exact-source packet and obtain authorization |
| Ordinary-export controller rebuilding | Existing behavior retained; sample preservation tested | Global rebuild semantics remain; separate contract needed for change |
| ClipPlayer beforeStart/Refresh/list mutation | Existing API unchanged outside sample flow | No arbitrary lifecycle/list-mutation qualification claim |
| Sample tests in arbitrary consumer projects | Orchestrator supplies test fixtures | Full suite requires generated QualityExports/owned output; normal sample playback was qualified |

Every20declinedbehavior is ruled above; none is converted to a pass or silently removed. No Minor polishing or second review was added. M1–M5 remains active.

Full fast backend after correction: **937passed/1platform skip/18slow deselected** in233.81s (`final-correction-backend.log`); existing Starlette warning retained. No Web/runtime C# changes were introduced by this correction; previously completed566Web/49Node/types/assets/build checks remain applicable. Documentation-only follow-up updates review status; the actual runtime receipt remains bound to tested commit ecc0649.
