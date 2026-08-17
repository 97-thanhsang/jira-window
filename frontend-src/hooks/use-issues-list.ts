import { useMemo } from 'react';
import useSWR from 'swr';
import { api } from '@/lib/api';
import type { JiraSearchResult } from '@/types/jira';

export interface IssueFilters {
  text?: string;
  // ── Multi-value filters ──────────────────────────────────────────
  statusIn?: string[];          // actual status names e.g. "Open", "In Progress"
  statusExclude?: boolean;
  priorityIn?: string[];
  priorityExclude?: boolean;
  issuetypeIn?: string[];
  issuetypeExclude?: boolean;
  projectIn?: string[];
  projectExclude?: boolean;
  // ── Multi-value person/sprint ────────────────────────────────────
  assigneeIn?: string[];        // 'currentUser()' | 'EMPTY' | username
  assigneeExclude?: boolean;
  reporterIn?: string[];        // 'currentUser()' | username
  reporterExclude?: boolean;
  sprintIn?: string[];          // sprint names
  sprintExclude?: boolean;
  // ── Epic filter ──────────────────────────────────────────────────
  epicIn?: string[];
  epicExclude?: boolean;
  // ── Date range mode ──────────────────────────────────────────────
  dateRangeMode?: 'current' | 'old';
  // ── Legacy single-value (kept for backward compat) ──────────────
  project?: string;
  assignee?: string;
  unassignedOnly?: boolean;
  labels?: string;
  updatedAfter?: string;
  duedate?: string;
  startAt?: number;
  reporter?: string;
  resolution?: string;
  sprint?: string;
  component?: string;
  fixVersion?: string;
  createdAfter?: string;
  // ── Quick filters ──────────────────────────────────────────────────
  onlyMyIssues?: boolean;
  recentlyUpdated?: boolean;
  dueThisWeek?: boolean;
  highPriority?: boolean;
  // ── Period ─────────────────────────────────────────────────────────
  period?: string;
  // ── Sorting ──────────────────────────────────────────────────────
  sortField?: string;
  sortDir?: 'ASC' | 'DESC';
}

