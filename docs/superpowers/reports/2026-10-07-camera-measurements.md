# Studio camera measurement qualification

Plan/spec: [implementation](../plans/2026-10-07-camera-measurements.md), [design](../specs/2026-10-07-camera-measurements-design.md). Review baseccf52dc; plan3518b3e; Task1 implementation48bfc61; Task2 and final independent review remain in progress at this report's initial creation.

## Implemented boundaries

The optional sink observes the existing Studio hook/solver/Three.js renderer. Its separate development HTML mounts actual Studio with local metadata/start/stop/response/download controls. Default production contains neither the private entries nor the collector/source payload. Ordinary motion numerical output, recorder/project/SDK admission, model versions and alternate-frame Fast hand behavior remain unchanged. Two narrow-screen wrapping rules prevent the existing preview controls from extending beyond320px.

The bounded receipt retains failures, overwritten/duplicate attempts, actual setup/delegates and first matching renders. Wall/warmup denominators and presented-input deduplication produce effective camera FPS; all-output/attempt counts remain separate. Unknown input identity withholds camera FPS/first-input p95/candidate eligibility. Source commit/hardware/rights/classification are declarations; four exact source text digests are traceability, not whole-runtime authentication. Qualification always remains pending. See [operator guide](../../camera-measurements.md) for exact timing/privacy/limits.

## Watched verification

- Initial29 behavior cases were29RED against declarations/stubs, then29GREEN. Readiness/metadata freezing/privacy, literal wall arithmetic/p95, old/mutated/replaced frame references, no-pose/clock/setup/context/attempt/response bounds and throwing observer cleanup were exercised.
- Portrait tracking dimension case:1RED/29 controls then30GREEN; delivered1280x720 and tracked540x720 remain distinct via the existing crop calculation.
- Actual first Edge case failed on missing private controls before the implementation. The first full7-case run gave6PASS/1RED on320px overflow. DOM evidence identified .legend/.panel__head extending to381.75px; narrow wrapping corrects it.
- Browser investigation also observed28SDK calls for8 video frames. Three new literal input-identity cases were3RED/30 controls then33GREEN: duplicated input/render output counts, unknown identity withholding, and a reset despite advancing media time.
- Whole Web currently566/54files passes; TypeScript passes;49Node asset/security/source/compiler cases pass with zero skips. Pinned npm11.21.0 full build verifies cached model SHA256 and succeeds with184 modules; pre-existing large-chunk advice remains.
- Final affected Edge154.0.4258.62 matrix passed21/zero skips in1.5min:7new camera,9SDK,4capture,1production sample. Actual downloaded corrected receipt is4573bytes/16attempts/12rendered outputs/1unique rendered input, synthetic/pending. Four digests matched actual source files; no source images/motion/private camera IDs were included. The320px full screenshot was inspected, with readable wrapped controls and no horizontal overflow. Dev/production listener check after completion found0; no external physical camera/provider/inference was exercised.

Ignored evidence belongs to `.superpowers/sdd/2026-10-07-camera-measurements/` and fresh `.superpowers/e2e/camera-*` roots. Final root is `.superpowers/e2e/camera-reg-f5c578c2`; immutable completed/partial/error/no-pose/observer/stalled/hidden downloads and `camera-narrow.png` are retained there. Failed/early outputs are retained separately and are not substituted for the corrected data. Receipt provenance is tested against actual four filesystem source hashes, with SDK/camera substitutes explicitly classified synthetic. Mocked SDK time is not a hardware performance result. Backend code is unchanged; no new backend/runtime/laptop/Unity evidence is claimed. Existing Three.js shadow advice and source-only missing export API warnings were observed; these flows deliberately use no server/provider.

## Rulings and costs

1. Execute continuously with preserved Native method: the user authorized M1–M5 local work. Cost if wrong: revertible local increment, no public write.
2. Record render-call and next-animation-frame timing proxies: browser code cannot observe physical exposure/display completion. Cost if wrong: actual hardware acceptance still requires external latency instrumentation.
3. Retain all owned/old ignored evidence after earlier cleanup rejection. Cost if wrong: disk use.
4. Validate tracking dimensions with existing cropRect while retaining delivered camera size. Cost if wrong: diagnostic comparability; ordinary motion behavior unchanged.
5. Add two narrow-only wrapping rules because mounted Studio controls overflowed the promised320px width. Cost if wrong: different control wrapping below640px; no numerical/persistence changes.
6. Extend optional observation with presented-video identity and deduplicate effective FPS: currentTime/SDK call counts overstated camera throughput. Cost if wrong: unsupported-counter browsers withhold comparable FPS and require another qualified identity source; ordinary tracking remains unchanged.

## Pending review and product gates

One fresh most-capable TypeScript reviewer will check the whole fixed increment after the Native task gate. Every finding/declined effect will be regraded and ruled; only one Important/Critical watched correction pass is allowed. Earlier deferred minors remain recorded in their own reports. This increment has not yet been accepted.

Actual SDK inference/network, physical camera/actors, specified laptop, original/new real-video quality, Unity activation/compilation/two rigs, clean machine/five new users, contributor/media/MIT rights, updated public CI and publication remain pending. No GitHub push, main merge, LICENSE, tag or release occurred for this increment.
