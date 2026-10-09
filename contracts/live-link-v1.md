# Paired local Live Link v1

Relay envelopev1 carries canonical motionv2. This transport update does not change bone order, coordinates, export data or project schema. The supported service binds loopback; browser Origin/Host checks complement independent role secrets. It is not a remote LAN service or a defense against malicious local software.

## Pairing

Explicit `POST /api/live-sessions` with no body creates201JSON:

```typescript
interface PairingSession {
  id:string; // canonical UUIDv4
  sourceToken:string; //256bit base64url,43characters
  pairingCode:string; //id + '.' + independent43character sink secret
  expiresAt:number; //Unix milliseconds, display only; enforcement uses monotonic clock
}
```

The HTTP Host must be `localhost`, `127.0.0.1` or `::1`. Browser Origin must be an exact HTTP loopback development origin on port5173, or the same service origin (HTTP/HTTPS with exact host/port). No userinfo/path/query/fragment is accepted. A native sink may omit Origin; a source and HTTP pairing operations may not. Secrets live in memory for3600seconds, at most4sessions. They are never saved in projects, logs or URL queries. Service restart invalidates every code.

`DELETE /api/live-sessions/{id}` sends the source token in `Authorization: Bearer <sourceToken>`, with a trusted Origin.204 means the session was invalidated and owned sockets were told to close;403wrong source secret/origin,404missing or expired,409creation capacity,413creation payload,408ingress timeout. Unknown API inputs/errors never echo secret values.

## Handshake and frames

Socket URL: `/ws/live?role=source|sink`. First text within5seconds:

```typescript
interface ClientHello {
  type:'hello';version:2;bones:string[]; //exact bones.json.driven
  sessionId:string;token:string; //source or sink secret according to URL role
}
interface ServerHello {
  type:'hello';version:2;bones:string[];
  sessionId:string;role:'source'|'sink';
  streamId:string|null; //new UUIDv4 per source connection, null while no source
  expiresAt:number;
}
```

Integer version, exact field set/bones, canonical identity and43character token are strict. No bool/string numeric coercion, duplicate fields or nonfinite JSON constants. No frame before the compatible authenticated hello. One source/four sinks per session; a competing source is rejected and the original remains connected. Other pairings are isolated. The acknowledgement has no credential. Sinks receive a new hello before the next source's frames; they reset frame/timing state for a new streamId.

Frames have exactly `type:'frame',t,h,r`. Numbers must be finite, `t>=0` strictly increasing for that connection,3hips values,192rotation values, horizontal hips magnitude<=1e-6 and each quaternion norm in[0.98,1.02]. Live timestamps may exceed180seconds. Valid frame text is forwarded unchanged; `clip_ready` and arbitrary text/binary are unsupported. UTF-8 text is capped at16KiB before JSON parsing. A protocol/permission violation closes1008 with a bounded constant reason, never raw input/secret.

## Delivery and consumer qualification

Each sink owns one writer, one pending latest frame and a separate hello/control slot. A newer frame replaces the unsent frame; a new source hello clears stale pending frames and precedes frames for that stream. Source processing never awaits a sink network write. Each send has a0.5second deadline; failures close only that sink. Explicit revocation/expiry/shutdown cancel only owned source/receiver work, release registration before awaited teardown and bound close attempts.

Delivery rechecks active monotonic lifetime after waking/control delivery and at actual send entry; a send timeout is at most remaining pairing lifetime. No new queued pose send starts after expiry. Bytes already handed to the transport cannot be withdrawn.

Studio defaults off and explicitly creates the session when enabled. It waits at most5seconds from socket creation for a verified acknowledgement; only then is status streaming. Ordinary disconnects retry after2seconds with the same unexpired session;1008or incompatible acknowledgement stops automatic retries. Session HTTP uses5second/64KiB bounds. Management is serialized across Stop/restart; late confirmed creation is revoked, and failed/uncertain cleanup remains visible. Up to4failed known pairings retain their codes/expiry and private source authorization for explicit Retry pairing cleanup. Secrets remain memory-only.

Frames are dropped while not acknowledged or above64KiB buffered data. Connection-relative increasing timestamps survive take playback resets without changing original frames. Pose numbers retain full JSON precision so rounding cannot push a valid quaternion outside the accepted tolerance; the16KiB wire limit still applies.

The historical unpaired Unity0.1.0receiver remains incompatible. Local0.2.0implements explicit memory-only Play-mode pairing, strict codec/fragment bounds and owned lifecycle; actual Windows6000.5.9f1Editor/PlayMode and defaultClientWebSocket/production relay cases pass. One final whole-plan review and public source publication remain pending. These tests do not establish two-rig/FBXplayback, physical camera or measured latency.
