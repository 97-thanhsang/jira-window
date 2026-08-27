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

export interface TeamRawIssue extends RawIssue {
  fields: RawIssue['fields'] & {
    status: { name: string; statusCategory: { key: string } };
    priority: { name: string } | null;
    duedate: string | null;
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
  return {
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
}

export function mapTeamWorklogEntry(issue: TeamRawIssue, wl: RawWorklog): WorklogEntry {
  return {
    ...mapWorklogEntry(issue, wl),
    status: issue.fields.status?.name ?? '',
    priority: issue.fields.priority?.name ?? 'Medium',
    duedate: issue.fields.duedate ?? undefined,
    parentKey: issue.fields.parent?.key,
    parentSummary: issue.fields.parent?.fields?.summary,
    parentIssueTypeName: issue.fields.parent?.fields?.issuetype?.name,
    parentIssueTypeIconUrl: issue.fields.parent?.fields?.issuetype?.iconUrl,
    parentStatus: issue.fields.parent?.fields?.status?.name,
    parentStatusCategory: issue.fields.parent?.fields?.status?.statusCategory?.key,
  };
}
