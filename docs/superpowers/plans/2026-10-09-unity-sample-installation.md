# Unity Sample Installation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let ordinary users compile/import Starter Rigs without developer-only Test Framework while preserving the complete opt-in qualification suite.

**Architecture:** Gate the four test asmdefs using a package-resource version define and matching define constraint. Runtime/editor sample code, fixtures, package dependencies and GUIDs remain intact. Fresh real Editors test the absent dependency; the existing fixed qualification runner tests the present dependency.

**Tech Stack:** Unity6000.5.9f1, UPM0.2.0, Test Framework1.7.0, Newtonsoft3.2.2, existing Python3.12.14 owned process/qualification tooling.

**Spec:** docs/superpowers/specs/2026-10-09-unity-sample-installation.md

## Global Constraints

- Preserve Unity6000.5, Editor6000.5.9f1, Newtonsoft3.2.2 and UPM0.2.0.
- Preserve all sample animation/geometry/motion bytes,48driven bones/192values/52exported bones and project/third-party licenses.
- No Test Framework dependency added to production package.json; preserve test source and asmdef/meta identities.
- Real RED/GREEN Editor compilation and81Editor/37Play zero-skip qualification required; new Mac regression remains pending.
- Only fresh owned projects/processes; retain all evidence and earlier private workspaces.

## Review Focus

- No Test Framework: imported sample must compile and create both Humanoid rigs.
- Test Framework1.7.0 present: all original test assemblies remain discoverable and all118tests execute.
- Package tests opted in without framework: no unresolved NUnit/TestRunner assembly reaches production compilation.
- Imported sample with existing author assets: no fixture, GUID, scene/animation semantics or license change.
- Negative/failed Editor run: no missing receipt, skipped class or stale output may be treated as pass.

---

### Task 1: Make test assemblies conditional and qualify real installation

**Files:**
- Modify: `unity/com.emotecap.mocap/Tests/Editor/EmoteCap.Live.Tests.asmdef`
- Modify: `unity/com.emotecap.mocap/Tests/Runtime/EmoteCap.Live.Runtime.Tests.asmdef`
- Modify: `unity/com.emotecap.mocap/Samples~/Starter Rigs/Tests/Editor/EmoteCap.Samples.Editor.Tests.asmdef`
- Modify: `unity/com.emotecap.mocap/Samples~/Starter Rigs/Tests/Runtime/EmoteCap.Samples.Play.Tests.asmdef`
- Modify: `unity/com.emotecap.mocap/Documentation~/sample-playback.md`, `docs/development.md`, `docs/release-progress.md`
- Create: `docs/superpowers/reports/2026-10-09-unity-sample-installation.md`
- Test: private frozen fresh no-framework projects and existing `scripts/unity-quality.py` real qualification; do not commit generated projects/logs.

**Interfaces:** Consumes unchanged local UPM package/sample, existing OwnedProcess and StarterRigBuilder.CreateScene. Produces real installation receipts with valid Standard/Tall Humanoids and unchanged original test XML.

- [ ] **Step 1: Create a fresh real installation probe before changing asmdefs.** Copy package/sample byte-for-byte into the plan workspace snapshot, create a minimal project manifest with local package and animation/physics/imgui/jsonserialize/imageconversion modules, omit Test Framework, and opt in package tests to cover the most demanding no-framework case. Add this Editor probe:

```csharp
public static void Run() {
    EmoteCap.Samples.Editor.StarterRigBuilder.CreateScene();
    foreach (var name in new[]{"Standard", "Tall"}) {
        var avatar = UnityEditor.AssetDatabase.LoadAssetAtPath<UnityEngine.Avatar>(
            "Assets/EmoteCap/StarterRigs/"+name+".avatar.asset");
        if (!avatar || !avatar.isValid || !avatar.isHuman)
            throw new System.Exception("Invalid Humanoid: "+name);
    }
    var assemblies = System.AppDomain.CurrentDomain.GetAssemblies();
    if (System.Array.Exists(assemblies, a=>a.GetName().Name.StartsWith("EmoteCap.") && a.GetName().Name.EndsWith(".Tests")))
        throw new System.Exception("Developer tests compiled without Test Framework");
    System.IO.File.WriteAllText(System.Environment.GetEnvironmentVariable("EMOTECAP_INSTALL_RECEIPT"),"valid-two-rig-no-test-framework");
}
```

- [ ] **Step 2: Run RED with actual Editor.** Use OwnedProcess, fresh project and log with `-batchmode -nographics -projectPath <owned-project> -executeMethod InstallSmoke.Run -quit -logFile <owned-log>`. Record command/source hashes/exit and receipt absence. Expected: NUnit/UnityTest compiler errors and no success receipt. Treat licensing/network/sandbox errors separately, never as expected product RED.
- [ ] **Step 3: Add the gate to all four test asmdefs.** Preserve all existing fields and add:

```json
"defineConstraints": ["EMOTECAP_TEST_FRAMEWORK"],
"versionDefines": [{"name":"com.unity.test-framework","expression":"1.7.0","define":"EMOTECAP_TEST_FRAMEWORK"}]
```

- [ ] **Step 4: Run GREEN in a new frozen no-framework project.** Same source-bound real probe must exit0, create two valid Humanoids, exclude all four test assemblies and write its new receipt. Also run without the manifest testables setting to cover normal installation. Verify sample/package files except the four declared asmdefs unchanged; no installed framework hidden in resolved manifest/lock.
- [ ] **Step 5: Run framework-present qualification.**

```text
server/.venv/Scripts/python.exe scripts/unity-quality.py --output <fresh-owned-quality-output> --unity "C:/Program Files/Unity/Hub/Editor/6000.5.9f1/Editor/Unity.exe" --blender <installed-Blender4.5.14> --powershell <installed-PowerShell7>
```

Expected: mandatory81Editor/37Play cases all passed, no skips, actual FBX/player/two-rig/rendered/relay checks, source fingerprints unchanged and owned process trees terminal. Existing runner's fixed output root is retained; select a fresh child and record why its helper owns that path.
- [ ] **Step 6: Update user/test instructions and current progress.** Explain tests only compile when Test Framework>=1.7.0 is available, ordinary package installation does not add it, developer qualification pins1.7.0. Record bounded Mac baseline25.57–27.61FPS/p9540.5–40.9ms at1093691, remaining Mac regressions and published merged main. Do not expose private artifacts or claim the branch tested on Mac.
- [ ] **Step 7: Commit and run task-done verification.**

```sh
git add unity/com.emotecap.mocap docs
git commit -m "fix: make Unity sample tests optional for normal installation"
```

Retain actual source-bound RED/GREEN,118-case XML and static docs/metadata parity checks; mark ledger completion only after all required evidence exists.
- [ ] **Step 8: Request one fresh whole-branch Native review.** Use the most capable available model and C# reviewer, include spec/plan/review-focus/ledger and frozen actual receipts. Re-grade findings and make one RED/GREEN correction pass if needed. Existing push/draft-PR authorization applies after qualified review; remote merge/tag/release stays separate unless specifically authorized for this branch.