function buildJql(filters: IssueFilters): string {
  const parts: string[] = [];

  // ── Resolution (default: Unresolved only) ──
  if (filters.resolution === 'all') {
    // no constraint
  } else if (filters.resolution && filters.resolution !== 'Unresolved') {
    parts.push(`resolution = "${filters.resolution}"`);
  } else {
    parts.push('resolution = Unresolved');
  }

  if (filters.text) parts.push(`text ~ "${filters.text}"`);

  // ── Multi-value Status ──
  if (filters.statusIn?.length) {
    const vals = filters.statusIn.map(s => `"${s}"`).join(', ');
    parts.push(filters.statusExclude
      ? `status NOT IN (${vals})`
      : `status IN (${vals})`);
  }

  // ── Multi-value Priority ──
  if (filters.priorityIn?.length) {
    const vals = filters.priorityIn.map(p => `"${p}"`).join(', ');
    parts.push(filters.priorityExclude
      ? `priority NOT IN (${vals})`
      : `priority IN (${vals})`);
  }

  // ── Multi-value Issue Type ──
  if (filters.issuetypeIn?.length) {
    const vals = filters.issuetypeIn.map(t => `"${t}"`).join(', ');
    parts.push(filters.issuetypeExclude
      ? `issuetype NOT IN (${vals})`
      : `issuetype IN (${vals})`);
  }

  // ── Project: projectIn takes priority over project ──
  if (filters.projectIn?.length) {
    const vals = filters.projectIn.map(p => `"${p}"`).join(', ');
    parts.push(filters.projectExclude
      ? `project NOT IN (${vals})`
      : `project IN (${vals})`);
  } else if (filters.project) {
    parts.push(`project = "${filters.project}"`);
  }
  if (filters.labels)  parts.push(`labels = "${filters.labels}"`);

  // ── Assignee: unassignedOnly > assigneeIn > assignee ──
  if (filters.unassignedOnly) {
    parts.push('assignee is EMPTY');
  } else if (filters.assigneeIn?.length) {
    const empties = filters.assigneeIn.filter(a => a === 'EMPTY');
    const users   = filters.assigneeIn.filter(a => a !== 'EMPTY');
    const clauses: string[] = [];
    if (empties.length) clauses.push('assignee is EMPTY');
    if (users.length) {
      const vals = users.map(a => a === 'currentUser()' ? 'currentUser()' : `"${a}"`).join(', ');
      clauses.push(`assignee IN (${vals})`);
    }
    const joined = clauses.length === 1 ? clauses[0] : `(${clauses.join(' OR ')})`;
    parts.push(filters.assigneeExclude ? `NOT ${joined}` : joined);
  } else if (filters.assignee === 'currentUser()') {
    parts.push('assignee = currentUser()');
  } else if (filters.assignee === 'EMPTY') {
    parts.push('assignee is EMPTY');
  } else if (filters.assignee) {
    parts.push(`assignee = "${filters.assignee}"`);
  }

  // ── Reporter: reporterIn > reporter ──
  if (filters.reporterIn?.length) {
    const vals = filters.reporterIn
      .map(r => r === 'currentUser()' ? 'currentUser()' : `"${r}"`)
      .join(', ');
    parts.push(filters.reporterExclude
      ? `reporter NOT IN (${vals})`
      : `reporter IN (${vals})`);
  } else if (filters.reporter === 'currentUser()') {
    parts.push('reporter = currentUser()');
  } else if (filters.reporter) {
    parts.push(`reporter = "${filters.reporter}"`);
  }

  // ── Sprint: sprintIn > sprint ──
  if (filters.sprintIn?.length) {
    const vals = filters.sprintIn.map(s => `"${s}"`).join(', ');
    parts.push(filters.sprintExclude
      ? `sprint NOT IN (${vals})`
      : `sprint IN (${vals})`);
  } else if (filters.sprint) {
    parts.push(`sprint = "${filters.sprint}"`);
  }

  // ── Epic Link ──
  if (filters.epicIn?.length) {
    const vals = filters.epicIn.map(k => `"${k}"`).join(', ');
    parts.push(filters.epicExclude
      ? `"Epic Link" NOT IN (${vals})`
      : `"Epic Link" IN (${vals})`);
  }

  if (filters.component)  parts.push(`component = "${filters.component}"`);
  if (filters.fixVersion) parts.push(`fixVersion = "${filters.fixVersion}"`);

  if (filters.updatedAfter === '-1d')  parts.push('updated >= "-1d"');
  else if (filters.updatedAfter === '-7d')  parts.push('updated >= "-7d"');
  else if (filters.updatedAfter === '-30d') parts.push('updated >= "-30d"');

  if (filters.createdAfter === '-1d')  parts.push('created >= "-1d"');
  else if (filters.createdAfter === '-7d')  parts.push('created >= "-7d"');
  else if (filters.createdAfter === '-30d') parts.push('created >= "-30d"');
  else if (filters.createdAfter === '-90d') parts.push('created >= "-90d"');

  if (filters.duedate === 'overdue')
    parts.push('duedate < now() AND duedate is not EMPTY');
  else if (filters.duedate === 'this_week')
    parts.push('duedate >= startOfWeek() AND duedate <= endOfWeek()');
  else if (filters.duedate === 'next_week')
    parts.push('duedate >= startOfWeek(1) AND duedate <= endOfWeek(1)');

  const orderField = filters.sortField ?? 'updated';
  const orderDir   = filters.sortDir   ?? 'DESC';
  return (parts.length ? parts.join(' AND ') : '') + ` ORDER BY ${orderField} ${orderDir}`;
}

export function useIssuesList(filters: IssueFilters = {}) {
  const swrKey = JSON.stringify(filters);

  const { data, error, isLoading, mutate } = useSWR(
    swrKey,
    () =>
      api
        .get<JiraSearchResult>('/search', {
          params: {
            jql: buildJql(filters),
            maxResults: 500,
            fields:
              'summary,status,priority,issuetype,project,updated,created,assignee,reporter,' +
              'labels,duedate,resolution,fixVersions,components,sprint,customfield_10020,timetracking,parent,customfield_10107',
          },
        })
        .then((r) => r.data),
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  );

  // ── Batch fetch epic summaries ───────────────────────────────────────────
  const epicKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const issue of data?.issues ?? []) {
      const ek = (issue.fields as unknown as Record<string, unknown>).customfield_10107 as string | undefined;
      if (ek) keys.add(ek);
    }
    return Array.from(keys);
  }, [data]);

  const { data: epicData } = useSWR(
    epicKeys.length > 0 ? ['epic-summaries', ...epicKeys.sort()] : null,
    async () => {
      const jql = `issue IN (${epicKeys.map(k => `"${k}"`).join(', ')})`;
      const r = await api.get<JiraSearchResult>('/search', {
        params: { jql, maxResults: epicKeys.length, fields: 'summary' },
      });
      const map: Record<string, string> = {};
      for (const issue of r.data.issues ?? []) {
        map[issue.key] = issue.fields.summary ?? '';
      }
      return map;
    },
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  );

  return {
    issues: data?.issues ?? [],
    total: data?.total ?? 0,
    isLoading,
    error,
    mutate,
    epicSummaries: epicData ?? {},
  };
}
