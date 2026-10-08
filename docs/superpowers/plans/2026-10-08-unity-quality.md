# Original Starter Rigs and FBX Playback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver an importable UPM sample with two original different-proportion Humanoids and qualify real Blender FBX playback in actual Unity.

**Architecture:** An imported Editor sample builds and persists original rig assets, copies a production-generated FBX/sidecar to the existing importer destination and creates a ready-to-play scene. Real Editor/PlayMode tests run in an isolated sample-imported project against the production importer/player and live relay; reports separate mathematical/export evidence from physical/human acceptance.

**Tech Stack:** WindowsUnity6000.5.9f1/C#, Blender4.5.14, TestFramework1.7.0/Newtonsoft3.2.2/NUnit2.1.0, existing Python/PowerShell runners. No dependency upgrades or downloaded character assets.

**Spec:** `docs/superpowers/specs/2026-10-08-unity-quality-design.md`.

## Global Constraints

- Canonicalv2/48driven/192quaternions/full52/body22 and source fixtures unchanged. Sample skeleton input is an exact copy of contracts/bones.json with provenance SHA.
- Two original visible skinned characters differ in segment lengths, not just root scale; valid Human Avatars and all48 mappings required.
- Imported sample destination is Assets/EmoteCap/StarterRigs; existing outputs reject, modified scenes prompt, persisted prefab mesh/Avatar/material references required.
- Actual FBX/imported Humanoid Playables and zero-failure/zero-skip XML are mandatory. Duration error≤1/outputfps; right-hand/head-up/proportion/in-place invariants on both rigs, finite transforms; no synthetic claim of tracking/hardware quality.
- Own projects/results/processes only in this plan's ignored workspace. Exact pinned dependencies; no license activation/global settings/foreign scenes or processes/private actors/provider requests.
- Continuous Native remains authorized, so no repeated execution-method or routine plan approval pause. One fresh final C# whole-plan reviewer, one watched Important/Critical correction pass/no rereview. Preserve scratch.
- No public push/main merge/tag/release or project-license grant. Rights/hardware/user/publication gates remain pending.

## Review Focus

1. Prefab/scene reload must retain mesh/Avatar/material dependencies; generated in-memory objects alone cannot be a usable sample.
2. Mirrored or nonmoving humanoid clips must fail quality acceptance even when Avatar.isValid and XML compilation pass.
3. Body-only/single-frame/posed-first/subframe clips must preserve sidecar/imported duration and original sample times without hidden preroll or skipped checks.
4. Different limb/torso proportions and a rotated root must remain finite, preserve segment lengths and move the correct hand without changing existing Live Link semantics.
5. A sample menu or qualification runner invoked twice must reject collisions and remain within its own destination without overwriting user assets/scenes or abandoning child processes.

---

### Task 1: Importable original rigs and sample assets

**Files:** Create `unity/com.emotecap.mocap/Samples~/Starter Rigs/{Editor/StarterRigBuilder.cs,Editor/EmoteCap.Samples.Editor.asmdef,bones.json,README.md,Tests/Editor/StarterRigTests.cs,Tests/Editor/EmoteCap.Samples.Editor.Tests.asmdef}` and stablemetas. Modify package.json sample metadata and scripts/test-unity.ps1/scripts/unity-relay-test.py ownership options. Extend server/tests/test_unity_relay_fixture.py.

**Interfaces:** `StarterRigBuilder.CreateRig(bool tall)->GameObject` creates an original Humanoid with Animator/Avatar and SkinnedMeshRenderer; its bones use canonical names mapped to HumanTrait (ToeBase→Toes). `StarterRigBuilder.BuildAssets(string destination)->string[]` persists meshes/Avatars/materials/prefabs, returns two prefab paths and rejects existing destination. `StarterRigBuilder.CreateScene()` menu uses fixed documented destination and save-modified-scenes prompt. `StarterRigBuilder.PrepareQualification()` executeMethod reads only EMOTECAP_UNITY_QUALITY_ROOT inside this plan workspace, creates sample prefabs inside that isolated project's Assets/EmoteCap/StarterRigs and records public input/asset hashes.

Existing runner adds `--workspace-name` and PowerShell `-WorkspaceName`, both exactly enumerated `2026-10-07-unity-receiver` (default) or `2026-10-08-unity-quality`; owned_path(value,workspace_name=default) validates the selected plan before output creation. No arbitrary root override.

