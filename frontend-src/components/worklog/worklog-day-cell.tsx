'use client';
import { useMemo } from 'react';
import { format, isToday } from 'date-fns';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import { Pencil, Layers, Calendar, Clock } from 'lucide-react';
import type { WorklogEntry } from '@/types/jira';
import {
  ISSUE_COLOR_PALETTE,
  ISSUE_TYPE_HEX_COLORS,
  PRIORITY_HEX_COLORS,
} from '@/lib/jira-colors';
import {
  getDuedateColor,
  getStatusBgColor,
  getStatusColor,
  typeAbbr,
} from '@/lib/jira-status';

export type GroupByField = 'project' | 'type' | 'assignee' | 'status' | 'priority' | 'parent' | 'statusCategory' | 'sprint' | 'reporter' | null;

// Timeline: show 7:00-18:30 (11.5h = 138 slots of 5min)
const START_HOUR = 7;        // 7:00
const END_MINUTES = 18.5 * 60; // 18:30 = 1110 min
const START_MINUTES = START_HOUR * 60; // 420
const SLOT_HEIGHT = 10;
const MINUTES_PER_SLOT = 5;
const VISIBLE_SLOTS = (END_MINUTES - START_MINUTES) / MINUTES_PER_SLOT; // 138 slots
const TIMELINE_HEIGHT = VISIBLE_SLOTS * SLOT_HEIGHT; // 1380px
const LUNCH_START = 12 * 60;       // 720 min
const LUNCH_END = 13.5 * 60;       // 810 min

function isWeekend(date: Date): boolean {
  return date.getDay() === 0 || date.getDay() === 6;
}

// ── Status-based colors ───────────────────────────────────────
function getStatusAccentColor(status: string | undefined): string {
  if (!status) return '#5E6C84';
  const s = status.toLowerCase();
  if (['done', 'closed', 'resolved', 'completed'].some(x => s.includes(x))) return '#36B37E';
  if (['in progress', 'in review', 'development', 'testing', 'review'].some(x => s.includes(x))) return '#0052CC';
  if (['to do', 'open', 'backlog', 'new', 'selected for development'].some(x => s.includes(x))) return '#5E6C84';
  if (['cancelled', 'rejected'].some(x => s.includes(x))) return '#C1C7D0';
  if (['blocked', 'impediment'].some(x => s.includes(x))) return '#DE350B';
  return '#5E6C84';
}

export function getPriorityColor(priority: string | undefined): string {
  if (!priority) return '#DFE1E6';
  return PRIORITY_HEX_COLORS[priority] ?? '#6B778C';
}

export function getPriorityBgColor(priority: string | undefined): string {
  if (!priority) return '#F4F5F7';
  const colors: Record<string, string> = {
    Highest: '#FFEBE6', High: '#FFEDE8', Blocker: '#FFEBE6',
    Medium: '#FFF7E6',
    Low: '#E6F0FF', Lowest: '#E6F0FF',
    Minor: '#F4F5F7',
  };
  return colors[priority] ?? '#F4F5F7';
}

// Border color: consistent by issue key (same key = same color)
function getEntryBorderColor(issueKey: string, _projectKey: string): string {
  let hash = 0;
  for (let i = 0; i < issueKey.length; i++) hash = issueKey.charCodeAt(i) + ((hash << 5) - hash);
  return ISSUE_COLOR_PALETTE[Math.abs(hash) % ISSUE_COLOR_PALETTE.length];
}

// Log badge color: red when logged > estimated
export function getLogBadgeColor(logSeconds: number, estSeconds: number): { bg: string; fg: string } {
  if (estSeconds > 0 && logSeconds > estSeconds) return { bg: '#FFEBE6', fg: '#DE350B' };
  return { bg: '#E6F0FF', fg: '#0052CC' };
}

// Duedate color: green when done+past, red when not done+past, blue otherwise
// 20+ distinct colors for group-by lanes (no adjacent similarity)
export const SWIMLANE_PALETTE = [
  '#0052CC', '#36B37E', '#DE350B', '#FF8B00', '#6554C0',
  '#008DA6', '#E774BB', '#FF5630', '#00B8D9', '#5243AA',
  '#BF2600', '#403294', '#006644', '#FF991F', '#172B4D',
  '#505F79', '#253858', '#0065FF', '#FFAB00', '#57D9A3',
  '#FF7452', '#998DD9', '#79E2F2', '#B3BAC5',
];

