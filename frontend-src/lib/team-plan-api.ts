import { api } from './api';
import type { TaskReport, UserReport, TeamReportData } from '@/types/jira';

interface SubTaskIssue {
  key: string;
  fields: {
    summary: string;
    issuetype: { name: string; iconUrl: string };
    project: { key: string; name: string };
    timetracking?: { originalEstimateSeconds: number };
    status: { name: string };
    priority: { name: string } | null;
    duedate: string | null;
    assignee: {
      name: string;
      displayName: string;
      avatarUrls?: { '16x16': string; '24x24': string; '32x32': string; '48x48': string };
    } | null;
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

// Shape returned by the batch parent-issue fetch
interface ParentIssueData {
  status: string;
  statusCategory: string;   // 'new' | 'indeterminate' | 'done'
  duedate: string | null;
  est: number;
}

function formatDuration(seconds: number): string {
  if (seconds === 0) return '-';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h >= 8 && h % 8 === 0 && m === 0) return `${h / 8}d`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export async function fetchTeamPlan(
  usernames: string[],
  dateFrom?: string,
  dateTo?: string,
  allUsers: boolean = false,
): Promise<TeamReportData> {
  if (usernames.length === 0 && !allUsers) {
    return { users: [], dateRange: { from: '', to: '' }, totalEstSeconds: 0, totalLoggedSeconds: 0, userCount: 0, taskCount: 0 };
  }

  const baseJql = allUsers
    ? 'issuetype = "Sub-task" AND resolution = Unresolved AND duedate is not EMPTY'
    : `assignee IN (${usernames.map(u => `"${u}"`).join(', ')}) AND issuetype = "Sub-task" AND resolution = Unresolved AND duedate is not EMPTY`;

  const jql = (dateFrom && dateTo)
    ? `${baseJql} AND duedate >= "${dateFrom}" AND duedate <= "${dateTo}" ORDER BY duedate ASC`
    : `${baseJql} ORDER BY duedate ASC`;

  const r = await api.get<{ issues: SubTaskIssue[] }>('/search', {
    params: {
      jql,
      maxResults: 2000,
      fields: 'summary,issuetype,project,timetracking,status,priority,duedate,assignee,parent',
    },
  });

  const issues = r.data.issues ?? [];

  // ── Batch-fetch parent issues to get duedate + timetracking + status ────
  const parentKeySet = new Set<string>();
  for (const issue of issues) {
    if (issue.fields.parent?.key) parentKeySet.add(issue.fields.parent.key);
  }

  const parentDataMap = new Map<string, ParentIssueData>();

  if (parentKeySet.size > 0) {
    const parentKeys = Array.from(parentKeySet);
    const parentJql = `key IN (${parentKeys.map(k => `"${k}"`).join(', ')})`;
    const pr = await api.get<{
      issues: Array<{
        key: string;
        fields: {
          status: { name: string; statusCategory: { key: string } };
          duedate: string | null;
          timetracking?: { originalEstimateSeconds?: number };
        };
      }>;
    }>('/search', {
      params: {
        jql: parentJql,
        maxResults: parentKeys.length + 20,
        fields: 'status,duedate,timetracking',
      },
    });
    for (const pi of pr.data.issues ?? []) {
      parentDataMap.set(pi.key, {
        status: pi.fields.status.name,
        statusCategory: pi.fields.status.statusCategory?.key ?? 'new',
        duedate: pi.fields.duedate,
        est: pi.fields.timetracking?.originalEstimateSeconds ?? 0,
      });
    }
  }

  // ── Build UserReport[] — group by assignee ───────────────────────────────
  const userMap = new Map<string, UserReport>();

  for (const issue of issues) {
    const uname = issue.fields.assignee?.name;
    if (!uname) continue;

    if (!userMap.has(uname)) {
      userMap.set(uname, {
        username: uname,
        displayName: issue.fields.assignee?.displayName ?? uname,
        avatarUrl: issue.fields.assignee?.avatarUrls?.['24x24'] ?? '',
        tasks: [],
        totalEstSeconds: 0,
        totalEstDisplay: '',
        totalLoggedSeconds: 0,
        totalLoggedDisplay: '',
      });
    }

    const user = userMap.get(uname)!;
    const est = issue.fields.timetracking?.originalEstimateSeconds ?? 0;
    const duedate = issue.fields.duedate;

    const parentKey = issue.fields.parent?.key;
    const parentInfo = parentKey ? parentDataMap.get(parentKey) : undefined;

    // parentStatus: prefer the batch-fetched value (more complete), fall back to inline
    const parentStatus = parentInfo?.status
      ?? issue.fields.parent?.fields?.status?.name;
    const parentStatusCategory = parentInfo?.statusCategory
      ?? issue.fields.parent?.fields?.status?.statusCategory?.key;

    const task: TaskReport = {
      issueKey: issue.key,
      issueId: '',
      summary: issue.fields.summary,
      issueTypeName: issue.fields.issuetype?.name ?? 'Sub-task',
      issueTypeIconUrl: issue.fields.issuetype?.iconUrl ?? '',
      projectKey: issue.fields.project.key,
      estSeconds: est,
      estDisplay: formatDuration(est),
      totalLoggedSeconds: est,
      totalLoggedDisplay: formatDuration(est),
      dailySeconds: duedate ? { [duedate]: est } : {},
      status: issue.fields.status?.name ?? '',
      priority: issue.fields.priority?.name ?? 'Medium',
      duedate: duedate ?? undefined,
      parentKey,
      parentSummary: issue.fields.parent?.fields?.summary,
      parentIssueTypeName: issue.fields.parent?.fields?.issuetype?.name,
      parentIssueTypeIconUrl: issue.fields.parent?.fields?.issuetype?.iconUrl,
      parentStatus,
      parentStatusCategory,
      parentDuedate: parentInfo?.duedate ?? undefined,
      parentEstSeconds: parentInfo?.est,
      parentEstDisplay: parentInfo?.est ? formatDuration(parentInfo.est) : undefined,
    };

    user.tasks.push(task);
    user.totalEstSeconds += est;
  }

  const users = Array.from(userMap.values())
    .map((u) => ({
      ...u,
      totalEstDisplay: formatDuration(u.totalEstSeconds),
      totalLoggedDisplay: formatDuration(u.totalEstSeconds),
      tasks: u.tasks.sort((a, b) => {
        if (a.projectKey !== b.projectKey) return a.projectKey.localeCompare(b.projectKey);
        return b.totalLoggedSeconds - a.totalLoggedSeconds;
      }),
    }))
    .sort((a, b) => b.totalEstSeconds - a.totalEstSeconds);

  const totalEst = users.reduce((s, u) => s + u.totalEstSeconds, 0);

  return {
    users,
    dateRange: { from: '', to: '' },
    totalEstSeconds: totalEst,
    totalLoggedSeconds: totalEst,
    userCount: users.length,
    taskCount: users.reduce((s, u) => s + u.tasks.length, 0),
  };
}
