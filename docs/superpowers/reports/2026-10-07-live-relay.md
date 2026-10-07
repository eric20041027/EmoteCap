# M3 paired local Live Link

Date2026-10-07. Branch feat/studio-projects; plan base596405e after accepted media review correction. [Spec](../specs/2026-10-07-live-relay-design.md), [plan](../plans/2026-10-07-live-relay.md), [contract](../../../contracts/live-link-v1.md). Full M1–M5 remains active; Unity consumer/runtime qualification is next, so this report does not close M3 or release readiness.

## Behavior and evidence

Studio defaults off. Explicit Enable creates a local in-memory pairing with separate256bit source/sink secrets; the code is copied into Unity. The service checks trusted loopback Origin/Host, exact motionv2/bones, finite canonical poses and an authenticated hello before admitting frames. Four one-hour sessions, one source/four sinks each,5second hello and16KiB text limits bound admission. Competing sources cannot replace the owner; pairings never mix frames. Body-free create and source-authorized revoke keep credentials out of URLs/logs/project backups.

Every receiver has one latest pending frame, separate hello/control and one writer. Source processing never waits for a receiver send; stalled/broken send closes that receiver after0.5seconds. New source hello precedes its poses and clears stale pending data. Owned source/receiver tasks are cancelled on revoke/expiry/shutdown; registration is removed before awaited teardown and close attempts are bounded. No unrelated processes/resources are stopped.

The browser waits for exact acknowledged identity/version/bones before streaming, including a5second deadline if the socket never opens. Ordinary closures reconnect after2seconds; policy/protocol failures stop automatic retries. It drops buffered/invalid frames, uses connection-relative increasing timestamps without rewriting take time and preserves pose numeric precision. Source management is serialized across quick Stop/restart; late creation is revoked. Unconfirmed creation warnings survive later cleanup, and up to4known failed revocations expose code/expiry with explicit retry while source authorization stays private in memory.

Verification:

- Watched65protocol/session failures before implementation, then two huge-number overflow failures; strict validation, admission, permissions, exact frame text/order, competing source, independent sessions, source reconnect, bounded missing hello and connected expiry pass.
- Watched6slow/lifecycle failures: source coupling, no latest slot, stalled hello, orphaned idle tasks and close stalls. Independent delivery,1000unsent-frame replacement/control ordering, broken receiver survival, targeted revocation and bounded shutdown pass. Framework cancellation exposed a registration leak; removing admission before awaited cleanup preserves the original disconnect regression.
- **542Python fast cases pass**,2real-Blender cases deselected. No actual Unity/camera/provider call; transport scenarios use real async fake stalls, TestClient sockets and temporary settings/data. Existing Starlette/httpx warning remains.
- Watched28/29initial Web failures and2actual Edge missing-UI failures before client implementation. Added watched failures for never-open socket timeout and an uncertain creation warning being erased. **458Web cases/47files,8Node asset/security, types,3modelSHA and181-module production build pass**.
- **19/19actual Edge154.0.4258.62 workflows passed**, including2new pairing cases. They verify no creation/model/camera before explicit toggle, pending-ack versus streaming, copyable code, Stop→DELETE and visible409failure. WebSocket/provider HTTP are mocked; no Unity latency/hardware claim follows. Existing Studio/jobs/media/capture/production workflows still pass.
- Main bundle>500kB/Three shadow fallback and runner color warnings remain. Browser output represents the latest run; RED/full qualification logs remain in plan scratch. One fresh final independent review is pending; Native task-done repeats the full Web gate.

## Rulings made

1. Continue already-authorized Native without a routine handoff. Cost if wrong: decisions remain steerable before publication.
2. Split service/browser protocol from the immediately following Unity consumer/rig plan. Cost if wrong: the old unpaired receiver is temporarily incompatible and M3 cannot close until updated.
3. Support same-computer loopback with independent high-entropy role secrets. Cost if wrong: separate-machine users need a future explicit network design.
4. Preserve earlier policy-blocked scratch. Cost if wrong: ignored local diagnostics remain.
5. Use absolute loopback TestClient socket URLs; its relative WebSocket resolver independently uses testserver. Cost if wrong: tests name the exact host, production Origin/Host guards remain strict.
6. Replace insecure unpaired/chat forwarding expectations with handshake/rejection while preserving exact frames/order/healthy disconnection. Cost if wrong: legacy clients must update; broken/slow tests belong to delivery.
7. Keep coupled bounded sends only for the intermediate protocol increment, then replace them in Task2. Cost if wrong: Task1 alone does not establish final relay readiness.
8. Separate latest frame/control with one writer. Cost if wrong: an intermediate unsent pose is intentionally replaced.
9. Track/cancel only admitted owner tasks and bound one close attempt. Cost if wrong: non-cooperative third-party awaitables cannot be forcibly killed; supported ASGI/cooperative stalls are tested.
10. Unregister synchronously and clear close bookkeeping in nested finally. Cost if wrong: admission count changes before the bounded physical close finishes.
11. Serialize browser creation/revocation and keep up to4known failed codes/private authorizations for explicit retry; uncertain creations remain warned. Cost if wrong: a restart can wait for bounded cleanup, and unconfirmed operations require expiry/service restart.
12. Preserve full pose JSON precision, round only monotonic wire time. Cost if wrong: slightly larger frames remain under16KiB; rounding pose quaternions could reject valid boundary norms.
13. Start the acknowledgement deadline at socket construction, not onopen. Cost if wrong: slow local transport establishment requires explicit retry rather than indefinite connecting.
14. Scope mocked browser acknowledgement to the actual /ws/live source socket and wait for its hello; Vite also opens a development socket. Cost if wrong: test setup depends on endpoint identity, with strict production acknowledgement unchanged.

Deferred minors: none before review. Real Unity receiver/fragment bounds, two rigs, Blender export direction/scale/timing, authorized video/laptop measurements, clean-machine/new-user study, rights/notices and owner-approved publication remain pending. No public push/main merge/tag/release occurred for this work.
