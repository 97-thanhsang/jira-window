'use client';

import { useMemo } from 'react';
import { startOfWeek, addDays, format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { WorkEstDaySchedule, WorkEstAllocation } from '@/lib/work-est-api';

interface Props {
  schedule: WorkEstDaySchedule[];
  workingDays: string[];
}

// ── Helpers (match worklog-day-cell.tsx exactly) ──────────────────────────

const TYPE_COLORS: Record<string, string> = {
  'Task': '#0052CC', 'Sub-task': '#008DA6', 'Story': '#36B37E',
  'Bug': '#DE350B', 'Epic': '#6554C0', 'Improvement': '#FF8B00',
};

function typeAbbr(name: string): string {
  if (name === 'Sub-task') return 'SUB';
  if (name === 'Story') return 'STR';
  if (name === 'Bug') return 'BUG';
  if (name === 'Epic') return 'EPC';
  if (name === 'Task') return 'TSK';
  return name.slice(0, 3).toUpperCase();
}

function TypeBadge({ typeName, iconUrl }: { typeName: string; iconUrl?: string }) {
  if (iconUrl) return <img src={iconUrl} alt={typeName} className="w-3.5 h-3.5 flex-shrink-0" />;
  return (
    <span className="text-[8px] font-bold px-1 py-0.5 rounded-sm flex-shrink-0 text-white"
      style={{ backgroundColor: TYPE_COLORS[typeName] ?? '#5E6C84' }}>
      {typeAbbr(typeName)}
    </span>
  );
}

function getStatusBgColor(status: string | undefined): string {
  if (!status) return '#F4F5F7';
  const s = status.toLowerCase();
  if (['done', 'closed', 'resolved', 'completed'].some(x => s.includes(x))) return '#E3FCEF';
  if (['in progress', 'in review', 'development', 'testing'].some(x => s.includes(x))) return '#DEEBFF';
  if (['to do', 'open', 'backlog', 'new'].some(x => s.includes(x))) return '#F4F5F7';
  if (['cancelled', 'rejected'].some(x => s.includes(x))) return '#F4F5F7';
  if (['blocked', 'impediment'].some(x => s.includes(x))) return '#FFEBE6';
  return '#F4F5F7';
}

function getStatusColor(status: string | undefined): string {
  if (!status) return '#42526E';
  const s = status.toLowerCase();
  if (['done', 'closed', 'resolved', 'completed'].some(x => s.includes(x))) return '#006644';
  if (['in progress', 'in review', 'development', 'testing'].some(x => s.includes(x))) return '#0052CC';
  if (['to do', 'open', 'backlog', 'new'].some(x => s.includes(x))) return '#42526E';
  if (['cancelled', 'rejected'].some(x => s.includes(x))) return '#6B778C';
  if (['blocked', 'impediment'].some(x => s.includes(x))) return '#DE350B';
  return '#42526E';
}

function getPriorityColor(priority: string | undefined): string {
  if (!priority) return '#DFE1E6';
  const colors: Record<string, string> = {
    Highest: '#DE350B', High: '#FF5630', Blocker: '#DE350B',
    Medium: '#FFAB00', Low: '#2684FF', Lowest: '#2684FF', Minor: '#6B778C',
  };
  return colors[priority] ?? '#6B778C';
}

function getPriorityBgColor(priority: string | undefined): string {
  if (!priority) return '#F4F5F7';
  const colors: Record<string, string> = {
    Highest: '#FFEBE6', High: '#FFEDE8', Blocker: '#FFEBE6',
    Medium: '#FFF7E6', Low: '#E6F0FF', Lowest: '#E6F0FF', Minor: '#F4F5F7',
  };
  return colors[priority] ?? '#F4F5F7';
}

function getEntryBorderColor(issueKey: string): string {
  let hash = 0;
  for (let i = 0; i < issueKey.length; i++) hash = issueKey.charCodeAt(i) + ((hash << 5) - hash);
  const palette = ['#0052CC','#36B37E','#DE350B','#FF8B00','#6554C0','#008DA6','#E774BB','#00B8D9','#5243AA','#BF2600','#403294','#006644','#FF991F','#172B4D','#0747A6'];
  return palette[Math.abs(hash) % palette.length];
}

// ── Consolidated Card: shows est and/or log for ONE issueKey ──────────

interface MergedTaskInfo {
  issueKey: string;
  summary: string;
  projectKey: string;
  issueTypeName: string;
  issueTypeIconUrl: string;
  status: string;
  priority: string;
  assigneeDisplayName: string | null;
  parentKey: string | null;
  parentSummary: string | null;
  estHours: number;
  logHours: number;
}

function TaskCard({ info }: { info: MergedTaskInfo }) {
  const hasEst = info.estHours > 0;
  const hasLog = info.logHours > 0;

  return (
    <div
      className={cn(
        'px-3 py-2 text-[12px] border rounded-sm transition-all group h-[100px] flex flex-col overflow-hidden',
        hasLog && !hasEst && 'bg-[#F8F9FA] dark:bg-gray-800/40 border-dashed border-[#DFE1E6] dark:border-gray-700 opacity-70',
        !hasLog && 'bg-white dark:bg-gray-800 border border-[#DFE1E6] dark:border-gray-700 hover:shadow-sm',
        hasLog && hasEst && 'bg-white dark:bg-gray-800 border border-[#DFE1E6] dark:border-gray-700 hover:shadow-sm',
      )}
      style={{ borderLeftColor: getEntryBorderColor(info.issueKey), borderLeftWidth: '3px' }}
    >
      {/* Row 1: type badge + issue key + project + status (fixed) */}
      <div className="flex items-center gap-1.5 min-w-0 h-[18px] shrink-0">
        <TypeBadge typeName={info.issueTypeName} iconUrl={info.issueTypeIconUrl} />
        <span className={cn('font-semibold truncate text-xs leading-none', hasLog && !hasEst ? 'text-[#5E6C84] dark:text-gray-400' : 'text-[#172B4D] dark:text-gray-100')}>{info.issueKey}</span>
        <span className="text-[10px] text-[#8993A4] dark:text-gray-500 truncate flex-shrink-0 leading-none">{info.projectKey}</span>
        {info.parentKey && (
          <span className="text-[9px] text-[#8993A4] dark:text-gray-500 truncate leading-tight shrink-0 max-w-[120px]" title={`${info.parentKey} — ${info.parentSummary ?? ''}`}>
            {info.parentKey}
          </span>
        )}
        <div className="flex-1 min-w-0" />
        {info.status && (
          <span className="text-[9px] px-1.5 py-[1px] rounded font-medium shrink-0 leading-tight"
            style={{ backgroundColor: getStatusBgColor(info.status), color: getStatusColor(info.status) }}>
            {info.status}
          </span>
        )}
        {hasLog && !hasEst && (
          <span className="text-[8px] text-[#8993A4] dark:text-gray-500 italic shrink-0 leading-none">(cũ)</span>
        )}
      </div>

      {/* Row 2: summary (flex-1, truncate) */}
      <p className={cn('text-[10px] leading-snug mt-1 line-clamp-2', hasLog && !hasEst ? 'text-[#8993A4] dark:text-gray-500' : 'text-[#5E6C84] dark:text-gray-400')} title={info.summary}>
        {info.summary}
      </p>

      {/* Row 3: priority left, est+log badges right (fixed, bottom-aligned) */}
      <div className="flex items-center justify-between min-w-0 h-[20px] shrink-0 mt-auto gap-1">
        <div className="flex items-center gap-1 min-w-0">
          {info.priority && (
            <span className="text-[9px] px-1.5 py-[1px] rounded font-medium leading-tight shrink-0"
              style={{ backgroundColor: getPriorityBgColor(info.priority), color: getPriorityColor(info.priority) }}>
              {info.priority}
            </span>
          )}
          {info.assigneeDisplayName && (
            <span className="text-[9px] text-[#8993A4] dark:text-gray-500 truncate leading-tight">{info.assigneeDisplayName}</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {hasEst && (
            <span className="inline-flex items-center justify-center gap-0.5 font-semibold px-1.5 py-[1px] rounded text-[10px] leading-tight min-w-[48px] text-center"
              style={{ backgroundColor: '#DEEBFF', color: '#0052CC' }}>
              <span className="text-[9px]">⏱</span> {info.estHours}h
            </span>
          )}
          {hasLog && (
            <span className="inline-flex items-center justify-center gap-0.5 font-semibold px-1.5 py-[1px] rounded text-[10px] leading-tight min-w-[48px] text-center"
              style={{ backgroundColor: '#E3FCEF', color: '#006644' }}>
              <span className="text-[9px]">✓</span> {info.logHours}h
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Day Column ─────────────────────────────────────────────────────────────

function DayColumn({ day }: { day: WorkEstDaySchedule }) {
  const date = new Date(day.date + 'T00:00:00');
  const dayLabel = format(date, 'EEE');
  const dateLabel = format(date, 'dd/MM');
  const todayFlag = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
  const isOver = day.allocations.length > 0 && day.totalHours / day.allocations.length > 8;
  const progressPct = Math.min(100, Math.round(((day.totalHours + day.existingHours) / 8) * 100));

  // Merge allocations + log entries by issueKey
  const mergedCards = useMemo((): MergedTaskInfo[] => {
    const map = new Map<string, MergedTaskInfo>();

    // Collect from new allocations (est)
    for (const alloc of day.allocations) {
      const existing = map.get(alloc.issueKey);
      if (existing) {
        existing.estHours += alloc.hours;
      } else {
        map.set(alloc.issueKey, {
          issueKey: alloc.issueKey,
          summary: alloc.summary,
          projectKey: alloc.projectKey,
          issueTypeName: alloc.issueTypeName,
          issueTypeIconUrl: alloc.issueTypeIconUrl,
          status: alloc.status,
          priority: alloc.priority,
          assigneeDisplayName: alloc.assigneeDisplayName,
          parentKey: alloc.parentKey ?? null,
          parentSummary: alloc.parentSummary ?? null,
          estHours: alloc.hours,
          logHours: 0,
        });
      }
    }

    // Collect from existing log entries
    for (const entry of day.existingLogEntries) {
      const existing = map.get(entry.issueKey);
      if (existing) {
        existing.logHours += entry.hours;
      } else {
        map.set(entry.issueKey, {
          issueKey: entry.issueKey,
          summary: entry.summary,
          projectKey: entry.projectKey,
          issueTypeName: entry.issueTypeName,
          issueTypeIconUrl: entry.issueTypeIconUrl,
          status: entry.status,
          priority: entry.priority,
          assigneeDisplayName: entry.assigneeDisplayName,
          parentKey: entry.parentKey ?? null,
          parentSummary: entry.parentSummary ?? null,
          estHours: 0,
          logHours: entry.hours,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => a.issueKey.localeCompare(b.issueKey));
  }, [day.allocations, day.existingLogEntries]);

  return (
    <div className={cn(
      'flex flex-col border border-[#DFE1E6] dark:border-gray-700 bg-white dark:bg-gray-800/50 rounded-sm overflow-hidden min-h-[300px]',
      todayFlag && 'bg-[#DEEBFF]/40 dark:bg-blue-900/20 border-[#0052CC]/50',
    )}>
      {/* Header */}
      <div className={cn(
        'flex items-center justify-between px-2 py-1.5 border-b border-[#DFE1E6] dark:border-gray-700 bg-[#FAFBFC] dark:bg-gray-800/60',
        todayFlag && 'bg-[#DEEBFF]/60',
      )}>
        <div className="flex items-center gap-1.5">
          <span className={cn('text-[10px] font-semibold', todayFlag ? 'text-[#0052CC]' : 'text-[#172B4D] dark:text-gray-200')}>{dayLabel}</span>
          <span className="text-[10px] text-[#5E6C84] dark:text-gray-400">{dateLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          {day.totalHours > 0 && (
            <span className="text-[10px] font-semibold text-[#0052CC] dark:text-blue-300">⏱ {day.totalHours}h</span>
          )}
          {day.totalHours > 0 && day.existingHours > 0 && (
            <span className="text-[9px] text-[#C1C7D0]">|</span>
          )}
          {day.existingHours > 0 && (
            <span className="text-[10px] font-medium text-[#006644] dark:text-green-400">✓ {day.existingHours}h</span>
          )}
          {day.totalHours === 0 && day.existingHours === 0 && (
            <span className="text-[10px] text-[#C1C7D0]">0h</span>
          )}
        </div>
      </div>

      {/* Progress bar (based on total est+log) */}
      <div className="h-1.5 bg-[#F4F5F7] dark:bg-gray-700 flex-shrink-0">
        <div className={cn('h-full rounded-r-sm transition-all', isOver ? 'bg-red-400' : 'bg-[#0052CC]')}
          style={{ width: `${Math.min(100, progressPct)}%` }} />
      </div>

      {/* Merged task cards */}
      <div className="flex-1 space-y-1.5 p-2 overflow-y-auto">
        {mergedCards.length === 0 ? (
          <div className="text-[10px] text-[#C1C7D0] dark:text-gray-500 text-center italic pt-8">Trống</div>
        ) : (
          mergedCards.map(card => (
            <TaskCard key={card.issueKey} info={card} />
          ))
        )}
      </div>
    </div>
  );
}

// ── Main Timeline ──────────────────────────────────────────────────────────

export function EstTimeline({ schedule, workingDays }: Props) {
  const dayHeaders = ['T2', 'T3', 'T4', 'T5', 'T6'];

  // Group working days into weeks (Mon-Fri)
  const weeks = useMemo(() => {
    if (workingDays.length === 0) return [];
    const groups: { label: string; days: string[] }[] = [];
    let cur: string[] = [];
    for (const day of workingDays) {
      const d = new Date(day + 'T00:00:00');
      if (d.getDay() === 1 && cur.length > 0) {
        const first = new Date(cur[0] + 'T00:00:00');
        const last = new Date(cur[cur.length - 1] + 'T00:00:00');
        groups.push({
          label: `${format(first, 'dd/MM')} – ${format(last, 'dd/MM/yyyy')}`,
          days: cur,
        });
        cur = [];
      }
      cur.push(day);
    }
    if (cur.length > 0) {
      const first = new Date(cur[0] + 'T00:00:00');
      const last = new Date(cur[cur.length - 1] + 'T00:00:00');
      groups.push({
        label: `${format(first, 'dd/MM')} – ${format(last, 'dd/MM/yyyy')}`,
        days: cur,
      });
    }
    return groups;
  }, [workingDays]);

  const scheduleMap = useMemo(() => {
    const m = new Map<string, WorkEstDaySchedule>();
    for (const d of schedule) m.set(d.date, d);
    return m;
  }, [schedule]);

  const totalHours = schedule.reduce((s, d) => s + d.totalHours, 0);
  const totalCapacity = workingDays.length * 8;

  if (workingDays.length === 0) return null;

  return (
    <div>
      {/* Summary bar */}
      <div className="flex items-center gap-3 mb-4 text-xs text-[#5E6C84] dark:text-gray-400">
        <span className="font-semibold text-[#172B4D] dark:text-gray-200">{totalHours}h / {totalCapacity}h</span>
        <span className="w-px h-4 bg-[#DFE1E6] dark:border-gray-700" />
        <span>{workingDays.length} ngày</span>
        <span className="w-px h-4 bg-[#DFE1E6] dark:border-gray-700" />
        <span>{weeks.length} tuần</span>
      </div>

      {/* Each week as a separate timeline */}
      {weeks.map((week, wi) => {
        // Build 5-column grid (Mon-Fri), fill null for missing days
        const first = new Date(week.days[0] + 'T00:00:00');
        const start = startOfWeek(first, { weekStartsOn: 1 });
        const gridDays: (string | null)[] = [];
        for (let i = 0; i < 5; i++) {
          const d = addDays(start, i);
          gridDays.push(week.days.includes(format(d, 'yyyy-MM-dd')) ? format(d, 'yyyy-MM-dd') : null);
        }

        return (
          <div key={wi} className="mb-6">
            {/* Week label */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold text-[#172B4D] dark:text-gray-200">Tuần {wi + 1}/{weeks.length}</span>
              <span className="text-[10px] text-[#5E6C84] dark:text-gray-400">{week.label}</span>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-5 gap-2 mb-1">
              {dayHeaders.map((d, i) => (
                <div key={d} className={cn('text-center text-[10px] font-semibold py-1 rounded-sm',
                  gridDays[i] && scheduleMap.has(gridDays[i]!) ? 'text-[#5E6C84] dark:text-gray-400' : 'text-[#C1C7D0] dark:text-gray-600',
                )}>{d}</div>
              ))}
            </div>

            {/* Day grid */}
            <div className="grid grid-cols-5 gap-2">
              {gridDays.map((dayKey, i) => {
                if (!dayKey) return <div key={`e-${wi}-${i}`} className="min-h-[250px] bg-[#F8F9FA] dark:bg-gray-800/20 border border-dashed border-[#DFE1E6] dark:border-gray-700 rounded-sm" />;
                const ds = scheduleMap.get(dayKey);
                return <DayColumn key={dayKey} day={ds ?? { date: dayKey, allocations: [], totalSeconds: 0, totalHours: 0, existingSeconds: 0, existingHours: 0, existingTasks: [], existingLogEntries: [] }} />;
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
