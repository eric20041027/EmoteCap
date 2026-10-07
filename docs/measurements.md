# M4 offline measurements

This developer tool validates and summarizes measurement packets. It does not collect camera/video/SDK timings, authorize processing, benchmark this computer or approve a release. Current real-video, SDK-network and target-laptop results remain pending in [release progress](release-progress.md).

Use the frozen developer environment in [development](development.md):

```text
uv run --directory server --frozen --python 3.12.14 python ../scripts/evaluate_motion.py --input "C:\work\candidate-measurement.json" --output "C:\work\fresh-receipt.json"
uv run --directory server --frozen --python 3.12.14 python ../scripts/evaluate_motion.py --input "C:\work\candidate-measurement.json" --baseline "C:\work\baseline-measurement.json" --output "C:\work\fresh-comparison.json"
```

Exit0 means a new offline receipt was written. Exit2 means incomplete/invalid inputs or an occupied/unsafe output; it is not a failed product benchmark. Output parents must already exist. The tool never overwrites a report or input. Retain raw packets and each new receipt. Input/baseline paths must be ordinary files, not aliases/hardlinks, at most32MiB. At most21601attempts,32annotations and180seconds are accepted. Strict UTF-8 JSON rejects duplicate keys, nonfinite values and unexpected fields.

## Packet contract

`schema=emotecap-measurement-v1`; `runId` is a canonical UUID; `sourceCommit` is a full lowercase40hex identifier; `classification` is `synthetic` or `observed`; `localProcessingAuthorized=true` declares the operator's local-processing authority. `inputSha256` is a lowercase64hex identity of the authorized source recording and `sourceKind` is `video` or `camera`. These IDs, classification, rights and hardware descriptions are declarations supplied by the collector, not authenticated by this offline tool. Receipt input hashes identify the exact packet bytes; they do not hash a separately supplied video.

`environment` has exactly `kind` (`desktop`/`laptop`), `os`, `cpu`, `gpu`, `browser`; descriptors are bounded text without machine paths. `settings` has exactly `quality` (`fast`/`accurate`), integer observed `width`/`height` (1..8192), `crop` (`none`/`portrait`), `smoothing` (`low`/`medium`/`high`), `skeleton` (`full`/`body`), `sdkVersion`, `modelSha256`, actual `delegate` (`CPU`/`GPU`), and `handPolicy` (`off`/`every-frame`/`every-other-150ms`). Record the actual fallback/configuration; a UI label alone is insufficient.

`measurement` has exactly `clock=performance-monotonic`, `latencyDefinition=detection-to-solver`, `startedMs`, `finishedMs`, `warmupMs`. The actual wall interval is1..180000ms; warmup is nonnegative and shorter than it. All attempted samples share this monotonic clock and must fit inside this interval without overlap. Input timestamps must strictly increase.

Each `samples` entry has exactly `inputTimeS`, `startedMs`, `finishedMs`, `status` and `frame`. Status is `ok`, `no-pose`, `detector-error` or `solver-error`. Only `ok` has a frame; the others have `frame:null`. A frame contains only numeric `t`, three numeric hips values `h`, and192numeric world-delta quaternion values `r`, with canonical in-place/unit-length validation and `t=inputTimeS`. Numeric strings/bools are rejected rather than coerced. Original frames are never changed by analysis. Record failures before filtering into a saved successful take.

`annotations` entries have exactly a unique `id` (1..64ASCII letters/digits/underscore/hyphen), `kind` (`stationary`/`left-stance`/`right-stance`), `startS`, `endS`. Intervals must fit the observed input timeline and have positive duration. They label operator-observed stationary/foot-contact periods; automatic stance or anatomical ground truth is not inferred.

## What the numbers mean

- Attempts starting before warmup ends are excluded from metrics but remain in overall/warmup counts. Successful effectiveFPS is the number of remaining `ok` attempts divided by the entire remaining measured wall interval, including idle and dropout time.
- Failure rate is all measured non-ok attempts divided by all measured attempts. It is unavailable (`null`) without attempts; zero successfulFPS then means no successful throughput, not valid tracking.
- `p95DetectionToSolverMs` uses nearest rank: sort all measured attempt durations and select index `ceil(.95*n)-1`. Empty durations are `null`. This includes failed attempts, and is detection/solver duration; it excludes source delivery, decode/seek, preview/display and export. It is not camera-to-display latency.
- Stationary `rmsDegreesByBone` measures sign-invariant angular departure from the interval's first valid pose, separately for all48driven bones. It is unavailable with fewer than two valid samples. Slow motion within a supposedly stationary interval affects this number; it is not anatomical error or a noise-only decomposition.
- `horizontalHeelPathM` sums canonical horizontal heel displacement only between adjacent successful attempts within the stance interval. Failed attempts break adjacency. No valid pair means `null`; sample/pair counts show coverage. FK uses committed parent-first bones, world-delta rotations and canonical in-place hips. This contact-drift proxy does not measure real-world root translation or prove foot-slide accuracy.

