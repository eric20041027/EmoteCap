# Studio Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the approved project storage and portable format usable through Studio, including safe reopening, persistent editing, explicit camera startup and recording recovery.

**Architecture:** A framework-independent StudioSession owns the current document, source decisions and ordered autosave; React subscribes to its stable snapshots. A capture coordinator appends only new frames on five-second checkpoints. Project/take/clip controls consume these modules, with actual Chromium workflows validating their composition.

**Tech Stack:** Existing React/TypeScript/Vitest/native IndexedDB; exact @playwright/test 1.62.1 as a development-only browser runner. No new runtime dependency.

**Spec:** docs/superpowers/specs/2026-10-06-studio-projects-design.md

## Global Constraints

- Project schema1, motion contractv2; 48 bones, 192 quaternion values; no credentials in projects.
- Stable UUID identities; immutable original motion/provenance; at most20takes,21601frames/take,43202frames/project,180seconds/take,50clips/take and20undo snapshots.
- Autosave delay750ms; capture checkpoints every5000ms, final motion staged and flushed on stop. Saved is confirmed only by transaction completion.
- Source video defaults to memory, at most100MiB/take and200MiB/current project. Keep source and Include source in backup are independent choices. Switching away from unretained sources requires an explicit UI discard decision.
- Sample/open/project import never starts a camera or MediaPipe. Local playback/save/download remain usable without Blender.
- A failed save keeps current work available for retry/download. Switching waits for a confirmed save; reopening a conflicting saved copy requires an explicit discard decision. Failed import never replaces the current document.
- No implicit cloud slicing in this plan; Find pauses uses the existing local fallbackSegments. M3 adds explicit provider consent separately.
- Browser tests distinguish synthetic capture, injected quota failure and real IndexedDB from physical-camera, actual-disk-quota and hardware evidence.
- Reuse feat/studio-projects at efbb89e. No remote push, main merge or publication in this plan. Full M1–M5 remains active.

## Review Focus

1. Storage unavailable, failed quota saves and another tab's newer revision must preserve downloadable current work and never report Saved prematurely.
2. Switching projects or takes while a save/import/video finalization is pending must never attach motion or source video to the wrong identity.
3. Mounting, restoring, importing and opening a sample must request neither camera permission nor MediaPipe model startup.
4. A recording interrupted between checkpoints must restore the completed prefix, with the same take identity and an interrupted label.
5. Empty/invalid/duplicate clip names and subsecond range edits must remain saveable and keyboard-editable while blocking invalid export.

---

### Task 1: Studio session and capture checkpoint coordinator

**Files:** Create `web/src/studio/session.ts`, `session.test.ts`, `checkpoint.ts`, `checkpoint.test.ts`, `provenance.ts`, `provenance.test.ts`, `useStudioSession.ts`.

**Interfaces:** Consumes ProjectAutosave, openProjectStore/ProjectStore, ProjectDocument/TakeProvenance and existing domain mutations. Produces:

```typescript
interface StudioSnapshot {
  project:ProjectDocument; summaries:readonly ProjectSummary[];
  storage:'loading'|'ready'|'error'; save:SaveStatus;
  busy:boolean; error:string|null; mediaRevision:number;
}
class StudioSession {
  constructor(open?:()=>Promise<ProjectStore>, selection?:{read():string|null;write(id:string):void});
  getSnapshot():StudioSnapshot;
  subscribe(listener:()=>void):()=>void;
  initialize():Promise<void>;
  update(edit:(project:ProjectDocument)=>ProjectDocument):void;
  attachSource(takeId:string,source:ArchiveMediaSource):void;
  readSource(takeId:string):Promise<ArchiveMediaSource|null>;
  hasVolatileSources():boolean;
  keepSource(takeId:string,keep:boolean):Promise<void>;
  create(discardSources?:boolean):Promise<void>;
  open(id:string,discardSources?:boolean):Promise<void>;
  install(project:ProjectDocument,media:ReadonlyMap<string,ArchiveMediaSource>,discardSources?:boolean):Promise<void>;
  removeCurrent():Promise<void>;
  reopenSaved(discardPending:boolean):Promise<void>;
  flush():Promise<void>; retry():Promise<void>; reportError(error:unknown):void; dispose():void;
}
class CaptureCheckpoint {
  constructor(session:StudioSession,provenance:TakeProvenance,readFrames:()=>readonly MotionFrame[]);
  readonly takeId:string;
  start():void; checkpoint():void; finish(frames:readonly MotionFrame[]):void; dispose():void;
}
```