export function TypeBadge({ typeName, iconUrl }: { typeName: string; iconUrl?: string }) {
  if (iconUrl) {
    return <img src={iconUrl} alt={typeName} className="w-3.5 h-3.5 flex-shrink-0" />;
  }
  return (
    <span className="text-[8px] font-bold px-1 py-0.5 rounded-sm flex-shrink-0 text-white"
      style={{ backgroundColor: ISSUE_TYPE_HEX_COLORS[typeName] ?? '#5E6C84' }}>
      {typeAbbr(typeName)}
    </span>
  );
}

function minutesFromMidnight(dateStr: string): number {
  const d = new Date(dateStr);
  return d.getHours() * 60 + d.getMinutes();
}

// ── Layout computation — only positions entries within visible timeline ──

interface LayoutEntry extends WorklogEntry {
  top: number;
  height: number;
  col: number;
  totalCols: number;
}

function layoutEntries(entries: WorklogEntry[]): LayoutEntry[] {
  if (entries.length === 0) return [];

  const sorted = [...entries].sort((a, b) => {
    const diff = minutesFromMidnight(a.started) - minutesFromMidnight(b.started);
    if (diff !== 0) return diff;
    return b.timeSpentSeconds - a.timeSpentSeconds;
  });

  const positioned = sorted.map((e) => {
    const startMin = minutesFromMidnight(e.started);
    const durationMin = Math.max(e.timeSpentSeconds / 60, 15); // min 15min visual
    // Clamp to visible range
    const visibleStart = Math.max(startMin, START_MINUTES);
    const visibleEnd = Math.min(startMin + durationMin, END_MINUTES);
    const visibleDuration = Math.max(visibleEnd - visibleStart, 15);

    return {
      ...e,
      top: ((visibleStart - START_MINUTES) / MINUTES_PER_SLOT) * SLOT_HEIGHT,
      height: Math.max((visibleDuration / MINUTES_PER_SLOT) * SLOT_HEIGHT, SLOT_HEIGHT * 0.5),
      startMin: visibleStart,
      endMin: visibleEnd,
    };
  });

  const columnEndMins: number[] = [];
  const withCols = positioned.map((e) => {
    let col = 0;
    while (col < columnEndMins.length && columnEndMins[col] > e.startMin) col++;
    if (col === columnEndMins.length) columnEndMins.push(e.endMin);
    else columnEndMins[col] = e.endMin;
    return { ...e, col, totalCols: 0 };
  });

  const totalCols = columnEndMins.length;
  return withCols.map((e) => ({ ...e, totalCols }));
}

// ── Group-by helpers ──

export function getGroupKey(entry: WorklogEntry, field: GroupByField): string {
  switch (field) {
    case 'project': return entry.projectName || entry.projectKey || 'No Project';
    case 'type': return entry.issueTypeName || 'No Type';
    case 'assignee': return entry.author?.displayName || 'Unassigned';
    case 'status': return entry.status || 'No Status';
    case 'priority': return entry.priority || 'No Priority';
    case 'parent': return entry.parentSummary || entry.parentKey || 'No Parent';
    case 'statusCategory': {
      const s = (entry.status || '').toLowerCase();
      if (s === 'done' || s === 'closed' || s === 'resolved' || s === 'completed') return 'Done';
      if (s === 'in progress' || s === 'in review' || s === 'development' || s === 'testing') return 'In Progress';
      if (s === 'open' || s === 'reopened' || s === 'to do' || s === 'new' || !s) return 'To Do';
      return 'To Do';
    }
    case 'sprint': return 'All'; // Not available on WorklogEntry
    // WorklogEntry has no separate reporter field; author is used as best available proxy
    case 'reporter': return entry.author?.displayName || 'Unknown';
    default: return 'All';
  }
}

export interface GroupMeta {
  iconUrl?: string;
  avatarUrl?: string;
  displayName?: string;
  priorityName?: string;
}

export function getGroupMeta(entry: WorklogEntry, field: GroupByField): GroupMeta {
  switch (field) {
    case 'assignee':
    case 'reporter':
      return { avatarUrl: entry.author?.avatarUrls?.['24x24'], displayName: entry.author?.displayName || 'Unknown' };
    case 'type':
      return { iconUrl: entry.issueTypeIconUrl, displayName: entry.issueTypeName };
    case 'parent':
      return { iconUrl: entry.parentIssueTypeIconUrl, displayName: entry.parentIssueTypeName };
    case 'priority':
      return { priorityName: entry.priority };
    default:
      return {};
  }
}

