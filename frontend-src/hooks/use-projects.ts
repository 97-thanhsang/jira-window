import useSWR from 'swr';
import { api } from '@/lib/api';
import type { JiraProject } from '@/types/jira';

export function useProjects() {
  const { data, error, isLoading, mutate } = useSWR<JiraProject[]>(
    '/project',
    (url: string) => api.get<JiraProject[]>(url).then((r) => r.data),
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

  return {
    projects: data ?? [],
    isLoading,
    error,
    mutate,
  };
}
