# M1 hosted qualification

Date: 2026-10-06 (America/New_York). PR: [#1](https://github.com/eric20041027/EmoteCap/pull/1), draft and unmerged.

## Result

All three operating-system jobs passed for code commit `663cd33ddf02ef0a3f21d927165639b744b50f97` in [PR run 37568993517](https://github.com/eric20041027/EmoteCap/actions/runs/37568993517).

| Runner | Actual job | Result |
|---|---|---|
| Windows x64 | [112623137594](https://github.com/eric20041027/EmoteCap/actions/runs/37568993517/job/112623137594) | Passed |
| macOS arm64 | [112623137697](https://github.com/eric20041027/EmoteCap/actions/runs/37568993517/job/112623137697) | Passed |
| Ubuntu x64 | [112623137703](https://github.com/eric20041027/EmoteCap/actions/runs/37568993517/job/112623137703) | Passed |

Each job installed and used Python 3.12.14, passed 380 backend tests (2 real-Blender tests deselected), 226 app tests, the asset/security checks, dependency audit (0 vulnerabilities), TypeScript and full Web build. Actual run logs were inspected, including interpreter, test counts, audit and build completion. The pre-existing bundle-size and Starlette/httpx warnings remain.

## Observed failure and repair

The [first PR run 37568728873](https://github.com/eric20041027/EmoteCap/actions/runs/37568728873) at fc63378 passed Ubuntu but failed Windows/macOS before application tests. actions/setup-python reported that Python 3.12.14 was unavailable for Windows 2025 x64 and macOS 26.6.2 arm64. Skipped downstream tests were not counted as passes.

Install uv directly with official astral-sh/setup-uv v9.0.0, pinned to verified commit `c771a70e6277c0a99b617c7a806ffedaca235ff9`, then install managed Python with `uv python install 3.12.14`. uv remains 0.12.6. Node, npm, Python, dependency locks and all verification commands remain unchanged. Optional uv caching is disabled for this repair.

The [official uv integration guide](https://docs.astral.sh/uv/guides/integration/github/) documents this bootstrap. The selected action tag and input names were verified from its repository before use.

## Review and rulings

Focused independent review of this new CI repair is pending. The earlier foundation and dependency-patch reviews remain valid for their scopes.

- Continue the approved M1 draft PR without another routine approval question; remote main remains unchanged. Cost if wrong: the owner can review the draft before integration.
- Use the actual failed installation and repaired hosted matrix as regression evidence for this configuration change. A text-matching unit test would not prove runner availability. Cost if wrong: external infrastructure can still change after this run.
- Review this newly introduced CI repair separately from the prior dependency patch. Cost if wrong: one additional review context.

## Product boundary

This closes M1's hosted compatibility gate. The M1–M5 goal remains active. Real camera/Gemini/Blender/Unity, target-laptop performance, license/contributor decisions, clean-machine/user acceptance and product publication remain separate requirements. M2 implementation has not been claimed complete. Local main is still ef7a76c; the reviewed security/CI follow-ups are in the draft branch.
