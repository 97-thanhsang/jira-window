'use client';

import { useMemo } from 'react';
import type { JiraIssue } from '@/types/jira';
import { ProjectStatsList, type ProjectStat } from '@/components/shared/project-stats-list';

interface BoardProjectStatsProps {
  issues: JiraIssue[];
  selectedProject: string | null;
  onSelectProject: (projectKey: string | null) => void;
}

export function BoardProjectStats({ issues, selectedProject, onSelectProject }: BoardProjectStatsProps) {
  const stats = useMemo(() => {
    const map = new Map<string, ProjectStat>();
    const seenIssues = new Set<string>();

    for (const issue of issues) {
      const pk = issue.fields.project.key;
      const pn = issue.fields.project.name;
      if (!map.has(pk)) {
        map.set(pk, { projectKey: pk, projectName: pn, totalHours: 0, issueCount: 0, estHours: 0 });
      }
      const stat = map.get(pk)!;
      stat.totalHours += (issue.fields.timetracking?.timeSpentSeconds ?? 0) / 3600;
      stat.estHours += (issue.fields.timetracking?.originalEstimateSeconds ?? 0) / 3600;
      if (!seenIssues.has(issue.key)) {
        seenIssues.add(issue.key);
        stat.issueCount++;
      }
    }

    return Array.from(map.values()).sort((a, b) => b.totalHours - a.totalHours);
  }, [issues]);

  return <ProjectStatsList stats={stats} selectedProject={selectedProject} onSelectProject={onSelectProject} />;
}
