# EmoteCap — project instructions

EmoteCap is being prepared for an open-source product release. The original
HackNite documents remain historical records; they are not current deadlines
or machine-specific edit restrictions.

Read the active product specification, the implementation plan for your task,
`docs/development.md`, and `contracts/motion-v1.md` before implementation.

Keep the existing web, motion-core, server, Blender, and Unity boundaries.
Agree file ownership before concurrent work. Preserve changes made by others.
Motion contract changes must update documentation, fixtures, and consumers
together; coordinate them with other active contributors.

Use the pinned tools and lockfiles. Run relevant tests before handing work
off. Use behavior tests for data/algorithm changes; verify user flows with
the actual browser and Unity where required. Report skipped/unrun checks.

Never commit secrets, private recordings, runtime data, or third-party
characters. New settings belong in `.env.example` without real values.
Preserve project history and require the release checklist before publishing.
