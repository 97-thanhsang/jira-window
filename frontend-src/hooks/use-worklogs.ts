'use client';
import useSWR from 'swr';
import { useMemo } from 'react';
import { fetchWorklogs } from '@/lib/worklog-api';
import { fetchTeamWorklogs } from '@/lib/team-api';
import type { WorklogEntry } from '@/types/jira';

interface UseWorklogsFilters {
  usernames?: string[];
  dateFrom: string;
  dateTo: string;
  project?: string;
}

export function useWorklogs(filters: UseWorklogsFilters | null) {
  const key = filters
    ? ['worklogs', filters.dateFrom, filters.dateTo, filters.project, ...(filters.usernames ?? [])]
    : null;

  const { data, error, isLoading, mutate } = useSWR(
    key,
    async () => {
      if (!filters) return null;
      const { usernames, dateFrom, dateTo, project } = filters;
      
      let result;
      if (usernames && usernames.length > 1) {
        result = await fetchTeamWorklogs(usernames, dateFrom, dateTo, false);
      } else {
        const username = usernames?.[0] || '';
        result = await fetchWorklogs(username, dateFrom, dateTo);
      }

      if (project) {
        result.entries = result.entries.filter(e => e.projectKey === project);
        result.total = result.entries.length;
        result.totalHours = result.entries.reduce((s, e) => s + e.timeSpentSeconds / 3600, 0);
        result.dailyHours = {};
        for (const e of result.entries) {
          const d = new Date(e.started).toISOString().slice(0, 10);
          result.dailyHours[d] = (result.dailyHours[d] ?? 0) + e.timeSpentSeconds / 3600;
        }
      }
      return result;
    },
    { revalidateOnFocus: false, dedupingInterval: 30_000 },
  );

  const entriesByDate = useMemo(() => {
    if (!data?.entries) return {} as Record<string, WorklogEntry[]>;
    const map: Record<string, WorklogEntry[]> = {};
    for (const e of data.entries) {
      const d = new Date(e.started).toISOString().slice(0, 10);
      (map[d] ??= []).push(e);
    }
    return map;
  }, [data]);

  return { data, entriesByDate, isLoading, error, mutate };
}
