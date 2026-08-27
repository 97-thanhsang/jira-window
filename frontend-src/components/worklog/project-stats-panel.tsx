'use client';

import { useMemo } from 'react';
import type { WorklogEntry } from '@/types/jira';
import { ProjectStatsList, type ProjectStat } from '@/components/shared/project-stats-list';

interface ProjectStatsPanelProps {
  entries: WorklogEntry[];
  selectedProject: string | null;
  onSelectProject: (projectKey: string | null) => void;
}

export function ProjectStatsPanel({ entries, selectedProject, onSelectProject }: ProjectStatsPanelProps) {
  const stats = useMemo(() => {
    const map = new Map<string, ProjectStat>();
    const seenIssues = new Set<string>();

    for (const e of entries) {
      if (!map.has(e.projectKey)) {
        map.set(e.projectKey, {
          projectKey: e.projectKey,
          projectName: e.projectName,
          totalHours: 0,
          estHours: 0,
          issueCount: 0,
        });
      }
      const stat = map.get(e.projectKey)!;
      stat.totalHours += e.timeSpentSeconds / 3600;
      stat.estHours += e.estSeconds / 3600;
      if (!seenIssues.has(e.issueKey)) {
        seenIssues.add(e.issueKey);
        stat.issueCount++;
      }
    }

    return Array.from(map.values()).sort((a, b) => b.totalHours - a.totalHours);
  }, [entries]);

  return <ProjectStatsList stats={stats} selectedProject={selectedProject} onSelectProject={onSelectProject} />;
}
