'use client';
import useSWR from 'swr';
import { useMemo } from 'react';
import { fetchTeamPlan } from '@/lib/team-plan-api';
import { fetchTeamWorklogs } from '@/lib/team-api';
import type { TeamReportData } from '@/types/jira';

interface UseTeamPlanParams {
  usernames: string[];
  dateFrom?: string;
  dateTo?: string;
  project?: string;
  allUsers?: boolean;
}

export function useTeamPlan(params: UseTeamPlanParams | null) {
  const usernames = params?.usernames;
  const dateFrom = params?.dateFrom;
  const dateTo = params?.dateTo;
  const project = params?.project;
  const allUsers = params?.allUsers ?? false;

  const planKey =
    allUsers || (usernames && usernames.length > 0)
      ? ['team-plan', allUsers ? 'all' : usernames, dateFrom, dateTo]
      : null;

  const {
    data: planData,
    error,
    isLoading,
    mutate: planMutate,
  } = useSWR<TeamReportData>(
    planKey,
    () => fetchTeamPlan(usernames ?? [], dateFrom, dateTo, allUsers),
    { revalidateOnFocus: false, dedupingInterval: 30_000 },
  );

  // Fetch worklogs for the same users/date range to get actual logged time
  const wlKey =
    (allUsers || (usernames && usernames.length > 0)) && dateFrom && dateTo
      ? ['team-plan-worklogs', allUsers ? 'all' : usernames, dateFrom, dateTo]
      : null;

  const { data: wlData } = useSWR(
    wlKey,
    () => fetchTeamWorklogs(usernames ?? [], dateFrom!, dateTo!, allUsers),
    { revalidateOnFocus: false, dedupingInterval: 30_000 },
  );

  // Merge worklog seconds + project filter
  const filteredData = useMemo(() => {
    if (!planData) return undefined;

    // Build issueKey → loggedSeconds from worklogs
    const loggedMap = new Map<string, number>();
    if (wlData?.entries) {
      for (const e of wlData.entries) {
        loggedMap.set(e.issueKey, (loggedMap.get(e.issueKey) ?? 0) + e.timeSpentSeconds);
      }
    }

    const formatDuration = (s: number) => {
      if (s === 0) return '-';
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      if (h >= 8 && h % 8 === 0 && m === 0) return `${h / 8}d`;
      if (m === 0) return `${h}h`;
      return `${h}h ${m}m`;
    };

    const mergeTasks = (tasks: typeof planData.users[0]['tasks']) =>
      tasks.map(t => {
        const logged = loggedMap.get(t.issueKey) ?? 0;
        return { ...t, totalLoggedSeconds: logged, totalLoggedDisplay: formatDuration(logged) };
      });

    let users = planData.users.map(u => ({
      ...u,
      tasks: mergeTasks(u.tasks),
    }));

    // Project filter
    if (project) {
      users = users
        .map(u => ({ ...u, tasks: u.tasks.filter(t => t.projectKey === project) }))
        .filter(u => u.tasks.length > 0);
    }

    // Recompute totals
    const recompute = (u: typeof users[0]) => {
      const totalEstSeconds = u.tasks.reduce((s, t) => s + t.estSeconds, 0);
      const totalLoggedSeconds = u.tasks.reduce((s, t) => s + t.totalLoggedSeconds, 0);
      return {
        ...u,
        totalEstSeconds,
        totalEstDisplay: formatDuration(totalEstSeconds),
        totalLoggedSeconds,
        totalLoggedDisplay: formatDuration(totalLoggedSeconds),
      };
    };

    users = users.map(recompute);

    return {
      ...planData,
      users,
      taskCount: users.reduce((s, u) => s + u.tasks.length, 0),
      totalEstSeconds: users.reduce((s, u) => s + u.totalEstSeconds, 0),
      totalLoggedSeconds: users.reduce((s, u) => s + u.totalLoggedSeconds, 0),
      userCount: users.length,
    };
  }, [planData, wlData, project]);

  return { data: filteredData, isLoading, error, mutate: planMutate };
}
