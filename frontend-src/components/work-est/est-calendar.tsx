'use client';

import { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { WorkEstDaySchedule } from '@/lib/work-est-api';

interface Props {
  schedule: WorkEstDaySchedule[];
  workingDays: string[];
}

const PROJECT_COLORS: Record<string, string> = {
  EMSPRO2: 'bg-blue-100 dark:bg-blue-900/30 border-l-blue-500 text-blue-800 dark:text-blue-200',
  default: 'bg-gray-50 dark:bg-gray-800/50 border-l-gray-400 text-gray-700 dark:text-gray-300',
};

function getProjectColor(projectKey: string): string {
  return PROJECT_COLORS[projectKey] ?? PROJECT_COLORS.default;
}

function DayCell({ day }: { day: WorkEstDaySchedule }) {
  const dateObj = parseISO(day.date);
  const dayLabel = format(dateObj, 'EEE', { locale: vi });
  const dateLabel = format(dateObj, 'dd/MM');

  const capacityPct = Math.min(100, Math.round((day.totalHours / 8) * 100));
  const isOver = day.totalHours > 8;

  return (
    <div className="bg-white dark:bg-gray-900 border border-[#DFE1E6] dark:border-gray-700 rounded-lg overflow-hidden">
      {/* Day header */}
      <div className="px-3 py-2 border-b border-[#DFE1E6] dark:border-gray-700 bg-[#FAFBFC] dark:bg-gray-800/60">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-[#5E6C84] dark:text-gray-400 uppercase">{dayLabel}</div>
            <div className="text-sm font-semibold text-[#172B4D] dark:text-gray-200">{dateLabel}</div>
          </div>
          <div className={cn(
            'text-xs font-semibold px-2 py-0.5 rounded-full',
            isOver ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-[#DEEBFF] dark:bg-blue-900/30 text-[#0052CC] dark:text-blue-300',
          )}>
            {day.totalHours}h / 8h
          </div>
        </div>
        {/* Capacity bar */}
        <div className="mt-1.5 h-1.5 bg-[#F4F5F7] dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', isOver ? 'bg-red-400' : 'bg-[#0052CC]')}
            style={{ width: `${Math.min(100, capacityPct)}%` }}
          />
        </div>
      </div>

      {/* Allocations */}
      <div className="divide-y divide-[#F4F5F7] dark:divide-gray-800">
        {day.allocations.length === 0 ? (
          <div className="px-3 py-4 text-xs text-[#C1C7D0] dark:text-gray-500 text-center italic">
            Trống
          </div>
        ) : (
          day.allocations.map(alloc => (
            <div
              key={`${day.date}-${alloc.issueKey}`}
              className={cn(
                'px-3 py-1.5 border-l-2',
                getProjectColor(alloc.projectKey),
              )}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-medium text-[#0052CC] dark:text-blue-400 shrink-0">{alloc.issueKey}</span>
                <span className="text-xs font-semibold text-[#5E6C84] dark:text-gray-400 shrink-0">{alloc.hours}h</span>
              </div>
              <div className="text-xs text-[#5E6C84] dark:text-gray-400 truncate mt-0.5">{alloc.summary}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function EstCalendar({ schedule, workingDays }: Props) {
  if (workingDays.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 border border-[#DFE1E6] dark:border-gray-700 rounded-lg p-8 text-center text-sm text-[#5E6C84] dark:text-gray-400">
        Chọn ngày bắt đầu và kết thúc để xem lịch phân bổ.
      </div>
    );
  }

  const totalHours = schedule.reduce((s, d) => s + d.totalHours, 0);
  const totalCapacity = workingDays.length * 8;

  return (
    <div>
      {/* Summary bar */}
      <div className="flex items-center gap-4 mb-4 text-xs text-[#5E6C84] dark:text-gray-400">
        <span className="font-semibold text-[#172B4D] dark:text-gray-200">{schedule.length} ngày</span>
        <span className="w-px h-4 bg-[#DFE1E6] dark:bg-gray-700" />
        <span>Đã phân bổ: <strong className="text-[#172B4D] dark:text-gray-200">{totalHours}h</strong></span>
        <span className="w-px h-4 bg-[#DFE1E6] dark:bg-gray-700" />
        <span>Tổng: <strong className="text-[#172B4D] dark:text-gray-200">{totalCapacity}h</strong></span>
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 auto-rows-fr">
        {schedule.map(day => (
          <DayCell key={day.date} day={day} />
        ))}
      </div>
    </div>
  );
}
