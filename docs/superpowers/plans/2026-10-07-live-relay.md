# Controlled local Live Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pair local Studio and Unity streams explicitly, reject mismatched/competing sources and isolate slow receivers.

**Architecture:** An in-memory bounded session registry authenticates hello messages before allocating source/sink ownership. Each sink independently sends its bounded latest-frame slot; the browser requires the server acknowledgement and exposes pairing/revocation state. The Unity receiver consumes the new contract in the next Unity quality plan.

**Tech Stack:** Existing pinned FastAPI/Starlette/Python3.12.14, React/TypeScript/Vitest/Playwright1.62.1; no new dependency.

**Spec:** `docs/superpowers/specs/2026-10-07-live-relay-design.md`.

## Global Constraints

- Motion remainsv2,48 canonical driven bones,192 rotation values, in-place hips and quaternion norm[0.98,1.02]. Live uptime is not limited to180seconds.
- Loopback same-computer support only. Source requires trusted Origin/Host; native sinks require role-separated256-bit secrets.
- Four sessions,3600-second monotonic lifetime, one source/four sinks per session;5s hello,16KiB text,0.5s sink-send deadline, one latest pending frame plus separate hello.
- Browser64KiB buffered cutoff,2s reconnect,5s HTTP/ack deadlines,64KiB HTTP responses. Credentials only in memory/hello/header, never URLs/project/diagnostic logs.
- Preserve all existing project/media/export behavior. Actual Unity receiver/playback qualification is the next plan, explicitly pending here.
- Reuse feature worktree; continuous Native authorization covers local work. No public write/tag/release, unrelated process termination, private video or scratch deletion.

## Review Focus

1. A stale source socket, delayed hello or concurrent second source must not displace the owner or mix streams across pairing sessions.
2. A receiver stalled during hello, frame delivery or shutdown must not block capture or grow an unbounded message queue.
3. Stop/restart while session creation or acknowledgement is pending must not turn Live Link back on or hide an unrevoked pairing code.
4. A malformed numeric pose, oversized Unicode message, missing Origin or wrong protocol/bone order must fail before driving any sink.
5. Expired/revoked sessions, ordinary reconnects and service shutdown must release owned clients while preserving other sessions and original take timestamps.

---

### Task 1: Authenticated bounded session protocol

**Files:** Create `server/emotecap_server/live/{__init__,protocol,sessions,api}.py`, `server/tests/test_live_sessions.py`, `test_live_protocol.py`; modify `server/emotecap_server/relay.py`, `main.py`, `server/tests/test_relay.py`; create `contracts/live-link-v1.md` and update `contracts/motion-v1.md`.

**Interfaces:** `LiveRelay(clock=time.monotonic,wall_clock=time.time,send_timeout=.5,hello_timeout=5)` owns `sessions:SessionRegistry`, `serve(websocket,role)`, `aclose()`. `SessionRegistry.issue()->PairingSession`, `authenticate(id,token,role)->Session`, `revoke(id,sourceToken)->Session`, `prune()->list[Session]`; session carries deadline/source/sinks/streamId and public metadata. `parse_hello(text,role)->Hello` and `validate_frame(text,last_t)->float` reject strict invalid fields/numerics and16KiB UTF-8 first. API calls only the installed `main.relay`, guarded by loopback Host and trusted Origin. Existing global relay injection remains supported by TestClient fixtures.

- [ ] **Step1: Write failing behavior tests.** Use injected clocks/temp-settings/fake sockets. Replace intentionally insecure legacy relay expectations with explicit handshakes; do not remove frame/order/healthy-source checks.

```python
def test_second_source_never_replaces_owner(client):
    session=issue_session(client)
    with connect_sink(client,session) as sink,connect_source(client,session) as owner:
        with pytest.raises(WebSocketDisconnect):
            with connect_source(client,session): pass
        owner.send_text(frame_text(181))
        assert json.loads(sink.receive_text())['t']==181
```

Also cover role-separated tokens, expiry/revocation/capacity, wrong/missing/remote Origin/Host, strict version2/exact bones/UUID, binary/16KiB UTF-8/malformed numeric frames, missing hello/timeout, separate sessions and source reconnect hello. Source timestamp181passes; original export180s validation stays unchanged.
- [ ] **Step2: Watch RED.** Run `uv run --directory server --frozen --python 3.12.14 pytest tests/test_live_sessions.py tests/test_live_protocol.py tests/test_relay.py -q` captured in this plan scratch. Expected: new sessions/strict handshake/ownership behavior absent; failures inspected before implementation. Only loadable characterization stubs if imports prevent behavior assertions; never commit stubs.
- [ ] **Step3: Implement admission and ownership.** Exact protocol validation and loopback API, generated independent secrets, constant-time comparisons, bounded sessions/deadlines, acknowledgement-before-frame, per-session source/sink ownership and explicit204revoke. Preserve accepted frame text. No field coercion or raw input in errors/logs.

```python
hello=parse_hello(await asyncio.wait_for(read_text(websocket),5),role)
session=registry.authenticate(hello.session_id,hello.token,role)
if role=='source' and session.source is not None:
    raise PolicyViolation('This pairing already has a source')
```

- [ ] **Step4: Verify/commit.** Same focused command then full `uv run --directory server --frozen --python 3.12.14 pytest -q -m "not slow"`; Expected all pass,2 real Blender deselected. Contract includes incompatible legacy unpaired receiver, all limits/close behavior. Commit `feat: authenticate and isolate local Live Link sessions`; task-done repeats full fast backend.

### Task 2: Independent bounded latest-frame workers

