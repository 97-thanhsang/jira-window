'use client';

import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Layers, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BoardProjectStats } from '@/components/board/board-project-stats';
import { BoardIssueTable } from '@/components/board/board-issue-table';
import type { JiraIssue } from '@/types/jira';

interface BoardDetailPanelProps {
  issues: JiraIssue[];
  editMode?: boolean;
  onIssueClick?: (key: string) => void;
}

export function BoardDetailPanel({ issues, editMode, onIssueClick }: BoardDetailPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  // Filter issues by selected project
  const filteredIssues = useMemo(() => {
    if (!selectedProject) return issues;
    return issues.filter(issue => issue.fields.project.key === selectedProject);
  }, [issues, selectedProject]);

  if (issues.length === 0) return null;

  return (
    <div className="border-t border-[#DFE1E6] dark:border-gray-700">
      {/* Toggle header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center gap-2 px-4 py-2.5 text-left font-medium transition-colors',
          isOpen
            ? 'bg-[#DEEBFF] dark:bg-blue-900/20 text-[#0052CC] dark:text-blue-400'
            : 'text-[#5E6C84] dark:text-gray-400 hover:bg-[#F4F5F7] dark:hover:bg-gray-700',
        )}
      >
        <div className={cn(
          'w-6 h-6 rounded flex items-center justify-center transition-colors',
          isOpen
            ? 'bg-[#0052CC] text-white'
            : 'bg-[#F4F5F7] dark:bg-gray-700 text-[#5E6C84]',
        )}>
          <BarChart3 size={13} />
        </div>
        <span className={cn('text-[12px]', isOpen && 'font-semibold')}>Project Detail</span>
        <div className={cn(
          'ml-auto flex items-center gap-2',
          isOpen ? 'text-[#0052CC] dark:text-blue-400' : 'text-[#8993A4] dark:text-gray-500',
        )}>
          <span className="text-[10px] font-medium">{issues.length} issue{issues.length !== 1 ? 's' : ''}</span>
          {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </div>
      </button>

      {/* Detail panel */}
      {isOpen && (
        <div className="bg-[#FAFBFC] dark:bg-gray-800/60 border-t border-[#DFE1E6] dark:border-gray-700">
          <div className="grid grid-cols-[260px_1fr] gap-0">
            {/* Left: Project Stats */}
            <div className="border-r border-[#DFE1E6] dark:border-gray-700 p-3 overflow-y-auto max-h-[400px]">
              <BoardProjectStats
                issues={issues}
                selectedProject={selectedProject}
                onSelectProject={setSelectedProject}
              />
            </div>
            {/* Right: Issue Table */}
            <div className="overflow-x-auto overflow-y-auto max-h-[400px] p-2">
              <BoardIssueTable
                issues={filteredIssues}
                editMode={editMode}
                onIssueClick={onIssueClick}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
