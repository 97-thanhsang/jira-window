'use client';

import { useMemo, useCallback } from 'react';
import useSWR from 'swr';
import { api } from '@/lib/api';
import type { JiraIssue, JiraSearchResult } from '@/types/jira';

// ─── Filters type ─────────────────────────────────────────────────────────

export interface DashboardFilters {
  teamMembers?: string[];
  period?: 'today' | 'week' | 'month' | 'custom';
  project?: string;
  dateFrom?: string;
  dateTo?: string;
}

// ─── JQL Builder ──────────────────────────────────────────────────────────

function buildJQL(base: string, filters: DashboardFilters): string {
  const parts = [base];

  // Team filter: assignee IN (members)
  if (filters.teamMembers && filters.teamMembers.length > 0) {
    const members = filters.teamMembers.map(m => `"${m}"`).join(', ');
    parts.push(`AND assignee IN (${members})`);
  }

  // Project filter
  if (filters.project) {
    parts.push(`AND project = "${filters.project}"`);
  }

  return parts.join(' ');
}

function recentJQL(filters: DashboardFilters): string {
  const base = 'assignee = currentUser() AND resolution = Unresolved';

  // Override assignee for team filter
  let jql = 'resolution = Unresolved';
  if (filters.teamMembers && filters.teamMembers.length > 0) {
    const members = filters.teamMembers.map(m => `"${m}"`).join(', ');
    jql = `assignee IN (${members}) AND ${jql}`;
  } else {
    jql = `assignee = currentUser() AND ${jql}`;
  }

  // Date filter for recent activity
  if (filters.dateFrom && filters.dateTo) {
    jql += ` AND updated >= "${filters.dateFrom}" AND updated <= "${filters.dateTo}"`;
  } else {
    jql += ' AND updated >= -7d';
  }

  if (filters.project) jql += ` AND project = "${filters.project}"`;
  return jql + ' ORDER BY updated DESC';
}

function myIssuesJQL(filters: DashboardFilters): string {
  let jql = 'resolution = Unresolved';
  if (filters.teamMembers && filters.teamMembers.length > 0) {
    const members = filters.teamMembers.map(m => `"${m}"`).join(', ');
    jql = `assignee IN (${members}) AND ${jql}`;
  } else {
    jql = `assignee = currentUser() AND ${jql}`;
  }
  if (filters.project) jql += ` AND project = "${filters.project}"`;
  return jql + ' ORDER BY updated DESC';
}

function dueSoonJQL(filters: DashboardFilters): string {
  let jql = '';
  if (filters.teamMembers && filters.teamMembers.length > 0) {
    const members = filters.teamMembers.map(m => `"${m}"`).join(', ');
    jql = `assignee IN (${members}) AND`;
  } else {
    jql = 'assignee = currentUser() AND';
  }
  jql += ' duedate <= 7d AND duedate >= -30d AND resolution = Unresolved';
  if (filters.project) jql += ` AND project = "${filters.project}"`;
  return jql + ' ORDER BY duedate ASC';
}

// ─── SWR key builders (for cache busting on filter change) ────────────────

function makeKey(prefix: string, filters: DashboardFilters): [string, string, string, string] {
  return [prefix, filters.teamMembers?.join(',') ?? '', filters.project ?? '', filters.dateFrom ?? ''];
}

// ─── Types ───────────────────────────────────────────────────────────────

export interface MyIssuesData {
  todo: number;
  inProgress: number;
  done: number;
  total: number;
  issues: JiraIssue[];
}

export interface RecentActivityItem {
  issueKey: string;
  summary: string;
  status: string;
  statusCategory: string;
  updated: string;
  projectKey: string;
}

export interface DueSoonItem {
  issueKey: string;
  summary: string;
  status: string;
  statusCategory: string;
  duedate: string;
  priority: string;
  overdue: boolean;
}

export interface DashboardData {
  myIssues: MyIssuesData;
  recentActivity: RecentActivityItem[];
  dueSoon: DueSoonItem[];
  isLoading: boolean;
  error: unknown;
  refresh: () => void;
}

// ─── Hook ────────────────────────────────────────────────────────────────

export function useDashboardData(filters?: DashboardFilters): DashboardData {
  const f = filters ?? {};

  const mySwr = useSWR(makeKey('dash-my-issues', f), () =>
    api.get<JiraSearchResult>('/search', {
      params: {
        jql: myIssuesJQL(f),
        maxResults: 100,
        fields: 'summary,status,priority,issuetype,project,updated,created,assignee,reporter,duedate,labels,components,timetracking,sprint,parent',
      },
    }).then(r => r.data),
    { revalidateOnFocus: false, dedupingInterval: 30000, refreshInterval: 60000 },
  );

  const recSwr = useSWR(makeKey('dash-recent', f), () =>
    api.get<JiraSearchResult>('/search', {
      params: {
        jql: recentJQL(f),
        maxResults: 10,
        fields: 'summary,status,issuetype,project,updated,duedate,assignee,timetracking',
      },
    }).then(r => r.data),
    { revalidateOnFocus: false, dedupingInterval: 30000, refreshInterval: 60000 },
  );

  const dueSwr = useSWR(makeKey('dash-due', f), () =>
    api.get<JiraSearchResult>('/search', {
      params: {
        jql: dueSoonJQL(f),
        maxResults: 20,
        fields: 'summary,status,priority,issuetype,project,duedate,assignee,timetracking',
      },
    }).then(r => r.data),
    { revalidateOnFocus: false, dedupingInterval: 30000, refreshInterval: 60000 },
  );

  const myIssues = useMemo<MyIssuesData>(() => {
    const empty = { todo: 0, inProgress: 0, done: 0, total: 0, issues: [] };
    if (!mySwr.data) return empty;
    const result = { todo: 0, inProgress: 0, done: 0, total: 0, issues: mySwr.data.issues };
    for (const issue of mySwr.data.issues) {
      const cat = issue.fields.status.statusCategory.key;
      if (cat === 'new') result.todo++;
      else if (cat === 'indeterminate') result.inProgress++;
      else if (cat === 'done') result.done++;
      result.total++;
    }
    return result;
  }, [mySwr.data]);

  const recentActivity = useMemo<RecentActivityItem[]>(() => {
    if (!recSwr.data) return [];
    return recSwr.data.issues.map(i => ({
      issueKey: i.key,
      summary: i.fields.summary,
      status: i.fields.status.name,
      statusCategory: i.fields.status.statusCategory.key,
      updated: i.fields.updated,
      projectKey: i.fields.project.key,
    }));
  }, [recSwr.data]);

  const dueSoon = useMemo<DueSoonItem[]>(() => {
    if (!dueSwr.data) return [];
    const now = new Date();
    return dueSwr.data.issues.map(i => ({
      issueKey: i.key,
      summary: i.fields.summary,
      status: i.fields.status.name,
      statusCategory: i.fields.status.statusCategory.key,
      duedate: i.fields.duedate ?? '',
      priority: i.fields.priority?.name ?? '',
      overdue: i.fields.duedate ? new Date(i.fields.duedate) < now : false,
    }));
  }, [dueSwr.data]);

  const refresh = useCallback(() => {
    mySwr.mutate();
    recSwr.mutate();
    dueSwr.mutate();
  }, [mySwr, recSwr, dueSwr]);

  return {
    myIssues,
    recentActivity,
    dueSoon,
    isLoading: mySwr.isLoading || recSwr.isLoading || dueSwr.isLoading,
    error: mySwr.error || recSwr.error || dueSwr.error,
    refresh,
  };
}
