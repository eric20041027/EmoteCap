# Offline M4 measurement tools qualification

[Spec](../specs/2026-10-07-offline-measurements-design.md), [plan](../plans/2026-10-07-offline-measurements.md), [protocol](../../measurements.md). Review base ea50369; task base 8b894c4. Offline developer tools only; no Web/solver/runtime/SDK/dependency or public change.

## Implemented behavior and evidence

Bounded strict packets retain all attempted statuses, actual wall intervals/warmup, declared conditions/annotations and original canonical frames. Existing MotionFrame/bones validation is reused without application contract changes. Summaries calculate successful effectiveFPS, all-attempt failure rate and nearest-rank detection-to-solver duration p95, with empty values unavailable. Per-bone stationary departure is quaternion-sign invariant; canonical heel path sums only adjacent successful stance attempts. Comparable-condition reports preserve source/run identities and null scalar deltas.

Receipts use exclusive fresh ordinary output and raw packet/evaluator script/helper/contract/server-lock SHA256 values. Duplicate/deep/nonfinite/oversized/hardlinked/aliased inputs and existing output are rejected. Actual owned Windows junction input/output controls preserve target bytes. Rights/source/input/classification/hardware are collector declarations, not authenticated processing evidence or acceptance.

Watched meaningful RED:51 assertion/admission/receipt failures before implementation. First focused GREEN51cases. Four additional numeric-string/bool frame-coercion controls reproduced DID NOT RAISE before stricter raw-number admission; final focused57cases passed in2.74seconds. Analytic controls cover warmup/dropout/idle intervals, empty/allfailed packets,90degree departure,0.04m heel displacement, q/-q and no dropout bridge, nine comparison mismatches and CLI digests/output preservation.

Five actual offline CLI subprocesses passed: fresh receipt with known0.5FPS/1/3failure/50ms p95, occupied report refusal, input overwrite refusal, duplicate-key refusal without output, and two-input comparison with0.25FPSdelta. Six evaluator digests were independently compared to actual source bytes. Retained synthetic artifacts: ignored plan workspace `cli-6a98d776-6b24-4c3f-acd6-ae4ff590f180`. The complete documented synthetic generator and CLI were executed in a separate fresh folder and matched all stated numbers. Whole fast backend passed782cases, with1unavailable file-symlink privilege skip/18slow deselected in78.79seconds. Native final gate and one fresh review remain pending at this initial report.

Native task-done repeated the complete backend at034f190:782passed/1privilege skip/18slow deselected in69.21seconds. One fresh independent Python reviewer independently passed57cases and found1Important comparison-coverage issue and1Minor numeric-boundary issue, no Critical. Root regraded both by user effect: comparison remained Important; rare numeric exception behavior remained Minor because prior bytes are protected and no false completed receipt is produced.

ONE correction pass watched four coverage controls fail (disjoint footage, overall/warmup-only boundary, measured-only boundary and missing summary coverage). Comparison now checks matching first/last input times overall and post-warmup, retains coverage and permits different interior cadence.61focused cases passed; whole backend786passed/1privilege skip/18slow deselected in84.10seconds. Six actual CLI processes repeated known arithmetic/digest/output-preservation controls and rejected disjoint portions before output. Current synthetic receipts retained at `cli-12c33977-d7a3-4904-8e53-812c8820d711`. No rereview was dispatched; the reviewed issue is accepted after RED→GREEN and whole-suite evidence.

No actual SDK inference/network, camera/video collector, before/after quality baseline, target laptop, Unity/two rigs, clean-machine/new users or legal/public release outcome was measured by this increment. These tools do not complete M4 or establish a performance threshold. The accepted5572c88internal Windows candidate is unchanged; these developer scripts are not added to its runtime archive.

## Rulings and costs

- Ruling: Continue independent offline tooling under the authorized continuous Native goal — useful arithmetic preparation does not require unanswered inputs — cost if wrong: actual collection/hardware/rights gates remain pending and synthetic results never qualify M4.
- Ruling: Name detection-to-solver duration and canonical contact-drift proxy precisely — existing sources lack optical/display or world-root measurements — cost if wrong: these numbers cannot substitute for full latency or anatomical/ground-truth acceptance.
- Ruling: Require strict numeric raw frames before the existing permissive Pydantic contract — numeric strings/bools reached raw arithmetic incorrectly — cost if wrong: offline packets reject such coercible data while application contract behavior stays unchanged.
- Ruling: Treat source/input/observed/hardware/rights as collector declarations — offline JSON cannot authenticate the capture process or a separate video — cost if wrong: actual qualification must match raw source, instrumentation and hardware evidence, in addition to a packet digest.
- Ruling: Use the existing actual source/contract/server-lock digests rather than add benchmark dependencies — the tool is offline and frozen — cost if wrong: declared locked provenance is not runtime package authentication, and no new dependency is installed.
- Ruling: Preserve all scratch/receipts — earlier recursive ignored cleanup was rejected — cost if wrong: disk usage remains, with no cleanup workaround.

## Final review rulings and deferred minor

- Final Ruling: Match exact source-interval endpoints overall and after warmup, rather than require identical interior cadence — the same video hash can describe different footage while timing/cadence can legitimately differ — cost if wrong: edge-sample differences conservatively refuse comparison; completeness/representative sampling remains declared and needs collection evidence.
- Final Ruling: Collector-supplied source/rights/hardware/attempt authenticity is not established — this offline increment implements no collector — cost if wrong: raw source, instrumentation and environment must be matched independently before observed acceptance.
- Final Ruling: Actual camera/SDK, laptop, Unity, clean-machine and new-user results remain pending — arithmetic controls do not exercise these systems — cost if wrong: M4/release cannot pass without their actual qualification.
- Final Ruling: Ground-truth anatomy and camera-to-display latency remain pending — these metrics explicitly describe narrower proxies — cost if wrong: they cannot support broader quality/latency claims.
- Final Ruling: Hostile concurrent filesystem-ancestor replacement remains outside this owned-artifact qualification — ordinary paths/hardlink refusal/exclusive output were checked — cost if wrong: path preflight and hashes do not authenticate an adversarial host.

Deferred Minor: very large JSON integers (e.g.10**400) can cause OverflowError before bounds rejection; clock/warmup values near floating-point precision can cause division by zero instead of the documented exit2. Prior inputs/reports remain protected. The protocol records the limitation. No Minor code polish or new dependency was added. Ruff/mypy/pylint/Black were unavailable during review.
