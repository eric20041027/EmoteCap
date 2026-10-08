# Paired Unity Receiver Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the incompatible legacy Unity receiver with a bounded, explicit paired consumer qualified in the actual editor.

**Architecture:** Pure protocol/fragment validation feeds one owned socket loop and the existing latest-frame retargeting. Nonserialized Play-mode pairing prevents scene credential persistence. An isolated local-UPM test project runs actual EditMode/PlayMode tests and retains machine-readable results.

**Tech Stack:** InstalledUnity6000.5.9f1/C#, exactUnity Newtonsoft3.2.2 and TestFramework1.7.0, existing pinned Python local relay/fixtures. No real provider/private video.

**Spec:** `docs/superpowers/specs/2026-10-07-unity-receiver-design.md`.

## Global Constraints

- Canonicalmotionv2/48bones/192rotations unchanged; strict finite/in-place/unit norms[.98,1.02], increasing live time without180second cap.
- Loopback local only;80character pairing code, role=sink hello, secrets only memory, never URL/scene/prefab/error text.
-5second ack/16KiB whole UTF-8 message,2second ordinary reconnect; no automatic retry on policy/protocol expiry.
- Preserve rest/root transforms, hips scaling, smoothing and grounding; invalid target computation preserves last good pose.
- Actual6000.5.9f1 editor/XML results are required; no substitute source-string checks, unrelated projects/editors/GPU tasks or license activation.
- New pinned official JSON/test dependencies only. Unity and dependency license notices are inventory facts, not an owner copyright decision. No publication/main merge/tag/release during plan.
- Continuous Native remains authorized; one fresh most-capable C# whole-plan reviewer, one TDD fix pass/no re-review; preserve ignored scratch.

## Review Focus

1. Disabling/destroying/reconnecting while a receive or hello is pending must prevent stale callbacks from changing status or applying another source's pose.
2. Fragmented/oversized/binary/coerced/nonfinite messages must be rejected before allocation grows or transforms receive invalid values.
3. A code pasted for Play mode must never appear in serialized scene/prefab state or diagnostic text, and ordinary reconnect must not leak ownership.
4. New/null stream hello, bad version/bone order and policy expiry must clear stale pending frames without silently restarting a rejected pairing.
5. Different rest proportions/root rotations and extreme finite hips values must preserve valid pose application without overflowing target transforms.

---

### Task 1: Actual editor gate and strict pure protocol

**Files:** Create `scripts/test-unity.ps1`, `unity/com.emotecap.mocap/Runtime/EmoteCapLiveProtocol.cs`, `Tests/Editor/{EmoteCap.Live.Tests.asmdef,LiveProtocolTests.cs}` plus stablemeta; modify `Runtime/EmoteCapContract.cs`, Runtimeasmdef/package.json; create ignored isolated project in this plan scratch.

**Interfaces:** `PairingCredentials.TryParse(string,out credentials)` validates identity/secret without revealing it in ToString. `LiveProtocol(credentials)` exposes `Parse(string)->LiveMessage`, `HelloJSON()->string`, `Reset()`, stream identity/ack state; `LiveMessage` gains version/bones/sessionId/role/streamId/expiresAt,doublet. `LiveMessageBuffer.Append(byte[],offset,count,end)->string|null` max16KiB, strict UTF-8 decode only after complete assembly, Reset on failure. `test-unity.ps1 -Mode EditMode|PlayMode -ProjectPath <owned> -ResultsPath <owned> -UnityPath <installed> [-Filter ...]` runs hidden batch, waits via owned process/log result and fails without successful XML.

Editor tests own `LiveFixtures`: `TestCredentials()` parses fixed UUIDv4/dummy secret; `ValidHello(streamId)` builds exact sink acknowledgement with canonical bone strings and future expiry; `ValidFrame(t)` emits type/frame,t,h=[0,.95,0],r=[0,0,0,1]x48. These are synthetic fixtures, never actual credentials or recordings.

