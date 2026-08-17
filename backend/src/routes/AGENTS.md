# routes/ — Express v5 Proxy + AI Endpoints

> **Generated:** 2026-05-21 | Parent: `../../AGENTS.md`

## OVERVIEW

Two route files handle all backend traffic: Jira API proxy (passthrough with auth injection) and Google Gemini AI endpoints (stateless, per-request key).

## FILES

| File | Lines | Role |
|------|-------|------|
| `jira.ts` | ~237 | Jira REST API v2 proxy — all methods, attachment streaming, Basic auth injection |
| `ai.ts` | ~228 | 5 Gemini endpoints — summarize, draft-comment, parse-worklog, suggest-transition, sprint-review |

## WHERE TO LOOK

| Task | Location |
|------|----------|
| Add Jira API proxy route | `jira.ts` — add to the wildcard router or new named route |
| Add AI endpoint | `ai.ts` — new POST handler + register in `createRouter()` |
| Fix auth header injection | `jira.ts` — `X-Jira-Auth` → `Authorization: Basic` |
| Attachment streaming | `jira.ts` — `/attachment-content/:id` route + `beforeRedirect` hook |
| AI prompt tuning | `ai.ts` — model/prompt constants at top of file |

## CRITICAL: EXPRESS v5 WILDCARDS

See [`backend/AGENTS.md`](../../AGENTS.md#critical-express-v5-wildcards) for full pattern. **Key reminders:**
- Always `/*path` (named), never `/*` or `/:path*`
- `req.params['path']` is an array for nested paths — always join: `Array.isArray(rawPath) ? rawPath.join('/') : rawPath`

## CONVENTIONS

- **Jira proxy**: All `/api/jira/*` → forwarded to `JIRA_BASE_URL/rest/api/2/*` with `Authorization: Basic` header injected from `X-Jira-Auth` request header.
- **AI endpoints**: All `/api/ai/*` are stateless — read `X-AI-Key` from request header, never cache server-side.
- **Attachment proxy**: Uses `beforeRedirect` on axios to re-inject `Authorization` when Jira Server returns 3xx redirects (common for attachment URLs).
- **Error handling**: 401 on bad Jira auth, 403 on bad AI key, forward Jira error responses as-is.
- **Route registration**: Add new routers in `backend/src/index.ts` — never inline routes there.

## ANTI-PATTERNS

- Using `/*` or `/:path*` wildcards — ALWAYS `/*path` with named param.
- Forgetting `Array.isArray()` check on `req.params['path']` — nested paths produce arrays.
- Caching `X-Jira-Auth` or `X-AI-Key` between requests — security risk.
- Direct `fetch()` to Jira from routes — use the axios instance (has interceptors for auth, redirects).
- Adding business logic in route handlers — routes proxy/forward, don't transform data.