**Files:** Modify `server/emotecap_server/relay.py`, `live/sessions.py`; create `live/delivery.py`, `server/tests/test_live_delivery.py`; extend `test_relay.py` and shutdown tests.

**Interfaces:** `SinkDelivery(socket,session,send_timeout)` provides `offer_hello(text,stream_id)`, `offer_frame(text,stream_id)`, async `run()` and `aclose()`, at most one pending frame, separate control and one writer. `LiveRelay.broadcast(session,text)` only offers; source never awaits send. Session/source disconnect changes hello before new frames; teardown closes owned sockets/workers with bounded deadlines.

- [ ] **Step1: Write RED.** Real async fake sends: stalled sink's hello/frame, broken sink, fast healthy sink,1000incomingframes while stalled, source reconnect control ordering, revocation/shutdown. Tests assert healthy delivery before0.5s slow timeout and pending frame count<=1, not just mock call counts.

```python
async def scenario():
    slow,healthy=BlockedSink(),RecordingSink()
    relay=paired_relay(slow,healthy)
    await relay.broadcast(session,frame_text(1))
    await asyncio.wait_for(healthy.frame_received.wait(),.1)
    assert slow.pending_frames<=1
```

- [ ] **Step2: Watch RED.** `uv run --directory server --frozen --python 3.12.14 pytest tests/test_live_delivery.py tests/test_relay.py -q`; Expected old gather/send prevents healthy source progress or lacks bound/lifecycle. Inspect timeout failures, no actual network/private poses.
- [ ] **Step3: Implement latest slot/control.** Separate hello and latest frame, writer snapshots generation, sends hello first, skips stale generation frames, wraps each send in0.5s deadline; clears pending memory and unregisters on failure/cancel. Cancellation is propagated and bounded socket close cannot await forever.

```python
delivery.offer_frame(text,session.stream_id) # replacement, never an awaited network write
await asyncio.wait_for(socket.send_text(next_text),timeout=send_timeout)
```

- [ ] **Step4: Verify/commit.** Focused command then full backend fast suite; Expected all pass. Commit `fix: isolate slow Live Link receivers with bounded delivery`; Native task-done repeats full backend.

### Task 3: Studio pairing and acknowledged browser source

**Files:** Modify `web/src/live/{liveLink.ts,liveLink.test.ts,useLiveLink.ts,LiveLinkToggle.tsx,LiveLinkToggle.css}`, `web/src/App.tsx`, `web/playwright.config.ts`; create `web/src/live/{sessionsApi.ts,sessionsApi.test.ts,LiveLinkPanel.tsx}`, `web/e2e/live.spec.ts`, `docs/superpowers/reports/2026-10-07-live-relay.md`; update release-progress/development and protocol docs.

**Interfaces:** `createSession(options)->Promise<PairingSession>` and `revokeSession(session,options)->Promise<void>` use existing bounded HTTP, validate canonicalUUID/secrets/code/expiry. `LiveLinkSender` gains asynchronous session acquisition, `SocketLike.onmessage`, acknowledgement/cancellation generation, `getSnapshot()/subscribe` returning `{status,pairingCode,expiresAt,error}` with stable snapshots; states `off|connecting|live|error`. `start/stop/send(frame)` remain hook integration; injectable now defaults performance.now. Stop closes synchronously and requests revoke, late creation is revoked, failures surface. `useLiveLink` uses the snapshot and exposes pairing to panel; input frame never mutated.

- [ ] **Step1: Write RED.** Fake sockets/send and controlled deferred session promises, strict server ack, policy rejection/expiry, uncooperative HTTP, Stop/restart latecallbacks, >64KiB drop, bad pose drop, monotonic t despite replayed take t, frames blocked before ack, ordinary reconnect requiring new ack. API requires no key/token in URL. Actual Edge test has0session/model/camera requests at boot/sample; Toggle→mocksession/WebSockethello→matchingack shows code/status, Stop→DELETE and cannot late-reactivate; failure visible and keyboard-copy field usable.

```typescript
it('waits for a matching acknowledgement before sending',async()=>{
  sender.start();await sessionReady();socket.open();
  expect(sender.send(tposeFrame())).toBe(false);
  socket.message(validAck(session));
  expect(sender.send(tposeFrame())).toBe(true);
});
```

- [ ] **Step2: Watch RED.** Focused `node node_modules/vitest/vitest.mjs run src/live` then Edge `live.spec.ts`; Expected old unpaired automatic-live behavior fails. Point latest browser output to this plan before the first browser run.
- [ ] **Step3: Implement acknowledged source/UI.** Session acquisition and generations; live-only send after verified version/bones/identity;5sack timer and ordinary2sreconnect, policy rejection halts; canonical monotonic wire t, validated numeric pose, bounded rounded JSON. Source secret only hello; visible pairing/expiry/revocation failure and copyable readonly field; no camera/model start on toggle.

```typescript
if(socket!==this.socket||generation!==this.generation)return;
if(!matchingAck(data,session))return this.reject('Live Link handshake failed');
this.setSnapshot({...this.snapshot,status:'live',error:null});
```

- [ ] **Step4: Verify/commit.** Full backend fast; full Vitest;8Node asset/security; types;3assetSHA; Vite build; all actual Edge journeys. Expected all green, legacy Unity consumer still explicitly pending. Commit `feat: expose paired and acknowledged Studio Live Link`; Native task-done repeats full Web gate. Assemble fixed BASE..HEAD review package and dispatch one fresh most-capable whole-plan reviewer with TS/Python protocol expertise, no browser overwrite or actual SDK/hardware. One TDD fix pass for Important/Critical, no re-review. Preserve earlier rejected scratch. Continue directly into Unity quality and M5; do not mark full objective complete.

