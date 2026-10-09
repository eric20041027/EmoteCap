# Studio Storage Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve identifiable original takes and clip edits with validated, atomic, conflict-safe browser saves.

**Architecture:** A pure immutable domain owns projects/takes/clips and a strict parser owns all stored-input validation. A native IndexedDB repository atomically saves documents, list summaries and selected video; an ordered autosave lane coalesces edits and preserves failed snapshots. UI, checkpoint timers and portable archives follow in separate M2 plans.

**Tech Stack:** Existing TypeScript/Vitest; native IndexedDB; fake-indexeddb 6.2.5 for database behavior tests only.

**Spec:** docs/superpowers/specs/2026-10-06-studio-projects-design.md

## Global Constraints

- Project schema 1; motion contract remains v2 with 48 driven bones and 192 quaternion values.
- Up to 20 takes/project, 21601 frames/take, 43202 frames/project, 180 seconds/take, 50 clips/take, 20 undo snapshots.
- Project/take names support Unicode and have at most 120 characters; clip draft names at most 24 and descriptions at most 512. Draft invalid export names remain saveable.
- Frame values finite; time strictly increasing inside [0,180]; hips x/z within 1e-6; quaternion norms in [0.98,1.02].
- Media at most 100 MiB/take and 200 MiB/project, retained only through an explicit later UI action. No secrets or extra schema properties.
- No motion-solver changes, remote push, remote main integration or product publication in this plan.
- Entire M1–M5 goal remains active. Modules without UI/browser acceptance do not complete M2.

## File Structure

- `web/src/project/types.ts`: schema types and bounds.
- `validation.ts`: strict bounded reader, deep ownership/freeze, storage summary parser and original-transition guard.
- `model.ts`: immutable creation, capture appends/completion/recovery, selection, naming, clip edits/undo and media descriptor changes.
- `store.ts`: native IndexedDB opening, listing/loading, CAS save/media reads and project deletion.
- `autosave.ts`: one ordered/coalescing save lane with honest status and explicit retry.
- Matching `.test.ts` files: behavior tests, not schema/source-text matching.

## Review Focus

1. A solver that reuses arrays must not corrupt the recorded original; clip undo must not reuse an old edit revision.
2. Unknown versions, corrupt frames, duplicate identities, dangling references or hidden credentials must fail before save.
3. A failure after one queued database write must roll back documents, summaries and videos together.
4. Two tabs or a delayed earlier save must not overwrite newer work or display Saved prematurely.
5. Saving video then removing its retention choice, deleting a take/project, and retrying a failed save must leave no orphan media and preserve in-memory work.

---

### Task 1: Validated immutable project domain

**Files:** Create `web/src/project/types.ts`, `validation.ts`, `model.ts`, `model.test.ts`, `validation.test.ts`, and shared synthetic `testData.ts`.

**Interfaces:**
- Consumes `MotionFrame`, `BONE_COUNT`, `CONTRACT_VERSION`, `CLIP_NAME_PATTERN` from `../motion/contract`.
- Produces `ProjectDocument`, `ProjectTake`, `ProjectClip`, `TakeProvenance`, `MediaDescriptor`, `ProjectSummary`.
- `createProject(name?: string, now?: number): ProjectDocument`.
- `addTake(project, {name,source,provenance,frames?}): ProjectDocument`; supplied frames mean complete, absent frames mean recording. Select the new UUID take.
- `appendTakeFrames(project,takeId,frames): ProjectDocument` appends only to a recording and owns buffers; `finishTake(project,takeId)` requires nonempty frames; `recoverProject(project)` marks only recording takes interrupted.
- `selectTake`, `renameProject`, `renameTake`, `removeTake` return a new document with monotonically increasing revision, or the same object for a genuine no-op.
- `replaceClips(project,takeId,clips)`, `editClip(project,takeId,clipId,patch)`, `removeClip`, `undoClips` preserve frames/provenance, bound history and increase clipRevision, including undo.
- `setTakeMedia(project,takeId,descriptor|null)` validates per-take/project totals.
- `parseProject(value: unknown): ProjectDocument`, `parseSummary(value: unknown): ProjectSummary`, `assertOriginalTransition(previous,next): void`; errors use `ProjectDataError`. Unknown fields fail rather than being copied.

