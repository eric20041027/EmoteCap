# Media Consent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make raw-video deletion explicit and require one-use, source-bound consent for optional Gemini slicing, with honest cleanup reporting.

**Architecture:** A bounded server grant/admission gate runs before multipart decoding or SDK access. Owned temporary video and provider cleanup reports accompany suggestions. Studio freezes take/revision/source identity and shows suggestions before explicit application; local pause slicing remains independent.

**Tech Stack:** Existing FastAPI/Pydantic/GoogleSDK/Python and React/TypeScript/Vitest/Playwright; no dependency additions.

**Spec:** docs/superpowers/specs/2026-10-07-media-consent-design.md

## Global Constraints

- Motionv2/projectschema1 and all accepted take/frame/media/undo bounds unchanged.
- Consent policy1, providergemini, explicit allowUploadtrue,256bit grant,60second expiry,32live grants, consume once before multipart/SDK.
- One active cloud request,100MiBvideo/102MiBmultipart/30singress/180svideo,200MiBservice temporary raw budget.
- Key backend-only; no provider request or upload on default/local actions; no real SDK in tests.
- New raw data is finally-cleaned. Cleanup failure is visible/explicitly retryable; legacy recordings never auto-delete.
- Confirm source deletion before memory release; preserve frames/clips. Freeze identity/revision for suggestions and require explicit Apply.
- Reuse current feature worktree; no public push/main merge/tag/release or historical scratch cleanup. Full M1–M5 remains active.

## Review Focus

1. A configured key, stale/replayed grant or legacy helper must never upload video without the current explicit consent action.
2. Cancel/navigation/new edits during cloud processing must not silently install suggestions on newer/different clips.
3. Failed browser/server/provider deletion must remain visible without losing original motion or falsely claiming all cloud data is deleted.
4. A disk quota, malformed multipart or bounded-admission failure must not leave unbounded raw data or target an arbitrary/legacy path.
5. Provider/key-bearing errors and exported project backups must not expose keys, tokens or private source bytes unexpectedly.

---

### Task 1: Consent gate and owned local temporary media

**Files:** Create `server/emotecap_server/media/{__init__,consent,storage,api}.py`, `server/tests/test_media_consent.py`, `test_media_storage.py`, `test_media_api.py`; modify `main.py`, `tests/test_takes_api.py`; create `contracts/media-consent-v1.md`.

**Interfaces:** `ConsentGrants.issue(payload)->Grant`, `.consume(token)->ConsentPayload`, `.enter()->contextmanager` owns one active operation. `MediaStorage.begin(grant,upload)->TemporaryMedia`, `.cleanup(media)->CleanupResult`, `.inventory()->list[CleanupItem]`, `.delete(id)->None` accepts recognized contained IDs only. API issues grants, validates bounded streamed multipart and invokes existing gemini.slice_take only after validation; cleanup finally runs before response. TemporaryMedia carries path/id, no key. Existing tests receive fake grants explicitly; ungranted calls remain forbidden.

- [ ] **Step1: Write behavior RED before implementation.** Fake SDK construction/upload counters, injectable monotonic clock and temporary dirs; no private video.

```python
def test_replayed_grant_never_reaches_provider(client,fake_gemini):
    token=issue_consent(client,take_id=TAKE_ID,size=len(VIDEO),duration=2)
    first=post_video(client,token,VIDEO,TAKE_ID,2)
    second=post_video(client,token,VIDEO,TAKE_ID,2)
    assert first.status_code==200 and second.status_code==403
    assert len(fake_gemini.calls)==1
```

Also pin missing/expired/wrong-source/size/MIME grants,32grant capacity, single active operation, oversized/chunked multipart, unknown extra fields, local cleanup success/error/timeout, failed cleanup inventory/budget, explicit cleanup containment and untouched legacy files.
- [ ] **Step2: Watch focused RED.** `uv run --directory server --frozen --python 3.12.14 pytest tests/test_media_consent.py tests/test_media_storage.py tests/test_media_api.py -q`; Expected: missing consent/cleanup behavior fails assertions; loadable characterization shapes only if needed.
- [ ] **Step3: Implement exact gate.** Validate strict payload, random token/expiry/one-use under lock; enter one-operation gate before copy. Validate request bytes while reading, then parsed upload/two fields against grant. Copy to new UUID under owned cloud-tmp; finally remove that file/folder after resolved containment/link checks, recording visible cleanup failure. Recognized legacy recordings are listed but never automatically removed.

```python
grant=grants.consume(request.headers.get('X-EmoteCap-Consent',''))
with grants.enter():
    media=storage.begin(grant,upload)
    try: segments=gemini.slice_take(media.path,mime,duration,api_key=key,model=model)
    finally: cleanup=storage.cleanup(media)
```

- [ ] **Step4: Verify/commit.** Full Python fast suite `uv run --directory server --frozen --python 3.12.14 pytest -q -m "not slow"`; Expected: all pass/real-Blender cases deselected. Contract documents grant/limits/errors and local cleanup scope. Commit `feat: require source-bound cloud consent and clean temporary media`; Native task-done repeats fast suite.

