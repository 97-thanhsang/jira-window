import useSWR from 'swr';
import { api } from '@/lib/api';
import type { JiraSearchResult } from '@/types/jira';

export function useJqlSearch(jql: string) {
  const { data, error, isLoading } = useSWR<JiraSearchResult>(
    jql.trim() ? ['jql-search', jql] : null,
    ([, query]: [string, string]) =>
      api
        .get<JiraSearchResult>('/search', {
          params: {
            jql: query,
            maxResults: 50,
            fields: 'summary,status,priority,issuetype,assignee,project,updated',
          },
        })
        .then((r) => r.data),
    { revalidateOnFocus: false, dedupingInterval: 5_000 }
  );

  return {
    issues: data?.issues ?? [],
    total: data?.total ?? 0,
    isLoading,
    error,
  };
}
