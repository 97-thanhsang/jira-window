import { api } from './api';
import { mapWorklogEntry, type RawIssue } from './worklog-mapper';
import type { WorklogEntry, DueTaskInfo, WorklogSearchResult } from '@/types/jira';

/** Fetch worklogs for multiple users (or all users) */
export async function fetchTeamWorklogs(
  usernames: string[],
  dateFrom: string,
  dateTo: string,
  allUsers: boolean = false,
): Promise<WorklogSearchResult> {
  if (usernames.length === 0 && !allUsers) return { entries: [], total: 0, totalHours: 0, dailyHours: {} };

  let jql: string;
  if (allUsers) {
    jql = `worklogDate >= "${dateFrom}" AND worklogDate <= "${dateTo}" ORDER BY created DESC`;
  } else {
    const userList = usernames.map((u) => `"${u}"`).join(', ');
    jql = `worklogAuthor IN (${userList}) AND worklogDate >= "${dateFrom}" AND worklogDate <= "${dateTo}" ORDER BY created DESC`;
  }

  const r = await api.get<{ total: number; issues: RawIssue[] }>('/search', {
    params: { jql, maxResults: 1000, fields: 'summary,issuetype,project,worklog,timetracking,status,priority,duedate,parent' },
  });

  const entries: WorklogEntry[] = [];
  const dailyHours: Record<string, number> = {};

  for (const issue of r.data.issues) {
    for (const wl of issue.fields.worklog?.worklogs ?? []) {
      const startedDate = new Date(wl.started).toISOString().slice(0, 10);
      if (!allUsers && !usernames.includes(wl.author.name)) continue;
      if (startedDate < dateFrom || startedDate > dateTo) continue;
      entries.push(mapWorklogEntry(issue, wl));
      dailyHours[startedDate] = (dailyHours[startedDate] ?? 0) + wl.timeSpentSeconds / 3600;
    }
  }

  const totalHours = entries.reduce((s, e) => s + e.timeSpentSeconds / 3600, 0);
  return { entries, total: entries.length, totalHours, dailyHours };
}

/** Fetch issues with due dates for multiple users */
export async function fetchTeamDueDates(
  usernames: string[],
  dateFrom: string,
  allUsers: boolean = false,
): Promise<DueTaskInfo[]> {
  if (usernames.length === 0 && !allUsers) return [];

  let jql: string;
  if (allUsers) {
    jql = `duedate >= "${dateFrom}" AND duedate <= now() AND resolution = Unresolved ORDER BY duedate ASC`;
  } else {
    const userList = usernames.map((u) => `"${u}"`).join(', ');
    jql = `assignee IN (${userList}) AND duedate >= "${dateFrom}" AND duedate <= now() AND resolution = Unresolved ORDER BY duedate ASC`;
  }

  const r = await api.get<{
    issues: Array<{
      key: string;
      fields: {
        summary: string;
        duedate: string;
        status: { name: string };
        priority: { name: string } | null;
        assignee: { name: string } | null;
      };
    }>;
  }>('/search', {
    params: { jql, maxResults: 500, fields: 'summary,duedate,status,priority,assignee' },
  });

  return (r.data.issues ?? []).map((i) => ({
    issueKey: i.key,
    summary: i.fields.summary,
    duedate: i.fields.duedate,
    status: i.fields.status.name,
    priority: i.fields.priority?.name ?? 'Medium',
    assignee: i.fields.assignee?.name ?? '',
  }));
}

/** Fetch all sub-tasks for filter values (projects, statuses, types) — lightweight */
export async function fetchTeamFilterMeta(
  usernames: string[],
  allUsers: boolean = false,
): Promise<{ projects: string[]; statuses: string[]; types: string[] }> {
  if (usernames.length === 0 && !allUsers) return { projects: [], statuses: [], types: [] };

  let jql: string;
  if (allUsers) {
    jql = 'issuetype = "Sub-task" AND resolution = Unresolved ORDER BY created DESC';
  } else {
    const userList = usernames.map((u) => `"${u}"`).join(', ');
    jql = `assignee IN (${userList}) AND issuetype = "Sub-task" AND resolution = Unresolved ORDER BY created DESC`;
  }

  const r = await api.get<{
    issues: Array<{
      fields: { project: { key: string }; status: { name: string }; issuetype: { name: string } };
    }>;
  }>('/search', {
    params: { jql, maxResults: 2000, fields: 'project,status,issuetype' },
  });

  const projects = new Set<string>();
  const statuses = new Set<string>();
  const types = new Set<string>();

  for (const i of r.data.issues ?? []) {
    projects.add(i.fields.project.key);
    statuses.add(i.fields.status.name);
    types.add(i.fields.issuetype.name);
  }

  return {
    projects: Array.from(projects).sort(),
    statuses: Array.from(statuses).sort(),
    types: Array.from(types).sort(),
  };
}