The hook returns `{session,state}` and subscribes via useSyncExternalStore. Session mount ownership must tolerate React effect replay; disposed/late opening callbacks cannot publish or leak an IDB connection. captureProvenance reads pinned app/tracker versions and model SHA256 metadata; it records only known calibration state, source quality and selected settings.

- [ ] **Step 1: Write failing restoration and preservation tests.**

```typescript
const db=await openProjectStore({factory:new IDBFactory(),name:crypto.randomUUID()});
const saved=createProject('Saved project'); await db.save(saved,null);
const studio=new StudioSession(async()=>db);
await studio.initialize();
expect(studio.getSnapshot().project.name).toBe('Saved project');
```

Add actual repository reload/edit/undo and recording-prefix recovery; unavailable storage still exposes a memory project; failed saves block switching; latest snapshot can still be encoded after failure; stale-tab writes cannot overwrite; explicit saved-copy reopen; source retention add/remove, missing source, per-project media cap and wrong-take attachments; explicit discard required for unretained sources. Late initialization/disposal and concurrent navigation must not publish stale work. With fake timers and the real repository, checkpoint at4999ms stores no extra frames,5000ms stores the exact prefix, stop flushes the tail, empty stop removes the empty capture.

- [ ] **Step 2: Observe behavioral RED.**

Run `node node_modules/vitest/vitest.mjs run src/studio/session.test.ts` from web. If needed use a minimal loadable constructor/initialize/getSnapshot returning an untouched draft, so the saved-name assertion fails instead of a missing-module error. Run checkpoint/provenance cases after their tests are written and before implementation.

- [ ] **Step 3: Implement the session and coordinator.**

```typescript
const loaded=await store.load(selectedId);
const recovered=recoverProject(loaded!);
lane=new ProjectAutosave(store,recovered.id,loaded!.revision,onStatus);
if(recovered!==loaded) lane.stage(recovered);
// Existing work is flushed before accepting a different project.
await lane.flush();
// A checkpoint appends the unseen suffix only.
const stored=session.getSnapshot().project.takes.find(t=>t.id===takeId)!;
session.update(p=>appendTakeFrames(p,takeId,readFrames().slice(stored.frames.length)));
```

Install only parsed complete decoded results; media must belong to existing takes and match descriptors/limits. Keep choice supplies blobs to autosave; removing choice stages deletion and retains the memory source until explicitly discarded. List summaries refresh after completed writes. One navigation operation may run at a time. Errors remain visible; retries do not load over pending work. A failed initial open preserves the memory document when storage is retried. Checkpoint interval is disposed on finish/unmount; capturing stores provenance at start, not at later settings changes.

- [ ] **Step 4: Verify and commit.**

Run all Web tests and TypeScript, compare expected restoration/prefix/conflict/media behavior against actual output, then commit `feat: connect Studio sessions to durable project recovery`. Task completion: `bash -c 'cd web && node node_modules/vitest/vitest.mjs run && node node_modules/typescript/bin/tsc --noEmit'`.

### Task 2: Project, take and persistent clip controls

**Files:** Create `web/src/studio/ProjectBar.tsx`, `TakeList.tsx`, `ProjectReview.tsx`, `clips.ts`, `clips.test.ts`, `archiveActions.ts`, `studio.css`. Modify App in Task3 to mount these components. Reuse TimeField/usePlayback/useExporter/ExportedFiles.

**Interfaces:** Consumes `{session,state}` from Task1. ProjectBar receives current snapshot, disabled capture state, async sample opener and archive handlers. TakeList selects via selectTake, adds via selectTake(null), renames via renameTake and explicitly confirms deletion. ProjectReview receives `take:ProjectTake`, `session:StudioSession`, `frameRef:RefObject<MotionFrame|null>`, `server:ServerHealth`; selection uses a project/take key to reset playback.

```typescript
clipNameIssues(clips:readonly ProjectClip[]):ReadonlyMap<string,string>;
projectClips(take:ProjectTake):Clip[];
downloadProject(session:StudioSession,includeMedia:boolean,signal?:AbortSignal):Promise<void>;
importProject(session:StudioSession,blob:Blob,discardSources:boolean,signal?:AbortSignal):Promise<void>;
```

