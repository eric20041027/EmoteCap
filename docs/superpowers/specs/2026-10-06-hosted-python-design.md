# Hosted Python bootstrap repair

The first real PR run for fc63378 is [37568728873](https://github.com/eric20041027/EmoteCap/actions/runs/37568728873). Ubuntu passed. Windows x64 and macOS arm64 failed before tests because actions/setup-python cannot supply Python 3.12.14 for those runners. Local verification used uv's managed Python successfully.

Keep Node 24.19.0, npm 11.21.0, Python 3.12.14, uv 0.12.6, all lockfiles and all test gates unchanged. Replace the Python-dependent uv bootstrap with the official astral-sh/setup-uv action, pinned to verified v9.0.0 commit c771a70e6277c0a99b617c7a806ffedaca235ff9. Install the same Python using `uv python install 3.12.14`. Disable optional uv caching for this repair; installing Python must not depend on a pre-existing runner interpreter or a repository-root Python project.

The official [uv Actions guide](https://docs.astral.sh/uv/guides/integration/github/) documents this installation path. The action tag and its inputs were verified against the GitHub API and action.yml at the pinned commit on 2026-10-06.

Acceptance is an actual successful PR run with all three matrix jobs for the repaired commit. A failed download, missing binary, advisory-service outage or failed test must fail the job, never skip checks or loosen versions. No local unit test can establish hosted runner binary availability. Existing substantive tests run in CI; do not add a text-matching workflow test.

The user approved pushing the reviewed M1 branch and opening its draft PR. This repair belongs to that PR and does not authorize remote main integration or a release. Keep the M1–M5 goal active.
