'use client';
import { useState, useEffect, useMemo, useCallback, Fragment } from 'react';
import { startOfWeek, subWeeks, addWeeks, addDays, subDays, startOfMonth, subMonths, addMonths, format } from 'date-fns';
import { CheckCircle2, XCircle, Clock, RefreshCw, Layers } from 'lucide-react';
import { getStoredUser } from '@/lib/api';
import { updateWorklog, deleteWorklog } from '@/lib/worklog-api';
import { useWorklogs } from '@/hooks/use-worklogs';
import { useWorklogMutations } from '@/hooks/use-worklog-mutations';
import { WorklogCalendar } from '@/components/worklog/worklog-calendar';
import { EMPTY_WORKLOG_FILTERS, applyWorklogFilters, type WorklogFilterBarFilters } from '@/components/worklog/worklog-filter-bar';
import { FilterBar } from '@/components/shared/filter-bar';
import type { UnifiedFilters } from '@/lib/filter-constants';
import { EditWorklogModal } from '@/components/worklog/edit-worklog-modal';
import { SWIMLANE_PALETTE, type GroupByField } from '@/components/worklog/worklog-day-cell';
import type { WorklogEntry } from '@/types/jira';
import { cn } from '@/lib/utils';
import { DEFAULT_GROUPS, MEMBER_DISPLAY_NAMES, type TeamGroup } from '@/lib/team-constants';
import { GroupSelector } from '@/components/shared/group-selector';
import { GroupByControls } from '@/components/shared/group-by-controls';
import { LoadingOverlay } from '@/components/shared/loading-overlay';

// ─── Page component ──────────────────────────────────────────────────────────