- [ ] **Step 1: Write failing clip behavior tests.**

```typescript
const take=readyProject().takes[0];
const changed={...take,clips:[{...take.clips[0],name:''}]};
expect(clipNameIssues(changed.clips).get(changed.clips[0].id)).toMatch(/name/i);
expect(()=>projectClips(changed)).toThrow();
expect(projectClips(take)[0].frames[0].t).toBe(0);
```

Pin case-insensitive duplicates, Unicode invalid export names, keyboard range clamping at0.1seconds, independent original frames, local pause splitting with stable generated IDs and persisted undo. Archive action tests use actual codec with a supplied download sink; failed/cancelled decode must never call install; includeMedia false must never read a source.

- [ ] **Step 2: Observe RED and implement controls.**

Run the new tests before helpers. Add labelled project/open/name/backup/import/source-choice inputs; loading/dirty/saving/saved/error text in a polite live region; explicit Retry save and Reopen saved copy; import/download cancel state. Download uses a temporary object URL, revoking it after the click. Only `.emotecap` data is imported and only a fully successful decode is installed.

Clip rows preserve UUIDs and immediately stage name/loop/description changes, allow temporarily invalid names with an associated export error, and clamp time changes before calling editClip. Add clip/delete/play/undo and Find pauses, using fallbackSegments locally and replaceClips to retain undo. Export captures the frozen selected take at click and builds only validated names; missing Blender disables export with readable text while review/save/download remain enabled. Empty interrupted takes show the label and remain downloadable, with playback/export unavailable.

- [ ] **Step 3: Verify and commit.**

Run the whole Web suite and TypeScript; inspect rendered labels/state branches in the source, then commit `feat: add persistent Studio project and clip controls`. Task completion: `bash -c 'cd web && node node_modules/vitest/vitest.mjs run && node node_modules/typescript/bin/tsc --noEmit'`.

### Task 3: Explicit camera startup and capture lifecycle wiring

**Files:** Modify `web/src/App.tsx`, `capture/usePose.ts`, `capture/CameraView.tsx`, `ui/StatusBar.tsx`, `record/useRecorder.ts`, `record/useRecorder.test.ts`. Create `studio/useCaptureProject.ts`, `SetupDiagnostics.tsx`, `diagnostics.ts`, `diagnostics.test.ts`; sample URL imports the committed contracts fixture.

**Interfaces:** usePose gains final `enabled:boolean=false` and PoseStatus gains off. Disabled mode releases streams/models and never invokes openCamera/createLandmarkers. useRecorder gains a maximum remaining frame option bounded by the project/take caps; stopping at180seconds or the frame limit retains the valid prefix with a visible note. useCaptureProject consumes the recorder state, frozen start provenance, session and useTakeVideo result, and returns current capture take identity for source attachment.

- [ ] **Step 1: Write failing lifecycle/diagnostic cases.**

```typescript
let state=recordingWith([100,101]);
state=recorderReducer(state,{type:'push',frame:tposeFrame(102),maxFrames:2});
expect(state.phase).toBe('recorded');
expect(state.phase==='recorded' && state.frames).toHaveLength(2);
```

Add180second overflow, duplicate/backward/nonfinite timeline input and zero remaining capacity. Diagnostic tests assert HEAD-only local model availability, missing files/messages, no camera/provider calls and cancellation. Browser Task4 explicitly pins no startup call and late-source identity after capture; unit checkpoint tests from Task1 pin scheduling.

- [ ] **Step 2: Observe RED, then wire App.**

Run recorder/diagnostics tests before modifying their production logic. Keep camera DOM mounted, but default enabled false. Add Start camera/Stop camera, disable camera/settings/navigation while capture/countdown/import is active, and clear calibration on a restarted camera generation. New take leaves a saved take intact and resets capture controls. Video import completion installs another complete take with its actual note/provenance and in-memory source. Camera stop finalizes motion immediately; asynchronous MediaRecorder completion is attached only to its captured take ID.

```typescript
const studio=useStudioSession();
const [cameraEnabled,setCameraEnabled]=useState(false);
const pose=usePose(videoRef,handlePose,quality,deviceId,trackHands,crop,isImporting,cameraEnabled);
const video=useTakeVideo(videoRef,recorder.state.phase);
useCaptureProject(recorder,studio.session,startProvenance,video);
```

