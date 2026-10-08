# First observed public-video comparison

This is one local M4 pilot using an actual person and unmocked inference, collected from clean `4e9a1dbe111a005165674fde427874835bb56899`. It does not complete the real-motion test set, finger-quality acceptance, physical camera/calibration, target-laptop, clean-machine or new-user gates.

## Source and scope

[Jumping jacks and burpees](https://commons.wikimedia.org/w/index.php?title=File:Jumping_jacks_and_burpees.webm&oldid=1182499913), by Taco fleur, is self-published under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Original bytes remain unchanged locally: 6,544,177 bytes, SHA1 `de0408ee2f90afba376f23d86f48d6c98d4eb42b`, SHA256 `1c8370a29c52b5b1538f03f8c63be6cdc9333dea3cbd77cc8f2af0dbe496d5b4`. No endorsement is implied. Raw media and derived animations are not uploaded with this report or included in distribution artifacts.

The first four seconds were selected before inference as one bounded pilot. Browser capture decoded and re-encoded silent VP8 without cropping. Actual source interval ends at 4.007 seconds; encoded input duration is 4.198814 seconds; sampled input coverage is 0 through 4.166666666666667 seconds. These clocks are distinct. The full 45.293-second source is retained for later coverage. The shared 640x480 excerpt is 885,450 bytes, SHA256 `02594035f595a2cd142d1f68be26ba2dfec8162ed2e36ea8d1fbde32cf6c450a`.

## Actual collection and comparison

Edge 154.0.4258.62 used SwiftShader software WebGL on a Windows desktop. MediaPipe 1.0.1 Heavy and Hand models were genuine local pinned assets; no API or SDK-result mocks were used. Both runs used Accurate/full/medium, no crop, zero warmup and every-frame hand policy. The SDK reports the GPU delegate, but that delegate was software rendering. This is not laptop or Fast 720p throughput.

The current core was compared to the verified original `713d349` converter/solver build `4916fce7616d8b8e7a3b1db59f54b539938311d36d21fa8625cc4718064d26db`. This uses common current model assets; original historical model binaries were not reconstructed. One independent final review approved the diagnostic workflow with zero findings; no collection rerun or file modification was performed by that reviewer.

| Observation | Original core | Current core |
|---|---:|---:|
| Attempted / successful pose samples | 126 / 126 | 126 / 126 |
| Final frames | 126 | 126 |
| Page errors | 0 | 0 |
| Assigned hand sides | 0 | 0 |
| Offline conversion seconds | 118.0387 | 118.7843 |
| Effective offline FPS | 1.06745 | 1.06075 |
| p95 detection-to-solver milliseconds | 997.8 | 1006.2 |

All final frames, source timestamps and attempt statuses match exactly: 24,696 numeric time/root/rotation values, maximum absolute difference 0. The production evaluator admitted both observed packets and their comparison with qualification still pending. Annotation lists are empty, so stationary jitter and heel-drift metrics are unavailable. There is no quality-improvement verdict or ground-truth accuracy claim. The pose failure rate is 0 in this case; active hand graphs on all 126 attempts produced no assigned hands, which does not qualify finger tracking and is not proof of the SDK's raw hand-detection count.

Both runs observed four Google metrics POSTs after SDK admission; the default-denied and permission-only phases had no external/model requests. No Gemini request was observed. This is browser-event evidence, not network-wide or retention qualification. Reload reset the SDK choice. All owned diagnostic processes completed terminal and the private port was released.

## Export and retained failures

The first manually assembled export input omitted the required `loop` field and used a name outside the production contract. Its failed log and partial FBX are retained as a harness construction error and excluded from qualification. A fresh input was then admitted by the actual production `Clip` model before export: `Public_Jacks_Pilot`, nonlooping/full/30fps, all 126 frames. Blender 4.5.14 exported a complete FBX and paired sidecar successfully into a separate fresh directory. FBX: 765,852 bytes, SHA256 `6e502f3c62c90be3b0008409459a472d31a06d3a37b9b843ef7efefef3e99135`. This public-video FBX has not yet been qualified for playback on the two Unity rigs; the separate 81 Editor/37 Play pipeline at `4e9a1db` covers the established sample fixtures.

Raw packets, source and excerpt receipts, prototype review, actual network records, evaluator receipts, exact core comparison, hand observations, failed export and corrected export remain in the local evidence folder `.superpowers/sdd/2026-10-08-public-video-4e9a1db/`. Inputs and prior outputs were not overwritten. Remaining M4/M5 requirements stay open in [release progress](../../release-progress.md).
