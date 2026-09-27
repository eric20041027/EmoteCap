# OneTake — project instructions

Hackathon project (HackNite 2026, submit by 07:30 EDT 2026-09-27). Ship working software fast; `main` must always run.

## Read first

1. Spec: `docs/superpowers/specs/2026-09-26-onetake-design.md`
2. Data contract between lanes (source of truth): `contracts/motion-v1.md` + `contracts/bones.json`
3. Your lane's plan: `docs/superpowers/plans/`

## Lanes — edit only your own folder

| Lane | Folder |
|---|---|
| Web | `web/` except `web/src/motion/` |
| motion-core (Claude on the lead Mac) | `web/src/motion/` |
| AI / Backend | `server/` |
| Unity | `unity/` |

Changing anything in `contracts/` requires telling the whole team first. Only the lead Mac edits `docs/superpowers/`.

## Commands

| What | Command |
|---|---|
| Web dev server | `cd web && npm install && npm run dev` → http://localhost:5173 |
| Web tests | `cd web && npm test` |
| Server | `cd server && uv sync && uv run uvicorn onetake_server.main:app --reload --port 8787` |
| Server tests | `cd server && uv run pytest` |
| Regenerate fixtures | `python3 contracts/fixtures/make_fixtures.py` |

## Rules

- Hackathon test mode: TDD for pure logic (motion-core, server validation/export); manual checklists for UI and Unity. No coverage gate.
- Commit messages: `feat|fix|refactor|docs|test|chore: <what>`. Small commits, `git pull --rebase` before every push.
- Never commit `.env` or API keys. New env vars go into `.env.example`.
- Never commit Mixamo or other third-party character models (license). Keep them in your local Unity project.
