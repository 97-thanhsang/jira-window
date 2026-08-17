'use client';
import { useMemo, useState } from 'react';
import { format, isToday } from 'date-fns';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Settings2, ChevronDown, ExternalLink } from 'lucide-react';
import { Pencil, Save } from 'lucide-react';
import { TeamExport } from './team-export';
import { IssueDetailPanel } from '@/components/issues/issue-detail-panel';
import { StatusEditor, InlineTextEditor, DateEditor, EstEditor } from './inline-editors';
import { SaveConfirmModal, type EditEntry } from './save-confirm-modal';
import type { TeamReportData, TaskReport } from '@/types/jira';
import type { TeamFiltersState } from '@/components/team/team-filters';

interface TeamReportTableProps {
  data: TeamReportData;
  filters: TeamFiltersState;
}

function getHourClass(seconds: number): string {
  if (seconds >= 28800) return 'text-[#36B37E] dark:text-green-400 font-semibold';
  if (seconds > 0) return 'text-[#172B4D] dark:text-gray-200';
  return 'text-[#C1C7D0] dark:text-gray-600';
}

function getDayBgClass(seconds: number, dateStr: string): string {
  const date = new Date(dateStr);
  const day = date.getDay();
  if (day === 0 || day === 6) return '';
  if (seconds >= 28800) return 'bg-green-50 dark:bg-green-900/10';
  if (seconds > 0) return 'bg-amber-50 dark:bg-amber-900/10';
  const today = new Date(new Date().toDateString());
  return date < today ? 'bg-red-50 dark:bg-red-900/10' : '';
}

function formatCellHours(seconds: number): string {
  if (seconds === 0) return '-';
  const h = seconds / 3600;
  return `${h % 1 === 0 ? h.toFixed(0) : h.toFixed(1)}h`;
}

function formatDueDate(d: string | undefined): string {
  if (!d) return '-';
  return format(new Date(d), 'dd/MM');
}

const PROJECT_PALETTE = [
  '#0052CC', '#36B37E', '#DE350B', '#FF8B00', '#6554C0',
  '#008DA6', '#E774BB', '#FF5630', '#00B8D9', '#8777D9',
  '#253858', '#57D9A3', '#FFAB00', '#4C9AFF', '#97A0AF',
];

function projectColor(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = key.charCodeAt(i) + ((hash << 5) - hash);
  return PROJECT_PALETTE[Math.abs(hash) % PROJECT_PALETTE.length];
}

function matchesMulti(values: string[] | undefined, exclude: boolean | undefined, actual: string): boolean {
  if (!values || values.length === 0) return true;
  const inList = values.includes(actual);
  return exclude ? !inList : inList;
}

