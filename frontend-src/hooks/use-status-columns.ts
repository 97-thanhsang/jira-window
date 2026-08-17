'use client';
import useSWR from 'swr';
import { api } from '@/lib/api';
import type { JiraStatus } from '@/types/jira';

export interface StatusColumnEntry {
  name: string;
  wipMin?: number;
  wipMax?: number;
  color: string;
}

interface UseStatusColumnsResult {
  statusColumnMap: Record<string, StatusColumnEntry> | null;
  isLoading: boolean;
  error: unknown;
}

const COLUMN_MAP: Record<string, StatusColumnEntry> = {
  new:           { name: 'To Do',       color: '#5E6C84' },
  indeterminate: { name: 'In Progress', color: '#0052CC' },
  done:          { name: 'Done',        color: '#36B37E' },
};

/**
 * Map each Jira status to one of 3 standard kanban columns
 * based on its statusCategory.key.
 */
export function useStatusColumns(): UseStatusColumnsResult {
  const { data: statuses, error, isLoading } = useSWR(
    '/status',
    (url: string) => api.get<JiraStatus[]>(url).then(r => r.data),
    { revalidateOnFocus: false, dedupingInterval: 300_000 },
  );

  if (!statuses || statuses.length === 0) {
    return { statusColumnMap: null, isLoading, error };
  }

  const map: Record<string, StatusColumnEntry> = {};
  for (const s of statuses) {
    if (map[s.id]) continue;
    const cat = s.statusCategory?.key ?? 'new';
    map[s.id] = COLUMN_MAP[cat] ?? COLUMN_MAP.new;
  }

  return { statusColumnMap: map, isLoading, error };
}
