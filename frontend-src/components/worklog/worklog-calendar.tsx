'use client';
import { useMemo, useState } from 'react';
import { startOfWeek, addDays, format } from 'date-fns';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { DndContext, DragOverlay, closestCenter, type DragStartEvent, type DragEndEvent } from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import type { WorklogEntry, JiraPriority } from '@/types/jira';
import { WorklogDayCell, type GroupByField, type GroupMeta, getGroupKey, getGroupMeta, SWIMLANE_PALETTE } from './worklog-day-cell';
import { WorklogEntryCard } from './worklog-entry-card';
import { GroupDetailPanel } from './group-detail-panel';
import { PriorityIcon } from '@/components/shared/priority-icon';
import { Button } from '@/components/ui/button';

interface Swimlane {
  key: string;
  label: string;
  color: string;
  totalHours: number;
  entriesByDate: Record<string, WorklogEntry[]>;
  dailyHours: Record<string, number>;
  groupBy?: GroupByField;
  iconUrl?: string;
  avatarUrl?: string;
  displayName?: string;
  priorityName?: string;
}

interface WorklogCalendarProps {
  mode: 'day' | 'week' | 'month';
  baseDate: Date;
  entriesByDate: Record<string, WorklogEntry[]>;
  dailyHours: Record<string, number>;
  groupBy?: GroupByField;
  editMode?: boolean;
  showWeekends?: boolean;
  onNavigate: (direction: 'prev' | 'next') => void;
  onModeChange: (mode: 'day' | 'week' | 'month') => void;
  onEntryClick?: (entry: WorklogEntry) => void;
  onDayClick?: (date: Date) => void;
  onDragEnd?: (entryId: string, newDate: string) => void;
}

