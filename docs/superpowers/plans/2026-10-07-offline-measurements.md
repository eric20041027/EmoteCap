# Offline Measurements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Preserve continuous Native execution with one fresh final Python reviewer.

**Goal:** Produce traceable offline M4 arithmetic receipts without inventing actual quality or hardware results.

**Architecture:** A bounded packet validator reuses canonical MotionFrame/bones validation. Pure summaries calculate all-attempt metrics, sign-invariant stationary departures and consecutive canonical stance drift. A developer CLI creates an exclusive report with input/evaluator digests and optional strict comparable-condition deltas.

**Tech Stack:** Existing Python3.12.14/Pydantic lock, stdlib, package_files helpers; no SDK/network execution.

**Spec:** `docs/superpowers/specs/2026-10-07-offline-measurements-design.md`.

## Global Constraints

- Packet32MiB/21601samples/180seconds/32annotations; finite ordered performance-monotonic timestamps, canonical v2 frames, no private/unknown fields.
- No camera/model/cloud/Unity/hardware/public/main/LICENSE/package runtime/solver/frame/dependency changes; no invented performance threshold or release PASS.
- Retain all attempted failures and warmup counts; synthetic arithmetic controls are not observed quality/target-laptop evidence.
- Stationary RMS is angular departure from first valid pose; canonical contact drift is a declared proxy, with coverage and no dropout bridging.
- Comparison must preserve input/environment/settings/annotation/measurement definition identity and distinct run IDs.
- Exclusive fresh report output, raw/evaluator/source/contract/lock digests, no input/prior report overwrite or scratch cleanup.
- One fresh final review, one necessary Important/Critical RED→GREEN correction pass, no rereview/minor polishing.

## Review Focus

1. Missing/failed samples and long idle gaps must not become perfect tracking or inflated effectiveFPS.
2. q/-q, one valid pose and dropout-separated stance frames must not create false jitter/drift conclusions.
3. A different video, hardware, model/delegate or clock definition must not silently produce a before/after claim.
4. Duplicate JSON keys, nonfinite values, aliases, oversized/deep packets and existing output must fail without changing prior data.
5. Observed labels/operator declarations must not be promoted to real SDK/rights/laptop/release approval; duration names and proxy limits must be clear.

---

### Task 1: Bounded summaries/comparison, exclusive CLI receipts and collection protocol

**Files:** Create `scripts/motion_measurements.py`, `scripts/evaluate_motion.py`, `server/tests/test_motion_measurements.py`, `docs/measurements.md`, `docs/superpowers/reports/2026-10-07-offline-measurements.md`; update `docs/release-progress.md`. Existing contract/solver/Web/builder unchanged.

**Interfaces:** `validate_packet(packet:dict)->dict` validates without mutating raw frames. `summarize(packet:dict)->dict` returns classification/source/input metadata, measured/overall status counts, effectiveFps, failureRate, p95DetectionToSolverMs, annotation metrics/coverage and qualification=pending. `compare(baseline:dict,candidate:dict)->dict` returns both summaries and numeric deltas with null propagation after condition identity checks. CLI `main(argv:list[str]|None=None)->int` accepts --input/--baseline(optional)/--output; returns0receiptwritten or2incomplete; no actual-processing operation. Reuse `MotionFrame.model_validate`, `BONES`, committed `contracts/bones.json`, `ordinary_path`, `sha256_file`, `write_json` with32MiBcheck.

- [ ] **Step1: Write analytic failing controls.** Build an owned packet helper with canonical identity quaternions, actual input/wall times, explicit statuses and settings. A loadable stub may be used only to make assertions fail meaningfully and is not committed.

```python
def test_dropouts_idle_and_warmup_are_not_hidden(packet):
    # Four attempts: one warmup ok, two measured ok, one measured no-pose;
    # measured wall interval4seconds and durations10,30,50ms.
    result = measurements.summarize(packet)
    assert result['metrics']['effectiveFps'] == 0.5
    assert result['metrics']['failureRate'] == pytest.approx(1/3)
    assert result['metrics']['p95DetectionToSolverMs'] == 50
    assert result['counts']['warmupAttempts'] == 1
```