- [x] **Step 1: Write behavior tests first.** Use synthetic tpose frames and UUID fixtures. Pin creation/copy ownership, original immutability, clip-edit/undo revision, recording append/finalize/recovery, draft naming, selection/removal, all limits and media totals. Initial creation characterization:

```typescript
it('creates a versioned Unicode project with a stable identity', () => {
  const project = createProject('我的動畫', 1000);
  expect(project).toMatchObject({format:'emotecap-project', schemaVersion:1,
    contractVersion:2, name:'我的動畫', revision:0, createdAt:1000,
    updatedAt:1000, activeTakeId:null, takes:[]});
  expect(project.id).toMatch(/^[0-9a-f-]{36}$/);
});
```

Validation tests mutate a serialized valid synthetic project: schemaVersion=2; contractVersion=1; fps/secret extra fields; NaN/string/sparse rotations; norm outside limits; nonzero horizontal hips; out-of-order/too-long timeline; duplicate IDs; missing active take; out-of-take clip; oversized counts/history/text/media. Roundtrip preserves provenance and freezes owned nested arrays. Test a previous completed original modified in a later document is rejected, and a recording prefix rewrite is rejected.

- [x] **Step 2: Run the tests to see the absent feature fail.**

Run `node node_modules/vitest/vitest.mjs run src/project/model.test.ts src/project/validation.test.ts` in web. Establish a clean failing creation assertion using a minimal module returning only its input name if needed to load the test; do not count a test typo as RED. Expected: project fields/behavior are missing before implementation.

- [x] **Step 3: Implement the domain.** Use explicit owned-field readers with key allowlists; check array bounds before loops, then finite numeric/timeline/norm/reference bounds. UUIDs come from crypto.randomUUID. Freeze owned frame buffers, clips/history, provenance and document arrays. Model mutations reuse unchanged immutable originals; only capture appends allocate frame copies.

```typescript
function changed(project: ProjectDocument, takes: readonly ProjectTake[],
  extra: Partial<Pick<ProjectDocument,'name'|'activeTakeId'>> = {}): ProjectDocument {
  if (!Number.isSafeInteger(project.revision + 1)) throw new ProjectDataError('Project revision limit reached.');
  return Object.freeze({...project, ...extra, takes: Object.freeze([...takes]),
    revision: project.revision + 1, updatedAt: Math.max(project.updatedAt, Date.now())});
}
```

Default a complete/recovered take to one full-range clip only if duration >=0.1s. Clip changes push the previous list, retain the newest 20 history entries, and increment clipRevision. Undo restores the list and increments clipRevision again. Parser accepts temporarily invalid draft names; export validity remains the existing contract's responsibility. The transition guard compares existing original frame/provenance/source/creation values, permits only a recording prefix append/status completion, and permits explicit take removal.

- [x] **Step 4: Verify domain tests and types.**

Run the two test files and `node node_modules/typescript/bin/tsc --noEmit`. Expected: all new tests pass and types pass; arrays/provenance unchanged across edits and undo.

- [x] **Step 5: Commit.**

```text
git add web/src/project/types.ts web/src/project/validation.ts web/src/project/model.ts web/src/project/model.test.ts web/src/project/validation.test.ts
git commit -m "feat: add immutable Studio project domain"
```

Task completion command: from repository root, `bash -c 'cd web && node node_modules/vitest/vitest.mjs run src/project/model.test.ts src/project/validation.test.ts && node node_modules/typescript/bin/tsc --noEmit'`.

### Task 2: Atomic native IndexedDB repository

**Files:** Create `web/src/project/store.ts`, `store.test.ts`; modify `web/package.json`, `web/package-lock.json` to add exact dev dependency fake-indexeddb 6.2.5.

