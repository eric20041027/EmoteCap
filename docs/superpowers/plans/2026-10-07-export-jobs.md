# Export Jobs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make FBX exports bounded, cancellable, recoverable and isolated, with an immutable Studio revision and visible job controls.

**Architecture:** A lifespan-owned single worker consumes durable SQLite job records and immutable JSON inputs. A cancellable owned subprocess produces staged files; serialized completion publishes a whole job directory. Studio polls and controls these records without blocking edits or replacing original takes.

**Tech Stack:** Existing Python3.12/FastAPI/Pydantic/SQLite/threading/subprocess and React/TypeScript/Vitest/Playwright. No dependency additions.

**Spec:** docs/superpowers/specs/2026-10-07-export-jobs-design.md

## Global Constraints

- Motionv2/48driven bones/192rotation values; existing full/body semantics unchanged.
- One owned Blender process,4waiting+1running,120seconds,64KiB process-output tail.
- Maximum43202aggregate frames/50clips/128MiBJSON request/128retained job records.
- Optional immutable snapshot UUIDv4 projectId/takeId and nonnegative clipRevision; inputSHA256 fixed through retry.
- Complete job-specific output directory, case-insensitive names, explicit terminal deletion; no automatic overwrite/eviction.
- Interrupted queued/running recovery after restart; explicit retry only. Cancellation and completion serialize at publication.
- One manager lock per data directory, SQLite/input writes before acceptance, lifecycle start/stop only.
- Reuse feat/studio-projects at e6e631f; no public write/local-main merge in this subsystem. Full M1–M5 stays active.

## Review Focus

1. A concurrent cancel at the final output boundary must not turn into a successful result or damage an earlier job.
2. A disk/write or malformed persisted-input failure must remain visible and must not start Blender on reconstructed/current clips.
3. Case-only names, repeated submissions and Unity-copy errors must not overwrite earlier files or hide valid local downloads.
4. Refresh/take switching/unmount during polling must not lose service jobs, run duplicate submission or attach results to newer edits.
5. Oversized/chunked JSON and queue/history exhaustion must be rejected before consuming unbounded memory or launching extra workers.

---

### Task 1: Isolated publication and cancellable owned runner

**Files:** Modify `server/emotecap_server/exporter.py`, `server/tests/test_exporter.py`, `server/blender/export_fbx.py`; create `server/emotecap_server/jobs/__init__.py`, `runner.py`, `server/tests/test_job_runner.py`.

**Interfaces:** Exporter produces `write_job(job_dir:Path,clips:list[Clip])->Path`, `publish_job(out_dir:Path,settings:Settings,job_id:str,names:list[str])->tuple[list[ExportedFile],str|None]`. Runner produces `run_job(settings:Settings,job_json:Path,out_dir:Path,cancel:threading.Event,progress:Callable[[int],None])->None`; cancellation raises `JobCancelled`, other failures ExportError. Task2 owns publication/cancel serialization; runner only creates staging output.

- [ ] **Step1: Write regressions before production.** Replace the intentional old-overwrite characterization with the new product expectation and retain validation/error tests. Use fake Blender for publication, and redirect an owned Popen invocation to an actual Python script for process semantics.

```python
def test_same_name_exports_are_isolated(tmp_path, fake_blender):
    settings=make_settings(tmp_path)
    first=export_clips([fixture_clip()],settings)
    first_bytes=(settings.data_dir/'exports'/first[0].url.removeprefix('/files/')).read_bytes()
    second=export_clips([fixture_clip()],settings)
    assert first[0].url != second[0].url
    assert (settings.data_dir/'exports'/first[0].url.removeprefix('/files/')).read_bytes()==first_bytes

def test_case_only_names_are_unique():
    assert unique_names(['Wave','wave','Wave_2'])==['Wave','wave_3','Wave_2']
```

Also pin whole-directory no-partial-publication, missing files, symlink rejection, Unity warning/local result preservation,120s timeout via a shorter injected test limit, real-child cancel and a>64KiB output tail.

- [ ] **Step2: Watch focused RED.** `uv run --directory server --frozen --python 3.12.14 pytest tests/test_exporter.py tests/test_job_runner.py -q`; Expected: overwrite/case collisions fail behavior assertions, not import errors. A loadable runner stub is permitted solely to characterize new behavior.
- [ ] **Step3: Implement the boundary.** Fold names with casefold, allocate oneUUIDdirectory per export, validate exact expected ordinary files and atomically rename the completed output folder. Keep legacy direct function using its existing run_blender. New run_job uses Popen(shell=False,cwd=REPO_ROOT), reads output continuously into a64KiB tail, polls cancel/time, terminates then kills only that Popen if needed. Blender prints `EMOTECAP_PROGRESS:<completed>:<total>` after each clip. Progress parsing bounds counters; no fabricated percent from elapsed time.

