# M3 paired local Live Link

Date2026-10-07. Branch feat/studio-projects; plan base596405e after accepted media review correction. [Spec](../specs/2026-10-07-live-relay-design.md), [plan](../plans/2026-10-07-live-relay.md), [contract](../../../contracts/live-link-v1.md). Full M1–M5 remains active; Unity consumer/runtime qualification is next, so this report does not close M3 or release readiness.

## Behavior and evidence

Studio defaults off. Explicit Enable creates a local in-memory pairing with separate256bit source/sink secrets; the code is copied into Unity. The service checks trusted loopback Origin/Host, exact motionv2/bones, finite canonical poses and an authenticated hello before admitting frames. Four one-hour sessions, one source/four sinks each,5second hello and16KiB text limits bound admission. Competing sources cannot replace the owner; pairings never mix frames. Body-free create and source-authorized revoke keep credentials out of URLs/logs/project backups.

Every receiver has one latest pending frame, separate hello/control and one writer. Source processing never waits for a receiver send; stalled/broken send closes that receiver after0.5seconds. New source hello precedes its poses and clears stale pending data. Owned source/receiver tasks are cancelled on revoke/expiry/shutdown; registration is removed before awaited teardown and close attempts are bounded. No unrelated processes/resources are stopped.

The browser waits for exact acknowledged identity/version/bones before streaming, including a5second deadline if the socket never opens. Ordinary closures reconnect after2seconds; policy/protocol failures stop automatic retries. It drops buffered/invalid frames, uses connection-relative increasing timestamps without rewriting take time and preserves pose numeric precision. Source management is serialized across quick Stop/restart; late creation is revoked. Unconfirmed creation warnings survive later cleanup, and up to4known failed revocations expose code/expiry with explicit retry while source authorization stays private in memory.

Verification:

- Watched65protocol/session failures before implementation, then two huge-number overflow failures; strict validation, admission, permissions, exact frame text/order, competing source, independent sessions, source reconnect, bounded missing hello and connected expiry pass.
- Watched6slow/lifecycle failures: source coupling, no latest slot, stalled hello, orphaned idle tasks and close stalls. Independent delivery,1000unsent-frame replacement/control ordering, broken receiver survival, targeted revocation and bounded shutdown pass. Framework cancellation exposed a registration leak; removing admission before awaited cleanup preserves the original disconnect regression.
- **544Python fast cases pass** after the review correction,2real-Blender cases deselected. No actual Unity/camera/provider call; transport scenarios use real async fake stalls, TestClient sockets and temporary settings/data. Existing Starlette/httpx warning remains.
- Watched28/29initial Web failures and2actual Edge missing-UI failures before client implementation. Added watched failures for never-open socket timeout and an uncertain creation warning being erased. **458Web cases/47files,8Node asset/security, types,3modelSHA and181-module production build pass**.
- **19/19actual Edge154.0.4258.62 workflows passed**, including2new pairing cases. They verify no creation/model/camera before explicit toggle, pending-ack versus streaming, copyable code, Stop→DELETE and visible409failure. WebSocket/provider HTTP are mocked; no Unity latency/hardware claim follows. Existing Studio/jobs/media/capture/production workflows still pass.
- Main bundle>500kB/Three shadow fallback and runner color warnings remain. Browser output represents the latest run; RED/full qualification logs remain in plan scratch. Native task-done repeated and passed the full Web gate. Fresh independent review found one Important issue, no Critical/Minor; the single TDD correction pass is complete, no re-review.

## Independent review and correction

Fresh gpt-6-astra reviewer checked fixed596405e..d5318b8 read-only and passed80focused backend cases. An injected-clock probe and a short real-monotonic deadline/event-loop-pause probe both reproduced a queued pose being initiated after expiry behind a stalled hello. The reviewer called it medium Important and approved the branch; the executor retains Important by its effect on the promised expiry behavior and fixes it before accepting this subsystem.

`test_queued_frame_behind_stalled_hello_is_never_sent_after_expiry` and `test_send_timeout_never_extends_the_remaining_pairing_lifetime` both failed before the correction. Delivery now checks active monotonic lifetime before/after waking and control delivery, at the child send's actual entry, and caps each send by remaining lifetime. Expiry closes1008 instead of being treated as an ordinary slow receiver. The post-fix whole544Python/458Web suites pass;8Node/types/3SHA/build/19Edge evidence remains the unchanged browser bundle's completed Native qualification. This closes service/browser review only, while the Unity consumer remains required.

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
15. Treat the reviewed medium Important expiry race as an acceptance fix. Cost if wrong: a send initiated while valid can still arrive later; already transmitted bytes cannot be withdrawn, but no new queued send starts after expiry.
16. Reviewer declined Unity compatibility/editor/two-rig playback; carry the immediate consumer plan and leave M3 incomplete. Cost if wrong: browser/service tests cannot establish actual Unity behavior.
17. Reviewer declined physical camera/provider/Blender/FPS/latency; retain required runtime/hardware measurements. Cost if wrong: simulated transport evidence cannot qualify those environments.
18. Reviewer declined LAN/cloud/malicious same-user software; retain the explicit loopback threat model. Cost if wrong: unsupported exposed-network deployments receive no security claim.
19. Reviewer declined forced cancellation of resistant third-party awaitables; retain supported cooperative ASGI behavior. Cost if wrong: arbitrary non-cooperative injected code may outlive a bounded close request.
20. Reviewer declined clean-machine study/rights/notices/publication; continue separate release gates. Cost if wrong: this accepted subsystem alone cannot justify a release.

Deferred minors: none before review. Real Unity receiver/fragment bounds, two rigs, Blender export direction/scale/timing, authorized video/laptop measurements, clean-machine/new-user study, rights/notices and owner-approved publication remain pending. No public push/main merge/tag/release occurred for this work.
