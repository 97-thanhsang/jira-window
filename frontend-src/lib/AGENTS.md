# lib/ — Frontend Utilities & API Layer

> **Generated:** 2026-05-15 | Parent: `../AGENTS.md`

## OVERVIEW

9 files: one central axios client, domain API wrappers, AI helper (fetch-based), and utilities.

## FILE INVENTORY

| File | Role |
|------|------|
| `api.ts` | **Central axios instance** — baseURL = `NEXT_PUBLIC_API_URL/api/jira`, injects `X-Jira-Auth` from localStorage, handles 401 → redirect to `/login`. Also exports `saveAuth`, `clearAuth`, `getStoredUser`, `isAuthenticated`. |
| `ai.ts` | **AI helper** — native `fetch` to `NEXT_PUBLIC_API_URL/api/ai/*`, sends `X-AI-Key` from localStorage. Exports: `aiSummarize`, `aiDraftComment`, `aiParseWorklog`, `aiSuggestTransition`, `aiSprintReview`. |
| `worklog-api.ts` | Worklog CRUD wrappers using `api` (axios). `fetchWorklogs` maps Jira search → `WorklogEntry[]`. |
| `team-api.ts` | Builds multi-user JQL, fetches team worklogs + due dates. |
| `team-plan-api.ts` | Fetches sub-tasks + batch parent issues → `TeamReportData`. |
| `transitions.ts` | `moveIssue()` — finds transition ID and POSTs to Jira `/transitions`. |
| `jira-wiki.ts` | Converts Jira wiki markup → HTML for `wiki-renderer.tsx`. |
| `worklogs.ts` | localStorage helpers for recent worklogs. |
| `utils.ts` | `cn()` — clsx + tailwind-merge. |

## CONVENTIONS

- `api` (axios instance) = only client for `/api/jira/*`. Do not create additional axios instances.
- `ai.ts` uses `fetch` (not axios) intentionally — AI key is per-request, not in global interceptors.
- Domain wrappers in `*-api.ts` are pure async functions (not hooks). Hooks in `hooks/` call these.
- `typeof window === 'undefined'` guard required in any helper that reads `localStorage` — see `api.ts` lines 5-8 as reference.

## ANTI-PATTERNS

- Calling Gemini/AI from browser directly — always go through `ai.ts` → backend `/api/ai/*`.
- Creating a second axios instance — extend `api.ts` interceptors instead.
- Reading `localStorage` outside `typeof window` guard in helper functions.
- Putting data-transform logic in hooks — keep it in `*-api.ts` wrappers.
