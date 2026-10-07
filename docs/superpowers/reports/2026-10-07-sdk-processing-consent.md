# SDK processing choice and withdrawal qualification

[Spec](../specs/2026-10-07-sdk-processing-consent-design.md), [plan](../plans/2026-10-07-sdk-processing-consent.md), [user guide](../../sdk-privacy.md). Review base58643bc; task basec57e9f2. Native local implementation; no public push, main merge, tag or release.

## Result

A session-only, initially unchecked MediaPipe choice gates both explicit camera startup and video import. Checking alone starts neither. Epoch-bound leases prevent old work from resuming after withdrawal and regrant. Guards cover WASM/model resolution, pose and hand creation, GPU fallback, selected-camera fallback, detection, video seeks, progress and final take delivery. Late returned owned resources close. Normal admitted CPU and body-only fallback remain available.

The always-available withdrawal control cancels countdown/import and stops camera capture. Recording uses its existing stop/final save path. Completed takes, original frame prefixes and retained-source choices survive. No permission is stored in project/IDB/archive data. Gemini source-video consent remains independent.

The installed MediaPipe Tasks Vision1.0.1 README and [primary upstream notice](https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/tasks/web/vision/README.md) were checked on2026-10-07; the notice is dated2026-06-05. It distinguishes on-device inputs from Google performance/utilization metrics. The UI explains both, links Google's privacy policy and states that already-started work may finish and already-sent metrics cannot be recalled. No undocumented telemetry-disable or provider-deletion claim is made.

## Watched gates

- Core default/lease/factory/detector characterization:13behavior failures and3ordinary-fallback controls before implementation, then16passed. Controlled promises cover resolver/pose/hand withdrawal, late cleanup and denial before fallback/detection.
- Initial browser launch without installed-channel configuration failed before behavior; it was not counted as RED. Actual Edge default/sample tests then failed because the required control was absent and passed after wiring.
- Camera plus first SDK lifecycle round:12actual Edge cases passed in1.3minutes. Synthetic canvas camera/model fixtures prove recording stop/save, original-prefix preservation, countdown cancellation, late returned models, denied file admission and cancelled model/seek imports.
- Additional selected-camera regression reproduced two camera requests where one was authorized; adding the lease check before fallback passed. A withdrawal/regrant cycle does not authorize an old camera retry.
- Whole Web:474tests in50files passed; assets6/security2 passed; TypeScript and183module production build passed. Existing large-bundle/Three.js warnings remain, with no dependency upgrade.
- Edge154.0.4258.62:27development cases passed in the whole-suite run; its one new production assertion incorrectly expected an import button while reviewing an existing take. The existing capture UI shows it before a take is selected. Moving that assertion to the initial page passed the one production journey separately. All28current journeys are qualified across those runs, including nine SDK cases. Desktop1280px and narrow390px production screenshots were inspected; no horizontal overflow. No product behavior was changed for the assertion correction.

The downloaded backup's manifest/project JSON is checked for absence of permission fields; the exact bytes are also decoded in the browser. Deep path-backed test input failed with captured Edge File.arrayBuffer NotFoundError although Python/Node read the file and browser decoded copied bytes. Qualification uses the downloaded bytes in a named File payload and a fresh shorter whole-suite artifact root. No archive parser was relaxed. Arbitrary long Windows browser-file paths are not qualified.

## Review and limits

Final independent TypeScript review is pending. The review maps default/direct admission and leases to focus1; deferred factories/fallbacks/seeks to focus2; captured-prefix/final-save/countdown/import checks to focus3; keyboard and declined sample workflows to focus4; reload/backup/Gemini separation to focus5.

Inference fixtures use owned synthetic camera streams, model API results and a synthetic decoder. Gemini API responses are mocked and upload counters remain zero until its separate explicit send. Production sample requests establish unused SDK/model behavior only. Actual Google metrics, physical cameras, real source-video quality, target-laptop latency, Unity playback and clean-machine/new-user acceptance remain pending. Existing backend/Blender qualification is unchanged; the older2c019a0 Windows candidate does not contain this new Web UI and must be rebuilt/qualified before formal release.

