import { useState, useMemo, useCallback, useRef } from 'react';
import useSWR from 'swr';
import { fetchSubTasks, fetchTasksByDateRange, distributeEstimates, buildExistingSchedule, fetchSubTasksByAssignee } from '@/lib/work-est-api';
import type { WorkEstSubTask, WorkEstDistributeResult } from '@/lib/work-est-api';
import type { UnifiedFilters } from '@/lib/filter-constants';

export interface WorkEstDateRange {
  from: string;
  to: string;
}

/** Return YYYY-MM-DD in LOCAL timezone */
function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function defaultDateRange(): WorkEstDateRange {
  const today = new Date();
  const day = today.getDay();
  const offset = day === 0 ? 1 : day === 6 ? 2 : 0;
  const start = new Date(today);
  if (offset) start.setDate(start.getDate() + offset);
  const from = localDateStr(start);
  const end = new Date(start);
  end.setDate(end.getDate() + 14);
  const to = localDateStr(end);
  return { from, to };
}

export function useWorkEst(parentKeys: string[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [manualEstimates, setManualEstimates] = useState<Map<string, number>>(new Map());
  const [dateRange, setDateRange] = useState<WorkEstDateRange>(defaultDateRange);
  const [filters, setFilters] = useState<UnifiedFilters>({ searchText: '' });
  // Selected user for distribution (empty = currentUser)
  const [selectedUser, setSelectedUser] = useState<string>('');
  // Timeline display state — set by either loadExistingData or runDistribution
  const [distribution, setDistribution] = useState<WorkEstDistributeResult | null>(null);
  // Load state — whether user has clicked "Load" to view member's existing workload
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);
  const [memberSubTasks, setMemberSubTasks] = useState<WorkEstSubTask[]>([]);
  const [isLoadingMemberSubTasks, setIsLoadingMemberSubTasks] = useState(false);
  // Allocation state — whether user has clicked "Phân rã" to distribute selected sub-tasks
  const [hasAllocated, setHasAllocated] = useState(false);
  // Distribution errors — non-null when distribution has errors (partial result still shown)
  const [distributionErrors, setDistributionErrors] = useState<string[] | null>(null);
  // Refs to capture latest state at click time
  const dateRangeRef = useRef(dateRange);
  dateRangeRef.current = dateRange;
  const selectedUserRef = useRef(selectedUser);
  selectedUserRef.current = selectedUser;
  const selectedSubTasksRef = useRef<WorkEstSubTask[]>([]);

  // ── Fetch ────────────────────────────────────────────────────────────
  const swrKey = parentKeys.length > 0 ? ['work-est-subtasks', ...parentKeys.sort()] : null;

  const { data: subTasks, error, isLoading, mutate } = useSWR(
    swrKey,
    () => fetchSubTasks([...parentKeys]),
    { revalidateOnFocus: false, dedupingInterval: 30_000 },
  );

  // ── Load existing workload for selected member ───────────────────────
  const loadExistingData = useCallback(async () => {
    const { from, to } = dateRangeRef.current;
    const username = selectedUserRef.current || undefined;

    // Phần 1: Load workload cho timeline (chỉ khi có date range)
    if (from && to) {
      setIsLoadingExisting(true);
      try {
        const dateRangeTasks = await fetchTasksByDateRange(from, to, username);
        const result = buildExistingSchedule(dateRangeTasks, from, to);
        setDistribution(result);
        setHasLoaded(true);
        setHasAllocated(false);
      } finally {
        setIsLoadingExisting(false);
      }
    }

    // Phần 2: Luôn fetch ALL sub-task của member vào Section B (không cần date range)
    setIsLoadingMemberSubTasks(true);
    try {
      const tasks = await fetchSubTasksByAssignee(username);
      console.log('[work-est] load member tasks count:', tasks?.length);
      setMemberSubTasks(tasks ? [...tasks] : []);
    } catch (e) {
      console.error('[work-est] load member tasks error:', e);
      setMemberSubTasks([]);
    } finally {
      setIsLoadingMemberSubTasks(false);
    }
  }, []);

  // ── Client-side filter (combined: memberSubTasks + parent-key subTasks) ───
  const allSource = useMemo((): WorkEstSubTask[] => {
    const seen = new Set<string>();
    const combined: WorkEstSubTask[] = [];
    for (const st of [...memberSubTasks, ...(subTasks ?? [])]) {
      if (!seen.has(st.key)) { seen.add(st.key); combined.push(st); }
    }
    return combined;
  }, [memberSubTasks, subTasks]);

  const filteredSubTasks = useMemo((): WorkEstSubTask[] => {
    if (!allSource) return [];
    return allSource.filter(st => {
      if (filters.searchText) {
        const q = filters.searchText.toLowerCase();
        if (!st.key.toLowerCase().includes(q) && !st.summary.toLowerCase().includes(q)) return false;
      }
      if ((filters.projectIn?.length ?? 0) > 0) {
        const m = filters.projectIn!.includes(st.projectKey);
        if (filters.projectExclude ? m : !m) return false;
      }
      if ((filters.issuetypeIn?.length ?? 0) > 0) {
        const m = filters.issuetypeIn!.includes(st.issueTypeName);
        if (filters.issuetypeExclude ? m : !m) return false;
      }
      if ((filters.statusIn?.length ?? 0) > 0) {
        const m = filters.statusIn!.includes(st.status);
        if (filters.statusExclude ? m : !m) return false;
      }
      if ((filters.priorityIn?.length ?? 0) > 0) {
        const m = filters.priorityIn!.includes(st.priority);
        if (filters.priorityExclude ? m : !m) return false;
      }
      if ((filters.assigneeIn?.length ?? 0) > 0) {
        const m = filters.assigneeIn!.some(a => {
          if (a === 'currentUser()') return true;
          if (a === 'EMPTY') return !st.assignee;
          return st.assignee === a;
        });
        if (filters.assigneeExclude ? m : !m) return false;
      }
      if ((filters.reporterIn?.length ?? 0) > 0) {
        const m = filters.reporterIn!.some(r => {
          if (r === 'currentUser()') return true;
          return st.reporter === r;
        });
        if (filters.reporterExclude ? m : !m) return false;
      }
      return true;
    });
  }, [subTasks, filters]);

  // ── Apply manual estimates ───────────────────────────────────────────
  const patchedSubTasks = useMemo((): WorkEstSubTask[] => {
    return filteredSubTasks.map(st => ({
      ...st,
      manualEstimateHours: manualEstimates.get(st.key) ?? null,
    }));
  }, [filteredSubTasks, manualEstimates]);

  // ── Selected / unselected ────────────────────────────────────────────
  const selectedSubTasks = useMemo(() => patchedSubTasks.filter(st => selectedIds.has(st.key)), [patchedSubTasks, selectedIds]);
  const unselectedSubTasks = useMemo(() => patchedSubTasks.filter(st => !selectedIds.has(st.key)), [patchedSubTasks, selectedIds]);

  const existingDayAllocations = useMemo((): Record<string, number> => {
    const map: Record<string, number> = {};
    for (const st of unselectedSubTasks) {
      if (st.duedate && st.originalEstimateSeconds > 0) {
        map[st.duedate] = (map[st.duedate] ?? 0) + st.originalEstimateSeconds;
      }
    }
    return map;
  }, [unselectedSubTasks]);

  // ── Keep selectedSubTasksRef in sync ─────────────────────────────────
  selectedSubTasksRef.current = selectedSubTasks;

  // ── Explicit distribution — runs fresh on each click ─────────────────
  const runDistribution = useCallback(async () => {
    const checkedTasks = selectedSubTasksRef.current;
    const { from, to } = dateRangeRef.current;

    if (checkedTasks.length === 0) return;

    // 1. Auto-fetch ANY sub-tasks with duedate or worklogs in the date range
    //    If a specific user is selected, fetch their tasks/worklogs instead of currentUser()
    const dateRangeTasks = await fetchTasksByDateRange(from, to, selectedUserRef.current || undefined);

    // 2. Build existing allocations from worklogDays of ALL found tasks (per-day)
    const existingAllocs: Record<string, number> = {};
    for (const st of dateRangeTasks) {
      const wd = (st as any).worklogDays as Record<string, number> | undefined;
      if (wd) {
        for (const [day, secs] of Object.entries(wd)) {
          if (secs > 0) {
            existingAllocs[day] = (existingAllocs[day] ?? 0) + secs;
          }
        }
      } else if (st.loggedSeconds > 0) {
        existingAllocs[from] = (existingAllocs[from] ?? 0) + st.loggedSeconds;
      }

      // B. Count existing estimates by duedate (member's scheduled tasks)
      if (st.duedate && st.originalEstimateSeconds > 0) {
        existingAllocs[st.duedate] = (existingAllocs[st.duedate] ?? 0) + st.originalEstimateSeconds;
      }
    }

    // 3. Display: all tasks with worklogs + unchecked from list (dedup by key)
    const uncheckedFromList = patchedSubTasks.filter(st => !selectedIds.has(st.key));
    const seenKeys = new Set<string>();
    const deduped: WorkEstSubTask[] = [];
    for (const st of [...dateRangeTasks, ...uncheckedFromList]) {
      if (!seenKeys.has(st.key)) {
        seenKeys.add(st.key);
        deduped.push(st);
      }
    }

    const result = distributeEstimates(checkedTasks, from, to, existingAllocs, deduped);
    setDistribution(result);

    if (result.errors && result.errors.length > 0) {
      setDistributionErrors(result.errors);
      setHasAllocated(false);
    } else {
      setDistributionErrors(null);
      setHasAllocated(true);
    }
  }, [patchedSubTasks, selectedIds]);

  const resetDistribution = useCallback(() => {
    setSelectedIds(new Set());
    setManualEstimates(new Map());
    setDateRange(defaultDateRange());
    setFilters({ searchText: '' });
    setSelectedUser('');
    setDistribution(null);
    setHasLoaded(false);
    setHasAllocated(false);
    setDistributionErrors(null);
    setMemberSubTasks([]);
  }, []);

  // ── Selection ────────────────────────────────────────────────────────
  const toggleSelection = useCallback((key: string) => {
    setSelectedIds(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds(prev => {
      if (!filteredSubTasks) return prev;
      if (prev.size === filteredSubTasks.length) return new Set();
      return new Set(filteredSubTasks.map(st => st.key));
    });
  }, [filteredSubTasks]);

  const isAllSelected = useMemo(() => !!(filteredSubTasks?.length && selectedIds.size === filteredSubTasks.length), [filteredSubTasks, selectedIds]);

  const setManualEstimate = useCallback((key: string, hours: number | null) => {
    setManualEstimates(prev => {
      const n = new Map(prev);
      if (hours === null || hours <= 0) n.delete(key);
      else n.set(key, Math.min(hours, 8));
      return n;
    });
  }, []);

  return {
    subTasks: patchedSubTasks,
    filteredCount: filteredSubTasks.length,
    totalCount: subTasks?.length ?? 0,
    isLoading, error, mutate,
    filters, setFilters,
    selectedIds, toggleSelection, toggleSelectAll, isAllSelected,
    manualEstimates, setManualEstimate,
    dateRange, setDateRange,
    selectedUser, setSelectedUser,
    distribution, runDistribution, resetDistribution,
    hasLoaded, loadExistingData, isLoadingExisting,
    memberSubTasks, isLoadingMemberSubTasks,
    hasAllocated,
    distributionErrors,
  };
}
