'use client';

import { useMemo } from 'react';
import type { JiraIssue } from '@/types/jira';

interface WidgetTeamOverviewProps {
  issues?: JiraIssue[];
  isLoading?: boolean;
}

export function WidgetTeamOverview({ issues, isLoading }: WidgetTeamOverviewProps) {
  const members = useMemo(() => {
    if (!issues || issues.length === 0) return [];
    const map = new Map<string, {
      name: string;
      displayName: string;
      assigned: number;
      done: number;
      inProgress: number;
      todo: number;
      logHours: number;
    }>();

    for (const issue of issues) {
      const assignee = issue.fields.assignee;
      const name = assignee?.name ?? 'unassigned';
      const display = assignee?.displayName ?? 'Unassigned';
      if (!map.has(name)) {
        map.set(name, { name, displayName: display, assigned: 0, done: 0, inProgress: 0, todo: 0, logHours: 0 });
      }
      const m = map.get(name)!;
      m.assigned++;
      m.logHours += (issue.fields.timetracking?.timeSpentSeconds ?? 0) / 3600;
      const cat = issue.fields.status.statusCategory.key;
      if (cat === 'done') m.done++;
      else if (cat === 'indeterminate') m.inProgress++;
      else m.todo++;
    }

    return Array.from(map.values()).sort((a, b) => b.assigned - a.assigned);
  }, [issues]);

  if (isLoading) {
    return (
      <div className="space-y-1.5 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="h-4 bg-[#F4F5F7] dark:bg-gray-700 rounded w-20" />
            <div className="h-4 bg-[#F4F5F7] dark:bg-gray-700 rounded flex-1" />
          </div>
        ))}
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 text-[11px] text-[#8993A4] dark:text-gray-500">
        No team data available
      </div>
    );
  }

  const maxAssigned = Math.max(...members.map(m => m.assigned), 1);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[auto_1fr_auto_auto] gap-1 text-[9px] font-semibold text-[#8993A4] dark:text-gray-500 uppercase tracking-wide px-1">
        <span className="col-span-2">Member</span>
        <span className="text-right">Tasks</span>
        <span className="text-right">Hours</span>
      </div>
      {members.slice(0, 8).map(m => (
        <div key={m.name} className="grid grid-cols-[auto_1fr_auto_auto] gap-1 items-center px-1 py-0.5 rounded hover:bg-[#F4F5F7] dark:hover:bg-gray-800 transition-colors">
          <span className="text-[10px] font-medium text-[#172B4D] dark:text-gray-200 truncate col-span-2">{m.displayName}</span>
          <span className="text-[10px] text-[#5E6C84] dark:text-gray-400 text-right font-medium">{m.assigned}</span>
          <span className="text-[10px] font-bold text-[#172B4D] dark:text-gray-200 text-right">{m.logHours.toFixed(1)}h</span>
          {/* Progress bar */}
          <div className="col-span-4 h-1 bg-[#DFE1E6] dark:bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full flex">
              <div style={{ width: `${(m.done / maxAssigned) * 100}%`, backgroundColor: '#00875A' }} />
              <div style={{ width: `${(m.inProgress / maxAssigned) * 100}%`, backgroundColor: '#0052CC' }} />
              <div style={{ width: `${(m.todo / maxAssigned) * 100}%`, backgroundColor: '#5E6C84' }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
