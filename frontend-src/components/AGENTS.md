# components/ — Domain Component Library

> **Generated:** 2026-05-15 | Parent: `../AGENTS.md`

## OVERVIEW

6 domain folders + `ui/` design-system layer. All components are client components. UI primitives: `@base-ui/react` wrapped in `ui/*` with cva variants.

## STRUCTURE

```
components/
├── ui/           # @base-ui/react wrappers (button, input, avatar, tooltip, dropdown-menu, card, badge, separator, label, skeleton)
├── shared/       # Cross-domain: status-badge, priority-icon, project-stats-list, collapsible-detail-panel
├── board/        # kanban-board, issue-card, board-filters, board-charts, board-epic-panel, board-version-panel, quick-view-panel
├── issues/       # issues-table, issue-row, issue-detail-panel, filter-panel, worklogs-tab, user-search-input
├── issue/        # Single-issue sub-components: comment-section, log-work-modal, wiki-renderer, attachment-gallery, transition-button
├── worklog/      # worklog-calendar, worklog-day-cell, worklog-entry-card, worklog-drawer, worklog-filters
├── team/         # team-report-table, team-filters, team-export
├── search/       # command-palette (global keyboard shortcut overlay)
├── sidebar.tsx   # Main app nav sidebar
├── create-issue-modal.tsx
└── keyboard-shortcuts-overlay.tsx
```

## WHERE TO LOOK

| Task | File |
|------|------|
| Add a UI primitive | `ui/` — wrap `@base-ui/react/*` with cva |
| Issue detail view | `issues/issue-detail-panel.tsx` (1049 lines — complex) |
| Kanban board | `board/kanban-board.tsx` → uses `use-board-state` |
| Log work modal | `issue/log-work-modal.tsx` |
| Global search | `search/command-palette.tsx` |
| Status/priority display | `shared/status-badge.tsx`, `shared/priority-icon.tsx` |

## CONVENTIONS

- Feature components consume hooks, not `api.*` directly.
- `cn()` from `lib/utils.ts` for class merging (clsx + tailwind-merge).
- `cva()` for variant recipes in `ui/` components.
- `lucide-react` for all icons.
- `localStorage` only in `useEffect` or event handlers — never in render.

## ANTI-PATTERNS

- Importing from `@base-ui/react` in feature components — use `ui/*` wrappers.
- Fat components: `issue-detail-panel.tsx` and `issues-table.tsx` are already 1000+ lines — extract sub-components rather than adding more logic there.
- Inline `fetch()` or `axios` calls in components — use hooks.