- [x] **Step1: Establish real editor preflight before code claims.** Save minimal explicit project manifest with local package/testables and pinned framework; invoke installed editor batch/nographics/createProject or import at that resolved owned path. Expected: license/packages/compiler available; otherwise report exact blocker and continue independent later milestones without claiming tests. Do not open a previous user project.
- [x] **Step2: Write actual behavior RED.** Add Editor tests and only loadable protocol characterization shapes if needed; watch exact intended assertions fail in XML.

```csharp
[Test] public void FrameBeforeAcknowledgementIsRejected() {
    var protocol=new LiveProtocol(TestCredentials());
    Assert.Throws<LiveProtocolException>(()=>protocol.Parse(ValidFrame(181)));
}
```

Also pin UUID/code limits, secret-free serialization, role/session/bone/version/extra/duplicate rejection, numeric bool/string/NaN/overflow, unitnorm/hips/timeline, null/newstream reset, split UTF-8 and exactly16KiB/binary boundaries. Run actual EditMode via test-unity helper; Expected behavior failures, not compiler/import/license failures.
- [x] **Step3: Implement minimal strict codec.** Use bounded UTF-8 bytes first, JsonTextReader MaxDepth8/DateParseNone plus JToken strict field/token types and DuplicatePropertyNameHandling.Error; no polymorphic deserialization. Validate hello before storing state; validate frame numbers before float conversion; preserve increasingdoubletime, clear stream state on every new/null hello. Build sink hello from known canonical bone names with secret only in that outbound message.

```csharp
if(bytesCount+count>16384)throw new LiveProtocolException("Live message is too large");
if(token.Type!=JTokenType.Integer&&token.Type!=JTokenType.Float)throw new LiveProtocolException("Invalid live number");
```

- [x] **Step4: Verify/commit.** Actual whole EditMode XML zero failures, Python fast parity and Web types; Expected all pass/real Blender deselected. Commit `feat: validate paired Unity Live Link messages`; task-done repeats actual EditMode helper. Do not claim2021.3 compatibility from a6000.5 run.

### Task 2: Owned runtime receiver and memory-only pairing

**Files:** Modify `Runtime/EmoteCapLiveLink.cs`; create `Runtime/EmoteCapLiveTransport.cs`, `Editor/EmoteCapLiveLinkEditor.cs`, `Tests/Runtime/{EmoteCap.Live.Runtime.Tests.asmdef,LiveReceiverTests.cs,ReceiverRigFactory.cs}`; extend Editor tests; add metas.

**Interfaces:** `ConnectPairing(string)->bool`, `StopPairing()`, `Status`, memory-only code/state and monotonically increasing generation. Existing bind/SetTargets/LateUpdate remain the pose application boundary. One CancellationTokenSource/ClientWebSocket/Task owns receive/reconnect; disable/destroy/explicitnewConnect abort and cancel own resources. Inspector runtime controls never serialize pairing. Protocol and bounded fragment buffer feed volatilelatest only after acceptance.

Produces readonly `ConnectionGeneration`, `AcceptedFrameCount`, `LastFrameTimestamp` for diagnostics/behavior assertions. `ILiveTransport` provides cancellation-aware `ConnectAsync(Uri)`, `SendAsync(string)`, `ReceiveAsync()->string|null`, close code, Abort/Dispose; production `WebSocketLiveTransport` owns the16KiB assembler, tests supply controlled async completions. Runtime test assembly has explicit internal access, not a public network bypass.

Runtime tests own `CreateTestReceiver()`: ReceiverRigFactory creates an original minimal T-pose Humanoid hierarchy with required body joints, a HumanDescription/AvatarBuilder avatar and Animator, then attaches the component with a controlled transport. `InjectLateFrame(receiver,generation,json)` completes that test transport's pending receive after disable/reconnect; it cannot bypass the actual codec/generation checks. `WaitForAcceptedFrame(receiver)` yields frames with a5second test deadline and fails if the counter stayszero. The factory is test-only; two redistributable sample rigs/FBX playback remain the following quality gate.