- [x] **Step1: Write behavior tests and owned project.** Explicit manifest/localUPM/sample source copy with hashes; loadable builder shape may return an empty object to allow intended behavior RED. Tests must inspect actual valid avatars/all48bones/visible weightedmesh/different segment ratios, save/reload prefab assets and collision rejection.

```csharp
[TestCase(false)] [TestCase(true)] public void OriginalRigHasAllDrivenMappings(bool tall) {
    var rig=StarterRigBuilder.CreateRig(tall);
    try {
        var animator=rig.GetComponent<Animator>();
        Assert.That(animator,Is.Not.Null);
        Assert.That(animator.avatar.isValid&&animator.isHuman,Is.True);
        foreach(var bone in EmoteCapContract.DrivenBones)Assert.That(animator.GetBoneTransform(bone),Is.Not.Null);
        Assert.That(rig.GetComponentInChildren<SkinnedMeshRenderer>().sharedMesh.vertexCount,Is.GreaterThan(0));
    } finally { UnityEngine.Object.DestroyImmediate(rig); }
}
```

Python controls admit selected quality paths and reject sibling/traversal/unknown plans before writes. Run focused pytest and actual filtered Editor XML; Expected intended behavior failures, not compiler/import/license errors.
- [x] **Step2: Implement minimal original geometry/assets.** Parse the copied skeleton, construct parent-relative positions after proportion changes (tall hips1.10, leg offsets×1.20, arm offsets×1.15, torso offsets×0.90; standard canonical lengths), map52 Human names and build Avatar. Generate rigidly weighted box segments with per-bone bindposes/finite indices; persist assets before prefab save, use original colored material. Verify references after AssetDatabase unload/reload. Add sample entry `{displayName:"Starter Rigs",path:"Samples~/Starter Rigs",description:"Two original Humanoids and FBX playback scene"}`. Preserve original notice/dependency bytes.
- [x] **Step3: Run/commit actual gate.** Filtered whole StarterRig Editor suite, all original55Editor cases, runner ownership pytest. Record source-copy hashes/actual version/XML/no skips/owned terminal PID. Commit `feat: add original Unity starter rigs and persisted sample assets`; Native task-done repeats actual Editor gate.

### Task 2: Actual Blender export, importer and two-rig PlayMode

**Files:** Create `scripts/unity-quality.py`, `server/tests/test_unity_quality.py`, sample `Tests/Editor/FbxImportTests.cs`, `Tests/Runtime/{FbxPlaybackTests.cs,EmoteCap.Samples.Play.Tests.asmdef}` and small original FBX/sidecar assets under sample `Animations/`. Modify production Editor/EmoteCapImporter.cs or Runtime/EmoteCapClipPlayer.cs only for demonstrated failures; generator/sample scene/menu integrates existing player. Stablemetas for new package sources.

**Interfaces:** `unity-quality.py --output <fresh-owned-child> --unity <installed> --blender <installed> --powershell <installed>` builds explicit isolated project, imports sample source files, freezes synthetic clips/production exporter hashes, invokes real Blender with120second bounded subprocess, copies FBX+sidecars before AssetDatabase import, invokes owned executeMethod PrepareQualification, then existing relay helper both modes with selected quality workspace. Output contains immutable qualification-inputs.json, actual FBX/source hashes, owned PID/port and real XML. EMOTECAP_UNITY_QUALITY_ROOT points to owned output; tests write exclusive GUID measurement JSON there. No private/provider data. Commands use no-quit for test runner, quit only for executeMethod preparation.

- [ ] **Step1: Prepare actual fixtures and negative acceptance controls.** Use production exporter with Raise_Right_Arm plus Tpose/posed/finger/irregular/body/single variants already defined by canonical contract; freeze each exact input SHA. Real import tests require Avatar/clip/name/loop/in-place/duration≤1/fps. PlayMode uses both persisted prefabs and actual AnimationClipPlayable/manual Evaluate at every source time, then also exercises production EmoteCapClipPlayer Start/Play with ordinary rendered frames.

