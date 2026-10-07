# Paired Unity receiver and actual editor qualification

This immediate consumer increment completes the compatibility side of M3 and prepares M4's animation/rig qualification. Parent product/Live Link specs remain binding; Native continuous local execution and one fresh final review are authorized. Actual editor tests cannot be replaced by source parity or mocked browser tests.

## Contract and user workflow

Unity consumes [paired local Live Link v1](../../../contracts/live-link-v1.md): loopback same-computer connection, copied80character pairing code (canonicalUUIDv4 dot43base64url sink secret), exactv2/48bones/192quaternions,5second acknowledgement,16KiB UTF-8 whole-message limit, finite in-place poses and increasing per-stream time. Native hello uses role=sink, no secret in URL. Verify role/session/bones/version, reject binary/extra/duplicate/nonfinite/coerced fields and ignore no frames before compatible acknowledgement. New streamId clears pending old frame/timing; nullstream means waiting for Studio. Normal disconnect retries2seconds; policy/protocol/expired pairing stops retry until explicit new Connect.

Enter Play mode, paste the code in the receiver Inspector or runtime controls and press Connect. Pairing fields are nonserialized, so scene/prefab/project files never contain credentials and domain reload does not require a persistent editor cache. Default state is disconnected. Stop, component disable, destroy and a new Connect cancel/abort only this receiver's owned socket/loop; late callbacks cannot change status or apply poses. Status/errors are bounded constants and never echo credentials/peer messages.

Preserve existing canonical conversion, restWorld/rootRest retargeting, hips proportional scale, smoothing/grounding and optional missing bones. Invalid/overflowed target computation must preserve the last usable pose. Hold last displayed pose when source disconnects, clear pending old source data, and require the new compatible hello before applying another pose. Avatar/controller requirements stay explicit.

## Boundaries and dependencies

- `Runtime/EmoteCapLiveProtocol.cs` owns pure wire/code validation and bounded fragment assembly; `EmoteCapLiveLink.cs` owns Unity lifecycle/retargeting/socket, `EmoteCapContract.cs` adds wire fields only without bone/version changes.
- `Editor/EmoteCapLiveLinkEditor.cs` provides nonserialized Play-mode code input/Connect/Stop and clear status. Package Documentation/README and Studio hint show the same order.
- Add exact Unity official `com.unity.nuget.newtonsoft-json:3.2.2` for typed JSON tokens/duplicate-field rejection rather than JsonUtility coercion or a handwritten JSON parser. Runtime assembly references Unity.Newtonsoft.Json. Its licenses/notices enter the M5 inventory; no SDK/provider/key/third-party character dependency.
- A saved isolated test project uses local UPM and exact `com.unity.test-framework:1.7.0` (or installed builtin framework if metadata proves a different required version, ruled before use); no unrelated Unity project is opened or modified. Installed6000.5.9f1 is the actual test target; older2021.3 support is unqualified until separately tested.
- Test project/runtime logs are ignored and retained. Editor helpers launch hidden/batch/nographics, log/results in this plan's workspace, guard resolved project paths and own processes. Never activate a paid license, accept terms, kill an unrelated editor/GPU task or fabricate editor success.

## Acceptance

Actual EditMode tests verify code/hello/frame/UTF-8/fragment limits, strict types/duplicates/finite numeric boundaries, version/bone/session rejection, stream reset and nonserialization. Actual PlayMode tests verify receiver lifecycle and local relay interoperability using synthetic fixtures (no camera/cloud). A test project XML result with zero failures and actual editor/version evidence is required. Two redistributable procedural humanoid rigs, real Blender FBX direction/scale/timing and authorized physical video/laptop measurements are the following M4 quality plan; they remain required gates after this consumer increment.

Primary documentation checked2026-10-07: [Unity Newtonsoft3.2.2](https://docs.unity3d.com/Packages/com.unity.nuget.newtonsoft-json@3.2/manual/index.html), [test command-line1.7.0](https://docs.unity3d.com/Packages/com.unity.test-framework@1.7/manual/reference-command-line.html), [package test assemblies](https://docs.unity3d.com/6000.0/Documentation/Manual/cus-tests.html), [6000.5 editor arguments](https://docs.unity3d.com/6000.5/Documentation/Manual/EditorCommandLineArguments.html).

