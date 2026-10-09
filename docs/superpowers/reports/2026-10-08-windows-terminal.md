# Windows owned-process terminal signals

The product draft reached six green hosted jobs at `3bb645e`, but two earlier Windows runs at `db7ad66` had failed the owned-descendant timeout assertion. Passing later runs did not establish that the failure was fixed.

## Reproduced boundary

A bounded local probe retained the actual descendant's kernel handle before timeout. Immediately after the runner reported `ownedProcessTreeTerminal: true`, `WaitForSingleObject(handle, 0)` returned `WAIT_TIMEOUT` (258), although the exit code was already 1. This rules out a reused numeric PID as the explanation for this observed failure. Four added actual-kernel regression cases then failed 4/4 with the original helper.

Windows job termination is asynchronous with respect to process exit. The job API describes termination as applying `TerminateProcess` to its members; Microsoft instructs callers to wait on a process handle when actual termination must be established. [TerminateJobObject](https://learn.microsoft.com/en-us/windows/win32/api/jobapi2/nf-jobapi2-terminatejobobject), [TerminateProcess](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-terminateprocess).

## Correction and review

The helper now retains process handles for the owned job's PID inventory before initiating termination. It checks membership against that exact job before retaining each identity, uses query/synchronize rights without PID-based termination, and waits for the retained handles to signal before setting `closed`. Native errors and bounded-wait failures prevent a success receipt. Handles are released on both success and failure. Suspended launch, pre-execution job assignment and kill-on-close remain in place.

One fresh independent final review identified an Important completeness gap: a child born after the inventory snapshot would have no retained handle. The single correction pass records job lifetime process count before the snapshot and requires it to remain unchanged at closure. It also rejects an inventory that cannot cover the initial active count. A controlled actual parent spawned a child only after inventory capture: the regression first failed because cleanup claimed success, then passed with explicit rejection. The job is still terminated; an incomplete observation cannot qualify closure. This uses the documented lifetime `TotalProcesses` counter rather than unguaranteed completion-port events or undocumented freeze APIs. [Accounting structure](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-jobobject_basic_accounting_information).

## Observed verification

- Four retained-identity regressions: watched 4 failures, then 4 passes.
- One actual post-inventory birth regression: watched failure, then pass.
- Complete affected qualification module: 30 passed.
- Final complete non-slow backend suite: 946 passed, one platform skip, 18 slow cases excluded, in 259.83 seconds. The existing Starlette deprecation warning remains.
- Separate actual retained-identity diagnostic: 8/8 verified live-before, signaled-after, exit code 1. Original failed observations and a diagnostic receipt-writer failure are retained separately; they were not overwritten.
- The final full backend, hosted matrix and fresh Blender/Unity pipeline are recorded against their exact source commits in [draft PR #2](https://github.com/eric20041027/EmoteCap/pull/2). The earlier six green jobs belong to `3bb645e` and are not attributed to this correction.

The independent review was not repeated after the watched correction. No original runner, model, product protocol, SDK or distribution dependency was changed. Licensing, authorized physical video/camera/laptop measurements, clean-machine and new-user acceptance, and formal-release approval remain separate requirements. This report does not mark M1–M5 complete.