export function WorklogCalendar({
  mode,
  baseDate,
  entriesByDate,
  dailyHours,
  groupBy,
  editMode,
  showWeekends = true,
  onNavigate,
  onModeChange,
  onEntryClick,
  onDayClick,
  onDragEnd,
}: WorklogCalendarProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragSourceDate, setDragSourceDate] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const days = useMemo(() => {
    const result: Date[] = [];
    if (mode === 'day') {
      result.push(baseDate);
    } else if (mode === 'week') {
      const start = startOfWeek(baseDate, { weekStartsOn: 1 });
      for (let i = 0; i < 7; i++) {
        const d = addDays(start, i);
        if (!showWeekends && (d.getDay() === 0 || d.getDay() === 6)) continue;
        result.push(d);
      }
    } else {
      const year = baseDate.getFullYear();
      const month = baseDate.getMonth();
      const firstDay = new Date(year, month, 1);
      const start = startOfWeek(firstDay, { weekStartsOn: 1 });
      for (let i = 0; i < 42; i++) {
        const d = addDays(start, i);
        if (!showWeekends && (d.getDay() === 0 || d.getDay() === 6)) continue;
        result.push(d);
      }
    }
    return result;
  }, [mode, baseDate, showWeekends]);

  // Compute swimlanes from all entries
  const swimlanes = useMemo<Swimlane[] | null>(() => {
    if (!groupBy) return null;

    const allEntries: WorklogEntry[] = [];
    for (const entries of Object.values(entriesByDate)) {
      for (const e of entries) allEntries.push(e);
    }

    const map = new Map<string, { entries: WorklogEntry[] }>();
    for (const e of allEntries) {
      const k = getGroupKey(e, groupBy);
      if (!map.has(k)) map.set(k, { entries: [] });
      map.get(k)!.entries.push(e);
    }

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val], idx) => {
        const byDate: Record<string, WorklogEntry[]> = {};
        const dh: Record<string, number> = {};
        for (const e of val.entries) {
          const d = new Date(e.started).toISOString().slice(0, 10);
          (byDate[d] ??= []).push(e);
          dh[d] = (dh[d] ?? 0) + e.timeSpentSeconds / 3600;
        }
        const sampleEntry = val.entries[0];
        const meta = getGroupMeta(sampleEntry, groupBy);
        return {
          key,
          label: key,
          color: SWIMLANE_PALETTE[idx % SWIMLANE_PALETTE.length],
          totalHours: val.entries.reduce((s, e) => s + e.timeSpentSeconds / 3600, 0),
          entriesByDate: byDate,
          dailyHours: dh,
          groupBy,
          ...meta,
        };
      });
  }, [entriesByDate, groupBy]);

  // Flatten all entries for drag lookup
  const allEntries = useMemo(() => {
    return swimlanes
      ? swimlanes.flatMap(s => Object.values(s.entriesByDate).flat())
      : Object.values(entriesByDate).flat();
  }, [swimlanes, entriesByDate]);

  const activeEntry = useMemo(() => {
    if (!activeId) return null;
    return allEntries.find((e) => e.id === activeId) ?? null;
  }, [activeId, allEntries]);

  const colCount = mode === 'day' ? 1 : !showWeekends ? 5 : 7;
  const dayHeaders = showWeekends
    ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

  function toggleCollapse(key: string) {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function DayGrid({ entries, hours }: { entries: Record<string, WorklogEntry[]>; hours: Record<string, number> }) {
    return (
      <div
        className={cn(
          'grid gap-px bg-[#DFE1E6] dark:bg-gray-700 rounded-sm overflow-hidden',
          swimlanes ? 'min-h-[80px]' : 'flex-1 min-h-0',
          mode === 'day' ? 'grid-cols-1' : `grid-cols-${colCount}`,
        )}
        style={(!swimlanes && mode !== 'month') || mode === 'day' ? { gridTemplateRows: '1fr' } : undefined}
      >
        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd');
          const isDragSource = activeId !== null && key === dragSourceDate;
          return (
            <WorklogDayCell
              key={key}
              date={day}
              entries={entries[key] ?? []}
              dailyHours={hours[key] ?? 0}
              compact={mode === 'month'}
              isCurrentMonth={
                mode === 'day' || mode === 'week' || day.getMonth() === baseDate.getMonth()
              }
              isDragActive={activeId !== null}
              isDragSource={isDragSource}
              groupBy={groupBy}
              editMode={editMode}
              onEntryClick={onEntryClick}
              onDayClick={onDayClick}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => onNavigate('prev')}
            className="border-[#DFE1E6] dark:border-gray-700 text-[#5E6C84] hover:bg-[#F4F5F7] dark:hover:bg-gray-800">
            <ChevronLeft size={14} />
          </Button>
          <h2 className="text-sm font-semibold text-[#172B4D] dark:text-gray-100 w-40 text-center">
            {mode === 'day'
              ? format(baseDate, 'EEEE, MMM d, yyyy')
              : mode === 'week'
                ? `${format(days[0], 'MMM d')} – ${format(days[days.length - 1], 'MMM d, yyyy')}`
                : format(baseDate, 'MMMM yyyy')}
          </h2>
          <Button variant="outline" size="sm" onClick={() => onNavigate('next')}
            className="border-[#DFE1E6] dark:border-gray-700 text-[#5E6C84] hover:bg-[#F4F5F7] dark:hover:bg-gray-800">
            <ChevronRight size={14} />
          </Button>
        </div>
        <div className="flex rounded-sm border border-[#DFE1E6] dark:border-gray-700 overflow-hidden">
          {(['day', 'week', 'month'] as const).map(m => (
            <button key={m} onClick={() => onModeChange(m)}
              className={cn('text-xs px-3 py-1 capitalize border-r border-[#DFE1E6] dark:border-gray-700 last:border-r-0',
                mode === m ? 'bg-[#0052CC] text-white' : 'bg-white dark:bg-gray-800 text-[#5E6C84] hover:bg-[#F4F5F7] dark:hover:bg-gray-700')}>
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Day headers (skip for day mode) */}
      {mode !== 'day' && (
        <div className={cn('grid gap-px mb-1 flex-shrink-0', `grid-cols-${colCount}`)}>
          {dayHeaders.map((d) => (
            <div key={d} className="text-center text-[10px] font-semibold text-[#5E6C84] dark:text-gray-400 py-1">{d}</div>
          ))}
        </div>
      )}

      {/* Calendar grid — with or without swimlanes */}
      <DndContext
        collisionDetection={closestCenter}
        onDragStart={(e: DragStartEvent) => {
          setActiveId(String(e.active.id));
          const id = String(e.active.id);
          for (const [dateKey, entries] of Object.entries(entriesByDate)) {
            if (entries.some(entry => entry.id === id)) { setDragSourceDate(dateKey); break; }
          }
        }}
        onDragEnd={(e: DragEndEvent) => {
          setActiveId(null);
          setDragSourceDate(null);
          if (e.over) onDragEnd?.(String(e.active.id), String(e.over.id));
        }}
      >
        {swimlanes ? (
          <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
            {swimlanes.map(lane => {
              const isOpen = !collapsed[lane.key];
              return (
                <div key={lane.key} className="rounded-sm border border-[#DFE1E6] dark:border-gray-700 overflow-hidden">
                  <button
                    onClick={() => toggleCollapse(lane.key)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 bg-[#FAFBFC] dark:bg-gray-800/80 hover:bg-[#F4F5F7] dark:hover:bg-gray-700 transition-colors text-left"
                  >
                    <ChevronDown size={12} className={cn('text-[#5E6C84] dark:text-gray-400 transition-transform', !isOpen && '-rotate-90')} />
                    {/* Color dot — hidden when icon/avatar/priority provide their own visual */}
                    {!(lane.avatarUrl || lane.iconUrl || lane.priorityName) && (
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: lane.color }} />
                    )}
                    {/* Rich group content */}
                    {lane.avatarUrl ? (
                      <img src={lane.avatarUrl} alt="" width={20} height={20} className="rounded-full flex-shrink-0" />
                    ) : lane.iconUrl ? (
                      <img src={lane.iconUrl} alt="" width={16} height={16} className="flex-shrink-0" />
                    ) : null}
                    {lane.priorityName ? (
                      <PriorityIcon priority={{ name: lane.priorityName, iconUrl: '' } as JiraPriority} />
                    ) : null}
                    <span className="text-xs font-semibold text-[#172B4D] dark:text-gray-200 flex-1">{lane.label}</span>
                    <span className="text-[10px] text-[#5E6C84] dark:text-gray-400 font-medium">{lane.totalHours.toFixed(1)}h</span>
                    <div className="w-16 h-1.5 bg-[#F4F5F7] dark:bg-gray-700 rounded-full overflow-hidden flex-shrink-0">
                      <div className="h-full rounded-full" style={{ width: `${Math.min((lane.totalHours / (mode === 'month' ? 160 : 8)) * 100, 100)}%`, backgroundColor: lane.color }} />
                    </div>
                  </button>
                  {isOpen && (
                    <div className="border-t border-[#DFE1E6] dark:border-gray-700">
                      <GroupDetailPanel
                        entries={Object.values(lane.entriesByDate).flat()}
                        editMode={editMode}
                        onEntryClick={onEntryClick}
                      />
                      <DayGrid entries={lane.entriesByDate} hours={lane.dailyHours} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <DayGrid entries={entriesByDate} hours={dailyHours} />
        )}

        <DragOverlay>
          {activeEntry && <WorklogEntryCard entry={activeEntry} isDragging />}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