Comparison requires distinct run IDs and identical input identity/source kind/classification/environment/settings/annotations/clock/latency definition/warmup. Actual wall durations may differ and throughput is normalized. Changed conditions cause refusal; synthetic/observed packets cannot be mixed. Scalar deltas are candidate minus baseline and propagate unavailable values. Both annotation summaries are retained for inspection; no quality-improvement verdict or performance threshold is invented. Receipts retain raw packet SHA256 and evaluator script/helper/contract/server-lock digests, with `qualification=pending`.

## Runnable synthetic arithmetic control

Save this as `make_synthetic_measurement.py` in a fresh developer workspace, then run it with the frozen Python. Its output is explicitly synthetic: zero-valued identities and named synthetic hardware are not real model/video/hardware evidence.

```python
import json
from pathlib import Path
import uuid

def attempt(t, begin, end, status='ok'):
    pose = {'t': t, 'h': [0, .95, 0], 'r': [0, 0, 0, 1] * 48}
    return {'inputTimeS': t, 'startedMs': begin, 'finishedMs': end,
            'status': status, 'frame': pose if status == 'ok' else None}

packet = {
    'schema': 'emotecap-measurement-v1', 'runId': str(uuid.uuid4()),
    'sourceCommit': '0' * 40, 'classification': 'synthetic',
    'localProcessingAuthorized': True, 'inputSha256': '0' * 64, 'sourceKind': 'video',
    'environment': {'kind': 'desktop', 'os': 'Synthetic OS', 'cpu': 'Synthetic CPU',
                    'gpu': 'Synthetic GPU', 'browser': 'Synthetic browser'},
    'settings': {'quality': 'fast', 'width': 1280, 'height': 720, 'crop': 'none',
                 'smoothing': 'medium', 'skeleton': 'full', 'sdkVersion': '1.0.1',
                 'modelSha256': '0' * 64, 'delegate': 'CPU',
                 'handPolicy': 'every-other-150ms'},
    'measurement': {'clock': 'performance-monotonic',
                    'latencyDefinition': 'detection-to-solver',
                    'startedMs': 0, 'finishedMs': 5000, 'warmupMs': 1000},
    'samples': [attempt(0, 0, 10), attempt(1, 1000, 1010),
                attempt(2, 2000, 2030), attempt(4, 4000, 4050, 'no-pose')],
    'annotations': [],
}
with Path('synthetic-measurement.json').open('x', encoding='utf-8') as output:
    json.dump(packet, output, allow_nan=False)
```

Analyze it with `--input` and a fresh `--output`. Expected effectiveFPS0.5, failure rate1/3, p95 detection-to-solver50ms, warmup attempts1. This tests arithmetic only.

## Real collection still required

Use authorized fixed recordings spanning stationary/T-pose/right-hand raise, walking/stance, occlusion, turn and leaving the frame; record failures and assistance as well as success. Keep source video/input digest and rights evidence private unless separately approved. Record original and new source commits, any instrumentation adapter digest, actual model/SDK/delegate/hand settings, annotations and all attempts. An old page that automatically initializes SDK/camera is not an authorized benchmark collector; SDK session consent and its disclosed metrics must be handled before actual initialization. Gemini has separate consent.

Capture detection-to-solver boundaries from before model execution through completion of the solver, including failures. Source delivery/decode/seek, render/display latency and export elapsed time require separate instrumentation/evidence; do not put them into this schema's duration field. The current UI EMA and successful saved take alone cannot supply these measurements. No real collector is implemented by this offline increment.

For the target laptop, record actual model/CPU/GPU/OS/browser/power mode, actual source and post-crop dimensions, Fast720p settings, warmup and measured interval, repeated runs, fallback/error events and operation-response observations. A desktop or same-host PATH-isolation check is not laptop/clean-machine evidence. Set formal support/performance thresholds only after the observed baseline; validate any required camera-to-display definition separately. Unity/two rigs and the five-user study remain separate gates.