## Rulings and costs

- Ruling: Continue authorized Native without another plan/method confirmation — full M1–M5continuous authorization — cost if wrong: local reviewable privacy/lifecycle work only, public and human gates stay separate.
- Ruling: Default-denied session-only SDK processing choice, explicit before camera/video — installed1.0.1upstreamnotice states Google performance/utilization metrics despite on-device inputs — cost if wrong: declining users cannot process camera/video through this SDK, but sample/saved/edit/backup/export remain available; no undocumented telemetry-disable mechanism invented.
- Ruling: SDK permission never grants Gemini source upload and does not persist — separate selected-source permission/identity required — cost if wrong: reload requires an explicit new SDK choice, no portability of a prior privacy decision.
- Ruling: Withdrawal stops new operations/stale callbacks and preserves recorder stop/checkpoint state; already-started requests/previousmetrics cannot be recalled — SDK API does not expose that deletion/disable guarantee — cost if wrong: in-flight work may finish, no retrospective provider-deletion claim.
- Ruling: Create web/src/import/detectFrame.test.ts instead of extending a missing file — actual file inventory has no existing detector test — cost if wrong: one new meaningful detector behavior test module, no test dependency.
- Ruling: Keep earlier ignored scratch after deletion rejection — no cleanup workaround — cost if wrong: retained disk use.
- Ruling: set EMOTECAP_BROWSER_CHANNEL=msedge and use per-run ownedE2Eartifactroot — existingconfighardcoded earlierLiveworkspace; default bundledChromium absent — cost if wrong: tests dependonactualinstalledEdge, no newbrowserdownload; oldrunnerlaunchfailureartifacts retained. playwright.config now uniqueUUIDartifactroot or explicit EMOTECAP_E2E_ARTIFACT_DIR; no deliberateearlierscratchcleanup.
- Ruling: Extend required guard to selected-camera fallback, not just MediaPipe retry — an already-started camera failure must not authorize a new camera request after withdrawal/regrant — cost if wrong: an old failed camera setup ends rather than recovering automatically; explicit fresh Start camera remains available.
- Ruling: Clear a hand tracker from its owning bundle after ordinary hand-error close — withdrawal cleanup must not close the same owned model twice — cost if wrong: body-only tracking persists until explicit camera restart, preserving existing fallback behavior.
- Ruling: Inspect downloaded archive JSON and explicit Gemini control separately — IDB field absence alone is not portable-permission or source-upload admission evidence — cost if wrong: qualification uses owned synthetic sample/source fixtures, no provider upload or actual SDK telemetry claim.
- Ruling: Use existing panel-border CSS variable — new consent border referenced nonexistent --border — cost if wrong: presentation-only panel border uses the existing theme, no workflow/data change.
- Ruling: Re-import exact downloaded bytes through Playwright's named File payload and use a fresh shorter owned whole-suite artifact root — deep retained harness path is unreadable through Edge path-backed File; do not change archive parsing or claim a consent corruption — cost if wrong: this test proves backup-byte portability, not arbitrary long Windows filesystem path support; existing path-backed production qualification uses a shorter fresh path. Preserve all failed outputs.
- Ruling: Check disabled video import before selecting sample take and mock empty jobs in built-only UI fixture — existing selected-take review hides capture controls; the production test has no live backend — cost if wrong: this pins the actual default admission/UI layout and sample portability, not a live server export integration. Real bundled-server export was separately qualified for the older Windows candidate.
- Ruling: Native task-done executes the installed Vitest entry with --root web — npm test is exactly vitest run and bare npm is unavailable in this Windows shell — cost if wrong: equivalent full suite, pinned installed Vitest5.0.2; no package script/dependency change or test subset.

Deferred minors: none recorded before final review. Ignored evidence and earlier failed runs remain retained locally.
