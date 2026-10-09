# Processed Clip Preview Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Play clip display the same immutable derived frames as export, preserving original-take review and source-bound delivery.

**Architecture:** Shared single-clip preparation in studio/clips.ts; focused useReviewPlayback hook owns derived playback and validity; ProjectReview exposes accessible source controls. Existing usePlayback cancels obsolete frame callbacks. No processing/storage/SDK/dependency change.

**Tech Stack:** Frozen Node24.19/TypeScript7.0.2/Vitest5.0.2/Playwright1.62.1/React19.3, existing Python packaging/runtime.

**Spec:** docs/superpowers/specs/2026-10-09-processed-clip-preview.md

## Global Constraints

- Base88550fec2fcc9ae06550985735d9c06f76d09594; Native and continuous M1–M5 already approved; reused linked worktree.
- Original take frames, IDs, project/export revisions, makeClip/solver/SDK/model/locks/UPM/licensing text bytes unchanged.
- Process only on explicit Play; no callbacks/network/uploads/camera started implicitly.
- Preserve invalid draft saving and original review; do not silently relabel raw frames as exported preview.
- No feature enabling/host reboot/third-party message/main merge/public binaries or formal release without its distinct authorization.

## Review Focus

- Nonzero trim and variable source timing must display processed/rebased frames, not raw timestamps or unsmoothed poses.
- Editing/deleting/switching take or unmounting must not retain obsolete callbacks/clip memory or alter originals.
- Repeated Play/Stop/loop/endpoints must select the correct dataset and cancel previous work without render-driven reprocessing.
- Invalid/duplicate/missing/empty selected clip must fail clearly; valid clips remain reviewable despite unrelated invalid drafts.
- Frame-level equality and controlled browser tests must not be broadened into physical/Humanoid/five-user/clean-machine success.

### Task 1: Align preview preparation and lifecycle

**Files:** Modify web/src/studio/clips.ts, ProjectReview.tsx and web/src/record/usePlayback.ts; create web/src/studio/useReviewPlayback.ts. Extend clips.test.ts and add web/e2e/clip-preview.spec.ts. Update user docs/aggregate report and private source-bound qualification/handoff under .superpowers/sdd/2026-10-09-processed-clip-preview/.

**Interfaces:** projectClip(take:ProjectTake,clipId:string):Clip prepares exactly one selected clip; projectClips(take) retains complete batch validation and uses the same internal preparation. useReviewPlayback(take,frameRef) returns stop/playClip/playOriginal/sourceLabel; stores original take/frame identity and processed clip revision so stale requests stop/reset. Existing usePlayback still returns playhead/play/stop/seek and now cancels work when frames change.

- [ ] **Step 1: Write shared-preparation controls.** Variable timestamps/hip heights and nonzero trims: projectClip matches the actual projectClips output and differs from raw source; arrays/IDs/revisions unchanged. All loop/name/fps/skeleton fields preserved. Unknown/invalid/duplicate/empty selected IDs reject; another invalid draft blocks batch export but not the valid selected preview.

```typescript
it('preview packet equals the actual export without changing originals',()=>{
  const take=readyProject().takes[0],before=structuredClone(take);
  const output=projectClip(take,take.clips[0].id);
  expect(output).toEqual(projectClips(take)[0]);
  expect(take).toEqual(before);
});
```

- [ ] **Step 2: Watch RED and add real browser controls.** Run node node_modules/vitest/vitest.mjs run src/studio/clips.test.ts from web; preserve missing-interface failures. Browser tests mount actual ProjectReview/React in a real page with owned frameRef/RAF controls and capture real producer output; assert first/end/interior/repeated/loop/original poses and stale edit/delete/take/unmount cancellation. Include keyboard actions and real integrated Studio save/reload/backup/export routes. Expect old Play clip to show a raw pose different from its actual exported packet; no missing server/setup error is counted.
- [ ] **Step 3: Implement shared preparation and explicit preview requests.** Extract the existing makeClip+skeleton construction once. The hook prepares only on Play, uses clip-relative times and loop setting, retains request identity until source/revision changes, and resets stale requests. Restore original playback explicitly. Frame changes cancel pending callbacks. UI source status is textual and controls keep accessible names; selected invalid names disable Play with existing guidance.
- [ ] **Step 4: Verify affected/full Web and actual browser workflows.** Run affected then complete Vitest, TypeScript noEmit, assets/security/baselines and production build through exact installed CLIs; host has no npm CLI so do not install/upgrade dependencies. Run new browser tests plus affected studio/jobs/production suites in actual Edge with fresh owned artifacts. Retain failures, actual screenshots/logs and scheduling/API-double limits; originals/exports remain unchanged.
- [ ] **Step 5: Commit and refresh real delivery/handoff.** Build two fresh Windows candidates from the clean reviewed-test source with frozen prepared runtime/new Web. Independently verify complete ZIP/notice/source hashes and deterministic equality. Actual isolated entry and browser sample/save/reload/backup/import/export-input flow must work; do not infer physical or legal acceptance. Verify current96-member UPM remains byte-equal to retained licensed/optional-test-fixed archive. Create current Chinese clean-machine/beginner README/artifacts/RESULTS.csv from actual identities, keeping U01–U05 blank and not shortening the sample-to-own-FBX-to-Unity task.
- [ ] **Step 6: Whole Native review and completion.** One fresh strongest-model TypeScript review of code/private/browser/artifact proof; one TDD correction pass for Important/Critical, minors deferred. Preserve immutable evidence. Standing reviewed branch/draft PR/CI permission applies; no main merge, external message, binary publication or formal release. Task completion does not complete M1–M5.
