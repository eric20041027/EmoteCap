# M2 Studio integration and browser recovery

Date: 2026-10-07, America/New_York. Branch: feat/studio-projects. Plan base: efbb89e. Code increments: 75bd919 (sessions/checkpoints), a8ca54a (controls/archives), acd2d89 (capture integration). [Plan](../plans/2026-10-07-studio-integration.md), [M2 spec](../specs/2026-10-06-studio-projects-design.md). The full objective remains M1–M5.

## Working behavior

Studio now creates, names, opens and deletes projects, restores the last saved selection, and retains separately identifiable takes. Clip names, ranges, loops and descriptions save through the immutable project model with bounded undo. Invalid or duplicate draft names remain saveable while FBX export is disabled. Keyboard time edits stay inside the original take with a 0.1-second minimum. Export interpolates exact subframe boundaries, fixing the previous collapse of a 0.2–0.8-second range over sparse samples into one pose.

Loading, dirty, saving, saved and error states are visible. Failed quota writes or a newer tab's revision preserve downloadable work; navigation cannot discard failed pending edits. Reopening a saved copy requires an explicit discard decision. Optional source retention and source inclusion in a portable backup are independent. Source video remains in a bounded memory cache until kept or explicitly discarded when leaving the project. Removing retention deletes native stored blobs atomically after Saved.

Camera/MediaPipe startup is explicit. Sample/open/import never requests a camera merely on mount. Camera shutdown releases both current and late-arriving resources, including a model that finishes while permission is still pending. A new camera generation/device/quality owns a fresh solver and calibration state. Recording validates and owns each solved frame, respects project/take/time limits, appends checkpoints every five seconds and flushes the final tail immediately. An invalid capture stops with its preserved prefix marked interrupted. Source finalization binds to the captured take identity rather than whichever take is currently selected.

The committed synthetic sample supports onboarding without models or Blender. Setup diagnostics check local model HEAD metadata and show export-service/Blender readiness. Missing Blender leaves review, save and project backup available. Local Find pauses makes no provider request; explicit Gemini transmission remains M3 work.

## Verification

- Watched saved-name restoration return a blank draft before implementation; checkpoint construction returned no take; provenance returned incorrect models/calibration.
- Watched late source attachment fail to reject during navigation; storage retry replace imported memory work; navigation install a new lane after disposal. Each has a passing regression.
- Watched draft export validation/backup helpers fail; subframe trim returned 1 frame instead of 19. Cancellation during a pending save still installed an import, and autosave hid unrelated import errors; both now pass regression checks.
- Watched invalid/time/capacity captures incorrectly continue, and a failed capture finalize as complete. The valid original prefix is now preserved and labelled accurately.
- **384 Web tests passed / 42 files; 8 Node asset/security tests passed.** TypeScript passed; all three cached model SHA256 checks passed; production Web build passed (169 modules, lazy archive chunk). Backend source is unchanged; the M1 hosted run is its prior evidence, not a fresh backend rerun.
- **14 actual browser tests passed together**, with one worker on installed **Microsoft Edge 154.0.4258.62**, driven by Playwright 1.62.1. Thirteen use the development application and one uses the production build. Owned strict-port servers use 127.0.0.1:4175/4176 and never reuse a foreign service.
- Browser cases cover no-camera sample save/reload, keyboard range/name/loop edits and undo, draft/duplicate export gating, backup/import under a new namespace, corrupt import preservation, injected quota recovery download, native multi-tab conflicts and explicit reopen, source retention/removal/reload, earlier-take preservation, camera opt-in/late-resource cleanup, synthetic recording checkpoints/finalization/source identity, and interrupted recording recovery.
- The built application independently completed sample/edit/save/reload/backup/import with **zero external HTTP and zero tracking-model requests**. Desktop and 390-pixel layouts were captured and visually inspected; the narrow layout has no horizontal page overflow.
- Exact **@playwright/test 1.62.1**, Apache-2.0, is development-only. Four new dev/optional lock records were added (@playwright/test, playwright, playwright-core 1.62.1 and nested fsevents 2.3.2); **zero existing package records changed**, and installation audit reported **0 vulnerabilities**.
- Existing >500 kB main-bundle and Three.js PCFSoftShadowMap fallback warnings remain. Browser tests do not claim new motion-quality or performance qualification from the rendered mannequin.

