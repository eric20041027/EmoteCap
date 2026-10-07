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

Initial whole fast backend**619passed/18slow deselected26.85seconds**, including28source cases, after the watched blank-env selector repair. Native task-done reran619cases green at6eec9ed. Actual Windows wrapper missing-build invocation returned1and created no private data. Existing Web458/8Node/types/assets/build/19Edgeand real Blender571/18actual evidence is unchanged; this increment adds the real source-service browser qualification above. No public push/main merge/tag/release.

One fresh Python reviewer checked a0a6be1..6eec9ed and independently passed all28source tests. Two Important findings were retained by user effect: implicit Starlette HTML fallbacks could select files after admission checks, and an existing directory chosen as the env file silently started without loading that configuration. No Critical or Minor findings.

The single correction pass watched five regressions fail first: missing-asset404HTML, directory-indexHTML, directory/unreadable settings before import, and a real fresh directory-settings process. HTML fallback is now disabled; root requests explicitly select the checked index.html. Existing settings paths must be readable regular files before binding/import; absent optional settings remain allowed. All**33source tests passed**, followed by **624fast backend passed/18slow deselected27.81seconds**. The fresh directory-settings case now exits nonzero without data or readiness. No second review was dispatched. This source increment is accepted locally; distribution and external gates below remain pending.

## Rulings made

1. Continue authorized Native local implementation without another method/plan approval. Cost if wrong: local reviewable entry; distribution/public writes stay separate.
2. Source assumes frozen developer setup/Web build; later Windows distribution supplies built Web/runtime. Cost if wrong: initial developer setup remains necessary; source success is not a clean-machine user package.
3. Select config in a fresh process instead of refactoring accepted singleton routers. Cost if wrong: in-process reconfiguration of already-imported main is unsupported; actual process tests cover the delivered entry.
4. Normalize Starlette1.7OS-specific separators for URI whitelist selection; delegate the original path to its lookup. Cost if wrong: platform path handling needs its own check; actual Windows assets/negative paths were exercised.
5. Restrict static prefixes/types and public/private paths with explicit MIME/headers. Cost if wrong: a new legitimate public asset type must be added deliberately, not exposed by an arbitrary directory mount.
6. Keep Windows exclusive port ownership. Cost if wrong: closing connections may delay reuse; user retries the same address instead of moving project origin or stealing another process's port.
7. Real browser verification uses a unique private artifact/data directory and verified dev-only Blender, not user media/Unity project folders. Cost if wrong: ignored evidence remains; no physical/clean-machine/Unity claim follows.
8. Treat an empty optional env selector like an absent selector. Cost if wrong: intentional selection of an empty path is not supported; legacy root dotenv still loads, tested without reading a private env.
9. An intermediate `-k static` also selected an unfinished launcher consumer; keep it red until startup implementation. Cost if wrong: no early task-completion claim; the final whole suite includes that consumer.
10. Clean-machine Windows packaging stays a separate required deliverable. Cost if wrong: source users still need developer tools; M5.1cannot pass on this source entry alone.
11. In-process reconfiguration remains unsupported after main import; delivered wrappers start a fresh interpreter. Cost if wrong: embedded callers cannot reuse the singleton to switch settings; actual process tests cover the supported entry.
12. New static formats require explicit admission. Cost if wrong: a future legitimate asset type can404until its whitelist/qualification is updated.
13. Immediate Windows port reuse follows exclusive ownership and existing-connection closure. Cost if wrong: retry may be delayed; no instance steals another listener or silently moves browser storage.
14. Retain the bounded20second readiness watcher. Cost if wrong: exceptionally slow startup requires manually checking the service messages and opening the documented address; this does not become a false-ready browser launch.
15. Physical camera/laptop, Unity entitlement/receiver/two rigs, owner rights/vendor notices and five-user study remain separate required gates. Cost if wrong: local automation cannot establish a formal user release; those gates remain explicitly incomplete.
16. Keep existing production Edge/Blender evidence for unchanged implementations; the final review reran source Python and synthetic edge cases. Cost if wrong: the unchanged Web/export implementation is not requalified for every Python-only correction; all33static/process cases and624backend regressions passed after the correction.
17. Preserve earlier policy-blocked scratch and this plan's retained evidence. Cost if wrong: ignored disk use accumulates; no cleanup workaround or deletion of other work is attempted.

Deferred minors:none. Unity license/receiver/two rigs, physical video/laptop, owner MIT/contributor/images, full vendor notices, Windows runtime package, clean-machine/5new-user and public release gates remain pending. These rulings preserve the authorized continuous M1–M5work rather than ending at this subsystem.