function getEntryColor(entry: WorklogEntry, _groupBy: GroupByField): string {
  return getStatusAccentColor(entry.status);
}

function getEntryBgColor(entry: WorklogEntry): string {
  return getStatusBgColor(entry.status);
}

function getExtraLabel(entry: WorklogEntry, groupBy: GroupByField): string | null {
  if (!groupBy) return null;
  switch (groupBy) {
    case 'project':
      return entry.author?.displayName ?? null;
    case 'assignee':
      return null;
    case 'status':
    case 'type':
    case 'priority':
    case 'parent':
    case 'statusCategory':
      return null;
    default:
      return null;
  }
}

interface EntryGroup {
  key: string;
  label: string;
  entries: WorklogEntry[];
  totalHours: number;
  color: string;
}

function groupEntries(entries: WorklogEntry[], field: GroupByField): EntryGroup[] {
  if (!field) return [];
  const map = new Map<string, { entries: WorklogEntry[]; totalHours: number }>();
  for (const e of entries) {
    const k = getGroupKey(e, field);
    const existing = map.get(k);
    if (existing) {
      existing.entries.push(e);
      existing.totalHours += e.timeSpentSeconds / 3600;
    } else {
      map.set(k, { entries: [e], totalHours: e.timeSpentSeconds / 3600 });
    }
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, val], idx) => ({
      key,
      label: key,
      entries: val.entries,
      totalHours: val.totalHours,
      color: SWIMLANE_PALETTE[idx % SWIMLANE_PALETTE.length],
    }));
}

// ── Draggable timeline entry ──

