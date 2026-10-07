# SDK Processing Consent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. Preserve the user's continuous Native choice; one fresh final TypeScript review follows this independently testable feature.

**Goal:** Obtain a clear session choice before MediaPipe setup/inference and stop new processing safely on withdrawal.

**Architecture:** A mutable epoch-bound consent guard is shared by model factories, camera/video hooks and a labelled React control. Guard checks protect asynchronous setup/fallback/detection before cleanup effects; existing recording/cancellation saves frames and closes owned resources. Nothing persists the permission or grants Gemini upload.

**Tech Stack:** Existing React19.3/TypeScript7/Vitest5/Playwright1.62.1/Edge154, MediaPipe1.0.1/frozen model assets; no dependency or motion contract change.

**Spec:** `docs/superpowers/specs/2026-10-07-sdk-processing-consent-design.md`.

## Global Constraints

- SDK1.0.1/notice2026-06-05fixed; disclose on-device inputs and Google performance/utilization metrics separately from Gemini source-video sending.
- Default unchecked/session-only; checkbox alone starts no camera/model/request; no permission in IDB/project/archive/preferences/provenance or keys/tokens.
- Samples/saved takes/edit/backup/export remain usable without SDK permission; actual camera/video inference require explicit action after permission.
- Withdrawal remains available while busy; synchronously revoke leases before cleanup, stop new SDK calls/stale callbacks, preserve captured original frames/autosave and close returned owned resources.
- Already-started operations may finish and already-sent metrics cannot be recalled; no undocumented disable/privacy/provider-deletion claim.
- Keep current SDK/assets/dependencies/motion/calibration/recording/export/relay/Gemini semantics; no physical camera/private media/external telemetry QA.
- Native continuous local implementation, one fresh final reviewer; preserve ignored scratch/no public writes/main merge/release.

## Review Focus

1. With no choice or after withdrawal, camera/video paths and direct factory/detector calls must not start new SDK processing through a bypassed UI.
2. Withdrawal during WASM/pose/hand setup, fallback or a video seek must prevent subsequent SDK calls/stale delivery and release late owned model objects.
3. Withdrawal during recording/countdown/import must preserve the current project's original frames and recovery while ending only owned work.
4. Keyboard users and users who decline SDK metrics must understand the disabled controls and still finish the sample/save/backup/export workflow.
5. Session processing permission must reset on reload and remain separate from archive data, retained source media and Gemini upload authorization.

---

### Task 1: Session guard, safe model/capture lifecycles, accessible UI and actual browser qualification

**Files:**
- Create `web/src/privacy/processingConsent.ts`, `processingConsent.test.ts`, `ProcessingConsentPanel.tsx` — mutable permission/leases and explanatory checkbox.
- Modify `web/src/capture/landmarkers.ts`, `hands.ts`, `usePose.ts` — guarded initialization/fallback/late cleanup/camera/detection.
- Modify `web/src/import/detectFrame.ts`, `useVideoImport.ts` — guarded file/setup/detection/callbacks/cancellation.
- Modify `web/src/App.tsx`, `web/src/record/CaptureControls.tsx`, `web/src/studio/studio.css` — shared session object/state, withdrawal stop/save/cancel and labelled disabled import/camera.
- Create `web/src/capture/landmarkers.test.ts`; extend `web/src/import/detectFrame.test.ts` and existing hand factory tests only where consumers change; create `web/e2e/sdk-consent.spec.ts`; update consent setup in existing capture-dependent e2e files identified by search.
- Create `docs/sdk-privacy.md`, `docs/superpowers/reports/2026-10-07-sdk-processing-consent.md`; modify `docs/release-progress.md`. No server/Blender/Unity/source-contract changes.

