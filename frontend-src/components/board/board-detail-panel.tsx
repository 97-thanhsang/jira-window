'use client';

import { useState, useMemo } from 'react';
import { CollapsibleDetailPanel } from '@/components/shared/collapsible-detail-panel';
import { BoardProjectStats } from '@/components/board/board-project-stats';
import { BoardIssueTable } from '@/components/board/board-issue-table';
import type { JiraIssue } from '@/types/jira';

interface BoardDetailPanelProps {
  issues: JiraIssue[];
  editMode?: boolean;
  onIssueClick?: (key: string) => void;
}

export function BoardDetailPanel({ issues, editMode, onIssueClick }: BoardDetailPanelProps) {
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  // Filter issues by selected project
  const filteredIssues = useMemo(() => {
    if (!selectedProject) return issues;
    return issues.filter(issue => issue.fields.project.key === selectedProject);
  }, [issues, selectedProject]);

  if (issues.length === 0) return null;

  return (
    <CollapsibleDetailPanel
      countLabel={`${issues.length} issue${issues.length !== 1 ? 's' : ''}`}
      stats={
        <BoardProjectStats
          issues={issues}
          selectedProject={selectedProject}
          onSelectProject={setSelectedProject}
        />
      }
      table={
        <BoardIssueTable
          issues={filteredIssues}
          editMode={editMode}
          onIssueClick={onIssueClick}
        />
      }
    />
  );
}
