'use client';

import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import type { JiraIssue } from '@/types/jira';

interface WidgetIssueTypesProps {
  issues?: JiraIssue[];
  isLoading?: boolean;
}

const TYPE_COLORS: Record<string, string> = {
  Story: '#36B37E',
  Task: '#4BADE8',
  Bug: '#DE350B',
  'Sub-task': '#0052CC',
  Epic: '#904EE2',
  Support: '#FF8B00',
  Enhancement: '#008DA6',
  Improvement: '#6554C0',
  'New Feature': '#E774BB',
};

export function WidgetIssueTypes({ issues, isLoading }: WidgetIssueTypesProps) {
  const data = useMemo(() => {
    if (!issues || issues.length === 0) return [];
    const map = new Map<string, number>();
    for (const issue of issues) {
      const type = issue.fields.issuetype.name;
      map.set(type, (map.get(type) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value, color: TYPE_COLORS[name] ?? '#7A869A' }))
      .sort((a, b) => b.value - a.value);
  }, [issues]);

  if (isLoading) {
    return (
      <div className="space-y-2 animate-pulse">
        <div className="h-24 bg-[#F4F5F7] dark:bg-gray-700 rounded-full w-24 mx-auto" />
        <div className="space-y-1">
          <div className="h-2 bg-[#F4F5F7] dark:bg-gray-700 rounded w-3/4 mx-auto" />
          <div className="h-2 bg-[#F4F5F7] dark:bg-gray-700 rounded w-1/2 mx-auto" />
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return <div className="h-24 flex items-center justify-center text-[11px] text-[#8993A4]">No data</div>;
  }

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="space-y-2">
      <div className="relative h-28">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={28} outerRadius={42} paddingAngle={1} dataKey="value" strokeWidth={0}>
              {data.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
          <span className="text-[14px] font-bold text-[#172B4D] dark:text-gray-100">{total}</span>
          <span className="text-[8px] text-[#5E6C84] dark:text-gray-400">total</span>
        </div>
      </div>
      <div className="space-y-0.5">
        {data.slice(0, 5).map(d => (
          <div key={d.name} className="flex items-center gap-2 text-[10px]">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
            <span className="text-[#5E6C84] dark:text-gray-400 flex-1">{d.name}</span>
            <span className="font-semibold text-[#172B4D] dark:text-gray-200">{d.value}</span>
            <span className="text-[#8993A4]">({Math.round((d.value / total) * 100)}%)</span>
          </div>
        ))}
        {data.length > 5 && (
          <div className="text-[9px] text-[#8993A4] pt-0.5">+{data.length - 5} more</div>
        )}
      </div>
    </div>
  );
}