**Interfaces:**
- `type SdkAuthorization = () => void`; `class ProcessingConsentError extends Error`; `class ProcessingConsent { readonly allowed: boolean; setAllowed(value: boolean): void; lease(): SdkAuthorization; }`. Getter is false initially; transitions increment a private epoch; lease requires admission and captures that epoch, so withdrawal/regrant leaves old lease invalid.
- `createLandmarkers(quality: CaptureQuality, authorize: SdkAuthorization): Promise<Landmarkers>` and `createHandLandmarker(fileset: WasmFileset, authorize: SdkAuthorization): Promise<HandLandmarker>` require authorization. `closeLandmarkers` retains its signature. Check before/after awaited resolver/creation and before retry; specific consent errors propagate and returned owned resources close.
- Add `processingConsent: ProcessingConsent` to `VideoImportOptions`; `usePose` receives the same stable object as an added final parameter with explicit App consumer. `createFrameDetector(landmarkers, trackHands, authorize: SdkAuthorization)`checks immediately before each SDK detection; no raw solver change.
- `ProcessingConsentPanel({allowed:boolean,onChange:(allowed:boolean)=>void})`provides labelled checkbox/help/privacy-policy link, never disabled by recording/import locks. CaptureControls adds `canImport:boolean` and forwards it to ImportButton; CameraView startDisabled includes permission without changing its interface.
- App owns stable `useMemo(()=>new ProcessingConsent(),[])`and false UI state. Changing permission revokes synchronously; false stops camera, calibration and import, calls recorder.stop()for recording or existing discard for countdown, and clears only active live tracking indicators. Existing useCaptureProjectfinalization/autosave remains responsible for original take data.

- [ ] **Step1: Write meaningful default/epoch/factory/detector tests with only a loadable new permission stub.** Use vi.hoistedSDK mocks and controlled deferred resolver/pose/hand promises. The existing factory ignores the added authorization argument before implementation, so denial/fallback/late return checks must fail at behavior. Cover body-only fallback for ordinary admitted hand failure. Match tests to actual existing detector return types; no new test dependency.

```typescript
it('does not authorize an old lease after withdrawal and regrant',()=>{
  const consent=new ProcessingConsent();consent.setAllowed(true);
  const previous=consent.lease();consent.setAllowed(false);consent.setAllowed(true);
  expect(previous).toThrow(ProcessingConsentError);expect(()=>consent.lease()()).not.toThrow();
});
it('does not resolve WASM before processing is admitted',async()=>{
  const deny=()=>{throw new ProcessingConsentError('Choose SDK processing first');};
  await expect(createLandmarkers('fast',deny)).rejects.toBeInstanceOf(ProcessingConsentError);
  expect(FilesetResolver.forVisionTasks).not.toHaveBeenCalled();
});
```

- [ ] **Step2: Watch focused RED.** Run pinned npm via the existing pnpm fallback: `npm test -- src/privacy/processingConsent.test.ts src/capture/landmarkers.test.ts src/import/detectFrame.test.ts`. Expected: guard/admission/race behavior fails, not module/dependency setup. Redirect output to this plan's ignored workspace/read tail.
- [ ] **Step3: Implement permission and SDK factory/detector boundaries.** Guard before/after each awaited step and immediately before every SDK call. Cancellation errors must not become GPU→CPU retry or body-only success. Store returned resources before checking late permission; close those objects on rejection without double close. Keep admitted GPU/CPU/optional hand behavior. Default-denied direct callers are explicit, never a permissive callback.

```typescript
class ProcessingConsent {
  private value=false;private epoch=0;
  get allowed(){return this.value;}
  setAllowed(value:boolean){if(value!==this.value){this.value=value;this.epoch+=1;}}
  lease():SdkAuthorization{
    if(!this.value)throw new ProcessingConsentError('Allow MediaPipe processing before starting camera or video.');
    const admitted=this.epoch;
    return()=>{if(!this.value||this.epoch!==admitted)throw new ProcessingConsentError('MediaPipe processing permission was withdrawn.');};
  }
}
// Factory: authorize(); await resolver; authorize(); await pose; authorize();
// fallback/hand creation likewise; cleanup each returned object on denial.
```

