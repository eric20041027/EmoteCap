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

One fresh independent TypeScript reviewer approved fixed range58643bc..3a59de3 with0Critical/0Important/0Minor findings. Its fresh16focused tests and TypeScript check passed; the previously recorded whole Web/browser results were read, not independently rerun. ESLint is not configured and no lint or new hosted-CI result is claimed. Native task-done repeated474/50files green1.89seconds. No correction pass or re-review was required. The review maps default/direct admission and leases to focus1; deferred factories/fallbacks/seeks to focus2; captured-prefix/final-save/countdown/import checks to focus3; keyboard and declined sample workflows to focus4; reload/backup/Gemini separation to focus5.

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

Deferred minors: none. Ignored evidence and earlier failed runs remain retained locally.

## Final considered behaviors and effect-based rulings

Root retained all32declined behaviors after grading their actual user effect. Each reason and cost is recorded below; no finding was dismissed merely because the spec omitted its input.

- Final: Ruling: Default/direct-call bypass — object starts denied and production factories/detector require leases beyond disabled controls — cost if wrong: SDK processing could begin without a choice.
- Final: Ruling: Checkbox-only processing — granting changes only permission/state, with camera disabled/no selected file — cost if wrong: the checkbox could open camera or load models.
- Final: Ruling: Regrant revives old work — epoch transition leaves previous leases invalid — cost if wrong: old setup/results could resume under a new choice.
- Final: Ruling: Old selected-camera fallback — original lease is checked before fallback — cost if wrong: a withdrawn request could open another camera.
- Final: Ruling: Resolver/pose/hand awaited withdrawal — each boundary guards subsequent calls and late objects — cost if wrong: unauthorized models/bundles could escape.
- Final: Ruling: Denial treated as GPU failure — retry rechecks the monotonic original lease — cost if wrong: CPU retry could run after withdrawal.
- Final: Ruling: Denial treated as optional hand failure — same lease recheck and specific error propagate — cost if wrong: body-only processing could continue after withdrawal.
- Final: Ruling: Late resource leak/double close — objects are owned before checking, rejected hand never assigned to outer bundle, late bundle closes in its caller — cost if wrong: GPU/WASM resources could leak or double-close.
- Final: Ruling: Runtime hand error double-close — camera clears local and bundle ownership; import keeps the failed hand owned until final cleanup — cost if wrong: final cleanup could close an already-closed hand.
- Final: Ruling: Detection after withdrawal — camera/import guard admission and delivery; adjacent synchronous SDK steps have no user-event yield — cost if wrong: detector calls or results could escape authorization.
- Final: Ruling: Already-started synchronous work — prevent subsequent work/delivery with disclosed in-flight limit — cost if wrong: users could expect retrospective cancellation/provider deletion that is not supplied.
- Final: Ruling: Late camera contaminates new session — disposal/lease and stream identity checks stop late streams/bundles — cost if wrong: an old completion could replace/blank a new camera or leak.
- Final: Ruling: Import cancellation waits for effects — generation and lease are changed synchronously, signal checked as well — cost if wrong: work could advance before cleanup.
- Final: Ruling: Stale seek/progress/final commit — guarded seek/progress/onDone and inactive cancellation prevent delivery — cost if wrong: cancelled motion could reach preview/Live Link or a saved take.
- Final: Ruling: Conversion catches consent error — guarded progress and next seek still reject immediately — cost if wrong: repeated denied frames could continue.
- Final: Ruling: Recorded prefix loss — normal stop/final checkpoint retains frames; discard is limited to countdown — cost if wrong: original captured motion could be lost/replaced.
- Final: Ruling: Raw video finalization order — existing MediaRecorder layout cleanup precedes passive camera cleanup, source attachment independent — cost if wrong: real-device source encoder could fail despite saved motion; synthetic SDK tests do not qualify every encoder.
- Final: Ruling: Countdown/calibration survival — cancel/discard/clear-world paths run and overlay does not block the checkbox — cost if wrong: delayed countdown/calibration could survive withdrawal.
- Final: Ruling: Withdrawal while busy — native checkbox has no disabled lock and is outside locked fieldsets — cost if wrong: users could be trapped until processing ends.
- Final: Ruling: Disabled-control explanation — preceding named region and checkbox descriptions explain requirements/alternatives — cost if wrong: direct navigation to a disabled control could require reading back; no blocked workflow demonstrated.
- Final: Ruling: Declined sample/edit/backup/export — permission only gates capture/import/record; independent paths unchanged — cost if wrong: declining metrics could block existing local work.
- Final: Ruling: Permission portability — App-only state has no schema/storage/provenance field; archive metadata/reload checked — cost if wrong: restored projects could silently authorize processing.
- Final: Ruling: Gemini cross-authorization — SDK and cloud state have no connection; independent controls/explicit sending checked — cost if wrong: one choice could grant upload or erase another choice.
- Final: Ruling: No-op test authorization — only fixture controls use it; production callers receive required leases/wrappers, not a hostile-code boundary — cost if wrong: an overlooked caller could bypass consent.
- Final: Ruling: Separate CPU-return tests — delegates share the post-await ownership/guard, with deferred/retry/ordinary controls covered — cost if wrong: a future delegate-path split could expose a coverage gap.
- Final: Ruling: Ordinary Stop-camera semantics — existing disposal lifecycle is unchanged; permission lease specifically models withdrawal, which remains available — cost if wrong: unrelated stop/retry behavior could need a separate lifecycle task; no new withdrawal bypass found.
- Final: Ruling: Throwing close method — retained SDK/helper contract with no concrete throwing-cleanup failure — cost if wrong: one thrown close could prevent later cleanup or obscure the primary error.
- Final: Ruling: Compact formatting/mutable object/inferred types — surrounding conventions and synchronous epoch requirement, typed permission methods — cost if wrong: maintenance could be harder; no present user failure established.
- Final: Ruling: Synthetic qualification scope — reports explicitly limit camera/SDK/decoder/provider mocks and release claims — cost if wrong: users could mistake lifecycle mocks for measured telemetry/device behavior.
- Final: Ruling: Archive named-payload transport — exact downloaded bytes use unchanged parser and UI import — cost if wrong: arbitrary long Windows filesystem input remains unqualified, as disclosed.
- Final: Ruling: Playwright artifact configuration — test-only unique fresh roots/channel, no runtime path changes — cost if wrong: deliberately reused explicit artifact roots could overwrite a run; all qualification callers use fresh owned roots.
- Final: Ruling: Unrelated contract/pin changes — fixed diff contains no SDK/dependency/solver/backend/Unity implementation changes — cost if wrong: prior qualifications would need separate validation.