export default function WorklogPage() {
  const [initialized, setInitialized] = useState(false);
  const currentUser = getStoredUser() as { name?: string } | null;
  const currentUsername = currentUser?.name;

  // Display mode (Full / Focus)
  const [displayMode, setDisplayMode] = useState<'full' | 'focus'>('focus');
  const [editMode, setEditMode] = useState(false);
  const [showWeekends, setShowWeekends] = useState(false);

  // Filters
  const [filters, setFilters] = useState<WorklogFilterBarFilters>({
    ...EMPTY_WORKLOG_FILTERS,
    period: 'week',
    dateRangeMode: 'current',
    assigneeIn: ['currentUser()'],
  });
  const [groupBy, setGroupBy] = useState<string>('assignee');

  useEffect(() => {
    setFilters(prev => ({
      ...prev,
      groupBy: groupBy === 'none' ? undefined : groupBy as any,
    }));
  }, [groupBy]);

  // ── Group / member filter ────────────────────────────────────────────────
  const [groups] = useState<TeamGroup[]>(DEFAULT_GROUPS);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>(
    () => DEFAULT_GROUPS[0]?.members ?? [],
  );
  const [memberDisplayNames, setMemberDisplayNames] = useState<Record<string, string>>(
    () => {
      const names: Record<string, string> = {};
      for (const m of DEFAULT_GROUPS[0]?.members ?? []) {
        names[m] = MEMBER_DISPLAY_NAMES[m] || m;
      }
      return names;
    },
  );

  useEffect(() => {
    setInitialized(true);
  }, []);

  // Calendar state
  const [baseDate, setBaseDate] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [mode, setMode] = useState<'day' | 'week' | 'month'>('week');

  const handleNavigate = useCallback((direction: 'prev' | 'next') => {
    setBaseDate((prev: Date) => {
      if (mode === 'day') return direction === 'prev' ? subDays(prev, 1) : addDays(prev, 1);
      if (mode === 'week') return direction === 'prev' ? subWeeks(prev, 1) : addWeeks(prev, 1);
      return direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1);
    });
  }, [mode]);

  // Derive date range from period for API fetching
  const activeFilters = useMemo(() => {
    const ref = filters.dateRangeMode === 'old' ? baseDate : new Date();
    let from = '';
    let to = '';

    if (filters.period === 'today') {
      from = format(ref, 'yyyy-MM-dd');
      to = format(ref, 'yyyy-MM-dd');
    } else if (filters.period === 'week') {
      const start = startOfWeek(ref, { weekStartsOn: 1 });
      from = format(start, 'yyyy-MM-dd');
      to = format(addWeeks(start, 1), 'yyyy-MM-dd');
    } else if (filters.period === 'month') {
      const start = startOfMonth(ref);
      from = format(start, 'yyyy-MM-dd');
      to = format(addMonths(start, 1), 'yyyy-MM-dd');
    } else if (filters.period === 'year') {
      from = format(new Date(ref.getFullYear(), 0, 1), 'yyyy-MM-dd');
      to = format(new Date(ref.getFullYear(), 11, 31), 'yyyy-MM-dd');
    }

    return {
      usernames: selectedMembers.length > 0 ? selectedMembers : [currentUsername || ''],
      dateFrom: from,
      dateTo: to,
    };
  }, [filters, currentUsername, selectedMembers, baseDate]);

  const { data, entriesByDate: rawEntriesByDate, isLoading, mutate } = useWorklogs(
    initialized ? activeFilters : null,
  );

  // Apply client-side filters
  const filteredEntries = useMemo(() => {
    if (!data?.entries) return [];
    return applyWorklogFilters(data.entries, filters, currentUsername, selectedMembers);
  }, [data, filters, currentUsername, selectedMembers]);

  const entriesByDate = useMemo(() => {
    const map: Record<string, WorklogEntry[]> = {};
    for (const e of filteredEntries) {
      const d = new Date(e.started).toISOString().slice(0, 10);
      (map[d] ??= []).push(e);
    }
    return map;
  }, [filteredEntries]);

  const dailyHours = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of filteredEntries) {
      const d = new Date(e.started).toISOString().slice(0, 10);
      map[d] = (map[d] ?? 0) + e.timeSpentSeconds / 3600;
    }
    return map;
  }, [filteredEntries]);

  // ── Member helpers ─────────────────────────────────────────────────────────

  function addMember(username: string, displayName: string) {
    if (selectedMembers.includes(username)) return;
    setSelectedMembers(prev => [...prev, username]);
    setMemberDisplayNames(prev => ({ ...prev, [username]: displayName }));
  }

  function removeMember(username: string) {
    setSelectedMembers(prev => prev.filter(m => m !== username));
  }

  function selectAllMembers() {
    setSelectedMembers([]);
  }

  function selectGroup(group: TeamGroup) {
    const names: Record<string, string> = {};
    for (const m of group.members) names[m] = MEMBER_DISPLAY_NAMES[m] || m;
    setSelectedMembers(group.members);
    setMemberDisplayNames(prev => ({ ...prev, ...names }));
  }

  // ── Worklog Drafts ──────────────────────────────────────────────────────

  type WorklogDraft =
    | { type: 'update'; timeSpentSeconds: number; comment: string; started: string }
    | { type: 'delete' };

  const [worklogDrafts, setWorklogDrafts] = useState<Record<string, WorklogDraft>>({});
  const [worklogReviewOpen, setWorklogReviewOpen] = useState(false);

  // CRUD
  const { add, update, remove, toast } = useWorklogMutations(() => mutate());

  const pendingCount = useMemo(
    () => Object.keys(worklogDrafts).length,
    [worklogDrafts],
  );

  async function handleApplyWorklogDrafts() {
    let errors = 0;
    for (const [worklogId, draft] of Object.entries(worklogDrafts)) {
      const entry = data?.entries.find(e => e.id === worklogId);
      if (!entry) { errors++; continue; }
      try {
        if (draft.type === 'delete') {
          await deleteWorklog(entry.issueKey, worklogId);
        } else {
          await updateWorklog(entry.issueKey, worklogId, {
            timeSpentSeconds: draft.timeSpentSeconds,
            comment: draft.comment,
            started: draft.started,
          });
        }
      } catch { errors++; }
    }
    if (errors === 0) {
      setWorklogDrafts({});
      setWorklogReviewOpen(false);
    }
    await mutate();
  }

  // Edit modal state
  const [editEntry, setEditEntry] = useState<WorklogEntry | null>(null);

  function handleEditSave(changes: { timeSpentSeconds: number; comment: string; started: string }) {
    if (!editEntry) return;
    setWorklogDrafts(prev => ({
      ...prev,
      [editEntry.id]: { type: 'update' as const, ...changes },
    }));
    setEditEntry(null);
  }

  function handleEditDelete() {
    if (!editEntry) return;
    setWorklogDrafts(prev => ({
      ...prev,
      [editEntry.id]: { type: 'delete' as const },
    }));
    setEditEntry(null);
  }

  const handleDragEnd = useCallback(async (entryId: string, newDate: string) => {
    if (!data) return;
    const entry = data.entries.find(e => e.id === entryId);
    if (!entry) return;
    const oldDate = new Date(entry.started).toISOString().slice(0, 10);
    if (oldDate === newDate) return;
    const oldStarted = new Date(entry.started);
    const newStarted = `${newDate}T${format(oldStarted, 'HH:mm')}:00.000+0700`;
    setWorklogDrafts(prev => ({
      ...prev,
      [entryId]: {
        type: 'update',
        timeSpentSeconds: entry.timeSpentSeconds,
        comment: entry.comment,
        started: newStarted,
      },
    }));
  }, [data]);

  const handleDayClick = useCallback((_date: Date) => {
    // Placeholder for add dialog
  }, []);

  // Week progress
  const weekProgress = useMemo(() => {
    if (!data) return null;
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    let total = 0;
    let workDays = 0;
    for (let i = 0; i < 5; i++) {
      const d = addDays(weekStart, i);
      const key = format(d, 'yyyy-MM-dd');
      total += data.dailyHours[key] ?? 0;
      workDays++;
    }
    return { total, required: workDays * 8 };
  }, [data]);

  // Map filter groupBy/subGroupBy to day cell GroupByField
  const groupByField = useMemo(() => {
    if (!filters.groupBy || filters.groupBy === 'None') return null;
    return filters.groupBy.toLowerCase() as GroupByField;
  }, [filters.groupBy]);

  const totalFiltered = filteredEntries.length;
  const totalFilteredHours = filteredEntries.reduce((s, e) => s + e.timeSpentSeconds / 3600, 0);

  return (
    <div className="flex flex-col h-screen p-6 relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-[#172B4D] dark:text-gray-100 flex items-center gap-2">
            <Clock size={20} className="text-[#0052CC]" />
            Timesheet
          </h1>
          <p className="text-sm text-[#5E6C84] dark:text-gray-400 mt-0.5 flex items-center gap-2">
            {totalFiltered} entries · {totalFilteredHours.toFixed(1)}h total
            {weekProgress && (
              <span className={`text-xs ml-1 px-2 py-0.5 rounded-full font-medium ${
                weekProgress.total >= weekProgress.required
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
              }`}>
                {weekProgress.total.toFixed(1)}h / {weekProgress.required}h this week
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Display mode toggle */}
          <div className="flex items-center rounded border border-[#DFE1E6] dark:border-gray-600 overflow-hidden shrink-0">
            <button
              type="button"
              onClick={() => setDisplayMode('full')}
              className={cn(
                'text-[10px] px-2 py-1.5 font-medium transition-colors border-r border-[#DFE1E6] dark:border-gray-600',
                displayMode === 'full'
                  ? 'bg-[#0052CC] text-white'
                  : 'bg-white dark:bg-gray-800 text-[#5E6C84] dark:text-gray-400 hover:bg-[#F4F5F7] dark:hover:bg-gray-700',
              )}
            >
              Full
            </button>
            <button
              type="button"
              onClick={() => setDisplayMode('focus')}
              className={cn(
                'text-[10px] px-2 py-1.5 font-medium transition-colors',
                displayMode === 'focus'
                  ? 'bg-[#0052CC] text-white'
                  : 'bg-white dark:bg-gray-800 text-[#5E6C84] dark:text-gray-400 hover:bg-[#F4F5F7] dark:hover:bg-gray-700',
              )}
            >
              Focus
            </button>
          </div>
          {/* View/Edit toggle */}
          <div className="flex items-center rounded border border-[#DFE1E6] dark:border-gray-600 overflow-hidden shrink-0">
            <button
              type="button"
              onClick={() => setEditMode(false)}
              className={cn(
                'text-[10px] px-2 py-1.5 font-medium transition-colors border-r border-[#DFE1E6] dark:border-gray-600',
                !editMode
                  ? 'bg-[#0052CC] text-white'
                  : 'bg-white dark:bg-gray-800 text-[#5E6C84] dark:text-gray-400 hover:bg-[#F4F5F7] dark:hover:bg-gray-700',
              )}
            >
              View
            </button>
            <button
              type="button"
              onClick={() => setEditMode(true)}
              className={cn(
                'text-[10px] px-2 py-1.5 font-medium transition-colors',
                editMode
                  ? 'bg-[#0052CC] text-white'
                  : 'bg-white dark:bg-gray-800 text-[#5E6C84] dark:text-gray-400 hover:bg-[#F4F5F7] dark:hover:bg-gray-700',
              )}
            >
              Edit
            </button>
          </div>
          {/* Weekends toggle */}
          <button
            type="button"
            onClick={() => setShowWeekends(!showWeekends)}
            className={cn(
              'text-[10px] px-2 py-1.5 rounded border font-medium transition-colors',
              showWeekends
                ? 'border-[#DFE1E6] dark:border-gray-600 bg-white dark:bg-gray-800 text-[#5E6C84] dark:text-gray-400'
                : 'border-[#0052CC] bg-[#0052CC] text-white',
            )}
          >
            {showWeekends ? 'Sat, Sun' : 'Mon–Fri'}
          </button>
          {/* Pending badge + Review button */}
          {pendingCount > 0 && (
            <button
              type="button"
              onClick={() => setWorklogReviewOpen(true)}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded border border-[#0052CC] bg-[#0052CC] text-white hover:bg-[#0747A6] transition-colors shrink-0"
            >
              <Layers size={13} />
              <span>{pendingCount} pending</span>
            </button>
          )}
          <button
          type="button"
          onClick={async () => { setIsRefreshing(true); await mutate(); setIsRefreshing(false); }}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded border border-[#DFE1E6] dark:border-gray-600 bg-white dark:bg-gray-800 text-[#5E6C84] dark:text-gray-400 hover:bg-[#F4F5F7] dark:hover:bg-gray-700 transition-colors shrink-0"
        >
          <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
          <span>{isRefreshing ? 'Refreshing…' : 'Refresh'}</span>
        </button>
      </div>
      </div>

      {displayMode === 'full' && (<Fragment>
      <GroupSelector
        groups={groups}
        selectedMembers={selectedMembers}
        memberDisplayNames={memberDisplayNames}
        onAddMember={addMember}
        onRemoveMember={removeMember}
        onSelectGroup={selectGroup}
        onSelectAllMembers={selectAllMembers}
      >
        {/* Color legend — member → color mapping */}
        {selectedMembers.length > 1 && (
          <div className="px-4 py-2 flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-medium text-[#5E6C84] dark:text-gray-400">Colors:</span>
            {[...selectedMembers].sort().map((m, i) => (
              <span key={m} className="inline-flex items-center gap-1 text-[10px] text-[#5E6C84] dark:text-gray-400">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: SWIMLANE_PALETTE[i % SWIMLANE_PALETTE.length] }} />
                {memberDisplayNames[m] || m}
              </span>
            ))}
          </div>
        )}
      </GroupSelector>

      <GroupByControls
        groupBy={groupBy}
        subGroupBy="none"
        subSubGroupBy="none"
        onGroupByChange={setGroupBy}
        onSubGroupByChange={() => {}}
        onSubSubGroupByChange={() => {}}
        groupByOptions={['none', 'project', 'assignee', 'priority', 'type', 'parent', 'status', 'sprint', 'statusCategory', 'reporter']}
        levels={1}
      />

      {/* Filters */}
      <FilterBar
        filters={filters as unknown as UnifiedFilters}
        onChange={(f) => setFilters(f as unknown as WorklogFilterBarFilters)}
        period={{
          options: [
            { key: 'today', label: 'Today' },
            { key: 'week', label: 'Week' },
            { key: 'month', label: 'Month' },
            { key: 'year', label: 'Year' },
          ],
          active: filters.period,
          onChange: (key) => setFilters(prev => ({ ...prev, period: key as WorklogFilterBarFilters['period'] })),
        }}
        quickPills={[
          { key: 'onlyMyIssues', label: 'Only My Issues', active: filters.onlyMyIssues ?? false, onToggle: () => setFilters(prev => ({ ...prev, onlyMyIssues: !prev.onlyMyIssues })) },
          { key: 'recentlyUpdated', label: 'Recently Updated', active: filters.recentlyUpdated ?? false, onToggle: () => setFilters(prev => ({ ...prev, recentlyUpdated: !prev.recentlyUpdated })) },
          { key: 'dueThisWeek', label: 'Due This Week', active: filters.dueThisWeek ?? false, onToggle: () => setFilters(prev => ({ ...prev, dueThisWeek: !prev.dueThisWeek })) },
          { key: 'highPriority', label: 'High Priority', active: filters.highPriority ?? false, onToggle: () => setFilters(prev => ({ ...prev, highPriority: !prev.highPriority })) },
        ]}
      />

      </Fragment>)}

      {/* Calendar */}
      <div className="flex-1 min-h-0 mt-4">
        <WorklogCalendar
          mode={mode}
          baseDate={baseDate}
          entriesByDate={entriesByDate}
          dailyHours={dailyHours}
          groupBy={groupByField}
          editMode={editMode}
          showWeekends={showWeekends}
          onNavigate={handleNavigate}
          onModeChange={setMode}
          onEntryClick={setEditEntry}
          onDayClick={handleDayClick}
          onDragEnd={handleDragEnd}
        />
      </div>

      {/* Edit Worklog Modal */}
      {editEntry && (
        <EditWorklogModal
          entry={editEntry}
          onSaveDraft={handleEditSave}
          onDeleteDraft={handleEditDelete}
          onClose={() => setEditEntry(null)}
        />
      )}

      {/* Worklog Review Changes popup */}
      {worklogReviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setWorklogReviewOpen(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#DFE1E6] dark:border-gray-700 flex-shrink-0">
              <h3 className="text-sm font-semibold text-[#172B4D] dark:text-gray-100">Review Worklog Changes</h3>
              <button onClick={() => setWorklogReviewOpen(false)} className="text-[#5E6C84] hover:text-[#172B4D] dark:hover:text-gray-100 p-0.5">
                <XCircle size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {Object.entries(worklogDrafts).map(([worklogId, draft]) => {
                const entry = data?.entries.find(e => e.id === worklogId);
                if (!entry) return null;
                return (
                  <div key={worklogId} className="flex items-center justify-between px-3 py-2 bg-[#FAFBFC] dark:bg-gray-700/50 border border-[#DFE1E6] dark:border-gray-700 rounded-lg">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-[#0052CC] dark:text-blue-400">{entry.issueKey}</span>
                        <span className={cn(
                          'text-[10px] px-1.5 py-0.5 rounded font-medium',
                          draft.type === 'delete'
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                        )}>
                          {draft.type === 'delete' ? 'Delete' : 'Update'}
                        </span>
                      </div>
                      {draft.type === 'update' && (
                        <div className="text-[11px] text-[#5E6C84] dark:text-gray-400 mt-0.5 space-x-2">
                          <span>{(draft.timeSpentSeconds / 3600).toFixed(1)}h</span>
                          {draft.started && <span>· {draft.started.slice(0, 16).replace('T', ' ')}</span>}
                          {draft.comment && <span>· "{draft.comment.slice(0, 30)}{draft.comment.length > 30 ? '…' : ''}"</span>}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        const next = { ...worklogDrafts };
                        delete next[worklogId];
                        setWorklogDrafts(next);
                      }}
                      className="text-[10px] text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 px-1.5 py-0.5 rounded ml-2 flex-shrink-0"
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
              {Object.keys(worklogDrafts).length === 0 && (
                <p className="text-xs text-[#5E6C84] dark:text-gray-400 text-center py-8">No pending changes</p>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[#DFE1E6] dark:border-gray-700 flex-shrink-0">
              <button
                onClick={() => { setWorklogDrafts({}); setWorklogReviewOpen(false); }}
                className="text-xs px-2.5 py-1.5 rounded border border-[#DFE1E6] dark:border-gray-600 text-[#5E6C84] dark:text-gray-400 hover:bg-[#F4F5F7] dark:hover:bg-gray-700 transition-colors"
              >
                Discard All
              </button>
              <button
                onClick={handleApplyWorklogDrafts}
                disabled={Object.keys(worklogDrafts).length === 0}
                className="text-xs px-3 py-1.5 rounded bg-[#0052CC] text-white hover:bg-[#0747A6] disabled:opacity-50 transition-colors"
              >
                Apply All Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={cn(
          'fixed bottom-6 right-6 z-[60] flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium',
          toast.type === 'success' ? 'bg-[#36B37E] text-white' : 'bg-red-500 text-white',
        )}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          {toast.message}
        </div>
      )}
      <LoadingOverlay loading={isRefreshing} message="Refreshing…" />
    </div>
  );
}