- [ ] **Step1: Write PlayMode/lifecycle RED.** Use explicit injected local transport only for controllable stalls, actual Unity GameObjects/Animator data and real codec; no string scanning as behavioral proof.

```csharp
[UnityTest] public IEnumerator DisableRejectsLateFrame() {
    var receiver=CreateTestReceiver();var generation=receiver.ConnectionGeneration;
    receiver.enabled=false;InjectLateFrame(receiver,generation,ValidFrame(1));
    yield return null;Assert.That(receiver.AcceptedFrameCount,Is.EqualTo(0));
}
```

Also Stop/destroy/new Connect while ack/receive pending, no retry on1008/bad ack,2snormal reconnect/5sdeadline, secrets absent from EditorJsonUtility scene serialization/status, fragment/binary limits, latest-frame replacement, stream reset and target overflow preserving previous transform. Run actual filtered PlayMode; Expected failures inspected.
- [ ] **Step2: Implement lifecycle/Inspector.** Explicit Play-mode pairing, nonserialized strings/credentials, generation-guarded callbacks, safe constant status; owned cancellation/socketAbort/dispose and bounded read deadlines, verified hello before frames. Use latest pose only; finite retarget/height calculations. Preserve original pose math and user ground/smoothing options.

```csharp
if(generation!=connectionGeneration||!isActiveAndEnabled)return;
var frame=protocol.Parse(json);if(frame.type=="frame")latest=frame;
```

- [ ] **Step3: Verify/commit.** Actual whole EditMode+PlayMode, Python fast and Web types; Expected all pass. Commit `feat: pair and stop the Unity receiver with owned lifecycle`; task-done repeats actual PlayMode helper.

### Task 3: Local relay interoperability and consumer documentation

**Files:** Create `scripts/unity-relay-test.py`, interoperability PlayMode tests and receiver documentation; modify UPMREADME/package metadata, Studio pairing hint, docs/development/release-progress; create durable report.

**Interfaces:** Owned test relay binds an explicit unused loopback port, uses temporary settings/no jobs/provider, exposes paired protocol plus synthetic shared fixtures. Helper reports ownedPID/port/fixtureSHA and closes only that service after editor tests. Real Unity client sends sink hello, receives new/null stream and fixtureframes, stops on expiry/revoke and survives ordinary reconnect. No camera or paid SDK.

- [ ] **Step1: Write/run interoperability RED.** Start only owned local relay and actual editor tests; assert wrong/old code never drives pose, valid ack/fixture delivery, source ownership isolation, newstream reset, expiry/no-retry and disable closing sink. Expected missing integration behavior fails explicit XML assertions, not service unavailability.

```csharp
[UnityTest] public IEnumerator PairedRelayDeliversOnlyItsFixture() {
    var receiver=CreateTestReceiver();Assert.IsTrue(receiver.ConnectPairing(TestRelayCode));
    yield return WaitForAcceptedFrame(receiver);
    Assert.That(receiver.LastFrameTimestamp,Is.GreaterThanOrEqualTo(0));
}
```

- [ ] **Step2: Complete helpers/docs.** Document Play mode→paste→Connect, defaultoff/local-only/expiry/Stop and source/Avatar/controller troubleshooting; update Studio hint in the same increment. Record actual editor/framework/JSON versions/testcounts/sourceSHA, unused/unsupported2021.3 status and remaining two-rig/FBX/physical/laptop gates. Editor availability cannot make those gates pass.
- [ ] **Step3: Verify/commit/review.** Actual EditMode/PlayMode+interop XML zero failures, full544+backend suite, wholeWeb/types/assets/build and impacted Edge pairing flows. Expected all pass; original take data unchanged/no secret in assets. Commit `test: qualify paired Unity relay interoperability`; task-done repeats whole actual editor gate. Dispatch one fresh most-capable C# whole-plan reviewer with exact plan/spec/ReviewFocus/ledger, no subagents/browser overwrites. One TDD correction pass Important/Critical; no re-review. Continue directly to real Blender/two-rig quality and M5.

