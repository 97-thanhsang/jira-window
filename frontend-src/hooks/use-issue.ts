import useSWR from 'swr';
import { api } from '@/lib/api';
import type { JiraIssue } from '@/types/jira';

export function useIssue(key: string) {
  const { data, error, isLoading, mutate } = useSWR(
    key ? `/issue/${key}` : null,
    (url: string) =>
      api
        .get<JiraIssue>(url, {
          params: {
            fields:
              'summary,description,status,priority,issuetype,project,assignee,reporter,created,updated,subtasks,parent,labels,comment,attachment,timetracking,fixVersions,components,duedate',
          },
        })
        .then((r) => r.data),
    { revalidateOnFocus: false }
  );

  return { issue: data, isLoading, error, mutate };
}
