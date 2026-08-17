'use client';
import useSWR from 'swr';
import { useMemo } from 'react';
import { fetchTeamWorklogs, fetchTeamDueDates } from '@/lib/team-api';
import type { TeamReportData, UserReport, TaskReport, DueTaskInfo, WorklogEntry } from '@/types/jira';

interface UseTeamDashboardParams {
  usernames: string[];
  dateFrom: string;
  dateTo: string;
  project?: string;
  allUsers?: boolean;
}

/** Format seconds to human-readable string: "8h", "2d", "4h 30m" */
function formatDuration(seconds: number): string {
  if (seconds === 0) return '-';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h >= 8 && h % 8 === 0 && m === 0) return `${h / 8}d`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Build a task-centric report grouped by user */
function buildReport(
  entries: WorklogEntry[],
  usernames: string[],
): UserReport[] {
  // Phase 1: collect the best issue metadata per issueKey
  const issueMeta = new Map<string, { summary: string; typeName: string; typeIcon: string; projKey: string; estSeconds: number; status: string; priority: string; duedate?: string; parentKey?: string; parentSummary?: string; parentTypeName?: string; parentTypeIcon?: string; parentStatus?: string; parentStatusCategory?: string }>();

  // Phase 2: group by user → issueKey → daily seconds
  const userMap = new Map<string, Map<string, Map<string, number>>>();

  for (const e of entries) {
    const uname = e.author.name;
    if (!userMap.has(uname)) userMap.set(uname, new Map());
    const issueMap = userMap.get(uname)!;

    if (!issueMap.has(e.issueKey)) {
      issueMap.set(e.issueKey, new Map());
      // Store metadata once per issueKey
      if (!issueMeta.has(e.issueKey)) {
        issueMeta.set(e.issueKey, {
          summary: e.issueSummary,
          typeName: e.issueTypeName,
          typeIcon: e.issueTypeIconUrl,
          projKey: e.projectKey,
          estSeconds: e.estSeconds,
          status: e.status ?? '',
          priority: e.priority ?? 'Medium',
          duedate: e.duedate,
          parentKey: e.parentKey,
          parentSummary: e.parentSummary,
          parentTypeName: e.parentIssueTypeName,
          parentTypeIcon: e.parentIssueTypeIconUrl,
          parentStatus: e.parentStatus,
          parentStatusCategory: e.parentStatusCategory,
        });
      }
    }

    const dailyMap = issueMap.get(e.issueKey)!;
    const d = new Date(e.started).toISOString().slice(0, 10);
    dailyMap.set(d, (dailyMap.get(d) ?? 0) + e.timeSpentSeconds);
  }

  // Phase 3: build UserReport[]
  const reports: UserReport[] = [];

  for (const [username, issueMap] of userMap) {
    const tasks: TaskReport[] = [];
    let totalEst = 0;
    let totalLogged = 0;

    for (const [issueKey, dailyMap] of issueMap) {
      const meta = issueMeta.get(issueKey)!;
      let taskLogged = 0;
      const dailySeconds: Record<string, number> = {};

      for (const [d, sec] of dailyMap) {
        dailySeconds[d] = sec;
        taskLogged += sec;
      }

      tasks.push({
        issueKey,
        issueId: '', // not needed for display
        summary: meta.summary,
        issueTypeName: meta.typeName,
        issueTypeIconUrl: meta.typeIcon,
        projectKey: meta.projKey,
        estSeconds: meta.estSeconds,
        estDisplay: formatDuration(meta.estSeconds),
        totalLoggedSeconds: taskLogged,
        totalLoggedDisplay: formatDuration(taskLogged),
        dailySeconds,
        status: meta.status,
        priority: meta.priority,
        duedate: meta.duedate,
        parentKey: meta.parentKey,
        parentSummary: meta.parentSummary,
        parentIssueTypeName: meta.parentTypeName,
        parentIssueTypeIconUrl: meta.parentTypeIcon,
        parentStatus: meta.parentStatus,
        parentStatusCategory: meta.parentStatusCategory,
      });

      totalEst += meta.estSeconds;
      totalLogged += taskLogged;
    }

    // Sort tasks by most logged first
    tasks.sort((a, b) => {
        if (a.projectKey !== b.projectKey) return a.projectKey.localeCompare(b.projectKey);
        return b.totalLoggedSeconds - a.totalLoggedSeconds;
      });

    const authorInfo = entries.find((e) => e.author.name === username)?.author;

    reports.push({
      username,
      displayName: authorInfo?.displayName ?? username,
      avatarUrl: authorInfo?.avatarUrls?.['24x24'] ?? '',
      tasks,
      totalEstSeconds: totalEst,
      totalEstDisplay: formatDuration(totalEst),
      totalLoggedSeconds: totalLogged,
      totalLoggedDisplay: formatDuration(totalLogged),
    });
  }

  // Include users with no worklogs but in the selected list
  for (const uname of usernames) {
    if (!userMap.has(uname)) {
      reports.push({
        username: uname,
        displayName: uname,
        avatarUrl: '',
        tasks: [],
        totalEstSeconds: 0,
        totalEstDisplay: '-',
        totalLoggedSeconds: 0,
        totalLoggedDisplay: '-',
      });
    }
  }

  // Sort by most logged
  return reports.sort((a, b) => b.totalLoggedSeconds - a.totalLoggedSeconds);
}

export function useTeamDashboard(params: UseTeamDashboardParams | null) {
  const usernames = params?.usernames;
  const dateFrom = params?.dateFrom;
  const dateTo = params?.dateTo;
  const project = params?.project;
  const allUsers = params?.allUsers ?? false;

  const worklogKey = (allUsers || usernames?.length) ? ['team-worklogs', allUsers ? 'all' : usernames, dateFrom, dateTo] : null;
  const dueDateKey = (allUsers || usernames?.length) ? ['team-duedates', allUsers ? 'all' : usernames, dateFrom] : null;

  const { data: worklogData, error: wlError, isLoading: wlLoading, mutate: worklogMutate } = useSWR(
    worklogKey,
    () => fetchTeamWorklogs(usernames ?? [], dateFrom!, dateTo!, allUsers),
    { revalidateOnFocus: false, dedupingInterval: 30_000 },
  );

  const { data: dueTasks, isLoading: dueLoading } = useSWR(
    dueDateKey,
    () => fetchTeamDueDates(usernames ?? [], dateFrom!, allUsers),
    { revalidateOnFocus: false, dedupingInterval: 30_000 },
  );

  const data = useMemo((): TeamReportData | undefined => {
    if (!worklogData || !usernames || !dateFrom || !dateTo) return undefined;

    let entries = worklogData.entries;

    // Client-side project filter
    if (project) {
      entries = entries.filter((e) => e.projectKey === project);
    }

    const users = buildReport(entries, usernames);

    return {
      users,
      dateRange: { from: dateFrom, to: dateTo },
      totalEstSeconds: users.reduce((s, u) => s + u.totalEstSeconds, 0),
      totalLoggedSeconds: users.reduce((s, u) => s + u.totalLoggedSeconds, 0),
      userCount: users.length,
      taskCount: users.reduce((s, u) => s + u.tasks.length, 0),
    };
  }, [worklogData, dueTasks, project, dateFrom, dateTo, usernames]);

  return {
    data,
    dueTasks: dueTasks ?? [],
    isLoading: wlLoading || dueLoading,
    error: wlError,
    mutate: worklogMutate,
  };
}
