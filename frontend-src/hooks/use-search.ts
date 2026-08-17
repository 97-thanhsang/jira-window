import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { api } from '@/lib/api';
import type { JiraSearchResult } from '@/types/jira';

export function useSearch(query: string) {
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const shouldFetch = debouncedQuery.trim().length >= 2;

  const { data, isLoading } = useSWR(
    shouldFetch ? ['search-palette', debouncedQuery] : null,
    () =>
      api
        .get<JiraSearchResult>('/search', {
          params: {
            jql: `text ~ "${debouncedQuery.trim()}" ORDER BY updated DESC`,
            maxResults: 10,
            fields: 'summary,status,priority,project',
          },
        })
        .then((r) => r.data),
    { revalidateOnFocus: false, dedupingInterval: 0 }
  );

  return {
    results: data?.issues ?? [],
    isLoading: shouldFetch && isLoading,
  };
}
