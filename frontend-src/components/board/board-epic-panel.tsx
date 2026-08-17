'use client';
import { useMemo } from 'react';
import { ChevronLeft, ChevronRight, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { JiraIssue } from '@/types/jira';

interface BoardEpicPanelProps {
  allIssues: JiraIssue[];
  selectedEpic: string | null;
  onSelectEpic: (epicKey: string | null) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export function BoardEpicPanel({
  allIssues,
  selectedEpic,
  onSelectEpic,
  isOpen,
  onToggle,
}: BoardEpicPanelProps) {
  const epics = useMemo(() => {
    const map = new Map<
      string,
      { key: string; summary: string; count: number; doneCount: number }
    >();
    for (const issue of allIssues) {
      const epicKey = issue.fields.parent?.key;
      if (!epicKey) continue;
      const existing = map.get(epicKey);
      const isDone =
        issue.fields.status.statusCategory.key === 'done';
      if (existing) {
        existing.count++;
        if (isDone) existing.doneCount++;
      } else {
        map.set(epicKey, {
          key: epicKey,
          summary:
            issue.fields.parent?.fields?.summary ||
            issue.fields.summary,
          count: 1,
          doneCount: isDone ? 1 : 0,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      a.summary.localeCompare(b.summary),
    );
  }, [allIssues]);

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="flex-shrink-0 w-6 bg-[#F4F5F7] dark:bg-gray-800 border-r border-[#DFE1E6] dark:border-gray-700 flex items-center justify-center hover:bg-[#DFE1E6] dark:hover:bg-gray-700 transition-colors"
        title="Open epic panel"
      >
        <ChevronRight size={14} className="text-[#5E6C84]" />
      </button>
    );
  }

  return (
    <div className="flex-shrink-0 w-56 bg-[#F4F5F7] dark:bg-gray-800 border-r border-[#DFE1E6] dark:border-gray-700 flex flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#DFE1E6] dark:border-gray-700">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#5E6C84] dark:text-gray-400 uppercase tracking-wider">
          <Layers size={12} />
          Epics
        </div>
        <button
          onClick={onToggle}
          className="hover:text-[#0052CC] transition-colors"
        >
          <ChevronLeft size={14} className="text-[#5E6C84]" />
        </button>
      </div>

      {/* Epic list */}
      <div className="flex-1 overflow-y-auto py-1">
        {/* All epics */}
        <button
          onClick={() => onSelectEpic(null)}
          className={cn(
            'w-full text-left px-3 py-2 text-xs transition-colors hover:bg-white dark:hover:bg-gray-700',
            !selectedEpic
              ? 'bg-white dark:bg-gray-700 font-medium text-[#0052CC]'
              : 'text-[#172B4D] dark:text-gray-200',
          )}
        >
          All Epics
        </button>

        {epics.map((epic) => {
          const progress =
            epic.count > 0
              ? Math.round((epic.doneCount / epic.count) * 100)
              : 0;
          return (
            <button
              key={epic.key}
              onClick={() => onSelectEpic(epic.key)}
              className={cn(
                'w-full text-left px-3 py-2 text-xs transition-colors hover:bg-white dark:hover:bg-gray-700',
                selectedEpic === epic.key
                  ? 'bg-white dark:bg-gray-700'
                  : 'text-[#172B4D] dark:text-gray-200',
              )}
            >
              <div className="flex items-center justify-between">
                <span className="truncate flex-1">{epic.summary}</span>
                <span className="text-[10px] text-[#5E6C84] dark:text-gray-400 ml-2 shrink-0">
                  {epic.count}
                </span>
              </div>
              {/* Progress bar */}
              <div className="mt-1 h-1 bg-[#DFE1E6] dark:bg-gray-600 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#36B37E] rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </button>
          );
        })}

        {epics.length === 0 && (
          <p className="px-3 py-4 text-xs text-[#5E6C84] dark:text-gray-500 text-center">
            No epics found
          </p>
        )}
      </div>
    </div>
  );
}
