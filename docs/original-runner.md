# Original MVP execution for private measurements

From a reviewed checkout with the frozen current dependencies installed, run this from the repository root in PowerShell:

```powershell
node web/scripts/baseline-snapshot.mjs
$original = node web/scripts/original-runner.mjs | ConvertFrom-Json
$original.buildId
```

The first command prepares/verifies the [nineteen original source inputs](baseline-source.md). The second compiles the actual converter and solver from713d349, using the current pinned Vite compiler. It reads verified input bytes into memory, disables project config/environment/public assets, and admits only original motion/import/contract runtime inputs. It never runs the old App, capture factory, asset fetch script or dependency install. The historical lock contains a vulnerable dependency and stays inert evidence. Installed Vite's [build API](https://vite.dev/guide/api-javascript.html#build) and [library mode](https://vite.dev/guide/build.html#library-mode) are used with output writes disabled; the tool owns its artifact writes.

The build ID is SHA256 of the exact compact manifest bytes. `web/.measurement-baseline/runners/<build-id>` contains `manifest.json` and `original.bin`: one self-contained JavaScript module, transported as opaque bytes so Vite does not rewrite them. Manifest binds source/index, consumed source paths, actual bundle digest/length, builder source digest, compiler lock digest and Vite/Node versions. The raw source snapshot remains unchanged. Bundle≤512KiB/manifest≤16KiB; exclusive writes, ordinary/link-free parent/file checks, exact inventory and immutable verified reuse apply. Partial/altered artifacts are retained and refused. Exit0 means compiled/verified source; it is not product acceptance. Source-only index startup diagnostics retain the separately documented deferred minor.

Launch [the private collection page](video-measurements.md), select **Original MVP converter and solver**, and paste `$original.buildId` into **Original build digest**. Its source commit becomes fixed/read-only. Select an authorized video, declared environment/classification/settings/local authority and session SDK choice, then Run. Granting permission or choosing an implementation alone performs no artifact/model processing. The loader bounds same-origin requests, refuses redirects and checks manifest/build/source/bundle identities before importing those exact bytes as an owned Blob module. Cancel/withdraw prevents late inference and releases owned transport/model/video resources. Default production Studio/candidate has no private page or runner artifacts.

The original converter runs with the compiled original solver. The current guarded SDK/detector provides both code versions with the same verified model configuration. A wrapper observes original injected seek/detect/solver/progress boundaries; it does not edit the old algorithm. Raw metadata identifies implementation, verified original build/manifest and the current wrapper source SHA256. This hash identifies that wrapper source, not the entire current application or its independently authenticated build. Preserve reviewed current source, builder/adapter digests, original manifest/module, source video digest, raw reports, packets and evaluator receipts together.

For a code comparison, use the **same retained video** and identical environment, full/body, smoothing, dimensions, hand/delegate settings, annotations and warmup. Run once with Original and once with Rebuilt source; each run gets a new UUID. The rebuilt commit remains declared and must independently match the actual checked-out build. Preserve preview and final outputs separately. Run the unchanged evaluator from the root, choosing a new receipt path:

```text
uv run --directory server --frozen --python 3.12.14 python ../scripts/evaluate_motion.py --input current-preview.json --baseline original-preview.json --output fresh-comparison.json
```

Original source used unhashed `latest` model URLs. This compares code with shared currently verified assets; it does not reconstruct contest model binaries or measure the complete old App. The compiler transpiles original TypeScript; current structural adapter/types and actual controlled output/error parity are checked. A standalone historical-project type check is not claimed. Synthetic controlled poses/SDK output prove source selection/parity, not actor accuracy or real performance. Actual SDK/network, authorized recordings, Fast720p target laptop, Unity/two rigs, clean machine/new users, rights and publication remain [separate gates](release-progress.md).

Developer regression: `npm run test:baselines` covers real owned Git/compiler/path/budget cases. To run actual-original Edge qualification, prepare a build, set `EMOTECAP_ORIGINAL_BUILD_ID` to its build ID, then run the existing Playwright measurement test. Without that explicit artifact, the actual-original case is skipped; a skip is not acceptance. Hosted execution of the updated local CI configuration remains pending until the separately authorized public branch is available.
