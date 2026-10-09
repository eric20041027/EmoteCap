# Source Single-Entry Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. The existing continuous Native choice is preserved; one fresh final reviewer follows the complete independently testable source launcher.

**Goal:** Start production Studio and its existing local API from one source entry after frozen build setup.

**Architecture:** Reserve a loopback listener, choose private settings/data before fresh-process main import, attach a restricted production static mount, then run the existing ASGI lifecycle. An owned readiness thread opens the system browser only after startup. Small source wrappers use the pinned managed Python; binary packaging follows separately.

**Tech Stack:** Existing FastAPI0.141.1/Starlette1.7.0/Uvicorn0.54.0, Python3.12.14/uv0.12.6; existing Web build/Edge/Playwright. No dependency change.

**Spec:** `docs/superpowers/specs/2026-10-07-local-launcher-design.md`.

## Global Constraints

- Bind only127.0.0.1; default8787; explicit integer port1..65535. No automatic port change or stopping other processes.
- Reserve port before stateful service import. Open browser only after ASGI startup; opener failure keeps the service/URL available.
- Private data/config cannot overlap the built Web root. No key CLI flag, private recording/settings copying, license/publication or binary bundling.
- Add EMOTECAP_DATA_DIR/EMOTECAP_ENV_FILEopt-in settings; absent them preserve legacy source defaults.
- One source start after pinned dependency/Web build setup. Developer prerequisites remain; later Windows package removes them for users.
- Preserve existing health/jobs/media/paired relay/export/file contracts. No launch-triggered camera/model/cloud processing.
- Unit plus actual Python HTTP process and actual built Edge/IDB qualification; no Vite/proxy/API mocks in the final browser gate. Other human/hardware/rights/release gates remain pending.

## Review Focus

1. Busy ports, startup failures and browser-opening errors must never claim readiness, mutate another instance's data or kill another process.
2. Unicode/space paths, missing Web builds and private/public overlap must produce actionable failures before stateful imports.
3. Malicious Host, dotfiles/traversal and links into private data must not expose local files or bypass the real APIs.
4. Production same-origin startup must preserve sample editing/native browser recovery and paired API semantics without a development proxy.
5. Stop/failed startup must release the owned listener/readiness thread and leave the current project/recoverable server jobs intact.

---

### Task 1: Source launcher, restricted static serving and actual production qualification

**Files:**
- Create: `server/emotecap_server/studio_files.py` — public static whitelist/headers/Host protection.
- Create: `server/emotecap_server/launcher.py` — parser, validation, listener, fresh app load, readiness/browser/lifecycle.
- Modify: `server/emotecap_server/config.py` — optional private data/env selection only.
- Create: `server/tests/test_local_launcher.py` — meaningful static/error/ownership/configuration/fresh-process tests.
- Create: `start.cmd`, `start.sh` — source entries, no installation-policy changes.
- Create: `docs/local-start.md`, `docs/superpowers/reports/2026-10-07-local-launcher.md`.
- Modify: `.env.example`, `docs/development.md`, `docs/release-progress.md` — exact operation and honest qualification status.
- Ignored verification: this plan's `.superpowers/sdd/.../browser-smoke.cjs`and results/screenshots; use existing Playwright directly, no new persistent TypeScript production changes.

**Interfaces:**
- Existing consumers: `main.app`/lifespan, unchanged `Settings`fields/load_settings(), `StaticFiles`, `TrustedHostMiddleware`, `uvicorn.Config/Server`.
- Produces `StudioFiles(StaticFiles)`; `attach_studio(app: FastAPI, web_dir: Path) -> None`.
- Produces `StartupError`; `default_data_dir() -> Path`; `validate_web_root(web_dir: Path, data_dir: Path, env_file: Path) -> Path`; `open_listener(port: int) -> socket.socket`; `open_when_ready(server, url: str, stop: threading.Event, *, open_browser=True, opener=webbrowser.open, wait_seconds=20) -> bool`; `_load_application(args: argparse.Namespace, web_root: Path) -> FastAPI`; `main(argv: list[str] | None=None) -> int`.
- CLI defaults: repo `web/dist`, repo `.env`, platform private data,8787; flags `--web-dir/--data-dir/--env-file/--blender/--port/--no-browser`. `_load_application`sets PORT/data/env and optional Blender environment before fresh-process import; direct legacy uvicorn entry is unchanged.