```csharp
[UnityTest] public IEnumerator ExportMovesRightHandOnBothOriginalRigs() {
    foreach(var prefab in new[]{"Standard","Tall"}) {
        var rig=UnityEngine.Object.Instantiate(UnityEditor.AssetDatabase.LoadAssetAtPath<GameObject>(
            "Assets/EmoteCap/StarterRigs/"+prefab+".prefab"));
        var animator=rig.GetComponent<Animator>();
        var clip=UnityEditor.AssetDatabase.LoadAllAssetsAtPath("Assets/EmoteCap/QualityExports/Sample_Raise_Right_Arm.fbx")
            .OfType<AnimationClip>().Single(value=>!value.name.StartsWith("__preview"));
        var graph=PlayableGraph.Create("Owned sample playback");
        try {
            graph.SetTimeUpdateMode(DirectorUpdateMode.Manual);
            var output=AnimationPlayableOutput.Create(graph,"Humanoid",animator);
            var playable=AnimationClipPlayable.Create(graph,clip);playable.SetApplyFootIK(false);
            output.SetSourcePlayable(playable);graph.Play();
            var right=animator.GetBoneTransform(HumanBodyBones.RightHand);
            playable.SetTime(0);graph.Evaluate(0);var rest=right.position;
            playable.SetTime(clip.length*.5);graph.Evaluate(0);
            Assert.That(right.position.y-rest.y,Is.GreaterThan(.15f));
        } finally {graph.Destroy();UnityEngine.Object.Destroy(rig);}
        yield return null;
    }
}
```

The actual test extends this graph to every original source sample, both named hands/head, finite baked meshes, original segment lengths and in-place root positions; it persists timestamped measurements under the owned output. Add a mirrored-right/left oracle negative control and unchanged/no-motion negative control; both must fail acceptance. Add root37degree and different-proportion checks. Run real Editor/PlayMode; watch any actual product failure before correction, separate unavailable-input/harness errors.
- [ ] **Step2: Correct demonstrated importer/player behavior and deliver scene.** Use observed importer/clip defaults; preserve root bake and sidecar semantics. Sample menu copies frozen public sample FBX/sidecar to destination and adds both players to persisted scene; show one menu to avoid overlapping controls. Tests verify both actual players advance, stop/hold/loop as intended and visible weighted mesh remains finite. Qualification runner rejects foreign/sibling/link/existing paths, damaged inputs/missing runtime/XML/nonfinite output, and stops only owned subprocesses. Reuse real relay fixture so original29Play cases are included without skipping.
- [ ] **Step3: Verify/commit.** Actual both-mode whole suites including original55/29, two-rig/importer/player cases, real Blender input/output hashes; whole fast backend/Web/types/assets/build and appropriate local example checks. Commit `test: qualify Blender FBX playback on both Unity starter rigs`; task-done repeats actual both-mode gate. No broad hardware/privacy claims.

### Task 3: Consumer documentation, report and final review

**Files:** Modify UPMREADME/Documentation~/sample-playback.md/CHANGELOG and English/zhTWguides/development/release-progress; add `docs/superpowers/reports/2026-10-08-unity-quality.md`, sample provenance index and actual measurements.

**Interfaces:** The report binds exact source/asset versions/hashes, actual test counts and original public fixture identity to measured rig ratios/direction/head/hips/root/time results; distinguishes actual Humanoid retargeting measurements from canonical Blender0.5degree/1mm checks. Sample authorship has no third-party role/license implication.

- [ ] **Step1: Document concrete consumer workflow.** PackageManager→StarterRigsImport→EmoteCap/CreateStarterScene→Play; recorded folder/collision behavior, no camera/key requirements, how to use exported clips, current Windows6000.5.9f1 scope and remaining rights/physical/laptop/cleanmachine/newuser/publication gates.
- [ ] **Step2: Verify docs/source/material parity and commit.** Check all local links/metaGUIDs, both upstreamUnity notices and unchanged480Windows licensing texts, current source-specific qualification receipts, owned processes/ports terminal, no pairing/private data in assets. Mark only proven M4.3sample/FBX portions complete. Commit `docs: record original Unity sample playback qualification`.
- [ ] **Step3: Final whole-plan review.** Fresh most-capable C# reviewer covers exact implementation range/spec/ledger/all5ReviewFocus behaviors, also Python/PowerShell runner boundaries. Re-grade by recipient effect; rule every declined behavior/cost. One watched Important/Critical correction pass plus full green suites, no rereview/Minor polish. Retain evidence, continue broader M4/M5 gates.

Self-review: coverage maps original/persisted assets→Task1, real FBX/two-rig/rendered player/counterexamples→Task2, consumer/provenance/support/legal separation→Task3. Cross-task CreateRig/BuildAssets/CreateScene/PrepareQualification and enumerated workspace interfaces agree. Task2 scaffold must be completed with actual graph measurements before test execution; no test/physical acceptance is inferred from the plan.