Also pin empty/allfailed nulls, q/-q zero departure, analytically90degree RMS, contract FK known ankle/heel positions, no stance bridge across missing pose, comparison mismatch each condition, nonfinite/bad timelines/frame keys/norm/deep/duplicate JSON/path link/hardlink/size/output reuse. An output refusal must preserve original bytes. Show actual test constructions, not mock result objects.

- [ ] **Step2: Watch focused RED.** `uv run --directory server --frozen --python 3.12.14 pytest -q tests/test_motion_measurements.py`, redirect to the plan's owned log. Require assertion/admission failures, not missing imports or executor errors; ledger the meaningful result.

- [ ] **Step3: Implement validator and arithmetic.** Strict allowed-key sets/types/enums/hash/UUID/finite temporal checks, plain MotionFrame contract reuse, max bounds and no packet mutation. Compute nearest-rank percentile and normalized quaternion angle; reconstruct only required heel positions from committed parent-first skeleton. Never interpolate across missing attempts. Comparison uses exact dictionaries for conditions and explicit scalar deltas, keeping null metrics unavailable.

```python
def nearest_rank(values, fraction=0.95):
    ordered = sorted(values)
    return ordered[math.ceil(fraction * len(ordered))-1] if ordered else None

def angular_degrees(left, right):
    left = [value/math.sqrt(sum(v*v for v in left)) for value in left]
    right = [value/math.sqrt(sum(v*v for v in right)) for value in right]
    return math.degrees(2*math.acos(min(1.0, abs(sum(a*b for a,b in zip(left,right))))))
```

- [ ] **Step4: Implement exclusive CLI and provenance.** Strict JSON load rejects duplicate keys/constants/deep metadata and ordinary input≤32MiB/nlink1. Evaluate before creating output; code/contract/server lock digests plus raw input hashes are recorded; output uses exclusive write. Compact stdout only, errors do not print raw private data.

```python
receipt = {'schema':'emotecap-measurement-receipt-v1',
           'qualification':'pending', 'inputs':input_digests,
           'evaluator':evaluator_digests, 'result':result}
write_json(ordinary_path(args.output), receipt)
```

- [ ] **Step5: Focused GREEN and actual CLI qualification.** Repeat focused suite; run the CLI on a fresh owned analytic input to a new receipt and compare known numeric output/source digests. Then invoke existing-output and malformed-JSON cases and require exit2/no overwrite. This is actual offline CLI execution, not actual SDK/laptop evidence. Preserve all outputs.
- [ ] **Step6: Write collection protocol/report and run full backend.** Document exact packet fields/units/statuses, warmup/percentile/FK definitions, privacy/rights declarations, unchanged original data, original/new identity, required failure/occlusion/turn/leave cases, recorded target720p dimensions/model/delegate/hardware and unavailable camera-to-display latency. Explain that collectors must record failures before successful take filtering. Include complete runnable synthetic packet generation and CLI commands. State real source/hardware/user gates pending; link in progress. Run all fast backend; no Web tests/build when unchanged.
- [ ] **Step7: Commit/Native gate/final review.** Commit all implementation/docs, then task-done runs the full fast backend command fromStep6. Generate whole plan BASE..HEAD package and dispatch one fresh Python reviewer. Regrade every finding/decline by effect, record exhaustive Ruling+cost; one needed Important/Critical TDD fix/fullGREEN, no rereview. Retain scratch per prior rejected cleanup and continue the full M1–M5 goal.

The continuous authorized goal covers this independent preparation; no routine execution-method/plan approval pause. Real measurement collection still awaits usable authorized inputs/hardware and cannot be inferred from elapsed unanswered questions.
