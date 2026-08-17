# hooks/ — SWR Data Hooks

> **Generated:** 2026-05-15 | Parent: `../AGENTS.md`

## OVERVIEW

11 SWR-based hooks — all server state lives here. Pattern: `useSWR(key, fetcher)` where fetcher calls `api.get(...)` (axios) or a domain lib wrapper.

## HOOK INVENTORY

| Hook | Data | Key pattern |
|------|------|-------------|
| `use-issue.ts` | Single issue by key | `/issue/${key}` |
| `use-issues-list.ts` | JQL-filtered issue list | JQL string |
| `use-my-issues.ts` | Current user's open issues | `my-issues` |
| `use-jql-search.ts` | Arbitrary JQL | JQL string |
| `use-search.ts` | Debounced quick search | `/search?q=...` |
| `use-projects.ts` | All Jira projects | `/project` |
| `use-board-state.ts` | Board columns + optimistic moves | composed |
| `use-worklogs.ts` | Worklogs by user/date | date range |
| `use-worklog-mutations.ts` | Add/update/delete worklogs | — (mutations) |
| `use-team-dashboard.ts` | Team worklog + task report | team members |
| `use-team-plan.ts` | Sub-tasks + worklog totals | team plan JQL |

## CONVENTIONS

- Every hook returns `{ data, error, isLoading }` (SWR shape).
- Mutations call `worklog-api.ts` then `mutate()` to revalidate.
- `use-board-state.ts` implements optimistic moves: local override map + revert on failure.
- No hooks import from other hooks (flat dependency) except `use-board-state` composing `use-my-issues`.

## ANTI-PATTERNS

- Calling `api.get()` directly in components — use or create a hook.
- `useEffect` + `fetch` for data fetching — use SWR.
- Storing fetched data in `useState` — use SWR cache.
- Multiple hooks for same SWR key — deduplicate keys carefully (SWR shares cache by key identity).