```python
if cancel.is_set():
    process.terminate()
    try: process.wait(timeout=2)
    except subprocess.TimeoutExpired: process.kill(); process.wait(timeout=2)
    raise JobCancelled('Export cancelled')
```

- [ ] **Step4: Verify and commit.** Run the focused tests, then `uv run --directory server --frozen --python 3.12.14 pytest -q -m "not slow"`; Expected: all pass,2real-Blender cases deselected. `git add server; git commit -m "feat: isolate exports and own cancellable Blender processes"`. Run Native task-done with that full fast-suite command.

### Task 2: Durable queue, recovery and API

**Files:** Create `server/emotecap_server/jobs/models.py`, `repository.py`, `service.py`, `api.py`, `server/tests/test_job_repository.py`, `test_job_service.py`, `test_job_api.py`; modify `main.py`, `test_export_api.py`, `test_health.py`; create `contracts/export-jobs-v1.md`.

**Interfaces:** Consumes Task1 run_job/write_job/publish_job. Produces `JobService(settings:Settings,runner=run_job,max_waiting=4,max_records=128)`, `.start()`, `.close()`, `.submit(submission:JobSubmission)->JobStatus`, `.get(id)->JobStatus`, `.list()->list[JobStatus]`, `.cancel(id)->JobStatus`, `.retry(id)->JobStatus`, `.delete(id)->None`, `.wait(id,timeout)->JobStatus`. JobSubmission has `clips:list[Clip]`, `snapshot:Snapshot|None`; JobStatus has id/schemaVersion/state/phase/progress/snapshot/inputSha256/createdAt/updatedAt/retryOf/files/error/warning; wire states queued/running/succeeded/failed/cancelled/interrupted. File responses include sidecar alongside name/url. Lifespan installs app.state.jobs; API reads it through Request, never creates an import-time worker.

- [ ] **Step1: Write behavior RED using injectable blocking runner.** Fixtures create isolated Settings/data and call service.start/close in finally. Use Events to establish running state rather than timing guesses.

```python
def test_queue_limit_and_cancel_preserve_running_input(service,submission,blocking_runner):
    first=service.submit(submission)
    assert blocking_runner.started.wait(2)
    queued=[service.submit(submission) for _ in range(4)]
    with pytest.raises(QueueFull): service.submit(submission)
    assert service.cancel(queued[0].id).state=='cancelled'
    assert service.get(first.id).state=='running'

def test_retry_keeps_original_digest(service,submission,failing_runner):
    first=service.submit(submission); service.wait(first.id,2)
    second=service.retry(first.id)
    assert second.id!=first.id
    assert second.inputSha256==first.inputSha256
    assert second.snapshot==first.snapshot
```

Pin single-worker concurrency, corrupt/missing persisted inputs, failed disk acceptance, restart→interrupted with no automatic run, second-manager lock failure, cancellation racing publish, completed-only deletion,128history capacity, request bounds/chunking and legacy request through the same lane. API TestClient uses lifespan context and an isolated service factory; no test touches main's default data or physical Blender.
- [ ] **Step2: Watch RED.** `uv run --directory server --frozen --python 3.12.14 pytest tests/test_job_repository.py tests/test_job_service.py tests/test_job_api.py -q`; Expected: queue/recovery/API behavior fails on loadable minimal interfaces.
- [ ] **Step3: Implement persisted state and lifecycle.** Save canonical UTF8 input to jobdirectory before SQLite acceptance, use transactions and a lock around admission/cancel/completion. Startup marks nonterminal records interrupted. Acquire msvcrt/fcntl one-manager lock. Worker verifies digest/schema/frame limits before owned run; publish only while current state remains running. Unity-copy warning does not suppress local files. Persistence failures fail the action visibly; never claim Saved/success from a failed commit. Close cancels owned work and joins; never kill external processes. API bounded reader consumes ASGI request chunks up to128MiB before model validation; parameter/extra fields strict. `POST /api/export` submits/waits through the service, returning its isolated files or legacy failure details.

```python
@asynccontextmanager
async def lifespan(app):
    service=JobService(settings)
    service.start(); app.state.jobs=service
    try: yield
    finally: service.close()
```

