'use client';

import { useMemo } from 'react';
import { Clock } from 'lucide-react';

interface WidgetWorklogProps {
  entries?: { timeSpentSeconds: number; projectKey: string; projectName: string; started: string }[];
  isLoading?: boolean;
}

export function WidgetWorklog({ entries, isLoading }: WidgetWorklogProps) {
  const stats = useMemo(() => {
    if (!entries || entries.length === 0) {
      return { todayHours: 0, weekHours: 0, projectMap: new Map<string, { projectName: string; hours: number }>() };
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(todayStart.getDate() - todayStart.getDay());

    let todayHours = 0;
    let weekHours = 0;
    const projectMap = new Map<string, { projectName: string; hours: number }>();

    for (const e of entries) {
      const d = new Date(e.started);
      const hours = e.timeSpentSeconds / 3600;

      if (d >= todayStart) todayHours += hours;
      if (d >= weekStart) weekHours += hours;

      const existing = projectMap.get(e.projectKey);
      if (existing) {
        existing.hours += hours;
      } else {
        projectMap.set(e.projectKey, { projectName: e.projectName, hours });
      }
    }

    return { todayHours, weekHours, projectMap };
  }, [entries]);

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="flex gap-4">
          <div className="flex-1 h-12 bg-[#F4F5F7] dark:bg-gray-700 rounded" />
          <div className="flex-1 h-12 bg-[#F4F5F7] dark:bg-gray-700 rounded" />
        </div>
        <div className="space-y-1.5">
          <div className="h-2 bg-[#F4F5F7] dark:bg-gray-700 rounded w-full" />
          <div className="h-2 bg-[#F4F5F7] dark:bg-gray-700 rounded w-3/4" />
        </div>
      </div>
    );
  }

  const { todayHours, weekHours, projectMap } = stats;
  const topProjects = Array.from(projectMap.entries())
    .sort((a, b) => b[1].hours - a[1].hours)
    .slice(0, 3);

  const PROJECT_DOT_COLORS: Record<string, string> = {
    HLU2: '#0052CC', HUBONG01: '#36B37E', EMSPRO2: '#FF8B00',
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <div className="flex-1 bg-[#F4F5F7] dark:bg-gray-800 rounded-lg p-3 text-center">
          <span className="text-[20px] font-bold text-[#172B4D] dark:text-gray-100 block">{todayHours.toFixed(1)}h</span>
          <span className="text-[10px] text-[#5E6C84] dark:text-gray-400 font-medium">Today</span>
        </div>
        <div className="flex-1 bg-[#F4F5F7] dark:bg-gray-800 rounded-lg p-3 text-center">
          <span className="text-[20px] font-bold text-[#172B4D] dark:text-gray-100 block">{weekHours.toFixed(1)}h</span>
          <span className="text-[10px] text-[#5E6C84] dark:text-gray-400 font-medium">This Week</span>
        </div>
      </div>

      {topProjects.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[9px] font-semibold text-[#8993A4] dark:text-gray-500 uppercase tracking-wide">Top Projects</span>
          {topProjects.map(([key, info], i) => {
            const maxHours = topProjects[0]?.[1]?.hours ?? 1;
            const pct = Math.min((info.hours / maxHours) * 100, 100);
            return (
              <div key={key} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: PROJECT_DOT_COLORS[key] ?? '#6554C0' }} />
                <span className="text-[10px] text-[#5E6C84] dark:text-gray-400 min-w-[60px] truncate">{info.projectName || key}</span>
                <div className="flex-1 h-1 bg-[#DFE1E6] dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-[#0052CC]" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[10px] font-semibold text-[#172B4D] dark:text-gray-200 w-8 text-right">{info.hours.toFixed(1)}h</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
