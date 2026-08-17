'use client';
import useSWR from 'swr';
import { api } from '@/lib/api';
import type { JiraSearchResult, JiraIssue } from '@/types/jira';

interface EpicOption {
  key: string;
  summary: string;
}

export function useEpics(): EpicOption[] {
  const { data } = useSWR<EpicOption[]>(
    'epic-list',
    async () => {
      const r = await api.get<JiraSearchResult>('/search', {
        params: {
          jql: 'issuetype = Epic AND resolution = Unresolved ORDER BY updated DESC',
          maxResults: 200,
          fields: 'summary',
        },
      });
      return (r.data.issues ?? []).map((issue: JiraIssue) => ({
        key: issue.key,
        summary: issue.fields.summary ?? '',
      }));
    },
    { revalidateOnFocus: false, dedupingInterval: 120_000 },
  );
  return data ?? [];
}