- [ ] **Step4: Verify, document and commit.** Full fast Python command from Task1; Expected: all pass/no real Blender. Contract lists limits, state transitions, failure codes, immutable retry and deletion. `git add server contracts/export-jobs-v1.md; git commit -m "feat: persist bounded export jobs and recovery API"`. Native task-done repeats the full fast suite.

### Task 3: Studio queue controls and browser recovery

**Files:** Create `web/src/jobs/api.ts`, `api.test.ts`, `controller.ts`, `controller.test.ts`, `useExportJobs.ts`, `JobPanel.tsx`, `jobs.css`, `web/e2e/jobs.spec.ts`; modify `record/useExporter.ts`, `studio/ProjectReview.tsx`, `App.tsx`, `playwright.config.ts`; create `docs/superpowers/reports/2026-10-07-export-jobs.md`; update `docs/release-progress.md`.

**Interfaces:** API uses exact Task2 envelope/states, validates UUID/digest/revision/progress/file URLs, timeout/AbortSignal and bounded response. Controller produces stable snapshot `{jobs,busy,error,loading}`,subscribe/getSnapshot/start/stop/submit/cancel/retry/delete/refresh; polling is serial1000ms, no overlapping calls or swallowed network errors. useExportJobs wraps one App-owned controller. Exporter accepts optional snapshot and returns submitted job without waiting for Blender; ProjectReview captures projectId/takeId/clipRevision before building. Legacy non-Studio range helper still supplies no snapshot. JobPanel displays phase/progress, immutable revision, failure/warning/details and explicit Cancel/Retry/Delete; terminal-only deletion requires a UI confirmation.

- [ ] **Step1: Write API/controller RED and an actual-browser consuming case before UI.** Test unknown states/unsafe links, invalid metadata, queue rejection, cancellation, retry identity, stale polling response after dispose, refresh recovery and immutable submitted bytes when edited later.

```typescript
it('submits a frozen revision instead of later edits',async()=>{
  const input=structuredClone(submission),pending=controller.submit(input);
  input.snapshot.clipRevision++;input.clips[0].name='Later_edit';
  await pending;
  expect(JSON.parse(sentBody).snapshot.clipRevision).toBe(submission.snapshot.clipRevision);
  expect(JSON.parse(sentBody).clips[0].name).toBe(submission.clips[0].name);
});
```

Browser uses normal sample→Export FBX, deterministic job routes, edits while queued, Cancel/Retry, reload and preserved download links. Expected RED is missing jobs UI, not missing runner/dependency. Model/camera/provider counts remain zero.
- [ ] **Step2: Watch RED.** `cd web && node node_modules/vitest/vitest.mjs run src/jobs`; actual Edge `test jobs.spec.ts`; Expected: behavior/UI assertions fail before implementation.
- [ ] **Step3: Implement and consume jobs.** Eagerly serialize submission before await; server owns retry snapshots. Poll errors stay visible, preserve last-known jobs; stop aborts only HTTP polling and does not cancel service work. Refresh retrieves jobs; queued/running cancellation and failed/cancelled/interrupted retry controls call explicit routes. Remove export busy from clip editor locks; queueing does not require blocking editing. Label input revision so later edits are distinguishable.

```tsx
<section aria-label="Export jobs">
  <h2>Export jobs</h2>
  <progress aria-label="Export progress" max={100} value={job.progress} />
  <p role="status">{job.phase}</p>
</section>
```

- [ ] **Step4: Verify and commit.** `cd web && node node_modules/vitest/vitest.mjs run && node --test scripts/asset-integrity.test.mjs scripts/dependency-security.test.mjs && node node_modules/typescript/bin/tsc --noEmit && node --use-system-ca --use-env-proxy scripts/fetch-mediapipe.mjs && node node_modules/vite/bin/vite.js build && EMOTECAP_BROWSER_CHANNEL=msedge node node_modules/@playwright/test/cli.js test`; Expected: all pass, browser evidence explicitly HTTP-deterministic for jobs and synthetic for capture. Rerun full Python fast suite for composition. `git add web docs; git commit -m "feat: expose immutable export jobs in Studio"`; task-done uses the full Web command above.

## Final gate

Build a review-package e6e631f..HEAD and dispatch one fresh most-capable reviewer with code-reviewer.md, this plan/spec, verbatim Review Focus and ledger rulings. Regrade by user effect, one RED→GREEN fix pass for Important/Critical, all suites green; no re-review. Ledger every declined boundary and cost. Preserve ignored diagnostic workspaces after the existing cleanup rejection. Continue other M3 plans and M4–M5; neither fake Blender nor HTTP browser tests qualify animation/release.