- [ ] **Step 1: Write failure/static/lifecycle tests and loadable characterization stubs.** New functions raise NotImplementedError; no stub is committed. Test correct index/JS/CSS/WASM/task MIME and known API precedence, denied Host/unknown API/dot/private/traversal/link paths, missing build/overlap/Unicode roots, busy port before `_load_application`, no browser before startup, opener failure readiness and owned cleanup. Tests attach a fresh FastAPI fixture, never mutate the shared main app in-process.

```python
app = FastAPI()
app.get('/api/health')(lambda: {'ok': True})
attach_studio(app, public)
client = TestClient(app, base_url='http://127.0.0.1:8787')
assert client.get('/').text == 'built Studio'
assert client.get('/api/health').json() == {'ok': True}
assert client.get('/api/missing').status_code == 404
assert client.get('/.env').status_code == 404
assert client.get('/api/health', headers={'Host':'attacker.invalid'}).status_code == 400
with pytest.raises(StartupError): validate_web_root(public, public/'private', private_env)
with socket.socket() as occupied:
    occupied.bind(('127.0.0.1',0))
    with pytest.raises(StartupError): open_listener(occupied.getsockname()[1])
```

- [ ] **Step 2: Watch behavior fail.**

Run: `uv run --directory server --frozen --python 3.12.14 pytest -q tests/test_local_launcher.py`.
Expected: failures at new launcher/static behavior, with existing dependencies/imports intact.

- [ ] **Step 3: Implement restricted static serving.** `StudioFiles.get_response`accepts index/root and whitelisted prefixes/static suffixes, rejects dot/traversal/link/junction components before `super`, overrides `.js/.mjs/.css/.wasm/.task/.emotecap`MIME, adds no-sniff/no-referrer/anti-framing and no-store HTML. `attach_studio`adds loopback Host protection and mounts root after existing API/files routes. Use `getattr(path,'is_junction',lambda:False)()`for the pinned cross-platform Path interface.

```python
STATIC_PREFIXES = {'assets','models','mediapipe','samples'}
MIME = {'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css',
        '.wasm':'application/wasm','.task':'application/octet-stream',
        '.emotecap':'application/octet-stream','.png':'image/png','.jpg':'image/jpeg',
        '.jpeg':'image/jpeg','.svg':'image/svg+xml','.woff':'font/woff','.woff2':'font/woff2'}
# Treat ''/'.'/'index.html' as the built root; all other requests require an
# allowed prefix, non-dot ordinary components and a suffix in MIME.
app.add_middleware(TrustedHostMiddleware,allowed_hosts=['127.0.0.1','localhost'],www_redirect=False)
app.mount('/',StudioFiles(directory=web_dir,html=True,follow_symlink=False),name='studio')
```

Run: Step2command with `-k static`.
Expected: static behavior passes; outstanding launcher tests remain red.

- [ ] **Step 4: Implement startup ownership and optional settings.** Validate index/root/overlap before import or data creation. Choose private data/env, reserve AF_INETloopback port (Windows exclusive-address option when available), then lazily import main and attach Studio. Run Uvicorn with the reserved listener, an owned stop event/readiness thread and5second graceful shutdown budget. No automatic process discovery/termination or output path deletion.

