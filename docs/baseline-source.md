# Original MVP source snapshot

From this checkout's root in PowerShell:

```powershell
node web/scripts/baseline-snapshot.mjs
```

This source-only tool reads original commit `713d349df05aa26b6b95a1b7974f7f3d8e574149` with replacement objects and lazy fetching disabled, and verifies nineteen inputs against the committed [digest index](../web/scripts/baseline-sources.json). It writes exact Git bytes below `web/.measurement-baseline/<commit>` and creates `snapshot.json` last. Repeating the command verifies an exact existing snapshot without changing it. Exit0 means prepared/verified source; exit2 means incomplete, unavailable or changed inputs/output. The tool never repairs or overwrites a partial/tampered snapshot. Preserve it for diagnosis. It accepts no CLI arguments or output path.

The original Git objects must exist locally. A shallow checkout may need `git fetch origin 713d349df05aa26b6b95a1b7974f7f3d8e574149` first. The tool itself performs no fetch, dependency install, asset download, browser startup, camera capture or SDK execution. It refuses path aliases, hardlinks, nonregular source tree entries, unsafe paths, mismatched hashes/sizes and extra snapshot entries; source is bounded at2MiB/file,8MiB total and64files. Existing and interrupted output is retained. This ignored source directory is outside the default production build; do not copy it into a release as an accepted runtime.

The snapshot contains thirteen historical motion modules, the original converter/frame timing/T-pose helpers, canonical bones, Web lock and original asset-fetch script. Historical `package-lock.json` is evidence: **do not run npm install/ci in the snapshot**. It records the old vulnerable source-map-js1.2.1. Continue using the rebuilt checkout's patched dependencies. Do not execute the historical fetch script or old app: they do not enforce the current session SDK choice.

Both source locks record MediaPipe1.0.1. The original asset fetch script used `latest` URLs without model digests, so this cannot reconstruct the contest's exact model binaries. A later code comparison may use the same currently verified assets for both implementations, while reporting that limitation. The receipt's `qualification:source-only` establishes no contributor/model rights, compiled original build, instrumented comparison, observed actor/hardware result or release acceptance.

The [private collector](video-measurements.md) defaults to the rebuilt converter/solver. Changing its declared commit does not load this snapshot. The separately reviewed [original runner](original-runner.md) compiles these pinned inputs; choosing Original with its verified build digest actually selects the old converter/solver under current SDK admission. Actual controlled output/error parity is qualified separately from this source-only receipt. Authorized real recordings and the other [release gates](release-progress.md) remain pending.