- [ ] **Step4: Implement capture/import/UI wiring, then focused GREEN.** Camera gets a lease before getUserMedia/model work, tests it before tick's pose/hand calls and delivery, and closes via existing cleanup. Import start obtains/checks a lease before file admission; model factory/seek/detector/progress/onDoneuse the same lease plus AbortSignal. Permission object transitions invalidate old work even before React cleanup. App false transition uses the existing stop/discard/cancel paths to preserve motion; checking only updates permission. Panel copy follows the spec, with help linked by aria-describedbyand named checkbox/section. canImportdefaults false where caller omitted; explicit App consumer supplies the permission state.

```tsx
<section aria-label="MediaPipe processing" className="studio-processing">
  <p id="sdk-processing-help">Images and video are processed on this device. MediaPipe APIs send performance and usage metrics to Google.</p>
  <label><input type="checkbox" checked={allowed} onChange={event=>onChange(event.target.checked)} aria-describedby="sdk-processing-help" />Allow MediaPipe performance and usage metrics</label>
  <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google Privacy Policy</a>
  <p>Camera and video processing require this choice. Samples, saved takes, editing and export remain available without it.</p>
</section>
```

Run Step2again. Expected: all meaningful guard/factory/detector tests green; TypeScript consumers use the exact new signatures.
- [ ] **Step5: Add actual Edge scenarios/owned synthetic fixtures.** Reuse existing getUserMedia/SDK synthetic hooks; this verifies admission/lifecycle, not real provider telemetry. Tests pin default denial/no model/camera calls, checkbox-only no processing, admitted explicit camera→record→withdraw→stopped/preserved, countdown withdrawal, pending GPU/hand/seek/import withdrawal, keyboard/reload unchecked/archive absence/Gemini separation, and sample/save/backup/reload without granting. Update existing capture-dependent journeys to make their permission explicit; samples need no change.

```typescript
await expect(page.getByRole('checkbox',{name:'Allow MediaPipe performance and usage metrics'})).not.toBeChecked();
await expect(page.getByRole('button',{name:'Start camera'})).toBeDisabled();
await page.getByRole('checkbox',{name:'Allow MediaPipe performance and usage metrics'}).check();
// Assert owned SDK/camera counters remain0 until explicit Start camera.
await page.getByRole('button',{name:'Use sample project'}).click();
// Save/reload/backup: consent resets false; original frames remain intact.
```

- [ ] **Step6: Whole Web/type/assets/security/build plus relevant Edge GREEN.** Run pinned `npm test`, `npm run test:assets`, `npm run test:security`, `npm run build`; then actual Edge full existing suite plus sdk-consentjourneys using Playwright's installed channel. Expected: relevant assertions/compiled bundle/frozen SHA gates pass; no SDK/API upgrade. Inspect desktop/narrow screenshots and accessible labels. Production default/sample page check has0external/cloud/model calls; allowed inference fixtures are explicitly mocked/synthetic and cannot establish real SDK network behavior.
- [ ] **Step7: Record actual evidence, commit and Native task-done.** Report exact counts/browser/version, privacy notice source, original-frame retention, admitted/denied/cancel cases, all Rulings+costs and untested actual telemetry/device gates. Commit only source/tests/docs, no user data/harness artifacts. Native task-done repeats the whole Web test command from this brief (`npm test`, via pinned executor) and records the result only when green; source other suites/e2e/build were read above.

## Final review and continuation

Check spec coverage/signatures/no placeholders/five focus mappings before execution. Whole plan BASE..finalHEADreview package, one fresh most-capable TypeScript reviewer using requesting-code-reviewand the ledger's Rulings. Re-grade findings/declined cases by actual user effect; one Critical/Important RED→GREEN fix pass/whole relevant green, no rereview; minors deferred, all decisions in report. Retain scratch after earlier deletion rejection. Continue vendor notices/English README/zh-TWquickstart/remaining human gates; do not treat SDK consent or mocks as full release/actual telemetry proof.
