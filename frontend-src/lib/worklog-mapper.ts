import type { WorklogEntry } from '@/types/jira';

export interface RawWorklog {
  id: string;
  author: { name: string; displayName: string; avatarUrls?: { '24x24': string } };
  timeSpent: string;
  timeSpentSeconds: number;
  started: string;
  comment: string;
  created: string;
  updated: string;
}

export interface RawIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    issuetype: { name: string; iconUrl: string };
    project: { key: string; name: string };
    worklog?: { worklogs: RawWorklog[] };
    timetracking?: { originalEstimateSeconds: number; remainingEstimateSeconds: number };
    status?: { name: string; statusCategory?: { key: string } };
    priority?: { name: string } | null;
    duedate?: string | null;
    parent?: {
      key: string;
      fields: {
        summary: string;
        issuetype: { name: string; iconUrl: string };
        status?: { name: string; statusCategory?: { key: string } };
      };
    };
  };
}

export function mapWorklogEntry(issue: RawIssue, wl: RawWorklog): WorklogEntry {
  const entry: WorklogEntry = {
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
  };

  if ('status' in issue.fields) {
    entry.status = issue.fields.status?.name ?? '';
  }
  if ('priority' in issue.fields) {
    entry.priority = issue.fields.priority?.name ?? 'Medium';
  }
  if ('duedate' in issue.fields) {
    entry.duedate = issue.fields.duedate ?? undefined;
  }
  if ('status' in issue.fields) {
    entry.parentKey = issue.fields.parent?.key;
    entry.parentSummary = issue.fields.parent?.fields.summary;
    entry.parentIssueTypeName = issue.fields.parent?.fields.issuetype?.name;
    entry.parentIssueTypeIconUrl = issue.fields.parent?.fields.issuetype?.iconUrl;
    entry.parentStatus = issue.fields.parent?.fields.status?.name;
    entry.parentStatusCategory = issue.fields.parent?.fields.status?.statusCategory?.key;
  }

  return entry;
}
