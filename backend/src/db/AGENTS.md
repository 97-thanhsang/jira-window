# db/ — Drizzle ORM + Dual DB

> **Generated:** 2026-05-15 | Parent: `../../AGENTS.md`

## OVERVIEW

Runtime-switched DB layer: SQLite (default, no config) or PostgreSQL (when `DATABASE_URL` env is set). Drizzle ORM. Two schema files for each DB engine.

## FILES

| File | Role |
|------|------|
| `index.ts` | Runtime init — checks `DATABASE_URL`, exports `db` and `dbReady` (Promise) |
| `schema.ts` | Drizzle schema for **SQLite** (better-sqlite3) |
| `schema-pg.ts` | Drizzle schema for **PostgreSQL** (pg driver) |
| `migrate.ts` | Migration runner — PG mode only; auto-runs on startup |

## SWITCHING DB

```bash
# SQLite (local dev) — leave DATABASE_URL unset
# .env: (no DATABASE_URL)

# PostgreSQL (Docker/prod)
# .env: DATABASE_URL=postgresql://user:pass@host:5432/dbname
```

`db/index.ts` checks `process.env.DATABASE_URL` at startup and imports the correct driver + schema.

## CONVENTIONS

- Always `await dbReady` before using `db` in routes (async init).
- Schema changes → update **both** `schema.ts` and `schema-pg.ts`.
- Migrations generated via `drizzle-kit` (devDep) — run `npx drizzle-kit generate` after schema change.
- SQLite file stored at `backend/data/jira-power.db` (not committed — in .gitignore).

## ANTI-PATTERNS

- Accessing `db` before `await dbReady` — race condition on startup.
- Adding SQLite-only syntax in `schema-pg.ts` or vice versa (e.g., `autoincrement()` vs `serial()`).
- Raw SQL strings — use Drizzle query builder.