**Interfaces:**
- Consumes Task 1 types/parser/original-transition guard.
- `openProjectStore({factory?:IDBFactory,name?:string}={}):Promise<ProjectStore>`; production defaults to browser IndexedDB and `emotecap-studio` database version1.
- `ProjectStore.list():Promise<ProjectSummary[]>`, `load(id):Promise<ProjectDocument|null>`, `readMedia(projectId,takeId):Promise<Blob|null>`, `close():void`.
- `save(project,expectedRevision:number|null,media?:ReadonlyMap<string,Blob>):Promise<void>`; null means a new ID, otherwise the current stored revision must match and the new revision must increase. Retained-media descriptors require matching existing/supplied blobs. Remove unreferenced blobs in the same transaction.
- `remove(id,expectedRevision:number):Promise<void>` deletes its document, summary and media in one transaction and checks the revision.
- Exports `ProjectConflictError` and `ProjectStorageError` with reason quota/blocked/unavailable/write. Resolve writes only on transaction complete; request strict durability; close on version change.

- [x] **Step 1: Install the pinned test adapter and write behavior tests.**

Run `npm install --save-dev --save-exact fake-indexeddb@6.2.5 --ignore-scripts` in web using the pinned npm. Expected: only the named new dev dependency and its lock record, no unrelated package upgrades; audit clean.

Tests use a new IDBFactory/database per test and real transaction semantics: save+close+reopen restore selected take/clips/provenance; separate summary; media opt-in/read/removal; take/project deletion; duplicate-new and stale-tab CAS rejection; original rewrite rejection; failed transaction rollback, including summary failure after document put. Inject the failure at the fake native object-store boundary rather than mocking the repository result:

```typescript
const originalPut = IDBObjectStore.prototype.put;
const fault = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function(value, key) {
  if (this.name === 'summaries') throw new DOMException('Disk full', 'QuotaExceededError');
  return originalPut.call(this, value, key);
});
try {
  await expect(store.save(changedProject, originalRevision)).rejects.toMatchObject({reason:'quota'});
} finally { fault.mockRestore(); }
expect(await store.load(project.id)).toEqual(originalProject);
```

Also verify unavailable factory, newer/corrupt database schema, late failed/blocked open closure, invalid project and media mismatch cannot publish partial work.

- [x] **Step 2: Observe RED.**

Run `node node_modules/vitest/vitest.mjs run src/project/store.test.ts`. Expected: repository behaviors absent; minimal loaded no-op exports may establish a clean missing-save/restore assertion.

- [x] **Step 3: Implement native transactions.**

Version1 stores `projects` keyPath id, `summaries` keyPath id, and `media` keyPath [projectId,takeId] with projectId index. Use callbacks during active transactions; do not await unrelated work inside them. Read current project then CAS/original checks before writes. Queue document, summary, retained-media checks/puts and deletion of orphans in the same readwrite transaction. Keep a captured failure when calling abort because transaction.error may be null. A request success does not resolve the save.

```typescript
const tx = db.transaction(['projects','summaries','media'], 'readwrite', {durability:'strict'});
let failure: unknown;
tx.oncomplete = () => resolve();
tx.onabort = () => reject(toStorageError(failure ?? tx.error));
const fail = (error: unknown) => { failure = error; tx.abort(); };
```

Open errors reject clearly; reject blocked opens with a close-other-tabs message and close a connection delivered after rejection. List only summaries and validate them. Read/load results only after readonly transaction completion; parsing corrupt stored data rejects without resetting it. Close connection on versionchange, making later operations fail visibly.

- [x] **Step 4: Verify transaction behavior and types.**

Run all src/project tests and TypeScript. Expected: all pass, rollback leaves the previous document/summary/media intact, no swallowed/unhandled failures.

- [x] **Step 5: Commit.**

```text
git add web/src/project/store.ts web/src/project/store.test.ts web/package.json web/package-lock.json
git commit -m "feat: persist Studio projects atomically in IndexedDB"
```

Task completion command: `bash -c 'cd web && node node_modules/vitest/vitest.mjs run src/project && node node_modules/typescript/bin/tsc --noEmit'` from root.

### Task 3: Ordered autosave and failure preservation

