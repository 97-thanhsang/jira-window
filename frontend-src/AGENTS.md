# frontend/ — Next.js 16 App Router

> **Generated:** 2026-05-21 | Parent: `../AGENTS.md`

## OVERVIEW

Next.js 16 App Router SPA — no server components with data, all data fetching via SWR + axios in client components. UI: `@base-ui/react` primitives + Tailwind v4 + cva variants.

## STRUCTURE

```
frontend/
├── app/
│   ├── layout.tsx            # Root layout (html/body wrapper)
│   ├── page.tsx              # Root redirect → /board or /login
│   ├── (app)/                # Auth-guarded route group
│   │   ├── layout.tsx        # App shell: Sidebar + auth guard
│   │   ├── board/page.tsx
│   │   ├── issues/page.tsx + [key]/page.tsx
│   │   ├── projects/page.tsx + [key]/page.tsx
│   │   ├── worklog/page.tsx
│   │   ├── team/page.tsx
│   │   ├── team-plan/page.tsx
│   │   ├── settings/page.tsx
│   │   └── search/page.tsx
│   └── (auth)/login/page.tsx # Login (outside auth guard)
├── components/               # See components/AGENTS.md
├── hooks/                    # See hooks/AGENTS.md
├── lib/                      # See lib/AGENTS.md
└── types/jira.ts             # All Jira entity types
```

## WHERE TO LOOK

| Task | Location |
|------|----------|
| Add a page | `app/(app)/{name}/page.tsx` |
| Auth guard logic | `app/(app)/layout.tsx` |
| Login page | `app/(auth)/login/page.tsx` |
| Root entry/redirect | `app/page.tsx` |
| All Jira types | `types/jira.ts` |

## CONVENTIONS

- **All pages are client components** (`'use client'`) — no server-side data fetching in Next.
- **`@/*`** alias maps to `frontend/` root (tsconfig paths).
- **No `app/api/`** — all API logic lives in Express backend.
- **Auth** is client-side only: `isAuthenticated()` from `lib/api.ts` + `router.replace` in `useEffect`.
- **UI kit:** `components/ui/*` are `@base-ui/react` wrappers with cva variants. Import from `@/components/ui/*`, not from `@base-ui/react` directly in feature components.

## ANTI-PATTERNS

- `localStorage` in render body → SSR hydration mismatch. Use `useEffect` always.
- Importing `@base-ui/react` directly in feature components — use `components/ui/*` wrappers.
- Creating Next.js API routes (`app/api/`) — add to Express backend instead.
- `delayDuration` on Tooltip → use `delay` (base-ui API difference).
- Global state stores (Zustand/Redux) — use SWR for server state, `useState` for UI state.
