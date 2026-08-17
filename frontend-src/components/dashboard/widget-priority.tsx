'use client';

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts';
import type { JiraIssue } from '@/types/jira';

interface WidgetPriorityProps {
  issues?: JiraIssue[];
  isLoading?: boolean;
}

const PRIORITY_COLORS: Record<string, string> = {
  Highest: '#DE350B',
  High: '#FF5630',
  Medium: '#FFAB00',
  Low: '#2684FF',
  Lowest: '#2684FF',
  Blocker: '#DE350B',
};

const PRIORITY_ORDER = ['Blocker', 'Highest', 'High', 'Medium', 'Low', 'Lowest'];

export function WidgetPriority({ issues, isLoading }: WidgetPriorityProps) {
  const data = useMemo(() => {
    if (!issues || issues.length === 0) return [];
    const map = new Map<string, number>();
    for (const issue of issues) {
      const pri = issue.fields.priority?.name ?? 'None';
      map.set(pri, (map.get(pri) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value, color: PRIORITY_COLORS[name] ?? '#6B778C' }))
      .sort((a, b) => PRIORITY_ORDER.indexOf(a.name) - PRIORITY_ORDER.indexOf(b.name));
  }, [issues]);

  if (isLoading) {
    return (
      <div className="space-y-2 animate-pulse">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="h-3 bg-[#F4F5F7] dark:bg-gray-700 rounded w-16" />
            <div className="h-3 bg-[#F4F5F7] dark:bg-gray-700 rounded flex-1" />
            <div className="h-3 bg-[#F4F5F7] dark:bg-gray-700 rounded w-4" />
          </div>
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return <div className="h-24 flex items-center justify-center text-[11px] text-[#8993A4]">No data</div>;
  }

  const maxVal = Math.max(...data.map(d => d.value), 1);

  return (
    <div className="space-y-0.5">
      {/* Horizontal bars using divs instead of recharts for compactness */}
      {data.map(d => (
        <div key={d.name} className="flex items-center gap-2 text-[10px]">
          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
          <span className="text-[#5E6C84] dark:text-gray-400 w-14 truncate">{d.name}</span>
          <div className="flex-1 h-3 bg-[#F4F5F7] dark:bg-gray-800 rounded-full overflow-hidden relative">
            <div className="h-full rounded-full transition-all" style={{
              width: `${Math.max((d.value / maxVal) * 100, 2)}%`,
              backgroundColor: d.color,
            }} />
          </div>
          <span className="font-semibold text-[#172B4D] dark:text-gray-200 w-4 text-right">{d.value}</span>
        </div>
      ))}
    </div>
  );
}
