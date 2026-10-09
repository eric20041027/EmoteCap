# Optional Unity test dependencies: actual installation qualification

This fixes a concrete onboarding failure from the Mac return: importing the unchanged Starter Rigs tests into a fresh project without Unity Test Framework caused NUnit/UnityTest compilation errors. Ordinary sample use now compiles without that developer dependency; development qualification still executes the full original test matrix.

The four package/sample test asmdefs add an `EMOTECAP_TEST_FRAMEWORK` version define for `com.unity.test-framework`1.7.0or later and a matching compilation constraint. Package0.2.0/Unity6000.5/Newtonsoft3.2.2, all test code/GUIDs, fixture/animation/geometry, licenses and runtime/editor production code remain unchanged. Test Framework is not added to production dependencies. Conditional resource compilation follows the [Unity assembly definition documentation](https://docs.unity.com/en-us/engine/6000.0/manual/programming-environment/script-compilation/assembly-definition-files/file-format); actual Editors, not a JSON-only check, are the gate.

## Actual verification

Windows Unity6000.5.9f1 was run against fresh frozen package copies and independently owned projects, with no Test Framework dependency in their resolved lockfiles:

| Case | Result |
| --- | --- |
| Original source, package tests opted in, framework absent | Real RED: exit1, NUnit/UnityTest compiler errors, no success receipt |
| Patched source, package tests opted in, framework absent | GREEN: exit0, zero compiler errors, both generated Avatars valid Humanoid, no EmoteCap test assembly loaded |
| Patched source, normal sample installation, framework absent | GREEN: same two-rig compilation/creation checks, no framework in resolved lock |
| Framework1.7.0 present, original qualification manifest | **81Editor/37Play passed**, zero skips; actual Blender4.5.14 exports, two-rig FBX/player/rendered checks and real paired local relay |

Consumed source/package fingerprints stayed unchanged during each execution; all owned process trees/relay terminal. The private probe's first API-preparation failure and sandboxed Editor crash were retained separately and excluded from product RED. The successful outside-sandbox runs use the already activated Editor; no new account/login/license acceptance occurred.

Evidence is retained privately in `.superpowers/sdd/2026-10-09-unity-sample-installation/` (brief, ledger, probe source, real RED/GREEN logs/receipts). Final absence cases are green-opt-in-final and green-normal-final. The existing qualification helper owns the fresh `.superpowers/sdd/2026-10-08-unity-quality/2026-10-09-installation-green-2/` child (source snapshot, exports,81/37XML, rendered images, ownership/completion). The earlier first pass is retained; after restoring the original compact asmdef formatting/LF, the final bytes were requalified. Private verification confirms these frozen package bytes match the current package and only the four declared test definitions plus sample documentation changed; original fixtures/licenses/GUIDs remain identical. Runs started from base1093691with documented working-tree source fingerprints; the old base's unmodified bytes do not contain the fix.

The unchanged qualification-runner regression suite also passes44cases. Its first sandbox attempt had39temporary-directory setup errors; a fresh in-workspace pytest base directory resolved that environment limitation. No product failure was hidden or mislabeled as a pass.

## Mac evidence and remaining scope

The returned1093691MacBook Pro13-inch2022/M2/16GB/macOS26.5.2 package had181files; supplied ZIP SHA256 `286bae8efce439b5b560f26b368e7a95020e484be7e89c0313d03d7383a423b1` and all180listed content digests matched. Source/lock/model/instrumentation digests matched the fixed commit. Independent raw-attempt arithmetic reproduced three observed Fast/no crop/full/Medium/calibrated/delivered1280x720GPU laptop runs: effective FPS25.5749–27.6143, median27.5200; p95detection-to-render-call40.5–40.9ms, median40.6. Qualification remains pending, with no invented performance threshold. The fourth completed short/uncalibrated receipt and three counter-reset incomplete receipts remain excluded from that baseline.

Sample60frames and personal907frames/26.0928s survived backup/reload checks; import kept frames/clips and changed project identity. Mac Blender export/reimport, Standard/Tall basic playback and Standard Live Link receiving/stop/new pairing have scoped evidence. Actor motion/images/raw logs stay private; no public release is implied.

This repair has not yet run on the Mac or through its previously blocked Package Manager floating-window route. New fixed-source Mac installation regression remains required. Visibility interruption and Humanoid translation-discard warnings are separate unresolved findings; the natural-lowering screenshot requirement was a handoff defect because the bundled fixture is a raise-only sequence, and the sample guide now explains its actual phases. Physical accuracy, full protocol coverage, clean second Windows machine, five independent new users, native/SDK redistribution and owner-approved formal release remain separate gates.
