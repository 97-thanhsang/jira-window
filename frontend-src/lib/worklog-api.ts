import { api } from './api';
import type { WorklogEntry, WorklogSearchResult, WorklogCreatePayload } from '@/types/jira';

export async function fetchWorklogs(
  username: string,
  dateFrom: string,
  dateTo: string,
): Promise<WorklogSearchResult> {
  const jql = `worklogDate >= "${dateFrom}" AND worklogDate <= "${dateTo}" AND worklogAuthor = "${username}" ORDER BY created DESC`;
  const r = await api.get<{
    total: number;
    issues: Array<{
      id: string;
      key: string;
      fields: {
        summary: string;
        issuetype: { name: string; iconUrl: string };
        project: { key: string; name: string };
        worklog: {
          worklogs: Array<{
            id: string;
            author: { name: string; displayName: string; avatarUrls?: { '24x24': string } };
            timeSpent: string;
            timeSpentSeconds: number;
            started: string;
            comment: string;
            created: string;
            updated: string;
          }>;
        };
        timetracking?: { originalEstimateSeconds: number; remainingEstimateSeconds: number };
      };
    }>;
  }>('/search', {
    params: { jql, maxResults: 500, fields: 'summary,issuetype,project,worklog,timetracking' },
  });

  const entries: WorklogEntry[] = [];
  const dailyHours: Record<string, number> = {};

  for (const issue of r.data.issues) {
    const wls = issue.fields.worklog?.worklogs ?? [];
    for (const wl of wls) {
      const startedDate = new Date(wl.started).toISOString().slice(0, 10);
      if (wl.author.name !== username) continue;
      if (startedDate < dateFrom || startedDate > dateTo) continue;

      entries.push({
        id: wl.id,
        issueId: issue.id,
        issueKey: issue.key,
        issueSummary: issue.fields.summary,
        issueTypeName: issue.fields.issuetype?.name ?? 'Task',
        issueTypeIconUrl: issue.fields.issuetype?.iconUrl ?? '',
        projectKey: issue.fields.project.key,
        projectName: issue.fields.project.name,
        author: wl.author,
        timeSpent: wl.timeSpent,
        timeSpentSeconds: wl.timeSpentSeconds,
        started: wl.started,
        comment: wl.comment ?? '',
        created: wl.created,
        updated: wl.updated,
        estSeconds: issue.fields.timetracking?.originalEstimateSeconds ?? 0,
      });
      dailyHours[startedDate] = (dailyHours[startedDate] ?? 0) + wl.timeSpentSeconds / 3600;
    }
  }

  const totalHours = entries.reduce((s, e) => s + e.timeSpentSeconds / 3600, 0);
  return { entries, total: entries.length, totalHours, dailyHours };
}

export async function addWorklog(payload: WorklogCreatePayload) {
  return api.post(`/issue/${payload.issueKey}/worklog`, {
    timeSpentSeconds: payload.timeSpentSeconds,
    comment: payload.comment,
    started: payload.started,
  });
}

export async function updateWorklog(
  issueKey: string, worklogId: string,
  payload: { timeSpentSeconds: number; comment: string; started: string },
) {
  return api.put(`/issue/${issueKey}/worklog/${worklogId}`, payload);
}

export async function deleteWorklog(issueKey: string, worklogId: string) {
  return api.delete(`/issue/${issueKey}/worklog/${worklogId}`);
}

/** Fetch all worklogs for today (authored by the given user). */
export async function fetchTodayWorklogs(username: string): Promise<WorklogEntry[]> {
  const todayStr = new Date().toISOString().slice(0, 10);
  const result = await fetchWorklogs(username, todayStr, todayStr);
  return result.entries;
}

/** Fetch total logged seconds (lifetime) for a single issue via its worklog endpoint. */
export async function fetchIssueWorklogTotal(issueKey: string): Promise<number> {
  const r = await api.get<{ worklogs: Array<{ timeSpentSeconds: number }> }>(
    `/issue/${issueKey}/worklog`,
  );
  return r.data.worklogs.reduce((s, w) => s + w.timeSpentSeconds, 0);
}