function DraggableTimelineEntry({
  entry,
  accentColor,
  bgColor,
  style,
  extraLabel,
  editMode,
  onEntryClick,
}: {
  entry: LayoutEntry;
  accentColor: string;
  bgColor: string;
  style: React.CSSProperties;
  extraLabel?: string | null;
  editMode?: boolean;
  onEntryClick?: (e: WorklogEntry) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: entry.id,
    data: { entry },
  });

  const dragStyle: React.CSSProperties = transform
    ? {
        ...style,
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 50,
        opacity: 0.7,
      }
    : style;

  const minHeight = Math.max(
    typeof style.height === 'number' ? style.height : SLOT_HEIGHT,
    SLOT_HEIGHT,
  );

  const textClass = 'text-[#172B4D] dark:text-gray-200';
  const subtitleClass = 'text-[#5E6C84] dark:text-gray-400';
  const smallClass = 'text-[#8993A4] dark:text-gray-500';

  const estH = entry.estSeconds > 0 ? (entry.estSeconds / 3600).toFixed(1) : null;
  const logH = (entry.timeSpentSeconds / 3600).toFixed(1);
  const isTall = entry.height > 50;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        'absolute rounded-sm cursor-grab active:cursor-grabbing hover:brightness-110 transition-all group overflow-hidden',
        'border border-[#DFE1E6] dark:border-gray-600',
        'bg-white dark:bg-gray-800',
        isDragging ? 'opacity-50 shadow-2xl z-50' : 'z-10',
      )}
      style={{ ...dragStyle, backgroundColor: bgColor, borderLeftColor: accentColor, borderLeftWidth: '3px', minHeight }}
      onClick={(ev) => {
        ev.stopPropagation();
        onEntryClick?.(entry);
      }}
      title={`${entry.issueKey}: ${entry.comment || entry.issueSummary} (${logH}h)`}
    >
      <div className="px-2 py-1.5 flex flex-col h-full gap-[2px]" style={{ fontSize: '12px', lineHeight: '1.3' }}>
        {/* Row 1: left=type+key+project, right=status */}
        <div className="flex items-center gap-1.5 min-w-0">
          <TypeBadge typeName={entry.issueTypeName} iconUrl={entry.issueTypeIconUrl} />
          <span className={cn('font-semibold truncate flex-1', textClass)}>{entry.issueKey}</span>
          <span className={cn('text-[10px] truncate flex-shrink-0', smallClass)}>{entry.projectKey}</span>
          {entry.status && (
            <span className="text-[9px] px-1.5 py-[1px] rounded font-medium shrink-0"
              style={{
                backgroundColor: getStatusBgColor(entry.status),
                color: getStatusColor(entry.status),
              }}
            >{entry.status}</span>
          )}
        </div>

        {/* Row 2: summary */}
        <p className={cn('text-[10px] leading-relaxed', subtitleClass)}>{entry.issueSummary}</p>

        {/* Row 3: left=create+due, right=est+log(colored) */}
        <div className="flex items-center justify-between text-[9px]">
          <div className="flex items-center gap-2" style={{ color: '#8993A4' }}>
            <span className="inline-flex items-center gap-0.5">
              <Clock size={8} />{format(new Date(entry.started), 'dd/MM')}
            </span>
            {entry.duedate && (
              <span className="inline-flex items-center gap-0.5 font-medium" style={{ color: getDuedateColor(entry.status, entry.duedate) }}>
                <Calendar size={8} />{format(new Date(entry.duedate + 'T12:00:00'), 'dd/MM')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {estH != null && <span className={smallClass}>⏱{estH}h</span>}
            <span className="font-bold px-1.5 py-[1px] rounded text-[10px]" style={{ backgroundColor: getLogBadgeColor(entry.timeSpentSeconds, entry.estSeconds).bg, color: getLogBadgeColor(entry.timeSpentSeconds, entry.estSeconds).fg }}>{logH}h</span>
          </div>
        </div>

        {extraLabel && (
          <div className={cn('text-[9px] truncate leading-tight', subtitleClass)}>
            {extraLabel}
          </div>
        )}

        {/* Row 4: left=priority(colored text), right=edit */}
        <div className="flex items-center justify-between mt-auto pt-[2px]">
          <div className="flex items-center gap-1.5">
            {entry.priority && (
              <span className="text-[9px] px-2 py-[2px] rounded font-medium" style={{ backgroundColor: getPriorityBgColor(entry.priority), color: getPriorityColor(entry.priority) }}>
                {entry.priority}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {editMode && (
              <button
                className="opacity-60 hover:opacity-100 transition-opacity bg-white/70 dark:bg-gray-700 rounded-sm p-1 -mr-0.5 border border-[#DFE1E6] dark:border-gray-600"
                onPointerDown={(ev) => ev.stopPropagation()}
                onClick={(ev) => { ev.stopPropagation(); onEntryClick?.(entry); }}
                title="Edit worklog"
              >
                <Pencil size={10} className="text-[#5E6C84]" />
              </button>
            )}
          </div>
        </div>

        {/* Comment — only if tall enough and not the same as summary */}
        {isTall && entry.comment && entry.comment !== entry.issueSummary && (
          <p className={cn('text-[9px] truncate leading-tight mt-[1px]', smallClass)}>{entry.comment}</p>
        )}
      </div>
    </div>
  );
}

// ── Main component ──

interface WorklogDayCellProps {
  date: Date;
  entries: WorklogEntry[];
  dailyHours: number;
  isCurrentMonth?: boolean;
  compact?: boolean;
  showRequirement?: boolean;
  isDragActive?: boolean;
  isDragSource?: boolean;
  groupBy?: GroupByField;
  editMode?: boolean;
  onEntryClick?: (entry: WorklogEntry) => void;
  onDayClick?: (date: Date) => void;
}

export function WorklogDayCell({
  date,
  entries,
  dailyHours,
  isCurrentMonth = true,
  compact = false,
  showRequirement = true,
  isDragActive = false,
  isDragSource = false,
  groupBy = null,
  editMode = false,
  onEntryClick,
  onDayClick,
}: WorklogDayCellProps) {
  const key = format(date, 'yyyy-MM-dd');
  const { setNodeRef } = useDroppable({ id: key });
  const weekend = isWeekend(date);
  const todayFlag = isToday(date);
  const isWeekday = !weekend;
  const hours = dailyHours > 0 ? dailyHours.toFixed(1) : '';

  const isComplete = isWeekday && dailyHours >= 8 && showRequirement;
  const isUnder = isWeekday && dailyHours > 0 && dailyHours < 8 && showRequirement;
  const isEmpty = isWeekday && dailyHours === 0 && showRequirement;
  const isOverHours = dailyHours > 8;

  const laidOutEntries = useMemo(() => layoutEntries(entries), [entries]);
  const groups = useMemo(() => groupEntries(entries, groupBy), [entries, groupBy]);

  // ── Compact (month mode): simple list (no timeline) ──

  if (compact) {
    const compactProgressPct = Math.min((dailyHours / 8) * 100, 100);
    const compactProgressColor = isComplete ? '#36B37E' : isUnder ? '#FFAB00' : isEmpty ? '#DE350B' : '#0052CC';

    return (
      <div
        ref={setNodeRef}
        className={cn(
          'flex flex-col border border-[#DFE1E6] dark:border-gray-700 bg-white dark:bg-gray-800/50 min-h-0 transition-colors',
          compact ? 'p-0' : 'p-1.5 min-h-[80px]',
          todayFlag && 'bg-[#DEEBFF] dark:bg-blue-900/20 border-[#0052CC] dark:border-blue-500',
          !isCurrentMonth && 'opacity-40 bg-[#F4F5F7] dark:bg-gray-900/50',
          isDragSource && 'bg-red-50 dark:bg-red-900/10 border-red-300 dark:border-red-700',
          isDragActive && !isDragSource && 'opacity-60',
        )}
        onClick={() => onDayClick?.(date)}
      >
        <div
          className={cn(
            'flex items-center justify-between flex-shrink-0',
            compact ? 'px-1 py-0.5 text-[10px]' : 'px-1.5 py-1 text-xs',
          )}
        >
          <span
            className={cn(
              'font-semibold',
              todayFlag
                ? 'text-[#0052CC] dark:text-blue-400'
                : 'text-[#172B4D] dark:text-gray-200',
            )}
          >
            {compact ? format(date, 'd') : format(date, 'EEE d')}
          </span>
          {isWeekday && showRequirement && (
            <span
              className={cn(
                'text-[10px] font-medium flex items-center gap-0.5',
                isComplete && 'text-green-600 dark:text-green-400',
                isOverHours && 'text-blue-600 dark:text-blue-400',
                isUnder && 'text-amber-600 dark:text-amber-400',
                isEmpty && 'text-red-500 dark:text-red-400',
                !isComplete && !isOverHours && !isUnder && !isEmpty && 'text-[#5E6C84] dark:text-gray-400',
              )}
            >
              {isComplete && <span className="text-[9px] mr-0.5">✓</span>}
              {isEmpty && <span className="text-[9px] mr-0.5">!</span>}
              {isUnder && <span className="text-[9px] mr-0.5">◷</span>}
              {hours}h / 8h
            </span>
          )}
          {!isWeekday && hours && (
            <span className="text-[10px] text-[#5E6C84] dark:text-gray-400">
              {hours}h
            </span>
          )}
        </div>
        {/* Progress bar for compact mode */}
        {compact && isWeekday && (
          <div className="h-1.5 bg-[#F4F5F7] dark:bg-gray-700 flex-shrink-0">
            <div className="h-full transition-all duration-300 rounded-r-sm"
              style={{ width: `${compactProgressPct}%`, backgroundColor: compactProgressColor, minWidth: dailyHours > 0 ? '2px' : '0' }} />
          </div>
        )}
        <div
          className={cn(
            'flex-1 space-y-0.5',
            compact ? 'overflow-hidden px-1 py-0.5' : 'overflow-y-auto max-h-full',
          )}
        >
          {groupBy && groups.length > 0 ? (
            groups.map((g) => (
              <div key={g.key} className="space-y-0.5">
                <div className="flex items-center gap-1.5 px-0.5 py-0.5">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: g.color }} />
                  <span className="text-[10px] font-semibold text-[#172B4D] dark:text-gray-200 truncate leading-tight">{g.label}</span>
                  <span className="text-[9px] text-[#5E6C84] dark:text-gray-400 ml-auto flex-shrink-0 font-medium">{g.totalHours.toFixed(1)}h</span>
                </div>
                {g.entries.slice(0, compact ? 10 : 5).map((e) => {
                  const estH = e.estSeconds > 0 ? (e.estSeconds / 3600).toFixed(1) : null;
                  const logH = (e.timeSpentSeconds / 3600).toFixed(1);
                  const logColor = getLogBadgeColor(e.timeSpentSeconds, e.estSeconds);
                  return (
                <div
                  key={e.id}
                  className="px-3 py-2 text-[12px] bg-white dark:bg-gray-800 border border-[#DFE1E6] dark:border-gray-700 rounded-sm cursor-pointer hover:shadow-sm transition-all group relative"
                  style={{ borderLeftColor: getEntryBorderColor(e.issueKey, e.projectKey), borderLeftWidth: '3px' }}
                  onClick={(ev) => { ev.stopPropagation(); onEntryClick?.(e); }}
                >
                  {/* Row 1: left=type+key+project, right=status */}
                  <div className="flex items-center gap-2 mb-[5px]">
                    <TypeBadge typeName={e.issueTypeName} iconUrl={e.issueTypeIconUrl} />
                    <span className="font-semibold text-[#172B4D] dark:text-gray-100 truncate">{e.issueKey}</span>
                    <span className="text-[11px] text-[#8993A4] dark:text-gray-500 truncate flex-shrink-0">{e.projectKey}</span>
                    <div className="flex-1" />
                    {e.status && (
                      <span
                        className="text-[10px] px-2 py-[1px] rounded font-medium shrink-0"
                        style={{
                          backgroundColor: getStatusBgColor(e.status),
                          color: getStatusColor(e.status),
                        }}
                      >{e.status}</span>
                    )}
                  </div>
                  {/* Row 2: summary */}
                  <p className="text-[11px] text-[#5E6C84] dark:text-gray-400 leading-relaxed mb-[5px]">{e.issueSummary}</p>
                  {/* Row 3: left=create+due, right=est+log(colored) */}
                  <div className="flex items-center justify-between text-[10px] mb-[3px]">
                    <div className="flex items-center gap-2.5 text-[#8993A4] dark:text-gray-500">
                      <span className="inline-flex items-center gap-1">
                        <Clock size={10} />{format(new Date(e.started), 'dd/MM')}
                      </span>
                      {e.duedate && (
                        <span className="inline-flex items-center gap-1 font-medium" style={{ color: getDuedateColor(e.status, e.duedate) }}>
                          <Calendar size={10} />{format(new Date(e.duedate + 'T12:00:00'), 'dd/MM')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2.5">
                      {estH != null && <span className="text-[#8993A4] dark:text-gray-500">⏱ {estH}h</span>}
                      <span className="font-bold px-1.5 py-[1px] rounded text-[11px]" style={{ backgroundColor: logColor.bg, color: logColor.fg }}>{logH}h</span>
                    </div>
                  </div>
                  {/* Row 4: left=priority(colored text), right=edit */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      {e.priority && (
                        <span className="text-[10px] px-2 py-[2px] rounded font-medium" style={{ backgroundColor: getPriorityBgColor(e.priority), color: getPriorityColor(e.priority) }}>
                          {e.priority}
                        </span>
                      )}
                    </div>
                    {editMode && (
                      <button
                        className="opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-gray-700 rounded border border-[#DFE1E6] dark:border-gray-600 p-1 shadow-sm hover:bg-[#F4F5F7] dark:hover:bg-gray-600"
                        onPointerDown={(ev) => ev.stopPropagation()}
                        onClick={(ev) => { ev.stopPropagation(); onEntryClick?.(e); }}
                        title="Edit worklog"
                      ><Pencil size={10} className="text-[#5E6C84]" /></button>
                    )}
                  </div>
                </div>
                );})}
                {g.entries.length > (compact ? 15 : 5) && (
                  <p className="text-[10px] text-[#0052CC] dark:text-blue-400 px-0.5">+{g.entries.length - (compact ? 15 : 5)} more</p>
                )}
              </div>
            ))
          ) : (<>
            {entries.slice(0, compact ? 30 : 10).map((e) => {
              const estH = e.estSeconds > 0 ? (e.estSeconds / 3600).toFixed(1) : null;
              const logH = (e.timeSpentSeconds / 3600).toFixed(1);
              const logColor = getLogBadgeColor(e.timeSpentSeconds, e.estSeconds);
              return (
            <div
              key={e.id}
              className="px-3 py-2 text-[12px] bg-white dark:bg-gray-800 border border-[#DFE1E6] dark:border-gray-700 rounded-sm cursor-pointer hover:shadow-sm transition-all group relative"
              style={{ borderLeftColor: getEntryBorderColor(e.issueKey, e.projectKey), borderLeftWidth: '3px' }}
              onClick={(ev) => {
                ev.stopPropagation();
                onEntryClick?.(e);
              }}
            >
              {/* Row 1: left=type+key+project, right=status */}
              <div className="flex items-center gap-2 mb-[5px]">
                <TypeBadge typeName={e.issueTypeName} iconUrl={e.issueTypeIconUrl} />
                <span className="font-semibold text-[#172B4D] dark:text-gray-100 truncate">{e.issueKey}</span>
                <span className="text-[11px] text-[#8993A4] dark:text-gray-500 truncate flex-shrink-0">{e.projectKey}</span>
                <div className="flex-1" />
                {e.status && (
                  <span
                    className="text-[10px] px-2 py-[1px] rounded font-medium shrink-0"
                    style={{
                      backgroundColor: getStatusBgColor(e.status),
                      color: getStatusColor(e.status),
                    }}
                  >{e.status}</span>
                )}
              </div>
              {/* Row 2: summary */}
              <p className="text-[11px] text-[#5E6C84] dark:text-gray-400 leading-relaxed mb-[5px]">{e.issueSummary}</p>
              {/* Row 3: left=create+due, right=est+log(colored) */}
              <div className="flex items-center justify-between text-[10px] mb-[3px]">
                <div className="flex items-center gap-2.5 text-[#8993A4] dark:text-gray-500">
                  <span className="inline-flex items-center gap-1">
                    <Clock size={10} />{format(new Date(e.started), 'dd/MM')}
                  </span>
                  {e.duedate && (
                    <span className="inline-flex items-center gap-1 font-medium" style={{ color: getDuedateColor(e.status, e.duedate) }}>
                      <Calendar size={10} />{format(new Date(e.duedate + 'T12:00:00'), 'dd/MM')}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2.5">
                  {estH != null && <span className="text-[#8993A4] dark:text-gray-500">⏱ {estH}h</span>}
                  <span className="font-bold px-1.5 py-[1px] rounded text-[11px]" style={{ backgroundColor: logColor.bg, color: logColor.fg }}>{logH}h</span>
                </div>
              </div>
              {/* Row 4: left=priority(colored text), right=edit */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  {e.priority && (
                    <span className="text-[10px] px-2 py-[2px] rounded font-medium" style={{ backgroundColor: getPriorityBgColor(e.priority), color: getPriorityColor(e.priority) }}>
                      {e.priority}
                    </span>
                  )}
                </div>
                {editMode && (
                  <button
                    className="opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-gray-700 rounded border border-[#DFE1E6] dark:border-gray-600 p-1 shadow-sm hover:bg-[#F4F5F7] dark:hover:bg-gray-600"
                    onPointerDown={(ev) => ev.stopPropagation()}
                    onClick={(ev) => { ev.stopPropagation(); onEntryClick?.(e); }}
                    title="Edit worklog"
                  ><Pencil size={10} className="text-[#5E6C84]" /></button>
                )}
              </div>
            </div>
            );})}
          {!compact && !groupBy && entries.length > 10 && (
            <p className="text-[10px] text-[#0052CC] dark:text-blue-400 pl-1">
              +{entries.length - (compact ? 3 : 10)} more
            </p>
          )}
          </>)}
        </div>
      </div>
    );
  }

  // ── Weekday (non-compact): timeline view — no scroll, working hours only ──
  const progressPct = Math.min((dailyHours / 8) * 100, 100);
  const progressColor = isComplete ? '#36B37E' : isUnder ? '#FFAB00' : isEmpty ? '#DE350B' : '#0052CC';

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col border border-[#DFE1E6] dark:border-gray-700 bg-white dark:bg-gray-800/50 min-h-0 relative transition-colors',
        todayFlag && 'bg-[#DEEBFF] dark:bg-blue-900/20 border-[#0052CC] dark:border-blue-500',
        !isCurrentMonth && 'opacity-40',
        isOverHours && 'bg-[#DEEBFF]/10 dark:bg-blue-900/10',
        // Drag visuals
        isDragSource && 'bg-red-50 dark:bg-red-900/10 border-red-300 dark:border-red-700',
        isDragActive && !isDragSource && 'opacity-60',
      )}
      onClick={() => onDayClick?.(date)}
    >
      {/* Header with progress bar */}
      <div className="flex-shrink-0 bg-white dark:bg-gray-800 z-10">
        <div className="flex items-center justify-between px-1.5 py-1 border-b border-[#DFE1E6] dark:border-gray-700">
          <span className={cn('text-xs font-semibold',
            todayFlag ? 'text-[#0052CC] dark:text-blue-400' : 'text-[#172B4D] dark:text-gray-200')}>
            {format(date, 'EEE d')}
          </span>
          <span className={cn('text-[10px] font-medium',
            isComplete ? 'text-green-600 dark:text-green-400' :
            isOverHours ? 'text-blue-600 dark:text-blue-400' :
            isUnder ? 'text-amber-600 dark:text-amber-400' :
            'text-red-500 dark:text-red-400')}>
            {hours ? `${hours}h` : '0h'} / 8h
          </span>
        </div>
        {/* Progress bar */}
        <div className="h-2 bg-[#F4F5F7] dark:bg-gray-700">
          <div
            className="h-full transition-all duration-300 rounded-r-sm"
            style={{ width: `${progressPct}%`, backgroundColor: progressColor, minWidth: dailyHours > 0 ? '2px' : '0' }}
          />
        </div>
      </div>

      {/* Group-by summary bar */}
      {groupBy && groups.length > 0 && (
        <div className="flex-shrink-0 px-1.5 py-1 border-b border-[#DFE1E6] dark:border-gray-700 bg-[#FAFBFC] dark:bg-gray-800 flex flex-col gap-1">
          <div className="flex items-center gap-1 flex-wrap">
            <Layers size={10} className="text-[#8993A4] dark:text-gray-500 flex-shrink-0" />
            {groups.map((g) => (
              <span
                key={g.key}
                className="text-[9px] px-1.5 py-0.5 rounded-full text-white font-medium flex items-center gap-1"
                style={{ backgroundColor: g.color }}
              >
                {g.label.length > 12 ? g.label.slice(0, 12) + '…' : g.label}
                <span className="opacity-80">{g.totalHours.toFixed(1)}h</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="flex-1 relative" style={{ minHeight: TIMELINE_HEIGHT }}>
        <div className="relative" style={{ height: TIMELINE_HEIGHT }}>
          {/* Slot backgrounds */}
          {Array.from({ length: VISIBLE_SLOTS }).map((_, i) => {
            const minutes = START_MINUTES + i * MINUTES_PER_SLOT;
            const hour = Math.floor(minutes / 60);
            const isHour = minutes % 60 === 0;
            const isLunch = minutes >= LUNCH_START && minutes < LUNCH_END;

              return (
              <div
                key={i}
                className={cn(
                  'absolute left-0 right-0 border-t',
                  isHour
                    ? 'border-[#C1C7D0] dark:border-gray-600'
                    : 'border-dashed border-[#F4F5F7] dark:border-gray-700/50',
                  isLunch && 'bg-[#FFF7E6] dark:bg-amber-900/5',
                )}
                style={{ top: i * SLOT_HEIGHT, height: SLOT_HEIGHT }}
              >
                {isHour && (
                  <span className="absolute left-1 top-0 text-[9px] text-[#8993A4] dark:text-gray-500 leading-none pt-0.5 select-none">
                    {String(hour).padStart(2, '0')}:00
                  </span>
                )}
                {!isHour && (
                  <span className="absolute left-1 top-0 text-[8px] text-[#C1C7D0] dark:text-gray-600 leading-none pt-0.5 select-none">
                    {String(hour).padStart(2, '0')}:{String(minutes % 60).padStart(2, '0')}
                  </span>
                )}
              </div>
            );
          })}

          {/* Entry overlay */}
          {laidOutEntries.length > 0 && (
            <div style={{ position: 'absolute', top: 0, left: '38px', right: '2px', bottom: 0 }}>
              {laidOutEntries.map((e) => {
                const accentColor = getEntryBorderColor(e.issueKey, e.projectKey);
                const bgColor = getStatusBgColor(e.status);
                const extraLabel = getExtraLabel(e, groupBy);
                const entryHeight = Math.max(e.height - 2, SLOT_HEIGHT * 0.5);

                return (
                  <DraggableTimelineEntry
                    key={e.id}
                    entry={e}
                    accentColor={accentColor}
                    bgColor={bgColor}
                    extraLabel={extraLabel}
                    editMode={editMode}
                    style={{
                      position: 'absolute',
                      top: e.top,
                      left: `${(e.col / e.totalCols) * 100}%`,
                      width: `${Math.max((1 / e.totalCols) * 100 - 1, 5)}%`,
                      height: entryHeight,
                    }}
                    onEntryClick={onEntryClick}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
