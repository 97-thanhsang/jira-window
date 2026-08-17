'use client';
import useSWR from 'swr';
import { api } from '@/lib/api';

// ─── useSprints — fetch active + future sprints from all agile boards ─────────

export function useSprints() {
  const { data: boards } = useSWR<{ values: { id: number }[] }>(
    '/agile/board?maxResults=50',
    (url: string) => api.get<{ values: { id: number }[] }>(url).then(r => r.data),
  );

  const { data: sprints } = useSWR<{ values: { id: number; name: string }[] }>(
    boards ? 'sprints' : null,
    async () => {
      if (!boards?.values?.length) return { values: [] };
      const results = await Promise.all(
        boards.values.map(b =>
          api.get<{ values: { id: number; name: string }[] }>(
            `/agile/board/${b.id}/sprint?state=active,future`,
          ).then(r => r.data.values).catch(() => [] as { id: number; name: string }[]),
        ),
      );
      const seen = new Set<string>();
      const unique: { id: number; name: string }[] = [];
      results.flat().forEach(s => {
        if (!seen.has(s.name)) { seen.add(s.name); unique.push(s); }
      });
      unique.sort((a, b) => a.name.localeCompare(b.name));
      return { values: unique };
    },
  );

  return sprints?.values ?? [];
}

// ─── useStatuses — fetch all status definitions with category grouping ────────

interface JiraStatusRaw {
  id: string;
  name: string;
  statusCategory: { key: string; name: string; colorName: string };
}

export const CATEGORY_ORDER: Record<string, number> = { new: 0, indeterminate: 1, done: 2 };
export const CATEGORY_LABEL: Record<string, string> = { new: 'To Do', indeterminate: 'In Progress', done: 'Done' };

export function useStatuses() {
  const { data, isLoading } = useSWR<JiraStatusRaw[]>(
    '/status',
    (url: string) =>
      api.get<JiraStatusRaw[]>(url)
        .then(r => Array.isArray(r.data) ? r.data : [])
        .catch(() => []),
  );
  return { statuses: data ?? [], loading: isLoading && !data };
}
