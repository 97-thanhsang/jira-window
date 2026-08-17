'use client';

import { useRouter } from 'next/navigation';
import { Calendar, AlertTriangle } from 'lucide-react';
import type { DueSoonItem } from '@/hooks/use-dashboard-data';

interface WidgetDueSoonProps {
  items?: DueSoonItem[];
  isLoading?: boolean;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}

function daysUntil(dateStr: string): number {
  if (!dateStr) return 999;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dateStr);
  due.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

const PRIORITY_COLORS: Record<string, string> = {
  Highest: '#DE350B', High: '#FF5630', Medium: '#FFAB00',
  Low: '#2684FF', Lowest: '#2684FF', Blocker: '#DE350B',
};

export function WidgetDueSoon({ items, isLoading }: WidgetDueSoonProps) {
  const router = useRouter();

  const sorted = (items ?? []).slice(0, 10);
  const overdue = sorted.filter(i => i.overdue).length;
  const dueThisWeek = sorted.filter(i => !i.overdue).length;

  if (isLoading) {
    return (
      <div className="space-y-2 animate-pulse">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="h-4 bg-[#F4F5F7] dark:bg-gray-700 rounded w-8" />
            <div className="h-4 bg-[#F4F5F7] dark:bg-gray-700 rounded flex-1" />
            <div className="h-4 bg-[#F4F5F7] dark:bg-gray-700 rounded w-12" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Summary header */}
      <div className="flex items-center gap-2 text-[10px]">
        {overdue > 0 && (
          <span className="inline-flex items-center gap-0.5 text-[#DE350B] font-semibold">
            <AlertTriangle size={10} />{overdue} overdue
          </span>
        )}
        {dueThisWeek > 0 && (
          <span className="text-[#5E6C84] dark:text-gray-400 font-medium">
            {dueThisWeek} due this week
          </span>
        )}
        {overdue === 0 && dueThisWeek === 0 && (
          <span className="text-[11px] text-[#8993A4] dark:text-gray-500">No upcoming due dates</span>
        )}
      </div>

      {/* List */}
      {sorted.length > 0 && (
        <div className="space-y-0.5">
          {sorted.map(item => {
            const days = daysUntil(item.duedate);
            const dueColor = item.overdue
              ? '#DE350B'
              : days <= 2 ? '#FF8B00' : '#0052CC';

            return (
              <button
                key={item.issueKey}
                onClick={() => router.push(`/issues/${item.issueKey}`)}
                className="w-full flex items-center gap-2 px-2 py-1.5 -mx-2 rounded hover:bg-[#F4F5F7] dark:hover:bg-gray-800 transition-colors text-left group"
              >
                {/* Priority indicator */}
                <div
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: PRIORITY_COLORS[item.priority] ?? '#6B778C' }}
                  title={item.priority}
                />
                {/* Overdue dot */}
                {item.overdue && (
                  <div className="w-1.5 h-1.5 rounded-full bg-[#DE350B] flex-shrink-0" />
                )}
                <span className="text-[10px] font-semibold text-[#0052CC] dark:text-blue-400 group-hover:underline min-w-[75px]">{item.issueKey}</span>
                <span className="text-[10px] text-[#5E6C84] dark:text-gray-400 truncate flex-1">{item.summary}</span>
                <span
                  className="text-[10px] font-semibold flex-shrink-0 flex items-center gap-0.5 min-w-[42px]"
                  style={{ color: dueColor }}
                >
                  <Calendar size={8} />
                  {formatDate(item.duedate)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
