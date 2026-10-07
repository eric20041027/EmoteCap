# Source single-entry production Studio qualification

Date2026-10-07; task base9181e6237c9ee402b29706ba80d6970169479b7b. [Spec](../specs/2026-10-07-local-launcher-design.md), [plan](../plans/2026-10-07-local-launcher.md), [operation](../../local-start.md). This is M5.1source preparation; Windows runtime packaging and human/rights gates remain separate.

## Implemented behavior

`start.cmd/start.sh`invoke pinned managed Python through uv after the frozen Web build setup. A fresh process validates ordinary public index/private data/env separation, reserves only127.0.0.1at the requested stable port, sets opt-in data/env choices, then imports the existing app and mounts restricted production static files after its API/file routes. Browser opens only after Uvicorn reports startup; opener failure preserves the service/printed URL. Stop/failure closes only the owned listener/readiness thread. Busy port never kills another process or chooses a new origin.

Windows defaults to user-local EmoteCap/data, outside the public build; legacy direct-server defaults are unchanged absent opt-in environment settings. Source flags/defaults/migration are documented. Private dotfiles/unsupported paths/types/traversal/links/junctions are denied, including a link alias to a hidden internal file. Host is loopback only; HTML is no-store and static responses include anti-framing/no-sniff/no-referrer. JS/CSS/WASM/task MIME is explicit.

## Actual checks

Initial25characterization cases failed before implementation. Static tests exposed Starlette's OS-specific Windows separators; normalizing those for URI selection fixed the real JS/CSS/WASM/task requests without weakening privacy checks. All25then passed including a fresh real Python HTTP service with Unicode/space paths, real health/jobs API/static bytes and unavailable Blender/cloud flags. Additional failure-import/startup tests verify owned listener/readiness-thread release.

Actual **Edge154.0.4258.62**opened the existing production bundle on this real service, with **no Vite/development proxy/API mocks**. Sample → edit → native-IDB save → backup → reload → import kept every original frame and assigned a new import project identity. Real same-origin pairing was acknowledged, Stop removed its UI code, and authorized retry DELETEreturned404after confirmed revocation. No live code/token was printed or screenshotted.

The same actual UI submitted to the durable export worker using the verified development Blender4.5.14cache; its sample FBX succeeded and downloaded **595388bytes**, SHA256`528f0822a0d5a8a37ae42efbb652afff83cf308d9dd071248b84d81ad32f9c30`. This connects the production browser/service/export path; independent FBX geometry remains covered by the accepted [Blender report](2026-10-07-blender-quality.md).

The browser sequence had **0external requests,0cloud sends,0model requests and0page errors**. Camera/model inference were not exercised. Desktop1280x1000and narrow390x844screenshots were visually inspected; no horizontal overflow or clipped main controls. Runtime logs/backup/FBX/result/screenshot evidence are retained in this plan's unique `browser-ea93bb12-50d5-4cc8-81ba-5eff23aa0068`folder. Both owned service and browser stopped afterwards; no unrelated process was stopped.

Whole fast backend**619passed/18slow deselected26.85seconds**, including28source cases, after the watched blank-env selector repair. Actual Windows wrapper missing-build invocation returned1and created no private data. Native task-done and one fresh final review follow before acceptance. Existing Web458/8Node/types/assets/build/19Edgeand real Blender571/18actual evidence is unchanged; this increment adds the real source-service browser qualification above. No public push/main merge/tag/release.

## Rulings made

1. Continue authorized Native local implementation without another method/plan approval. Cost if wrong: local reviewable entry; distribution/public writes stay separate.
2. Source assumes frozen developer setup/Web build; later Windows distribution supplies built Web/runtime. Cost if wrong: initial developer setup remains necessary; source success is not a clean-machine user package.
3. Select config in a fresh process instead of refactoring accepted singleton routers. Cost if wrong: in-process reconfiguration of already-imported main is unsupported; actual process tests cover the delivered entry.
4. Normalize Starlette1.7OS-specific separators for URI whitelist selection; delegate the original path to its lookup. Cost if wrong: platform path handling needs its own check; actual Windows assets/negative paths were exercised.
5. Restrict static prefixes/types and public/private paths with explicit MIME/headers. Cost if wrong: a new legitimate public asset type must be added deliberately, not exposed by an arbitrary directory mount.
6. Keep Windows exclusive port ownership. Cost if wrong: closing connections may delay reuse; user retries the same address instead of moving project origin or stealing another process's port.
7. Real browser verification uses a unique private artifact/data directory and verified dev-only Blender, not user media/Unity project folders. Cost if wrong: ignored evidence remains; no physical/clean-machine/Unity claim follows.
8. Treat an empty optional env selector like an absent selector. Cost if wrong: intentional selection of an empty path is not supported; legacy root dotenv still loads, tested without reading a private env.

Deferred minors:none before final review. Unity license/receiver/two rigs, physical video/laptop, owner MIT/contributor/images, full vendor notices, Windows runtime package, clean-machine/5new-user and public release gates remain pending.