```python
# config.py, before the existing import-time dotenv load:
load_dotenv(Path(os.getenv('EMOTECAP_ENV_FILE',str(REPO_ROOT/'.env'))))
# Existing Settings.data_dir only:
data_dir=Path(os.environ['EMOTECAP_DATA_DIR']).resolve() if os.getenv('EMOTECAP_DATA_DIR') else SERVER_DIR/'data'

# Fresh launcher app load, only after validated paths and successful bind:
os.environ['PORT']=str(args.port)
os.environ['EMOTECAP_DATA_DIR']=str(args.data_dir.resolve())
os.environ['EMOTECAP_ENV_FILE']=str(args.env_file.resolve())
if args.blender: os.environ['BLENDER_PATH']=args.blender
from .main import app
attach_studio(app,web_root)

# Lifecycle core inside main:
listener=open_listener(args.port)
stop=threading.Event()
try:
    app=_load_application(args,web_root)
    server=uvicorn.Server(uvicorn.Config(app,host='127.0.0.1',port=args.port,
        loop='asyncio',timeout_graceful_shutdown=5))
    ready=threading.Thread(target=open_when_ready,args=(server,url,stop),
        kwargs={'open_browser':not args.no_browser},daemon=True)
    ready.start()
    try: server.run(sockets=[listener])
    finally: stop.set();ready.join(timeout=1)
    if not server.started: raise StartupError('Local service did not finish startup')
finally:
    listener.close()
```

`open_when_ready`waits with `stop.wait(.05)`until actual `server.started`or20seconds, prints the loopback URL only after readiness, and catches opener errors without stopping the service. `main`returns1with a short recovery message on StartupError/OSError,0after a normally started/stopped service. Argparse validates port bounds. Do not promise in-process reconfiguration of an already imported main singleton; source entry creates a fresh process.

Run: Step2command.
Expected: all unit ownership/error/static cases pass.

- [ ] **Step 5: Add and test one source entry plus actual fresh HTTP process.**

```bat
@echo off
uv run --directory "%~dp0server" --frozen --python 3.12.14 python -m emotecap_server.launcher %*
exit /b %errorlevel%
```
```sh
#!/usr/bin/env sh
set -eu
source_root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
exec uv run --directory "$source_root/server" --frozen --python 3.12.14 python -m emotecap_server.launcher "$@"
```

Add a subprocess test using the real source interpreter/module, unique unused port and owned private data/env paths, empty Gemini key/invalid Blender path, `--no-browser`. Poll actual health with urllib ProxyHandler({}); require index200/health/jobs JSON plus WASM/model bytes/MIME and invalidHost400. Stop only the Popen-owned process in finally, bounded wait/kill if its own termination fails; preserve logs. Missing-build startup must return nonzero without creating data. Test named paths contain Unicode/spaces. Document that source Web must be built once with the locked npm commands and that changing origin uses portable backup/import.

Run: Step2command including the fresh-process tests.
Expected: actual loopback service serves production Web/API/assets, optional Blender/cloud unavailable is reported honestly; no provider/camera/external request.

- [ ] **Step 6: Qualify actual production Edge/native IDB without API mocks.** Use the existing Playwright module from `web/node_modules`in a plan-owned Node verification harness. Start the exact fresh Python launcher with a unique port/private data/env and `--no-browser`; open actual Edge, assert real health and no default model/camera/cloud traffic, use sample, edit, backup, reload and import, verify original frames and new project identity. Enable/stop pairing with real API and verify revocation; do not print or screenshot a live code/token. Screenshots after Stop at1280x1000and390x844must remain readable/no horizontal overflow. Keep private data and owned-process cleanup bounded; no user process termination.

Expected: actual built-browser lifecycle passes on the source service, with original vectors/IDs preserved across native IDB recovery/backup import. This is developer-host qualification, not a clean machine/new-user/physical capture acceptance.

- [ ] **Step 7: Record exact results, integrate and commit.**

Run: `uv run --directory server --frozen --python 3.12.14 pytest -q -m 'not slow'`; unchanged Web type/build and existing asset SHA check only if consumer/build changes require them; `git diff --check`.
Expected: whole fast backend green with the real process test; existing M4 exporter evidence remains separate and unchanged. Write report/progress and all Rulings; commit exact source launcher/static/config/tests/entries/docs. Native task-done reruns the full fast gate. One fresh final Python reviewer receives fixed range/spec/ledger/five focus lines; Critical/Important enter one TDD correction pass, no re-review.

## Self-review

One task owns the working source launch deliverable; no competing interfaces. Optional config settings preserve legacy defaults while fresh-process CLI uses private storage. Every focus line has explicit unit/process/browser verification. Initial Web build/developer prerequisites are clearly distinct from the following Windows distribution. Continuous Native authorization covers local execution; public writes, license/human/hardware acceptance remain pending.
