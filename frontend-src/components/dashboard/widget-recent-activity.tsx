'use client';

import { useRouter } from 'next/navigation';
import { Clock } from 'lucide-react';
import type { RecentActivityItem } from '@/hooks/use-dashboard-data';

interface WidgetRecentActivityProps {
  items?: RecentActivityItem[];
  isLoading?: boolean;
}

const STATUS_CATEGORY_COLORS: Record<string, string> = {
  new: 'bg-[#5E6C84] text-white',
  indeterminate: 'bg-[#0052CC] text-white',
  done: 'bg-[#00875A] text-white',
};

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return '1d ago';
  return `${days}d ago`;
}

export function WidgetRecentActivity({ items, isLoading }: WidgetRecentActivityProps) {
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="space-y-2 animate-pulse">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="h-4 bg-[#F4F5F7] dark:bg-gray-700 rounded w-8" />
            <div className="h-4 bg-[#F4F5F7] dark:bg-gray-700 rounded flex-1" />
            <div className="h-4 bg-[#F4F5F7] dark:bg-gray-700 rounded w-12" />
          </div>
        ))}
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 text-[11px] text-[#8993A4] dark:text-gray-500">
        No recent activity
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {items.slice(0, 8).map(item => (
        <button
          key={item.issueKey}
          onClick={() => router.push(`/issues/${item.issueKey}`)}
          className="w-full flex items-center gap-2 px-2 py-1.5 -mx-2 rounded hover:bg-[#F4F5F7] dark:hover:bg-gray-800 transition-colors text-left group"
        >
          <span className="text-[10px] font-semibold text-[#0052CC] dark:text-blue-400 group-hover:underline min-w-[75px]">{item.issueKey}</span>
          <span className="text-[10px] text-[#5E6C84] dark:text-gray-400 truncate flex-1">{item.summary}</span>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-sm leading-none flex-shrink-0 ${STATUS_CATEGORY_COLORS[item.statusCategory] ?? 'bg-gray-400 text-white'}`}>
            {item.status}
          </span>
          <span className="text-[9px] text-[#8993A4] dark:text-gray-500 flex-shrink-0 flex items-center gap-0.5 min-w-[42px]">
            <Clock size={8} />{relativeTime(item.updated)}
          </span>
        </button>
      ))}
    </div>
  );
}