The first lazy archive action exposed a Vite optimizer page reload: its trace showed an interrupted optimized ZIP request followed by a new document navigation. Explicit initial prebundling fixes the development workflow; the runner forces cold optimization. Production archive behavior is verified separately. [Vite dependency optimization](https://vite.dev/config/dep-optimization-options.html) describes these development-only controls.

Final Native whole-plan independent review found Critical0/Important2/Minor0. Both Important findings were reproduced and fixed in the single TDD pass at e7c5005: unkeeping a reloaded source now caches its validated original before deleting the stored copy, and reaching20takes no longer disables active Stop/Cancel. The new unit regression verifies backup bytes and re-retention; the actual-browser regression manually stops and completes the twentieth take. All384Web/8Node and14browser cases passed after the fixes. No re-review was dispatched under the Native rule. Local workflow qualification does not mark all M2 or release gates complete.

## Rulings made

1. Continue the already-authorized Native M1–M5 execution without another routine plan approval. Cost if wrong: product choices remain open to steering before release.
2. Require an explicit UI discard decision before leaving unretained memory sources; bound the current project's source cache. Cost if wrong: switching requires a keep/download/discard choice.
3. Require explicit discard before reopening a conflicting saved copy; retry never overwrites a newer tab. Cost if wrong: users must download recovery before discarding pending edits.
4. Substitute synthetic model detections and inject quota failure only with explicit evidence labels. Cost if wrong: automation could be mistaken for physical camera/disk/hardware acceptance; those gates remain pending.
5. Preserve ignored verification scratch after the earlier cleanup rejection. Cost if wrong: bounded local diagnostic files remain.
6. Accept internal typed immutable domain mutations in update, while parsing external install/open documents. Cost if wrong: a future untrusted updater must enter through validation; storage still enforces original transitions. This avoids copying every original frame on each clip keystroke.
7. Treat the last-project localStorage preference as advisory; IndexedDB confirms durability. Cost if wrong: a blocked preference opens the most recently saved project rather than the preferred one.
8. Fix existing makeClip boundary interpolation in this plan because subsecond edits need their selected duration. Cost if wrong: legacy callers receive precise boundaries; all prior clip tests remain passing.
9. Add an optional installation AbortSignal and injectable download sink. Cost if wrong: future import callers must forward cancellation to the final installation boundary.
10. Move the initial Playwright setup/sample test ahead of UI implementation to preserve consumer RED→GREEN. Cost if wrong: the development runner arrives earlier, without runtime dependencies.
11. Share NameField and keep export ownership in App across keyed take review. Cost if wrong: App owns one extra session-level hook until M3 jobs replace it.
12. Validate solved frames at ingestion and mark invalid captures interrupted. Cost if wrong: bounded per-frame validation needs M4 FPS/latency measurement.
13. Reset solver/calibration ownership with camera generation/device/quality; freeze provenance at capture start. Cost if wrong: camera restart requires a new T-pose.
14. Model HEAD checks establish availability, not a new browser-computed SHA. Cost if wrong: externally modified assets need explicit hash revalidation; installer hash checks remain required.
15. Prebundle the lazy ZIP dependency during development to prevent import-triggered reload. Cost if wrong: slightly more startup work; production uses its independently tested bundle.
16. Use two isolated owned acceptance servers for development and production. Cost if wrong: two test ports must be free; the runner refuses reuse and does not terminate a foreign service.

Final review rulings for every declined boundary:

17. Keep physical camera permission, actual MediaPipe inference and motion quality pending. Cost if wrong: camera/inference may fail outside synthetic browser lifecycle tests.
18. Keep physical quota, eviction, power loss and browser persistence policies pending. Cost if wrong: physical disk/browser recovery may differ from injected quota/native transactions.
19. Require maximum-size memory/responsiveness and Fast720p FPS/p95 measurement on the M4 target laptop. Cost if wrong: large projects or ordinary laptops may pause excessively.
20. Require real Blender/Unity direction, scale and timing plus two redistributable rigs in M4. Cost if wrong: exported animation remains unqualified.
21. Retain M3 provider/jobs and M4/M5 clean-machine, beginner, licensing and public-release gates in the active full goal. Cost if wrong: subsystem qualification could be confused with release readiness.
22. Preserve previous independent storage/archive approvals while qualifying new integration interactions. Cost if wrong: a new boundary interaction may require another regression.
23. Refresh vulnerability audit and hosted CI for the later release candidate; current browser evidence is Edge only. Cost if wrong: advisories or platform differences can change before publication.

Deferred minor findings: none.

## Evidence boundaries and remaining gates

The capture acceptance uses an actual browser canvas MediaStream/MediaRecorder and the actual application recorder/solver/storage lifecycle, with synthetic pose detections substituted at the model module. It does **not** use a physical camera or actual MediaPipe inference. The source-retention fixture also transports bounded synthetic opaque bytes rather than claiming authentic video content. Quota failure is injected at native IDBObjectStore.put; real transaction rollback/conflict/blob behavior is exercised, but actual disk quota, eviction and physical durability are not thereby proven.

Maximum-size memory/responsiveness/deadline behavior, a physical camera workflow, actual Fast 720p effective FPS/p95 latency, Blender/Unity animation on two redistributable rigs, authorized motion-quality data, clean-machine packaging and the five-person beginner acceptance remain required. Native IndexedDB alone is a recovery cache; portable backups remain necessary.

Test logs and the plan ledger are retained. Playwright's browser-results/report contain the latest run's artifacts; earlier failure traces were used during diagnosis and are not claimed as permanent historical artifacts after runner output replacement.

No M2 push/PR, remote main merge, tag or release occurred. Local main remains verified M1 25c6cbe. M3–M5, owner/contributor licensing decisions and owner-approved release stay in the active goal.
