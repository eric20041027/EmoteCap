# Private video import collection

This developer workflow collects failed/successful import attempts, timed preview poses and final calibrated motion. Use it with the [offline evaluation tool](measurements.md). It remains separate from actual Studio camera/laptop, SDK-network, Unity/two-rig, clean-machine and new-user acceptance in [release progress](release-progress.md).

## Launch from a fixed developer source

Use the frozen environment in [development](development.md): Node24.19.0/npm11.21.0, the committed npm lock and verified local model assets. Start from the reviewed clean source you intend to measure. From the repository root in PowerShell:

```powershell
$env:VITE_EMOTECAP_SOURCE_COMMIT = git rev-parse HEAD
Set-Location web
npm ci
npm run dev -- --host 127.0.0.1
```

Open [the private collection page](http://127.0.0.1:5173/measurements.html). This entry is available in developer Vite; the default production build and Windows candidate do not include it. Rebuilt source commit remains an operator declaration; changing it does not change the code. Selecting **Original MVP converter and solver** with a verified [original build digest](original-runner.md) actually loads fixed713d349converter/solver, with a read-only original source commit. Retain source/build/wrapper evidence with each result; this is a shared-asset code comparison, not reconstruction of historical models or the entire old App.

Select an authorized local video, enter the actual device/browser descriptions and classification, choose full/body/smoothing/warmup, and explicitly declare local processing authority. Choose the session SDK option and then Run collection. Granting it alone does not open media or initialize models. The page uses Accurate/Heavy import, its actual source dimensions, no crop, and hands on each import frame when available; it does not measure Fast720p camera performance.

The SDK disclosure and privacy link remain visible. SDK choice resets on reload; withdrawal cancels the operation and invalidates late inference. Cancel reports that owned asynchronous setup may still be settling; late returned models are closed. Existing captured/partial results remain downloadable. Source and metadata controls are frozen per run; changed selection starts a new UUID run. Closing the page aborts its owned work. No source video/name/path/key/token/landmarks is embedded in diagnostics, and this workflow has no automatic API/IDB/cloud save. Raw reports contain motion and declared conditions, so keep them with the source/rights evidence under the intended access policy.

## Downloaded data

`emotecap-video-collection-v1` raw JSON retains source File SHA256, actual selected implementation, declared environment/classification, observed dimensions/duration, both model hashes, successful pose/hand delegate configurations, hand-model availability/policy and conversion outcome. Original mode adds verified runner manifest/build ID and wrapper source SHA256. These configurations report the successful SDK option paths, not independent hardware proof. The wrapper digest is not an authenticated whole-application build.

Each attempt includes source seconds, seek/detection/preview-finish monotonic milliseconds, ok/no-pose/detector-error/solver-error/seek-error status, copied preview frame/null, optional active/disabled/failed hand tracking and assigned hand sides. Assigned sides are not a count of every SDK hand detection or proof of correct fingers. Fatal tenth detector error is retained. All-no-person processing has a no-person outcome with an all-failed packet when the complete attempt set and clock are valid.

`finalFrames` are the converter's separately calibrated final output, including its existing hold-from-start behavior. Failure rate must come from attempted statuses, not this success-only output. Initialization timing is separate. Conversion start/end/elapsed are unavailable (`null`) if conversion never began. Partial failures retain bounded raw data and a fixed reason code without serializing a private exception message.

An eligible `emotecap-measurement-v1` preview packet has strict source/configuration/span/attempt completion and clock checks; all measured failures remain present. The packet's detection-to-solver duration covers the preview solver. Its effectiveFPS uses the entire offline conversion wall interval, including seeking, diagnostics overhead and the final solve; it is not live camera throughput or camera-to-display latency. Use final frames separately for final-output quality checks and raw preview frames only for their named phase. Do not compare phases by changing a source label.

Projection is unavailable after cancellation, missing/truncated/invalid observations, cleanup failure, seek/final-solver failure, unknown pose/hand configuration, mid-run hand downgrade, exhausted warmup or wall budget. The v1 packet represents one delegate; active pose/hand configurations that differ retain raw/final data with `mixed-model-delegates` and no packet. Body-only mode explicitly records hand policy off. Initial unavailable hands remain explicit in raw metadata; a full skeleton shape alone does not mean fingers were tracked.

Source is limited to100MiB/180seconds. Raw diagnostics are at most21601attempts/32MiB; crossing the private diagnostic budget stops only that collection and keeps a bounded partial result. Downloads use the same compact JSON serialization as the byte budget. Timings must be finite/nonnegative/ordered and inside their actual wall interval. Existing main Studio imports have no observer by default and preserve their original result/calibration/error behavior.

## Analyze and retain evidence

Download the raw collection and eligible preview packet using their explicit links. Preserve each original file. Add stationary/stance annotations to a new packet copy after checking their source-time intervals, following [the packet contract](measurements.md). Source commit, hardware, classification and local rights remain declarations; independently match them to source/video/instrumentation and actual hardware before observed acceptance.

From the repository root, use the frozen Python:

```text
uv run --directory server --frozen --python 3.12.14 python ../scripts/evaluate_motion.py --input "C:\work\downloaded-preview.json" --output "C:\work\fresh-preview-receipt.json"
```

Pass only the preview packet to this CLI, not the raw collection envelope. Keep its new receipt alongside raw data and source/build evidence. Comparison still requires matching overall/post-warmup input intervals, source, settings, environment and annotations. Raw-only/mixed/incomplete results require separate assessment; they must not be relabeled as a compatible packet.

Current automated qualification uses a real browser decoder with an owned synthetic canvas video and mocked SDK outputs. It proves consent/lifecycle/source binding/download/packet arithmetic. It is not real SDK inference/network, actual actor accuracy, target laptop performance or release acceptance.
