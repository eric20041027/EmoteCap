# Returned motion: processing phases and Humanoid diagnostics

This advances M4 with actual artifact/pose evidence, without modifying a take, FBX, import setting or production pose/export code. It does not establish anatomical accuracy or approve release. Actor motion and detailed pose arrays remain private.

## Inputs and phase binding

The Mac return for1093691contains907raw frames/26.0928seconds and an actual4,301,836-byte full-skeleton FBX. Frozen Windows package base8bfa037has identical clip/math/contract/player/importer blobs. The first independent Blender oracle compared raw take to returned export and measured60.329degrees/77.807mm difference. That is a mixed processing-phase observation, not an exporter verdict: projectClips/makeClip resamples30fps and applies five-tap offline smoothing; take review displays original frames.

Pinned Node24.19 executes unchanged trusted clip/math/contract modules and reconstructs783processed frames/end26.0667without changing907original frames. Sample reconstruction matches all60actual Mac sample input frames and canonical request SHA exactly. Personal reconstructed request SHA differs from reported actual job SHA. Floating-point runtime differences are a hypothesis, not established cause. Missing actual personal input.json prevents authenticating that reference; the focused Mac handoff now requests existing stored input/clip JSON without recording/export again.

Independent Blender4.5.14 on the named processed candidate and unchanged binary checks783timestamps/52bones: max0.039578degrees/0.109600mm, zero duplicate keys, duration26.1seconds. These candidate-reference measurements are within existing0.5degree/1mm diagnostic tolerance; they are not authenticated actual-input qualification. Raw end, processed end and rounded export duration remain distinct.

## Actual Unity comparison

Unity6000.5.9f1/Newtonsoft3.2.2/TestFramework1.7.0, frozen current package, generated Standard/Tall valid Humanoids and actual production ClipPlayer evaluated roots0/37degrees. Primary mode preserves default FootIK=true; separately labeled false mode isolates its effect. Both references are evaluated at907original timestamps, with processed-candidate interpolation/endpoint hold named.

Reference reflects canonical X per authoritative Unity contract, captures actual target bind geometry, applies parent-first world-delta FK and scaled hips height. It is unsmoothed/ungrounded mathematical pose application, not full grounded/smoothed/networked Live Link or person truth. Global quaternion angles include axial twist/bind orientation/muscle redistribution; a large angle alone is not anatomical error or a visible flip.

Positive controls use actual production coordinate conversion to apply source to target transforms and compare independent FK: all907samples on each rig/root have max0degrees/0.000510mm. Frozen-first-pose negatives reach179.651degrees and at least0.971m, detecting a nonmoving source. Controls pass before comparison is accepted.

All8runs/907samples=7,256poses, with48joint comparisons against two phases, are present. One diagnostic Play test passes with zero skips; this means controls/coverage/finite arithmetic succeeded, not Humanoid fidelity passed.

| Rig | Foot IK | Candidate body max angle | Finger median / max angle | Joint-head max difference | Segment-length max change |
| --- | --- | --- | --- | --- | --- |
| Standard | true/default |53.725deg|36.076/179.696deg|147.154mm|19.927mm|
| Standard | false/diagnostic |53.725deg|36.076/179.696deg|154.566mm|0.000268mm|
| Tall | true/default |53.836deg|36.083/179.625deg|176.153mm|22.312mm|
| Tall | false/diagnostic |53.836deg|36.083/179.625deg|184.220mm|0.000358mm|

Table is root0; root37matches within float differences. Root GameObject translation remains0. Default FootIK measurably changes segment lengths; disabling it largely removes that change but not rotation/head-position differences. This is causal evidence, not a recommendation to silently disable FootIK, and not a physical accuracy threshold.

## Integrity and invalid trials

Private workspace .superpowers/sdd/2026-10-09-observed-retargeting retains input/source/code hashes, raw/candidate Blender receipts, sample identity control, Unity-v4 XML/pose arrays, consumed bytes and owned completions. Package and inputs stayed unchanged. No camera/SDK/provider started; no original file overwritten or actor data publicly published.

Invalid trials are retained separately: v1 assumed prefab contained ClipPlayer, whereas builder adds it to scene instances; v2 used FBX names for canonical rig transforms; v3 used wrong Z reflection in oracle and control, so all its Humanoid metrics are INVALID despite internal control/test success. Independent protocol review caught it; v4 uses independent X-reflection reference and actual production conversion for control. ProjectVersion normalization bookkeeping was corrected before v4. Node native-TypeScript7 compiler-API assumption and initial single-job status parse were preparation errors, not product defects.

## Next required work

Authenticate existing personal job input before final source-fidelity claims. Independently review diagnostic math/controls, separate axial/bind/muscle conventions from geometric differences, then diagnose actual production differences and create a dedicated verified repair. Preserve both FootIK modes; do not suppress import warnings or enable translation DOF just to clean Console.

Mac standard Package Manager/visibility trace/operation responses, support matrix, stationary/stance/finger tracking accuracy, clean Windows/five independent beginners, full native/SDK redistribution and owner-approved release remain pending. Earlier118-case Windows and Mac smoke retain original scope; this analysis replaces no mandatory gate.