function filterTask(task: TaskReport, filters: TeamFiltersState): boolean {
  if (!matchesMulti(filters.projectIn, filters.projectExclude, task.projectKey)) return false;
  if (!matchesMulti(filters.statusIn, filters.statusExclude, task.status ?? '')) return false;
  if (!matchesMulti(filters.priorityIn, filters.priorityExclude, task.priority ?? '')) return false;
  if (!matchesMulti(filters.issuetypeIn, filters.issuetypeExclude, task.issueTypeName ?? '')) return false;

  if (filters.filterStatus && task.status !== filters.filterStatus) return false;
  if (filters.filterPriority && task.priority !== filters.filterPriority) return false;
  if (filters.filterType && task.issueTypeName !== filters.filterType) return false;

  if (filters.filterDueDate) {
    if (!task.duedate) return false;
    const due = new Date(task.duedate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (filters.filterDueDate === 'overdue') {
      if (due >= today) return false;
    } else if (filters.filterDueDate === 'today') {
      if (due.toDateString() !== today.toDateString()) return false;
    } else if (filters.filterDueDate === 'this-week') {
      const weekEnd = new Date(today);
      weekEnd.setDate(today.getDate() + (7 - today.getDay()));
      if (due > weekEnd || due < today) return false;
    }
  }

  if (filters.filterHasLog === 'has-log' && task.totalLoggedSeconds === 0) return false;
  if (filters.filterHasLog === 'no-log' && task.totalLoggedSeconds > 0) return false;

  return true;
}

/** Classify a task status into 3 buckets: todo / in-progress / done */
function classifyStatus(status: string | undefined): 'todo' | 'in-progress' | 'done' {
  const s = (status ?? '').toLowerCase();
  if (['done', 'resolved', 'closed'].some(k => s.includes(k))) return 'done';
  if (['progress', 'develop', 'review', 'qa', 'testing', 'verify'].some(k => s.includes(k))) return 'in-progress';
  return 'todo';
}

/** Check if task is overdue: duedate passed AND not done */
function isOverdue(task: TaskReport): boolean {
  if (!task.duedate) return false;
  const today = new Date(new Date().toDateString());
  const due = new Date(task.duedate);
  return due < today && classifyStatus(task.status) !== 'done';
}

/** Row background for missing critical info */
function getMissingInfoClass(task: TaskReport): string {
  const hasDue = !!task.duedate;
  const hasEst = task.estSeconds > 0;
  if (!hasDue && !hasEst) return 'bg-red-50 dark:bg-red-900/20 border-l-2 border-l-[#DE350B]';
  if (!hasDue) return 'bg-amber-50 dark:bg-amber-900/15 border-l-2 border-l-[#FF8B00]';
  if (!hasEst) return 'bg-blue-50 dark:bg-blue-900/10 border-l-2 border-l-[#0052CC]';
  return '';
}

const SORT_OPTIONS = [
  { value: 'default', label: 'Default' },
  { value: 'due-asc', label: 'Due date ↑' },
  { value: 'due-desc', label: 'Due date ↓' },
  { value: 'est-asc', label: 'Estimate ↑' },
  { value: 'est-desc', label: 'Estimate ↓' },
] as const;

type SortBy = (typeof SORT_OPTIONS)[number]['value'];

// Stats table column config
interface StatCol { key: string; label: string; color: string; }
const STAT_COLS: StatCol[] = [
  { key: 'taskCount', label: 'Tasks', color: '#5E6C84' },
  { key: 'totalEst', label: 'Est', color: '#172B4D' },
  { key: 'totalLogged', label: 'Logged', color: '#36B37E' },
  { key: 'overdue', label: 'Overdue', color: '#DE350B' },
  { key: 'noEst', label: 'No Est', color: '#FF8B00' },
  { key: 'todo', label: 'Todo', color: '#5E6C84' },
  { key: 'inProgress', label: 'In Prog', color: '#0052CC' },
  { key: 'done', label: 'Done', color: '#36B37E' },
];

export function TeamReportTable({ data, filters }: TeamReportTableProps) {
  const [configOpen, setConfigOpen] = useState(false);
  const [showWeekends, setShowWeekends] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    project: true, tasktype: true, key: true, summary: true, est: true, status: true, duedate: true,
  });
  const [panelIssueKey, setPanelIssueKey] = useState<string | null>(null);
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(
    () => new Set(data.users.map(u => u.username)),
  );
  const [sortBy, setSortBy] = useState<SortBy>('default');
  const [localSearch, setLocalSearch] = useState('');

  // ── Inline Edit State ──────────────────────────────────────────────────
  const [editMode, setEditMode] = useState(false);
  const [edits, setEdits] = useState<EditEntry[]>([]);
  const [editingKey, setEditingKey] = useState<string | null>(null); // "ISSUE-KEY:field"
  const [showConfirm, setShowConfirm] = useState(false);

  /** Check if a cell has a pending edit */
  function hasEdit(issueKey: string, field: EditEntry['field']) {
    return edits.some((e) => e.issueKey === issueKey && e.field === field);
  }

  /** Get CSS class for an edited cell */
  function getEditClass(issueKey: string, field: EditEntry['field']) {
    return hasEdit(issueKey, field)
      ? 'bg-amber-50 dark:bg-amber-900/20 ring-1 ring-inset ring-amber-400'
      : '';
  }

  /** Add or update an edit entry */
  function addEdit(entry: EditEntry) {
    setEdits((prev) => {
      const filtered = prev.filter(
        (e) => !(e.issueKey === entry.issueKey && e.field === entry.field),
      );
      return [...filtered, entry];
    });
    setEditingKey(null);
  }

  /** Start editing a cell */
  function startEdit(key: string) {
    setEditingKey(key);
  }

  /** Cancel current edit */
  function cancelEdit() {
    setEditingKey(null);
  }

  /** Called after save completes — clear edits and refresh */
  function handleSaved() {
    setEdits([]);
    setEditMode(false);
    setShowConfirm(false);
    // SWR will revalidate automatically on focus, or we can trigger manually
  }

  const days = useMemo(() => {
    const result: string[] = [];
    const from = new Date(data.dateRange.from);
    const to = new Date(data.dateRange.to);
    const cur = new Date(from);
    while (cur <= to) {
      const day = cur.getDay();
      if (showWeekends || (day !== 0 && day !== 6)) {
        result.push(format(cur, 'yyyy-MM-dd'));
      }
      cur.setDate(cur.getDate() + 1);
    }
    return result;
  }, [data.dateRange, showWeekends]);

  const dayHeaders = useMemo(() => days.map((d) => ({
    key: d,
    dayName: format(new Date(d), 'EEE'),
    dateStr: format(new Date(d), 'dd/MM'),
    isToday: isToday(new Date(d)),
  })), [days]);

  const toggleUser = (username: string) => {
    setExpandedUsers(prev => {
      const next = new Set(prev);
      if (next.has(username)) next.delete(username);
      else next.add(username);
      return next;
    });
  };

  if (data.users.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-[#5E6C84] dark:text-gray-400">
          No team members to display. Select a group or add members.
        </p>
      </div>
    );
  }

  const selectClass = 'text-xs border border-[#DFE1E6] dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-[#172B4D] dark:text-gray-100 focus:outline-none focus:border-[#0052CC]';

  return (
    <div className="space-y-3">
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2">
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
          className={cn(selectClass, 'w-28')}
        >
          {SORT_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <input
          type="text"
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          placeholder="Search key or summary..."
          className={cn(selectClass, 'flex-1 max-w-xs placeholder:text-[#C1C7D0] dark:placeholder:text-gray-600')}
        />
        <div className="flex-1" />

        {/* VIEW / EDIT toggle */}
        <div className="flex items-center rounded border border-[#DFE1E6] dark:border-gray-600 overflow-hidden">
          <button
            onClick={() => setEditMode(false)}
            className={cn(
              'text-xs px-3 py-1.5 font-medium transition-colors border-r border-[#DFE1E6] dark:border-gray-600',
              !editMode
                ? 'bg-[#0052CC] text-white'
                : 'bg-white dark:bg-gray-800 text-[#5E6C84] dark:text-gray-400 hover:bg-[#F4F5F7] dark:hover:bg-gray-700',
            )}
          >
            VIEW
          </button>
          <button
            onClick={() => setEditMode(true)}
            className={cn(
              'text-xs px-3 py-1.5 font-medium transition-colors',
              editMode
                ? 'bg-[#DE350B] text-white'
                : 'bg-white dark:bg-gray-800 text-[#5E6C84] dark:text-gray-400 hover:bg-[#F4F5F7] dark:hover:bg-gray-700',
            )}
          >
            <span className="flex items-center gap-1">
              <Pencil size={10} />
              EDIT
            </span>
          </button>
        </div>

        {/* Save button — only visible in edit mode with pending edits */}
        {editMode && edits.length > 0 && (
          <button
            onClick={() => setShowConfirm(true)}
            className="text-xs px-2 py-1 rounded border transition-colors flex items-center gap-1 bg-[#36B37E] text-white border-[#36B37E] hover:bg-green-600"
          >
            <Save size={12} />
            Save ({edits.length})
          </button>
        )}

        <TeamExport
          data={data}
          dayHeaders={dayHeaders}
          visibleColumns={visibleColumns}
          showWeekends={showWeekends}
        />
        <div className="relative">
          <button
            onClick={() => setConfigOpen(!configOpen)}
            className={cn(
              'text-xs px-2 py-1 rounded border transition-colors flex items-center gap-1',
              configOpen
                ? 'bg-[#0052CC] text-white border-[#0052CC]'
                : 'border-[#DFE1E6] dark:border-gray-600 text-[#5E6C84] dark:text-gray-400 hover:bg-[#F4F5F7] dark:hover:bg-gray-800',
            )}
          >
            <Settings2 size={12} />
            Config Grid
          </button>

          {configOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setConfigOpen(false)} />
              <div className="absolute top-full right-0 mt-1 w-56 bg-white dark:bg-gray-800 border border-[#DFE1E6] dark:border-gray-600 rounded shadow-lg z-40 p-3">
                <p className="text-[10px] font-semibold text-[#5E6C84] dark:text-gray-400 uppercase tracking-wider mb-2">Visible Columns</p>
                {([
                  ['project', 'Project'],
                  ['tasktype', 'Task Type (parent)'],
                  ['key', 'Task Key'],
                  ['summary', 'Summary'],
                  ['est', 'Estimate'],
                  ['status', 'Status'],
                  ['duedate', 'Due Date'],
                ] as const).map(([col, label]) => (
                  <label key={col} className="flex items-center gap-2 py-1.5 px-1 rounded hover:bg-[#F4F5F7] dark:hover:bg-gray-700 cursor-pointer text-xs text-[#172B4D] dark:text-gray-200">
                    <input
                      type="checkbox"
                      checked={visibleColumns[col]}
                      onChange={() => setVisibleColumns(prev => ({ ...prev, [col]: !prev[col] }))}
                      className="w-3 h-3 accent-[#0052CC]"
                    />
                    {label}
                  </label>
                ))}
                <div className="border-t border-[#DFE1E6] dark:border-gray-700 my-1.5" />
                <label className="flex items-center gap-2 py-1.5 px-1 rounded hover:bg-[#F4F5F7] dark:hover:bg-gray-700 cursor-pointer text-xs text-[#172B4D] dark:text-gray-200">
                  <input type="checkbox" checked={showWeekends}
                    onChange={() => setShowWeekends(prev => !prev)}
                    className="w-3 h-3 accent-[#0052CC]" />
                  Show Sat/Sun
                </label>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── User Sections ── */}
      <div className="space-y-4 min-w-max">
      {data.users.map((rawUser) => {
        // Apply all filters per user
        let tasks = rawUser.tasks.filter(t => filterTask(t, filters));

        if (localSearch) {
          const q = localSearch.toLowerCase();
          tasks = tasks.filter(t => t.issueKey.toLowerCase().includes(q) || t.summary.toLowerCase().includes(q));
        }

        // Sort tasks — always by project first, then optionally by parent
        tasks = [...tasks];
        const projectThenSort = (a: TaskReport, b: TaskReport) => {
          if (a.projectKey !== b.projectKey) return a.projectKey.localeCompare(b.projectKey);
          // When tasktype column is on, secondary sort by parentKey for visual grouping
          if (visibleColumns.tasktype) {
            const aP = a.parentKey ?? '';
            const bP = b.parentKey ?? '';
            if (aP !== bP) return aP.localeCompare(bP);
          }
          if (sortBy === 'due-asc') {
            if (!a.duedate && !b.duedate) return 0;
            if (!a.duedate) return 1;
            if (!b.duedate) return -1;
            return a.duedate.localeCompare(b.duedate);
          }
          if (sortBy === 'due-desc') {
            if (!a.duedate && !b.duedate) return 0;
            if (!a.duedate) return 1;
            if (!b.duedate) return -1;
            return b.duedate.localeCompare(a.duedate);
          }
          if (sortBy === 'est-asc') return a.estSeconds - b.estSeconds;
          if (sortBy === 'est-desc') return b.estSeconds - a.estSeconds;
          return b.estSeconds - a.estSeconds;
        };
        tasks.sort(projectThenSort);

        if (tasks.length === 0) return null;

        // Hide user if searchText (from filters) doesn't match
        if (filters.searchText) {
          const q = filters.searchText.toLowerCase();
          if (!rawUser.username.toLowerCase().includes(q) && !rawUser.displayName.toLowerCase().includes(q)) {
            return null;
          }
        }

        // Quick filter: under-8h
        if (filters.quickFilter === 'under-8h') {
          const dailyTotals: Record<string, number> = {};
          for (const t of tasks) {
            for (const [d, sec] of Object.entries(t.dailySeconds)) {
              dailyTotals[d] = (dailyTotals[d] ?? 0) + sec;
            }
          }
          const hasUnder = Object.entries(dailyTotals).some(([dateStr, total]) => {
            const date = new Date(dateStr);
            if (date.getDay() === 0 || date.getDay() === 6) return false;
            const today = new Date(new Date().toDateString());
            if (date > today) return false;
            return total < 28800;
          });
          if (!hasUnder) return null;
        }

        // Compute stats from FILTERED tasks
        const today = new Date(new Date().toDateString());
        let overdueCount = 0, noEstCount = 0, todoCount = 0, inProgressCount = 0, doneCount = 0;
        let totalEst = 0, totalLogged = 0;
        for (const task of tasks) {
          totalEst += task.estSeconds;
          totalLogged += task.totalLoggedSeconds;
          if (task.estSeconds === 0) noEstCount++;
          const cls = classifyStatus(task.status);
          if (cls === 'todo') todoCount++;
          else if (cls === 'in-progress') inProgressCount++;
          else doneCount++;
          if (task.duedate) {
            const due = new Date(task.duedate);
            if (due < today && cls !== 'done') overdueCount++;
          }
        }

        const stats: Record<string, string> = {
          taskCount: String(tasks.length),
          totalEst: formatCellHours(totalEst),
          totalLogged: formatCellHours(totalLogged),
          overdue: overdueCount > 0 ? String(overdueCount) : '-',
          noEst: noEstCount > 0 ? String(noEstCount) : '-',
          todo: String(todoCount),
          inProgress: String(inProgressCount),
          done: String(doneCount),
        };

        const isExpanded = expandedUsers.has(rawUser.username);

        return (
        <div key={rawUser.username}>
          {/* ── User Header ── */}
          <div className="border border-[#DFE1E6] dark:border-gray-700 rounded-sm bg-white dark:bg-gray-900 overflow-hidden">
            {/* Row 1: name + expand toggle */}
            <button
              onClick={() => toggleUser(rawUser.username)}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#F4F5F7] dark:hover:bg-gray-800 transition-colors text-left"
            >
              <ChevronDown
                size={14}
                className={cn(
                  'text-[#5E6C84] dark:text-gray-400 flex-shrink-0 transition-transform',
                  !isExpanded && '-rotate-90',
                )}
              />
              {rawUser.avatarUrl ? (
                <img src={rawUser.avatarUrl} alt="" className="w-7 h-7 rounded-full flex-shrink-0" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-[#0052CC] dark:bg-blue-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-[10px] font-bold text-white">
                    {rawUser.displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </span>
                </div>
              )}
              <h3 className="text-sm font-semibold text-[#172B4D] dark:text-gray-100">{rawUser.displayName}</h3>
            </button>

            {/* Row 2: Stats mini-table */}
            <div className="flex items-stretch border-t border-[#DFE1E6] dark:border-gray-700">
              {STAT_COLS.map((col, i) => (
                <div
                  key={col.key}
                  className={cn(
                    'flex-1 flex flex-col items-center justify-center py-1.5 px-1',
                    i < STAT_COLS.length - 1 && 'border-r border-[#DFE1E6] dark:border-gray-700',
                  )}
                >
                  <span className="text-[9px] text-[#5E6C84] dark:text-gray-500 uppercase tracking-wider leading-none mb-0.5">
                    {col.label}
                  </span>
                  <span
                    className="text-xs font-semibold leading-none"
                    style={{ color: col.key === 'overdue' && overdueCount > 0 ? col.color
                      : col.key === 'noEst' && noEstCount > 0 ? col.color
                      : '#172B4D' }}
                  >
                    {stats[col.key]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Task Table (collapsible) ── */}
          {isExpanded && (
            <div className="border border-t-0 border-[#DFE1E6] dark:border-gray-700 rounded-b-sm overflow-hidden">
              {(() => {
                const dailyTotals: Record<string, number> = {};
                for (const d of days) {
                  dailyTotals[d] = tasks.reduce((s, t) => s + (t.dailySeconds[d] ?? 0), 0);
                }
                const projectKeys = new Set(tasks.map(t => t.projectKey));
                const parentKeys = new Set(tasks.map(t => t.parentKey).filter(Boolean));

                const editProps: TaskRowEditProps | undefined = editMode
                  ? { editMode, editingKey, edits, startEdit, cancelEdit, addEdit, hasEdit, getEditClass }
                  : undefined;

                return (
                  <>
                    {/* Column headers */}
                    <div className="flex bg-[#F4F5F7] dark:bg-gray-800 text-xs font-semibold text-[#5E6C84] dark:text-gray-400">
                      {visibleColumns.project && <div className="w-[120px] flex-shrink-0 px-3 py-2">Project</div>}
                      {visibleColumns.tasktype && <div className="w-[280px] flex-shrink-0 px-3 py-2">Parent Task</div>}
                      {visibleColumns.key && <div className="w-[150px] flex-shrink-0 px-3 py-2">Key</div>}
                      {visibleColumns.summary && <div className="flex-1 px-2 py-2 min-w-0">Summary</div>}
                      {visibleColumns.est && <div className="w-[72px] flex-shrink-0 px-2 py-2 text-right">Est</div>}
                      {visibleColumns.status && <div className="w-[80px] flex-shrink-0 px-1 py-2 text-center">Status</div>}
                      {visibleColumns.duedate && <div className="w-[72px] flex-shrink-0 px-2 py-2 text-center">Due</div>}
                      {dayHeaders.map((dh) => (
                        <div
                          key={dh.key}
                          className={cn(
                            'w-[64px] flex-shrink-0 flex flex-col items-center justify-center py-1 text-center',
                            dh.isToday && 'bg-[#DEEBFF] dark:bg-blue-900/30 text-[#0052CC] dark:text-blue-300 rounded-t',
                            !dh.isToday && getDayBgClass(dailyTotals[dh.key], dh.key),
                          )}
                        >
                          <span className="text-[10px] leading-none">{dh.dayName}</span>
                          <span className="text-[10px] leading-none mt-0.5">{dh.dateStr}</span>
                        </div>
                      ))}
                    </div>

                    {/* Task rows grouped by project (→ optionally by parent) */}
                    {(() => {
                      const groups: Array<{ projKey: string; tasks: TaskReport[] }> = [];
                      for (const task of tasks) {
                        const last = groups[groups.length - 1];
                        if (last && last.projKey === task.projectKey) {
                          last.tasks.push(task);
                        } else {
                          groups.push({ projKey: task.projectKey, tasks: [task] });
                        }
                      }
                      return groups.map((group, gi) => (
                        <div
                          key={`${group.projKey}-${gi}`}
                          className={cn(
                            'flex',
                            gi < groups.length - 1 && 'border-b-2 border-b-[#DFE1E6] dark:border-b-gray-600',
                          )}
                        >
                          {visibleColumns.project && (
                            <div
                              className="w-[120px] flex-shrink-0 flex flex-col items-start justify-center px-3 py-2 border-r border-[#DFE1E6] dark:border-gray-700"
                              style={{ minHeight: `${group.tasks.length * 32}px` }}
                            >
                              <span
                                className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-sm text-white"
                                style={{ backgroundColor: projectColor(group.projKey) }}
                              >
                                {group.projKey}
                              </span>
                              <span className="text-[9px] text-[#5E6C84] dark:text-gray-400 mt-0.5">
                                {group.tasks.length} task{group.tasks.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                          )}

                          {/* When tasktype column is ON → sub-group by parent; otherwise flat list */}
                          {visibleColumns.tasktype ? (() => {
                            // Build parent sub-groups (tasks already sorted by parentKey above)
                            type ParentGroup = {
                              parentKey: string; parentSummary: string;
                              parentTypeName: string; parentTypeIcon: string;
                              parentStatus?: string; parentStatusCategory?: string;
                              parentDuedate?: string; parentEstDisplay?: string;
                              tasks: TaskReport[];
                            };
                            const parentGroups: ParentGroup[] = [];
                            for (const task of group.tasks) {
                              const pKey = task.parentKey ?? '__none__';
                              const last2 = parentGroups[parentGroups.length - 1];
                              if (last2 && last2.parentKey === pKey) {
                                last2.tasks.push(task);
                              } else {
                                parentGroups.push({
                                  parentKey: pKey,
                                  parentSummary: task.parentSummary ?? '',
                                  parentTypeName: task.parentIssueTypeName ?? '',
                                  parentTypeIcon: task.parentIssueTypeIconUrl ?? '',
                                  parentStatus: task.parentStatus,
                                  parentStatusCategory: task.parentStatusCategory,
                                  parentDuedate: task.parentDuedate,
                                  parentEstDisplay: task.parentEstDisplay,
                                  tasks: [task],
                                });
                              }
                            }
                            return (
                              <div className="flex-1 flex flex-col min-w-0">
                                {parentGroups.map((pg, pgi) => {
                                  const pCat = pg.parentStatusCategory;
                                  const pStatusCls = pCat === 'done'
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                    : pCat === 'indeterminate'
                                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                      : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
                                  const pDueToday = new Date(new Date().toDateString());
                                  const pIsOverdue = pg.parentDuedate && pCat !== 'done'
                                    && new Date(pg.parentDuedate) < pDueToday;
                                  return (
                                    <div
                                      key={`${pg.parentKey}-${pgi}`}
                                      className={cn(
                                        'flex',
                                        pgi < parentGroups.length - 1 && 'border-b border-[#DFE1E6] dark:border-gray-700',
                                      )}
                                    >
                                      {/* ── Parent Task cell — spans all sub-task rows ── */}
                                      <div
                                        className="w-[280px] flex-shrink-0 flex flex-col justify-center px-3 py-2 border-r border-[#DFE1E6] dark:border-gray-700 gap-1"
                                        style={{ minHeight: `${pg.tasks.length * 32}px` }}
                                      >
                                        {pg.parentKey !== '__none__' ? (
                                          <>
                                            {/* Row 1: icon + key (left) | status (right) */}
                                            <div className="flex items-center gap-1.5 min-w-0">
                                              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                                {pg.parentTypeIcon && (
                                                  <img src={pg.parentTypeIcon} alt={pg.parentTypeName} className="w-3.5 h-3.5 flex-shrink-0" />
                                                )}
                                                <button
                                                  onClick={() => setPanelIssueKey(pg.parentKey)}
                                                  className="text-[11px] font-bold text-[#0052CC] dark:text-blue-400 hover:underline truncate text-left"
                                                  title={`Open ${pg.parentKey}`}
                                                >
                                                  {pg.parentKey}
                                                </button>
                                              </div>
                                              {editMode && editingKey === `${pg.parentKey}:parentStatus` ? (
                                                <StatusEditor
                                                  issueKey={pg.parentKey}
                                                  currentStatus={pg.parentStatus ?? ''}
                                                  onSave={(newStatus, transitionId) =>
                                                    addEdit({
                                                      issueKey: pg.parentKey,
                                                      field: 'parentStatus',
                                                      oldValue: pg.parentStatus ?? '',
                                                      newValue: newStatus,
                                                      transitionId,
                                                      parentKey: pg.parentKey,
                                                    })
                                                  }
                                                  onCancel={cancelEdit}
                                                />
                                              ) : pg.parentStatus ? (
                                                <span
                                                  onClick={() => editMode && startEdit(`${pg.parentKey}:parentStatus`)}
                                                  className={cn(
                                                    'text-[9px] px-1.5 py-0.5 rounded-sm font-semibold leading-none flex-shrink-0',
                                                    pStatusCls,
                                                    editMode && 'cursor-pointer hover:ring-1 hover:ring-[#0052CC]',
                                                    getEditClass(pg.parentKey, 'parentStatus'),
                                                  )}
                                                >
                                                  {hasEdit(pg.parentKey, 'parentStatus')
                                                    ? edits.find(e => e.issueKey === pg.parentKey && e.field === 'parentStatus')!.newValue
                                                    : pg.parentStatus}
                                                </span>
                                              ) : editMode ? (
                                                <span
                                                  onClick={() => startEdit(`${pg.parentKey}:parentStatus`)}
                                                  className="text-[9px] px-1 py-0.5 rounded-sm text-[#C1C7D0] dark:text-gray-600 italic cursor-pointer hover:ring-1 hover:ring-[#0052CC]"
                                                >
                                                  set
                                                </span>
                                              ) : null}
                                            </div>
                                            {/* Row 2: summary (left) | sub-task count (right) */}
                                            <div className="flex items-start gap-1.5 min-w-0">
                                              <p className="text-[10px] text-[#172B4D] dark:text-gray-200 line-clamp-2 leading-snug flex-1 min-w-0">
                                                {pg.parentSummary}
                                              </p>
                                              <span className="text-[9px] text-[#5E6C84] dark:text-gray-500 leading-none flex-shrink-0 mt-0.5">
                                                {pg.tasks.length} sub-task{pg.tasks.length !== 1 ? 's' : ''}
                                              </span>
                                            </div>
                                            {/* Row 3: duedate · est */}
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              {pg.parentDuedate && (
                                                <span className={cn(
                                                  'text-[9px] font-medium leading-none',
                                                  pIsOverdue ? 'text-[#DE350B] dark:text-red-400' : 'text-[#5E6C84] dark:text-gray-400',
                                                )}>
                                                  {pIsOverdue && '⚠ '}{formatDueDate(pg.parentDuedate)}
                                                </span>
                                              )}
                                              {pg.parentEstDisplay && (
                                                <span className="text-[9px] text-[#5E6C84] dark:text-gray-500 leading-none">
                                                  {pg.parentEstDisplay}
                                                </span>
                                              )}
                                            </div>
                                          </>
                                        ) : (
                                          <span className="text-[9px] text-[#C1C7D0] dark:text-gray-600 italic">No parent</span>
                                        )}
                                      </div>
                                      {/* Task rows for this parent */}
                                      <div className="flex-1 flex flex-col min-w-0">
                                        {pg.tasks.map((task, ti) => (
                                          <TaskRow
                                            key={task.issueKey}
                                            task={task}
                                            dayHeaders={dayHeaders}
                                            dailyTotals={dailyTotals}
                                            isLastInGroup={ti === pg.tasks.length - 1}
                                            visibleColumns={visibleColumns}
                                            onIssueClick={setPanelIssueKey}
                                            edit={editProps}
                                          />
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })() : (
                            <div className="flex-1 flex flex-col min-w-0">
                              {group.tasks.map((task, ti) => (
                                <TaskRow
                                  key={task.issueKey}
                                  task={task}
                                  dayHeaders={dayHeaders}
                                  dailyTotals={dailyTotals}
                                  isLastInGroup={ti === group.tasks.length - 1}
                                  visibleColumns={visibleColumns}
                                  onIssueClick={setPanelIssueKey}
                                  edit={editProps}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      ));
                    })()}

                    {/* Total row */}
                    <div className="flex border-t border-[#DFE1E6] dark:border-gray-700 bg-[#F4F5F7] dark:bg-gray-800 text-xs font-semibold">
                      {visibleColumns.project && (
                        <div className="w-[120px] flex-shrink-0 px-3 py-2 text-[#5E6C84] dark:text-gray-400">
                          {projectKeys.size} project{projectKeys.size !== 1 ? 's' : ''}
                        </div>
                      )}
                      {visibleColumns.tasktype && (
                        <div className="w-[280px] flex-shrink-0 px-3 py-2 text-[#5E6C84] dark:text-gray-400">
                          {parentKeys.size} parent{parentKeys.size !== 1 ? 's' : ''}
                        </div>
                      )}
                      {visibleColumns.key && (
                        <div className="w-[150px] flex-shrink-0 px-3 py-2 text-[#172B4D] dark:text-gray-100">Total</div>
                      )}
                      {visibleColumns.summary && (
                        <div className="flex-1 px-2 py-2 text-[#5E6C84] dark:text-gray-400 min-w-0">
                          {tasks.length} task{tasks.length !== 1 ? 's' : ''}
                        </div>
                      )}
                      {visibleColumns.est && (
                        <div className="w-[72px] flex-shrink-0 px-2 py-2 text-right text-[#172B4D] dark:text-gray-100">
                          {formatCellHours(totalEst)}
                        </div>
                      )}
                      {visibleColumns.status && <div className="w-[80px] flex-shrink-0 px-1 py-2" />}
                      {visibleColumns.duedate && <div className="w-[72px] flex-shrink-0 px-2 py-2" />}
                      {dayHeaders.map((dh) => {
                        const total = dailyTotals[dh.key] ?? 0;
                        return (
                          <div
                            key={dh.key}
                            className={cn(
                              'w-[64px] flex-shrink-0 px-1 py-2 text-center',
                              getHourClass(total),
                              dh.isToday && 'bg-[#DEEBFF] dark:bg-blue-900/30',
                              !dh.isToday && getDayBgClass(total, dh.key),
                            )}
                          >
                            {formatCellHours(total)}
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>
        );
      })}
      </div>

      {/* Issue Detail Panel — triggered by clicking a parent key */}
      {panelIssueKey && (
        <IssueDetailPanel
          issueKey={panelIssueKey}
          onClose={() => setPanelIssueKey(null)}
          onUpdated={() => {}}
        />
      )}

      {/* Save Confirmation Modal */}
      {showConfirm && (
        <SaveConfirmModal
          edits={edits}
          onClose={() => setShowConfirm(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

// ── Task Row sub-component ─────────────────────────────────────────────

interface TaskRowEditProps {
  editMode: boolean;
  editingKey: string | null;
  edits: EditEntry[];
  startEdit: (key: string) => void;
  cancelEdit: () => void;
  addEdit: (entry: EditEntry) => void;
  hasEdit: (issueKey: string, field: EditEntry['field']) => boolean;
  getEditClass: (issueKey: string, field: EditEntry['field']) => string;
}

function TaskRow({
  task,
  dayHeaders,
  dailyTotals,
  isLastInGroup,
  visibleColumns,
  onIssueClick,
  edit,
}: {
  task: TaskReport;
  dayHeaders: Array<{ key: string; dayName: string; dateStr: string; isToday: boolean }>;
  dailyTotals: Record<string, number>;
  isLastInGroup: boolean;
  visibleColumns: Record<string, boolean>;
  onIssueClick?: (key: string) => void;
  edit?: TaskRowEditProps;
}) {
  const missingClass = getMissingInfoClass(task);
  const ed = edit;

  const summaryCls = ed && ed.editMode
    ? 'cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/10'
    : '';
  const estCls = ed && ed.editMode
    ? 'cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/10'
    : '';
  const statusCls = ed && ed.editMode
    ? 'cursor-pointer hover:ring-1 hover:ring-[#0052CC]'
    : '';

  return (
    <div
      className={cn(
        'flex text-xs hover:bg-[#F4F5F7]/50 dark:hover:bg-gray-800/50 transition-colors',
        !isLastInGroup && 'border-b border-[#DFE1E6] dark:border-gray-700',
        missingClass,
      )}
    >
      {visibleColumns.key && (
        <div className="w-[150px] flex-shrink-0 px-3 py-2 flex items-center gap-1.5">
          {task.issueTypeIconUrl && (
            <img src={task.issueTypeIconUrl} alt={task.issueTypeName} className="w-3.5 h-3.5 flex-shrink-0" />
          )}
          <button
            onClick={() => onIssueClick?.(task.issueKey)}
            className="text-[#0052CC] dark:text-blue-400 hover:underline font-medium truncate text-left"
            title={`Open ${task.issueKey}`}
          >
            {task.issueKey}
          </button>
          <Link
            href={`/issues/${task.issueKey}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#5E6C84] dark:text-gray-500 hover:text-[#0052CC] dark:hover:text-blue-400 flex-shrink-0"
            title="Open full page"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink size={10} />
          </Link>
        </div>
      )}

      {/* ── Summary (editable) ── */}
      {visibleColumns.summary && (
        <div
          onClick={() => ed?.editMode && ed.startEdit(`${task.issueKey}:summary`)}
          className={cn(
            'flex-1 px-2 py-2 text-[#172B4D] dark:text-gray-200 truncate min-w-0',
            summaryCls,
            ed && ed.getEditClass(task.issueKey, 'summary'),
          )}
        >
          {ed && ed.editMode && ed.editingKey === `${task.issueKey}:summary` ? (
            <InlineTextEditor
              currentValue={task.summary}
              onSave={(newVal) =>
                ed.addEdit({
                  issueKey: task.issueKey,
                  field: 'summary',
                  oldValue: task.summary,
                  newValue: newVal,
                })
              }
              onCancel={ed.cancelEdit}
            />
          ) : ed && ed.hasEdit(task.issueKey, 'summary') ? (
            <span className="text-[#B45309] dark:text-amber-400">
              {editsFromContext(ed, task.issueKey, 'summary')}
            </span>
          ) : (
            task.summary
          )}
        </div>
      )}

      {/* ── Estimate (editable) ── */}
      {visibleColumns.est && (
        <div
          onClick={() => ed?.editMode && ed.startEdit(`${task.issueKey}:est`)}
          className={cn(
            'w-[72px] flex-shrink-0 px-2 py-2 text-right',
            task.estSeconds === 0 ? 'text-[#C1C7D0] dark:text-gray-600 italic text-[10px]' : 'text-[#5E6C84] dark:text-gray-400',
            estCls,
            ed && ed.getEditClass(task.issueKey, 'est'),
          )}
        >
          {ed && ed.editMode && ed.editingKey === `${task.issueKey}:est` ? (
            <EstEditor
              currentValue={task.estSeconds === 0 ? '' : task.estDisplay}
              onSave={(newVal) =>
                ed.addEdit({
                  issueKey: task.issueKey,
                  field: 'est',
                  oldValue: task.estSeconds === 0 ? '' : task.estDisplay,
                  newValue: newVal,
                })
              }
              onCancel={ed.cancelEdit}
            />
          ) : ed && ed.hasEdit(task.issueKey, 'est') ? (
            <span className="text-[#B45309] dark:text-amber-400 font-medium">
              {editsFromContext(ed, task.issueKey, 'est')}
            </span>
          ) : task.estSeconds === 0 ? (
            ed?.editMode ? <span className="italic text-[10px]">—</span> : '—'
          ) : (
            task.estDisplay
          )}
        </div>
      )}

      {/* ── Status (editable) ── */}
      {visibleColumns.status && (
        <div className="w-[80px] flex-shrink-0 px-1 py-2 text-center">
          {ed && ed.editMode && ed.editingKey === `${task.issueKey}:status` ? (
            <StatusEditor
              issueKey={task.issueKey}
              currentStatus={task.status ?? ''}
              onSave={(newStatus, transitionId) =>
                ed.addEdit({
                  issueKey: task.issueKey,
                  field: 'status',
                  oldValue: task.status ?? '',
                  newValue: newStatus,
                  transitionId,
                })
              }
              onCancel={ed.cancelEdit}
            />
          ) : (
            <span
              onClick={() => ed?.editMode && ed.startEdit(`${task.issueKey}:status`)}
              className={cn(
                'text-[10px] px-1.5 py-0.5 rounded font-medium',
                classifyStatus(task.status) === 'done'
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : classifyStatus(task.status) === 'in-progress'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
                statusCls,
                ed && ed.getEditClass(task.issueKey, 'status'),
              )}
            >
              {ed && ed.hasEdit(task.issueKey, 'status')
                ? editsFromContext(ed, task.issueKey, 'status')
                : task.status || '-'}
            </span>
          )}
        </div>
      )}

      {/* ── Due date (editable) ── */}
      {visibleColumns.duedate && (
        <div className={cn(
          'w-[72px] flex-shrink-0 px-2 py-2 text-center text-xs font-medium',
          ed && ed.editMode && 'cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/10',
          ed && ed.getEditClass(task.issueKey, 'duedate'),
        )}>
          {ed && ed.editMode && ed.editingKey === `${task.issueKey}:duedate` ? (
            <DateEditor
              currentValue={task.duedate ?? ''}
              onSave={(newVal) =>
                ed.addEdit({
                  issueKey: task.issueKey,
                  field: 'duedate',
                  oldValue: task.duedate ?? '',
                  newValue: newVal,
                })
              }
              onCancel={ed.cancelEdit}
            />
          ) : ed && ed.hasEdit(task.issueKey, 'duedate') ? (
            <span className="text-[#B45309] dark:text-amber-400 font-medium">
              {formatDueDate(editsFromContext(ed, task.issueKey, 'duedate'))}
            </span>
          ) : (
            <span
              onClick={() => ed?.editMode && ed.startEdit(`${task.issueKey}:duedate`)}
              className={cn(
                isOverdue(task)
                  ? 'bg-red-100 dark:bg-red-900/30 text-[#DE350B] dark:text-red-400 rounded'
                  : !task.duedate
                    ? 'text-[#C1C7D0] dark:text-gray-600 italic text-[10px]'
                    : 'text-[#172B4D] dark:text-gray-200',
              )}
            >
              {isOverdue(task) && <span className="mr-0.5">⚠</span>}
              {task.duedate ? formatDueDate(task.duedate) : '—'}
            </span>
          )}
        </div>
      )}

      {dayHeaders.map((dh) => {
        const sec = task.dailySeconds[dh.key] ?? 0;
        return (
          <div
            key={dh.key}
            className={cn(
              'w-[64px] flex-shrink-0 px-1 py-2 text-center',
              getHourClass(sec),
              dh.isToday && 'bg-[#DEEBFF] dark:bg-blue-900/30',
              !dh.isToday && getDayBgClass(dailyTotals[dh.key] ?? 0, dh.key),
            )}
          >
            {formatCellHours(sec)}
          </div>
        );
      })}
    </div>
  );
}

/** Helper: get the new value from edits for display in the cell */
function editsFromContext(
  ed: TaskRowEditProps,
  issueKey: string,
  field: EditEntry['field'],
): string {
  const entry = ed.edits.find((e) => e.issueKey === issueKey && e.field === field);
  return entry?.newValue ?? '';
}
