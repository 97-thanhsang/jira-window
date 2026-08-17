'use client';

import { CalendarDays } from 'lucide-react';
import type { WorkEstDateRange } from '@/hooks/use-work-est';

interface Props {
  dateRange: WorkEstDateRange;
  onChange: (range: WorkEstDateRange) => void;
}

function countWorkingDays(from: string, to: string): number {
  const start = new Date(from + 'T00:00:00');
  const end = new Date(to + 'T00:00:00');
  let count = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

export function EstDateRange({ dateRange, onChange }: Props) {
  const workingDays = countWorkingDays(dateRange.from, dateRange.to);
  const totalHours = workingDays * 8;

  return (
    <div className="bg-white dark:bg-gray-900 border border-[#DFE1E6] dark:border-gray-700 rounded-lg p-4">
      <div className="flex items-center gap-4 flex-wrap">
        <CalendarDays size={18} className="text-[#5E6C84] dark:text-gray-400 shrink-0" />
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-[#5E6C84] dark:text-gray-400 uppercase tracking-wide">Từ ngày</label>
          <input type="date" value={dateRange.from}
            onChange={e => onChange({ ...dateRange, from: e.target.value })}
            className="px-3 py-1.5 text-sm border border-[#DFE1E6] dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-[#172B4D] dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#0052CC]" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-[#5E6C84] dark:text-gray-400 uppercase tracking-wide">Đến ngày</label>
          <input type="date" value={dateRange.to}
            onChange={e => onChange({ ...dateRange, to: e.target.value })}
            className="px-3 py-1.5 text-sm border border-[#DFE1E6] dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-[#172B4D] dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#0052CC]" />
        </div>
        <div className="ml-auto flex items-center gap-4 text-xs text-[#5E6C84] dark:text-gray-400">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#DEEBFF] dark:bg-blue-900/30 text-[#0052CC] dark:text-blue-300 rounded-full font-medium">
            {workingDays} ngày làm việc
          </span>
          <span className="w-px h-4 bg-[#DFE1E6] dark:border-gray-700" />
          <span className="font-semibold text-[#172B4D] dark:text-gray-200">{totalHours}h khả dụng</span>
          <span className="w-px h-4 bg-[#DFE1E6] dark:border-gray-700" />
          <span className="text-[10px] text-[#5E6C84]">(Bỏ qua T7/CN)</span>
        </div>
      </div>
    </div>
  );
}
