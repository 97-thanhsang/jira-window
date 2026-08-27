'use client';

import { useState, useMemo } from 'react';
import { CollapsibleDetailPanel } from '@/components/shared/collapsible-detail-panel';
import { ProjectStatsPanel } from '@/components/worklog/project-stats-panel';
import { SubTaskTable } from '@/components/worklog/subtask-table';
import type { WorklogEntry } from '@/types/jira';

interface GroupDetailPanelProps {
  entries: WorklogEntry[];
  editMode?: boolean;
  onEntryClick?: (entry: WorklogEntry) => void;
}

export function GroupDetailPanel({ entries, editMode, onEntryClick }: GroupDetailPanelProps) {
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  // Filter entries by selected project
  const filteredEntries = useMemo(() => {
    if (!selectedProject) return entries;
    return entries.filter(e => e.projectKey === selectedProject);
  }, [entries, selectedProject]);

  if (entries.length === 0) return null;

  return (
    <CollapsibleDetailPanel
      countLabel={`${entries.length} entr${entries.length !== 1 ? 'ies' : 'y'}`}
      stats={
        <ProjectStatsPanel
          entries={entries}
          selectedProject={selectedProject}
          onSelectProject={setSelectedProject}
        />
      }
      table={
        <SubTaskTable
          entries={filteredEntries}
          editMode={editMode}
          onEntryClick={onEntryClick}
        />
      }
    />
  );
}
