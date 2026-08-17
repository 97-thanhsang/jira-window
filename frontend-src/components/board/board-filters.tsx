'use client';
import type { JiraIssue } from '@/types/jira';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BoardFilters {
  // Text search
  searchText: string;
  // Multi-select filters
  projectIn?: string[];        // project keys
  projectExclude?: boolean;
  issuetypeIn?: string[];
  issuetypeExclude?: boolean;
  statusIn?: string[];
  statusExclude?: boolean;
  priorityIn?: string[];
  priorityExclude?: boolean;
  assigneeIn?: string[];       // 'currentUser()' | 'EMPTY' | username
  assigneeExclude?: boolean;
  sprintIn?: string[];
  sprintExclude?: boolean;
  reporterIn?: string[];
  reporterExclude?: boolean;
  dateRangeMode?: 'current' | 'old';
  // Period / Due date filter
  period?: 'today' | 'week' | 'month' | 'year';
  dateFrom?: string;           // yyyy-MM-dd (derived from period)
  dateTo?: string;             // yyyy-MM-dd (derived from period)
  // Quick filters
  onlyMyIssues: boolean;
  recentlyUpdated: boolean;
  dueThisWeek: boolean;
  highPriority: boolean;
}

export const EMPTY_FILTERS: BoardFilters = {
  searchText: '',
  onlyMyIssues: false,
  recentlyUpdated: false,
  dueThisWeek: false,
  highPriority: false,
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Compute start of current week (Monday 00:00) */
function getWeekStart(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.getFullYear(), now.getMonth(), diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/** Compute end of current week (Sunday 23:59:59.999) */
function getWeekEnd(): Date {
  const monday = getWeekStart();
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return sunday;
}

// ─── Client-side filter logic ──────────────────────────────────────────────────

/** Apply filters on already-fetched issues (client-side filtering) */
export function applyFilters(
  issues: JiraIssue[],
  filters: BoardFilters,
  currentUsername?: string,
): JiraIssue[] {
  const now = Date.now();
  const DAY_MS = 86_400_000;
  const weekStart = getWeekStart().getTime();
  const weekEnd = getWeekEnd().getTime();

  return issues.filter((issue) => {
    // ── Search text ─────────────────────────────────────────────────
    if (filters.searchText) {
      const q = filters.searchText.toLowerCase();
      if (
        !issue.key.toLowerCase().includes(q) &&
        !issue.fields.summary.toLowerCase().includes(q)
      ) return false;
    }

    // ── Project (multi-select) ──────────────────────────────────────
    if (filters.projectIn?.length) {
      if (!issue.fields.project) return false;
      const match = filters.projectIn.includes(issue.fields.project.key);
      if (filters.projectExclude ? match : !match) return false;
    }

    // ── Issue type (multi-select) ───────────────────────────────────
    if (filters.issuetypeIn?.length) {
      if (!issue.fields.issuetype) return false;
      const match = filters.issuetypeIn.includes(issue.fields.issuetype.name);
      if (filters.issuetypeExclude ? match : !match) return false;
    }

    // ── Status (multi-select) ───────────────────────────────────────
    if (filters.statusIn?.length) {
      if (!issue.fields.status) return false;
      const match = filters.statusIn.includes(issue.fields.status.name);
      if (filters.statusExclude ? match : !match) return false;
    }

    // ── Priority (multi-select) ─────────────────────────────────────
    if (filters.priorityIn?.length) {
      if (!issue.fields.priority) return false;
      const match = filters.priorityIn.includes(issue.fields.priority.name);
      if (filters.priorityExclude ? match : !match) return false;
    }

    // ── Assignee (multi-select) ─────────────────────────────────────
    if (filters.assigneeIn?.length) {
      const assigneeName = issue.fields.assignee?.name;
      let match = false;

      for (const v of filters.assigneeIn) {
        if (v === 'currentUser()') {
          if (assigneeName === currentUsername) { match = true; break; }
        } else if (v === 'EMPTY') {
          if (!assigneeName) { match = true; break; }
        } else if (assigneeName === v) {
          match = true; break;
        }
      }
      if (filters.assigneeExclude ? match : !match) return false;
    }

    // ── Sprint (multi-select) ───────────────────────────────────────
    if (filters.sprintIn?.length) {
      const issueSprints = new Set<string>();
      // Active/future sprint from fields.sprint
      const sprintField = issue.fields.sprint;
      if (sprintField) {
        if (Array.isArray(sprintField)) {
          sprintField.forEach((s: { name?: string }) => { if (s.name) issueSprints.add(s.name); });
        } else if (sprintField.name) {
          issueSprints.add(sprintField.name);
        }
      }
      // Customfield may contain all sprints (including closed)
      const cf = issue.fields.customfield_10020;
      if (cf) {
        if (Array.isArray(cf)) {
          cf.forEach((s: { name?: string }) => { if (s.name) issueSprints.add(s.name); });
        } else if (cf.name) {
          issueSprints.add(cf.name);
        }
      }

      const hasSprint = filters.sprintIn.some(s => issueSprints.has(s));
      if (filters.sprintExclude ? hasSprint : !hasSprint) return false;
    }

    // ── Reporter (multi-select) ─────────────────────────────────────
    if (filters.reporterIn?.length) {
      const reporterName = issue.fields.reporter?.name;
      let match = false;

      for (const v of filters.reporterIn) {
        if (v === 'currentUser()') {
          if (reporterName === currentUsername) { match = true; break; }
        } else if (reporterName === v) {
          match = true; break;
        }
      }
      if (filters.reporterExclude ? match : !match) return false;
    }

    // ── Period / Due date filter ────────────────────────────────────
    if (filters.period && filters.dateFrom) {
      if (!issue.fields.duedate) return false;
      const dueMs = new Date(issue.fields.duedate).getTime();
      const fromMs = new Date(filters.dateFrom).getTime();
      const toMs = filters.dateTo ? new Date(filters.dateTo).getTime() + 86_399_999 : fromMs + 86_399_999; // end of day
      if (dueMs < fromMs || dueMs > toMs) return false;
    }

    // ── Quick filter: only my issues ────────────────────────────────
    if (filters.onlyMyIssues && currentUsername) {
      if (issue.fields.assignee?.name !== currentUsername) return false;
    }

    // ── Quick filter: recently updated (last 24h) ───────────────────
    if (filters.recentlyUpdated) {
      const updatedMs = new Date(issue.fields.updated).getTime();
      if (now - updatedMs > DAY_MS) return false;
    }

    // ── Quick filter: due this week ─────────────────────────────────
    if (filters.dueThisWeek) {
      if (!issue.fields.duedate) return false;
      const dueMs = new Date(issue.fields.duedate).getTime();
      if (dueMs < weekStart || dueMs > weekEnd) return false;
    }

    // ── Quick filter: high priority only ────────────────────────────
    if (filters.highPriority) {
      if (!['Highest', 'High'].includes(issue.fields.priority?.name ?? '')) return false;
    }

    return true;
  });
}

// ─── Component placeholder ────────────────────────────────────────────────────

interface BoardFilterBarProps {
  filters: BoardFilters;
  onChange: (filters: BoardFilters) => void;
  allIssues: JiraIssue[];
}

export function BoardFilterBar(_props: BoardFilterBarProps) {
  // Replaced by board-filter-bar.tsx
  return null;
}