Mount ProjectBar/TakeList and keyed ProjectReview around the existing camera/preview. Restore/sample/import use session state rather than loading through a video-only recorder. The beforeunload handler warns if capturing or current save is unconfirmed. Diagnostics show local server/Blender and model availability; no background camera/model startup is needed for sample/save/download.

- [ ] **Step 3: Verify and commit.**

Run all Web and8Node tests, TypeScript, model hashes and build; commit `feat: integrate explicit capture and Studio checkpoints`. Task completion: `bash -c 'cd web && node node_modules/vitest/vitest.mjs run && node --test scripts/asset-integrity.test.mjs scripts/dependency-security.test.mjs && node node_modules/typescript/bin/tsc --noEmit && node --use-system-ca --use-env-proxy scripts/fetch-mediapipe.mjs && node node_modules/vite/bin/vite.js build'`.

### Task 4: Actual browser workflows and qualification report

**Files:** Create `web/playwright.config.ts`, `web/e2e/studio.spec.ts`, `web/e2e/capture.spec.ts`, `docs/superpowers/reports/2026-10-07-studio-integration.md`; modify `web/package.json`, `web/package-lock.json`, `web/vite.config.ts`, `.gitignore`, `docs/release-progress.md`.

**Interfaces:** Playwright uses an isolated local Vite server on127.0.0.1:4175, strict port and reuseExistingServer false, owned by the runner. Default bundled Chromium; optional EMOTECAP_BROWSER_CHANNEL=msedge for installed Edge. Tests use fresh browser contexts/real IndexedDB and normal visible controls. Artifact paths are ignored. Test-only routes may substitute synthetic model detections for capture; no production test flag or fake acceptance claim is added.

- [ ] **Step 1: Pin the runner and write browser assertions.**

Install exact @playwright/test1.62.1 --save-dev --ignore-scripts; inspect parsed lock difference and audit. Exclude e2e from Vitest and include config/tests in TypeScript checking. Launch only the owned test server. Core assertion:

```typescript
await page.addInitScript(()=>{
  Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:()=>{throw new Error('Unexpected camera startup');}});
});
await page.goto('/');
await page.getByRole('button',{name:'Use sample project'}).click();
await expect(page.getByRole('status',{name:'Project save status'})).toContainText('Saved');
await page.reload();
await expect(page.getByLabel('Take name')).toHaveValue('Synthetic right-arm raise');
```

Watch any newly pinned missing behavior fail before fixing it. Functional tests cover keyboard clip edits/undo/save/reload, motion backup/download/import into a new identity, corrupt import preserving the current project, new take preserving earlier originals, optional source keep/removal/reload, injected quota failure leaving a usable backup, real multi-tab CAS conflict, explicit saved-copy reopen and an interrupted recording prefix. Synthetic capture through the actual lifecycle proves5000ms checkpoint/stop/late-source binding; disclose substituted detections and distinguish from physical camera.

- [ ] **Step 2: Run, inspect and resolve concrete failures.**

Run `node node_modules/@playwright/test/cli.js test`; use installed Edge if default Chromium absent, recording the exact browser version/channel. Failures must include useful trace/screenshot artifacts. Fix actual integration defects via RED→GREEN; no weakening of integrity/consent/version gates. Inspect screenshots, responsive layout and keyboard focus. Check the production build's no-camera sample/archive route as an additional smoke case so Vite development success does not stand in for built ZIP compatibility.

- [ ] **Step 3: Record evidence and commit.**

Report actual Web/Node/browser test counts, browser version, API/network scope, original-frame/identity checks, synthetic-vs-physical boundaries, quota injection and pending real quota/hardware gates. Update full M1–M5 ledger without marking physical camera or release complete. Commit `test: qualify Studio recovery in a real browser`. Task completion runs full Web/Node/types/hash/build and Playwright (same commands above plus browser runner) from web.

## Final Review

One fresh most-capable Native reviewer checks efbb89e..HEAD with this plan, M2 spec, report, all Rulings and the five Review Focus lines. Re-grade by user effect; one TDD fix pass for Critical/Important, minors deferred and every declined scope ruled with cost. Preserve earlier policy-blocked scratch. Continue the full goal with remaining actual-camera acceptance and M3–M5; reviewed local Studio is not a released product.
