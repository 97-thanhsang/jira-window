'use client';

import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts';
import type { JiraIssue } from '@/types/jira';

interface WidgetSprintProgressProps {
  issues?: JiraIssue[];
  isLoading?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  new: '#5E6C84',
  indeterminate: '#0052CC',
  done: '#00875A',
};

export function WidgetSprintProgress({ issues, isLoading }: WidgetSprintProgressProps) {
  const sprintData = useMemo(() => {
    if (!issues || issues.length === 0) return null;
    let todo = 0; let inProgress = 0; let done = 0;
    for (const issue of issues) {
      const cat = issue.fields.status.statusCategory.key;
      if (cat === 'new') todo++;
      else if (cat === 'indeterminate') inProgress++;
      else if (cat === 'done') done++;
    }
    return { todo, inProgress, done, total: todo + inProgress + done };
  }, [issues]);

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="flex justify-center">
          <div className="h-28 w-28 bg-[#F4F5F7] dark:bg-gray-700 rounded-full" />
        </div>
        <div className="space-y-1">
          <div className="h-3 bg-[#F4F5F7] dark:bg-gray-700 rounded w-full" />
          <div className="h-3 bg-[#F4F5F7] dark:bg-gray-700 rounded w-3/4" />
          <div className="h-3 bg-[#F4F5F7] dark:bg-gray-700 rounded w-1/2" />
        </div>
      </div>
    );
  }

  if (!sprintData || sprintData.total === 0) {
    return (
      <div className="flex items-center justify-center h-24 text-[11px] text-[#8993A4] dark:text-gray-500">
        No active sprint
      </div>
    );
  }

  const { todo, inProgress, done, total } = sprintData;
  const pct = Math.round((done / total) * 100);

  const pieData = [
    { name: 'Done', value: done, color: '#00875A' },
    { name: 'In Progress', value: inProgress, color: '#0052CC' },
    { name: 'To Do', value: todo, color: '#5E6C84' },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-2">
      {/* Donut chart */}
      <div className="relative h-32">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={30}
              outerRadius={45}
              paddingAngle={2}
              dataKey="value"
              strokeWidth={0}
            >
              {pieData.map((entry, idx) => (
                <Cell key={idx} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {/* Center text */}
        <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
          <span className="text-[16px] font-bold text-[#172B4D] dark:text-gray-100">{done}/{total}</span>
          <span className="text-[9px] text-[#5E6C84] dark:text-gray-400 font-medium">{pct}% done</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-4">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#00875A' }} />
          <span className="text-[9px] text-[#5E6C84] dark:text-gray-400">Done <span className="font-semibold text-[#172B4D] dark:text-gray-200">{done}</span></span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#0052CC' }} />
          <span className="text-[9px] text-[#5E6C84] dark:text-gray-400">In Progress <span className="font-semibold text-[#172B4D] dark:text-gray-200">{inProgress}</span></span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#5E6C84' }} />
          <span className="text-[9px] text-[#5E6C84] dark:text-gray-400">To Do <span className="font-semibold text-[#172B4D] dark:text-gray-200">{todo}</span></span>
        </div>
      </div>
    </div>
  );
}
