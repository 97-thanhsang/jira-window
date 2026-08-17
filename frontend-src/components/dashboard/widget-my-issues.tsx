'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { MyIssuesData } from '@/hooks/use-dashboard-data';

interface WidgetMyIssuesProps {
  data?: MyIssuesData;
  isLoading?: boolean;
}

export function WidgetMyIssues({ data, isLoading }: WidgetMyIssuesProps) {
  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="flex gap-3">
          <div className="h-16 bg-[#F4F5F7] dark:bg-gray-700 rounded flex-1" />
          <div className="h-16 bg-[#F4F5F7] dark:bg-gray-700 rounded flex-1" />
          <div className="h-16 bg-[#F4F5F7] dark:bg-gray-700 rounded flex-1" />
        </div>
        <div className="h-3 bg-[#F4F5F7] dark:bg-gray-700 rounded w-20" />
      </div>
    );
  }

  const d = data ?? { todo: 0, inProgress: 0, done: 0, total: 0, issues: [] };
  const max = Math.max(d.todo, d.inProgress, d.done, 1);

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2 h-20">
        {/* Todo bar */}
        <div className="flex-1 flex flex-col items-center gap-1">
          <span className="text-[12px] font-bold text-[#172B4D] dark:text-gray-200">{d.todo}</span>
          <div className="w-full rounded-t" style={{
            height: `${Math.max((d.todo / max) * 56, 4)}px`,
            backgroundColor: '#5E6C84',
          }} />
          <span className="text-[9px] font-medium text-[#5E6C84] dark:text-gray-400">To Do</span>
        </div>
        {/* In Progress bar */}
        <div className="flex-1 flex flex-col items-center gap-1">
          <span className="text-[12px] font-bold text-[#172B4D] dark:text-gray-200">{d.inProgress}</span>
          <div className="w-full rounded-t" style={{
            height: `${Math.max((d.inProgress / max) * 56, 4)}px`,
            backgroundColor: '#0052CC',
          }} />
          <span className="text-[9px] font-medium text-[#5E6C84] dark:text-gray-400">In Progress</span>
        </div>
        {/* Done bar */}
        <div className="flex-1 flex flex-col items-center gap-1">
          <span className="text-[12px] font-bold text-[#172B4D] dark:text-gray-200">{d.done}</span>
          <div className="w-full rounded-t" style={{
            height: `${Math.max((d.done / max) * 56, 4)}px`,
            backgroundColor: '#00875A',
          }} />
          <span className="text-[9px] font-medium text-[#5E6C84] dark:text-gray-400">Done</span>
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px]">
        <span className="text-[#5E6C84] dark:text-gray-400 font-medium">
          Total: <span className="text-[#172B4D] dark:text-gray-200 font-bold">{d.total}</span> issues
        </span>
        <Link
          href="/issues"
          className="inline-flex items-center gap-1 text-[#0052CC] dark:text-blue-400 hover:underline font-medium transition-colors group"
        >
          View all issues
          <ArrowRight size={10} className="group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </div>
  );
}