**Files:** Create `web/src/project/autosave.ts`, `autosave.test.ts`; update `docs/release-progress.md`; create `docs/superpowers/reports/2026-10-07-studio-storage.md`.

**Interfaces:**
- Consumes `Pick<ProjectStore,'save'>` and validated immutable documents.
- `ProjectAutosave(store,projectId,storedRevision:number|null,onStatus:(status:SaveStatus)=>void,delayMs=750)`.
- `stage(project,media?:ReadonlyMap<string,Blob>):void`; coalesce, retain unsaved selected media, reject other project IDs and older snapshots.
- `flush():Promise<void>`, `retry():Promise<void>`, `getPending():ProjectDocument|null`, `getStatus():SaveStatus`, `dispose():void`.
- `SaveStatus` phases saved/dirty/saving/error; revision means the latest staged revision, savedRevision means only a completed database write. Error carries the actual Error. No timer starts an automatic retry after failure. Later recording UI chooses 5-second checkpoints separately.

- [x] **Step 1: Write temporal behavior tests.**

Use deferred save promises, fake timers and the real Task2 store where useful. Start revision1, stage revision2 while revision1 is pending, resolve first; assert status is not Saved, then resolve latest and assert Saved revision2. Verify only latest pre-timer snapshot writes, expected revision follows last completed save, quota rejection preserves latest project and selected video, stage-after-failure stays in error until retry, retry saves the latest snapshot, wrong-ID/older snapshots fail and dispose cancels only pending timer.

- [x] **Step 2: Observe RED.**

Run `node node_modules/vitest/vitest.mjs run src/project/autosave.test.ts`. Expected: missing ordered-save behavior; clean characterization uses a minimal loaded lane without saving to prove flush fails to publish expected data.

- [x] **Step 3: Implement one ordered lane.**

Stage keeps the latest immutable document and a bounded union of selected pending media filtered by the latest take descriptors. One debounce timer starts one drain promise. Drain awaits exactly one save at a time, updates savedRevision only on its success, and continues to the latest pending snapshot. An earlier completion never emits Saved while newer work exists. On rejection restore the failed snapshot unless a newer pending one exists, retain media, emit error and stop. flush cancels the debounce and joins the drain; retry clears the failure and flushes. Dispose cancels a timer, detaches status delivery, and allows an already-started atomic transaction to finish; getPending still preserves any unsaved work.

```typescript
await store.save(snapshot, savedRevision, snapshotMedia);
savedRevision = snapshot.revision;
// Emit Saved only after the queue and in-flight snapshot are empty.
```

- [x] **Step 4: Verify and document the scope.**

Run all Web tests, 8 Node asset/security checks, TypeScript and full Web build. Expected: existing tests plus all project tests pass; no other dependency records upgraded; build succeeds. Record RED/GREEN evidence, all counts, commit range, known IndexedDB performance/real-browser limits and full M2 requirements still pending. Update only achieved parts of release ledger; no checkpoint/UI/archive claims.

- [x] **Step 5: Commit.**

```text
git add web/src/project/autosave.ts web/src/project/autosave.test.ts docs/release-progress.md docs/superpowers/reports/2026-10-07-studio-storage.md
git commit -m "feat: preserve pending work through ordered autosave"
```

Task completion command: `bash -c 'cd web && node node_modules/vitest/vitest.mjs run && node --test scripts/asset-integrity.test.mjs scripts/dependency-security.test.mjs && node node_modules/typescript/bin/tsc --noEmit && node --use-system-ca --use-env-proxy scripts/fetch-mediapipe.mjs && node node_modules/vite/bin/vite.js build'` from root.

## Final Review

Generate the plan review package from 2411625 to completed HEAD. Dispatch one fresh reviewer on the most capable model for the whole storage plan, with spec, ledger rulings and the five Review Focus lines. Regrade findings by user impact; one TDD fix pass for Critical/Important, Minor deferred with record. Keep all declined scopes explicit. Retain verification scratch per the earlier cleanup approval rejection. Continue portable-format and Studio/browser work; this plan alone does not complete M2.