### Task 2: Honest provider cleanup report

**Files:** Modify `server/emotecap_server/gemini.py`, `contract.py`, `media/api.py`, `server/tests/test_gemini.py`, `test_media_api.py`.

**Interfaces:** `CleanupReport` records remoteFiles `not-used|deleted|failed|unknown`, optional safe warning, and actual selected model. Optional cleanup argument flows through slice_take/request_segments/_ask_with_upload. Direct callers still get segment lists; media API returns structured cleanup metadata on both success and original failure. Key redaction applies before truncation to report/errors.

- [ ] **Step1: Write RED.** Fake client files.delete raises while generation succeeds, and generation+delete both fail; unknown upload confirmation remains unknown.

```python
def test_remote_delete_failure_preserves_result_and_is_visible(fake,video):
    fake.delete_error=OSError('delete failed')
    report=CleanupReport()
    result=slice_take(video,'video/webm',2,api_key=TEST_KEY,model=MODEL,cleanup=report)
    assert result and report.remoteFiles=='failed'
    assert report.warning and TEST_KEY not in report.warning
```

- [ ] **Step2: Watch RED.** Focused `pytest tests/test_gemini.py tests/test_media_api.py -q` via pinned uv; Expected: old quiet cleanup cannot produce required report.
- [ ] **Step3: Implement report.** Always attempt delete of the confirmed uploaded file in finally; preserve original error/result and expose a bounded redacted warning. Do not delete unconfirmed/unrelated account files or promise removal of provider processing logs. Keep30sSDK budget,5sdelete limit and current verified stable model/fallback IDs.
- [ ] **Step4: Verify/commit.** Same whole Python fast command; Expected all pass. Commit `fix: report provider cleanup without hiding slicing results`; Native task-done repeats it.

### Task 3: Explicit Studio source deletion and cloud suggestions

**Files:** Modify `web/src/studio/session.ts`, `session.test.ts`, `TakeList.tsx`, `ProjectReview.tsx`, `App.tsx`, legacy `take/takesApi.ts`, `sliceTake.ts` and their tests; create `web/src/cloud/api.ts`, `api.test.ts`, `controller.ts`, `controller.test.ts`, `useCloudSlice.ts`, `CloudPanel.tsx`, `web/e2e/media.spec.ts`; add report/update release-progress.

**Interfaces:** `StudioSession.deleteSource(takeId)->Promise<void>` clears retained descriptor, waits confirmed flush, then drops source cache and advances mediaRevision. `CloudSlice` freezes projectId/takeId/clipRevision/source before its consent request, exposes stable snapshot/subscription/start/cancel/apply; suggestions max50 are validated/refined to that original take. Apply checks identity/current revision and uses bounded undo; revision divergence requires explicit replacement approval. requestSegments requires an explicit grant; sliceTake defaults to local consent-required fallback without network. CloudPanel checkbox resets on selection and Send is distinct from checking it.

- [ ] **Step1: Write RED first.** Actual IDB session tests prove deleted source unavailable after reload, frames/clips unchanged, failed flush retains source. API tests count0requests before consent; one grant/upload after explicit choice, no key/token in archive. Controller tests navigation/cancel/revision divergence. Browser sample/local Find pauses count0cloud requests, synthetic included-source→keep→Delete→reload, explicit checkbox/Send→preview→Apply with safe identity and visible cleanup warning.

```typescript
it('defaults to local slicing without contacting the provider',async()=>{
  const request=vi.fn();const result=await sliceTake(frames,video,{request});
  expect(request).not.toHaveBeenCalled();expect(result.source).toBe('fallback');
});
```

- [ ] **Step2: Watch RED.** Focused Vitest session/cloud/legacy tests then Edge media.spec.ts; Expected: old source remains available/default helper uploads/explicit panel missing, with tools correctly loaded.
- [ ] **Step3: Implement consumers.** Source Delete has explicit confirmation and is disabled during a send. Consent text links Google terms/Files policy and states video leaves the computer/possible cost; checkbox-off and key-only configuration do not send. Freeze source, grant/upload once; failure/cancel keeps clips and local alternative. Preview suggestions and cleanup; require Apply and original identity/revision check, preserve bounded undo. Ordinary sample/save/backup remains camera/provider independent.
- [ ] **Step4: Verify/commit.** Full Web/Node/types/model SHA/build/Edge suite and Python fast suite. Expected all pass; browser/provider/camera evidence labeled synthetic/mocked. Commit `feat: expose explicit media deletion and Gemini consent in Studio`; Native task-done repeats the whole Web gate.

## Final gate

One fresh most-capable code-reviewer review of this plan's recorded BASE..HEAD with spec, verbatim Review Focus and all ledger rulings. Regrade by effect; Important/Critical get one watched RED→GREEN pass and whole suites; no re-review. Record every declined boundary/minor/cost and preserve existing ignored scratch. Continue remaining M3 Live Link and M4–M5; real provider/hardware/licensing/publication gates require separate evidence/authorization.
