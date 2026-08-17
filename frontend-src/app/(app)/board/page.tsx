'use client';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { api, getStoredUser } from '@/lib/api';
import { startOfWeek, addDays, startOfMonth, endOfMonth, startOfYear, endOfYear, format } from 'date-fns';
import { RefreshCw, CheckCircle2, XCircle, X, Loader2, Pencil, Check, Undo2, AlertTriangle, Info } from 'lucide-react';
import { DEFAULT_GROUPS, MEMBER_DISPLAY_NAMES } from '@/lib/team-constants';
import { GroupSelector } from '@/components/shared/group-selector';
import { GroupByControls } from '@/components/shared/group-by-controls';
import { useBoardState } from '@/hooks/use-board-state';
import { useStatusColumns } from '@/hooks/use-status-columns';
import { KanbanBoard, type BoardColumn, type BoardColumnDef, type SwimlaneStats, type ColumnData, type SubGroup } from '@/components/board/kanban-board';
import { EMPTY_FILTERS, applyFilters, type BoardFilters } from '@/components/board/board-filters';
import { FilterBar } from '@/components/shared/filter-bar';
import type { UnifiedFilters } from '@/lib/filter-constants';
import { IssueDetailPanel } from '@/components/issues/issue-detail-panel';
import { BoardEditContext } from '@/contexts/board-edit';
import { LoadingOverlay } from '@/components/shared/loading-overlay';
import { useEpics } from '@/hooks/use-epics';
import type { SubSubGroup } from '@/components/board/kanban-board';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { JiraIssue, JiraTransition } from '@/types/jira';
import type { TeamGroup } from '@/types/jira';
import { validateWorklogRules } from '@/lib/worklog-validation';
import { fetchTodayWorklogs, deleteWorklog, addWorklog } from '@/lib/worklog-api';

// ─── Page component ──────────────────────────────────────────────────────────

export default function BoardPage() {
  const currentUser = getStoredUser() as { name?: string } | null;
  const currentUsername = currentUser?.name;

  // Status-based 5-column mapping
  const { statusColumnMap } = useStatusColumns();

  // Filter state
  const [filters, setFilters] = useState<BoardFilters>({
    ...EMPTY_FILTERS,
    period: 'week',
    dateRangeMode: 'old',
    issuetypeIn: ['Sub-task'],
    statusIn: ['Cancelled', 'Closed', 'Done', 'Rejected'],
    statusExclude: true,
  });

  // After mount, default assignee filter = current user
  useEffect(() => {
    if (currentUsername && !filters.assigneeIn && !filters.assigneeExclude) {
      setFilters(prev => ({ ...prev, assigneeIn: ['currentUser()'] }));
    }
  }, [currentUsername]); // eslint-disable-line react-hooks/exhaustive-deps
  const [quickViewKey, setQuickViewKey] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [displayMode, setDisplayMode] = useState<'full' | 'focus'>('full');
  const [legendOpen, setLegendOpen] = useState(false);
  const epics = useEpics();
  const epicMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const e of epics) map[e.key] = e.summary;
    return map;
  }, [epics]);

  // ── Staged edit state ──────────────────────────────────────────────────
  /** Per-issue draft changes: { [issueKey]: { [field]: newValue } } */
  const [drafts, setDrafts] = useState<Record<string, Record<string, unknown>>>({});
  /** Which cards have pencil toggled on (showing editable fields). */
  const [editingCards, setEditingCards] = useState<Set<string>>(new Set());
  /** Confirm-apply popup */
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applySuccess, setApplySuccess] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const totalDraftFields = useMemo(
    () => Object.values(drafts).reduce((s, d) => s + Object.keys(d).length, 0),
    [drafts],
  );

  function toggleEditing(issueKey: string) {
    setEditingCards(prev => {
      const next = new Set(prev);
      if (next.has(issueKey)) { next.delete(issueKey); } else { next.add(issueKey); }
      return next;
    });
  }

  function onFieldDraft(issueKey: string, field: string, value: unknown) {
    setDrafts(prev => ({
      ...prev,
      [issueKey]: { ...(prev[issueKey] || {}), [field]: value },
    }));
  }

  function onFieldRevert(issueKey: string, field: string) {
    setDrafts(prev => {
      if (!prev[issueKey]) return prev;
      const nextIssue = { ...prev[issueKey] };
      delete nextIssue[field];
      if (Object.keys(nextIssue).length === 0) {
        const next = { ...prev };
        delete next[issueKey];
        return next;
      }
      return { ...prev, [issueKey]: nextIssue };
    });
  }

  function cancelAllDrafts() {
    setDrafts({});
    setEditingCards(new Set());
  }

  async function confirmApply() {
    setApplying(true);
    setApplyError(null);

    // Pre-fetch today's worklogs once for worklog-rule validation
    let todayWorklogs: Awaited<ReturnType<typeof fetchTodayWorklogs>> = [];
    const todayStr = new Date().toISOString().slice(0, 10);
    if (currentUsername) {
      try {
        todayWorklogs = await fetchTodayWorklogs(currentUsername);
      } catch { /* validation will just skip pre-fetched data */ }
    }

    // Build flat issue lookup keyed by issueKey for lifetime total
    const issueByKey = new Map<string, JiraIssue>();
    for (const [, issues] of Object.entries(grouped)) {
      for (const issue of issues) {
        issueByKey.set(issue.key, issue);
      }
    }

    const issuesWithErrors: string[] = [];
    for (const [issueKey, issueDrafts] of Object.entries(drafts)) {
      try {
        const fields: Record<string, unknown> = {};
        for (const [field, value] of Object.entries(issueDrafts)) {
          switch (field) {
            case 'status': {
              const statusObj = value && typeof value === 'object' ? value as { id?: string; name?: string } : null;
              // Fetch fresh transitions to get current valid transition IDs
              const { data: transData } = await api.get<{ transitions: Array<{ id: string; to?: { name: string } }> }>(
                `/issue/${issueKey}/transitions`,
              );
              const freshTransition = statusObj?.name
                ? transData.transitions.find(t => t.to?.name === statusObj.name)
                : statusObj?.id
                  ? transData.transitions.find(t => t.id === statusObj.id)
                  : null;
              if (freshTransition) {
                await api.post(`/issue/${issueKey}/transitions`, { transition: { id: Number(freshTransition.id) } });
              }
              break;
            }
            case 'assignee':
              fields.assignee = value ? { name: value } : null;
              break;
            case 'priority':
              fields.priority = { name: value };
              break;
            case 'summary':
              fields.summary = String(value);
              break;
            case 'duedate':
              fields.duedate = value || null;
              break;
            case 'originalEstimate': {
              // value is in hours, convert to Jira format "Xh"
              const h = Number(value);
              fields.timetracking = { originalEstimate: `${h}h` };
              break;
            }
            case 'timeSpent': {
              // Overwrite worklog for today on the correct sub-task
              const hs = Number(value);
              if (hs <= 0) break;

              const issue = issueByKey.get(issueKey);
              const lifetimeTotal = issue?.fields.timetracking?.timeSpentSeconds ?? 0;
              const todayForIssue = todayWorklogs.filter(e => e.issueKey === issueKey);

              const validation = validateWorklogRules({
                issueKey,
                newHoursRequested: hs,
                todayWorklogsForIssue: todayForIssue,
                allTodayWorklogs: todayWorklogs,
                lifetimeTotalSeconds: lifetimeTotal,
              });

              if (!validation.valid) {
                issuesWithErrors.push(`${issueKey}: ${validation.error}`);
                break;
              }

              // Delete existing today worklogs for this sub-task (overwrite model)
              for (const wl of todayForIssue) {
                await deleteWorklog(issueKey, wl.id);
              }
              // Create new worklog with correct started time and seconds
              await addWorklog({
                issueKey,
                timeSpentSeconds: Math.round(hs * 3600),
                comment: '',
                started: validation.started!,
              });
              break;
            }
          }
        }
        if (Object.keys(fields).length > 0) {
          await api.put(`/issue/${issueKey}`, { fields });
        }
      } catch {
        issuesWithErrors.push(issueKey);
      }
    }
    if (issuesWithErrors.length > 0) {
      setApplyError(`Failed for: ${issuesWithErrors.join(', ')}. Other changes applied.`);
      setApplySuccess(false);
    } else {
      setDrafts({});
      setEditingCards(new Set());
      mutate();
      setApplyError(null);
      setApplySuccess(true);
    }
    setApplying(false);
  }
  const [groups] = useState<TeamGroup[]>(DEFAULT_GROUPS);
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

  // ── Move confirmation popup ─────────────────────────────────────────────
  const [movePopup, setMovePopup] = useState<{
    issueKey: string;
    issueId: string;
    targetCol: string;
    targetLabel: string;
    transitions: JiraTransition[] | null;
    loading: boolean;
  } | null>(null);

  const handleMoveRequest = useCallback(
    async (issueId: string, issueKey: string, targetCol: string, targetLabel: string) => {
      setMovePopup({ issueKey, issueId, targetCol, targetLabel, transitions: null, loading: true });
      try {
        const { data } = await api.get<{ transitions: JiraTransition[] }>(`/issue/${issueKey}/transitions`);
        setMovePopup(prev => prev ? { ...prev, transitions: data.transitions, loading: false } : null);
      } catch {
        setMovePopup(null);
      }
    },
    [],
  );

  // Build dynamic JQL: expand beyond currentUser when viewing team members
  const boardJql = useMemo<string | undefined>(() => {
    if (selectedMembers.length === 0) return undefined; // "All Members" — use default (currentUser)
    if (!currentUsername) return undefined;

    // If only currentUser is selected, use default (faster, cached)
    if (selectedMembers.length === 1 && selectedMembers[0] === currentUsername) {
      return undefined;
    }

    // Team mode: fetch issues for all selected members
    const assigneeClause = selectedMembers
      .map(m => `assignee = "${m}"`)
      .join(' OR ');
    return `(${assigneeClause}) AND resolution = Unresolved ORDER BY updated DESC`;
  }, [selectedMembers, currentUsername]);

  const { grouped, dynamicColumns, isLoading, error, mutate, moveCard, toast } =
    useBoardState(statusColumnMap, boardJql);

  // Build issueKey → issue lookup for Review Changes popup
  const issueMap = useMemo(() => {
    const map = new Map<string, JiraIssue>();
    for (const issues of Object.values(grouped)) {
      for (const issue of issues) map.set(issue.key, issue);
    }
    return map;
  }, [grouped]);

  const onIssueUpdate = useCallback(() => { mutate(); }, [mutate]);


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

  // Derive date range from period filter
  const dateFiltered = useMemo(() => {
    if (!filters.period) return filters;
    const now = new Date();
    let dateFrom: string | undefined;
    let dateTo: string | undefined;

    switch (filters.period) {
      case 'today':
        dateTo = format(now, 'yyyy-MM-dd');
        if (filters.dateRangeMode !== 'old') dateFrom = dateTo;
        break;
      case 'week':
        dateTo = format(addDays(startOfWeek(now, { weekStartsOn: 1 }), 6), 'yyyy-MM-dd');
        if (filters.dateRangeMode !== 'old') dateFrom = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
        break;
      case 'month':
        dateTo = format(endOfMonth(now), 'yyyy-MM-dd');
        if (filters.dateRangeMode !== 'old') dateFrom = format(startOfMonth(now), 'yyyy-MM-dd');
        break;
      case 'year':
        dateTo = format(endOfYear(now), 'yyyy-MM-dd');
        if (filters.dateRangeMode !== 'old') dateFrom = format(startOfYear(now), 'yyyy-MM-dd');
        break;
    }

    return { ...filters, dateFrom, dateTo };
  }, [filters]);

  // effectiveFilters: dateFiltered + BoardFilterBar filters (groups handled via JQL)
  const effectiveFilters = dateFiltered;

  // Apply client-side filters to each column
  const filteredGrouped = useMemo(() => {
    const result: Record<string, JiraIssue[]> = {};
    for (const [colName, issues] of Object.entries(grouped)) {
      result[colName] = applyFilters(issues, effectiveFilters, currentUsername);
    }
    return result;
  }, [grouped, effectiveFilters, currentUsername]);

  // ── 3-level grouping state ──────────────────────────────────────────────
const [groupBy, setGroupBy]             = useState<string>('assignee');
const [subGroupBy, setSubGroupBy]       = useState<string>('project');
const [subSubGroupBy, setSubSubGroupBy] = useState<string>('parent');

  // Unique status names from current data — used when groupBy='status' as columns
  const statusColumns = useMemo(() => {
    if (groupBy !== 'status') return undefined;
    const map = new Map<string, { name: string; color: string; category: string }>();
    for (const issues of Object.values(filteredGrouped)) {
      for (const issue of issues) {
        const name = issue.fields.status.name;
        if (!map.has(name)) {
          const cat = issue.fields.status.statusCategory?.key ?? 'new';
          const color = cat === 'done' ? '#36B37E' : cat === 'indeterminate' ? '#0052CC' : '#5E6C84';
          map.set(name, { name, color, category: cat });
        }
      }
    }
    // Sort by workflow: To Do → In Progress → Done, then alphabetically within category
    const catOrder: Record<string, number> = { new: 0, indeterminate: 1, done: 2 };
    return Array.from(map.values()).sort((a, b) => {
      const diff = (catOrder[a.category] ?? 0) - (catOrder[b.category] ?? 0);
      return diff !== 0 ? diff : a.name.localeCompare(b.name);
    });
  }, [groupBy, filteredGrouped]);

  // Build dynamic BoardColumn array
  const columns: BoardColumn[] = useMemo(() => {
    // Status-as-columns: redistribute all issues by their actual status name
    if (groupBy === 'status' && statusColumns) {
      const allIssues: JiraIssue[] = [];
      for (const issues of Object.values(filteredGrouped)) {
        for (const issue of issues) allIssues.push(issue);
      }
      return statusColumns.map(sc => {
        const issues = allIssues.filter(i => i.fields.status.name === sc.name);
        return {
          id: sc.name.toLowerCase().replace(/\s+/g, '-'),
          label: sc.name,
          issues,
          color: sc.color,
          statusIds: [],
        };
      });
    }

    if (dynamicColumns.length > 0) {
      return dynamicColumns.map(col => ({
        id: col.name.toLowerCase().replace(/\s+/g, '-'),
        label: col.name,
        issues: filteredGrouped[col.name] || [],
        color: col.color,
        wipMin: col.wipMin,
        wipMax: col.wipMax,
        statusIds: col.statusIds,
      }));
    }
    return [
      { id: 'to-do', label: 'To Do', issues: filteredGrouped['To Do'] || [], color: '#5E6C84', wipMax: 5, statusIds: [] },
      { id: 'in-progress', label: 'In Progress', issues: filteredGrouped['In Progress'] || [], color: '#0052CC', wipMax: 5, statusIds: [] },
      { id: 'done', label: 'Done', issues: filteredGrouped['Done'] || [], color: '#36B37E', statusIds: [] },
    ];
  }, [groupBy, statusColumns, dynamicColumns, filteredGrouped]);

  // ── Dynamic per-type column filtering ───────────────────────────────────
  // Build: issueType → Set<columnName> from ALL unfiltered issues
  const typeColumnMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const [colName, issues] of Object.entries(grouped)) {
      for (const issue of issues) {
        const typeName = issue.fields.issuetype.name;
        if (!map.has(typeName)) map.set(typeName, new Set());
        map.get(typeName)!.add(colName);
      }
    }
    return map;
  }, [grouped]);

  // Only show columns relevant to the currently visible issue types
  const visibleColumns = useMemo(() => {
    if (columns.length === 0) return columns;

    // Determine visible types (from filter or all)
    const visibleTypes = filters.issuetypeIn?.length
      ? new Set(filters.issuetypeIn)
      : new Set(typeColumnMap.keys());

    return columns.filter(col => {
      // Always show if column has issues
      if (col.issues.length > 0) return true;

      // Check: does any visible type have this column in its status set?
      for (const typeName of visibleTypes) {
        const typeCols = typeColumnMap.get(typeName);
        if (typeCols?.has(col.label)) return true;
      }
      return false;
    });
  }, [columns, typeColumnMap, filters.issuetypeIn]);

  // Helper: resolve sprint from issue fields
  function resolveSprint(issue: JiraIssue): { id: string; name: string } | null {
    const raw = (issue.fields as any).sprint ?? (issue.fields as any).customfield_10020;
    if (raw) {
      if (Array.isArray(raw)) {
        const active = (raw as any[]).find((s: any) => s.state === 'active');
        return active ? { id: String(active.id), name: active.name } : null;
      }
      return { id: String((raw as any).id), name: (raw as any).name };
    }
    return null;
  }

  // Get a field value from an issue for grouping
  function getFieldValue(issue: JiraIssue, field: string): { key: string; label: string } | null {
    if (field === 'none') return null;
    switch (field) {
      case 'project':
        return { key: issue.fields.project.key, label: `${issue.fields.project.name} (${issue.fields.project.key})` };
      case 'assignee': {
        const name = issue.fields.assignee?.name ?? '__unassigned';
        const label = MEMBER_DISPLAY_NAMES[name] ?? issue.fields.assignee?.displayName ?? 'Unassigned';
        return { key: name, label };
      }
      case 'priority':
        return { key: issue.fields.priority?.name ?? 'None', label: issue.fields.priority?.name ?? 'None' };
      case 'type':
        return { key: issue.fields.issuetype.name, label: issue.fields.issuetype.name };
      case 'parent':
        if (issue.fields.parent) return { key: issue.fields.parent.key, label: `${issue.fields.parent.key} — ${issue.fields.parent.fields.summary}` };
        return { key: '__no_parent', label: 'No Parent' };
      case 'sprint': {
        const s = resolveSprint(issue);
        if (s) return { key: String(s.id), label: s.name };
        return { key: '__nosprint', label: 'No Sprint' };
      }
      case 'status':
        return { key: issue.fields.status.name, label: issue.fields.status.name };
      case 'statusCategory': {
        const cat = issue.fields.status.statusCategory;
        if (!cat) return { key: '__unknown', label: 'Unknown' };
        const catLabels: Record<string, string> = { new: 'To Do', indeterminate: 'In Progress', done: 'Done' };
        return { key: cat.key, label: catLabels[cat.key] ?? cat.key };
      }
      case 'reporter': {
        const r = issue.fields.reporter;
        if (r) return { key: r.name, label: r.displayName ?? r.name };
        return { key: '__noreporter', label: 'No Reporter' };
      }
      case 'epic': {
        const epicKey = (issue.fields as unknown as Record<string, unknown>).customfield_10107 as string | undefined;
        if (epicKey) {
          const summary = epicMap[epicKey];
          if (summary) return { key: epicKey, label: `${epicKey} — ${summary}` };
          return { key: epicKey, label: epicKey };
        }
        return { key: '__no_epic', label: 'No Epic' };
      }
      default:
        return null;
    }
  }

  // Swimlane computation: groupBy → swimlanes, subGroupBy → sub-groups within columns
  const swimlanes = useMemo(() => {
    if (groupBy === 'none' || groupBy === 'statusCategory' || groupBy === 'status') return undefined;

    const colNames = dynamicColumns.length > 0
      ? dynamicColumns.map(c => c.name)
      : ['To Do', 'In Progress', 'Done'];

    // Collect all issues with their column assignment
    const allIssues: { issue: JiraIssue; colName: string }[] = [];
    for (const [colName, issues] of Object.entries(filteredGrouped)) {
      for (const issue of issues) allIssues.push({ issue, colName });
    }

    // Group by primary field → swimlanes
    const groupMap = new Map<string, { label: string; issues: { issue: JiraIssue; colName: string }[] }>();

    for (const item of allIssues) {
      const g1 = getFieldValue(item.issue, groupBy);
      if (!g1) continue;
      if (!groupMap.has(g1.key)) {
        groupMap.set(g1.key, { label: g1.label, issues: [] });
      }
      groupMap.get(g1.key)!.issues.push(item);
    }

    const sortedGroups = Array.from(groupMap.entries()).sort(([a], [b]) => {
      if (a === '__unassigned' || a === 'None' || a === '__no_parent') return 1;
      if (b === '__unassigned' || b === 'None' || b === '__no_parent') return -1;
      return a.localeCompare(b);
    });

    const result: { key: string; columns: Record<string, ColumnData>; stats?: SwimlaneStats }[] = [];

    for (const [, group] of sortedGroups) {
      // Build columns: group issues by column name
      const colMap = new Map<string, JiraIssue[]>();
      for (const cn of colNames) colMap.set(cn, []);
      for (const item of group.issues) {
        colMap.get(item.colName)?.push(item.issue);
      }

      // If sub-group is active, nest sub-groups within each column
      const columns: Record<string, ColumnData> = {};
      if (subGroupBy !== 'none') {
        for (const [colName, issues] of colMap) {
          // Group by sub-field within this column
          const subMap = new Map<string, JiraIssue[]>();
          for (const issue of issues) {
            const sg = getFieldValue(issue, subGroupBy);
            const sk = sg?.label ?? 'Other';
            if (!subMap.has(sk)) subMap.set(sk, []);
            subMap.get(sk)!.push(issue);
          }
          const subGroups: SubGroup[] = Array.from(subMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([label, sgIssues]) => {
              // If sub-sub-group is active, further nest within each sub-group
              let subSubGroups: SubSubGroup[] | undefined;
              if (subSubGroupBy !== 'none') {
                const ssMap = new Map<string, JiraIssue[]>();
                for (const issue of sgIssues) {
                  const ssg = getFieldValue(issue, subSubGroupBy);
                  const ssk = ssg?.label ?? 'Other';
                  if (!ssMap.has(ssk)) ssMap.set(ssk, []);
                  ssMap.get(ssk)!.push(issue);
                }
                subSubGroups = Array.from(ssMap.entries())
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([ssLabel, ssIssues]) => ({ label: ssLabel, issues: ssIssues }));
              }
              return { label, issues: sgIssues, subSubGroups };
            });
          columns[colName] = { subGroups };
        }
      } else {
        for (const [colName, issues] of colMap) {
          columns[colName] = issues;
        }
      }

      // Compute stats
      const allLaneIssues = [...colMap.values()].flat();
      let totalEstSeconds = 0, totalLoggedSeconds = 0, todoCount = 0, inProgressCount = 0, doneCount = 0;
      for (const issue of allLaneIssues) {
        totalEstSeconds += issue.fields.timetracking?.originalEstimateSeconds ?? 0;
        totalLoggedSeconds += issue.fields.timetracking?.timeSpentSeconds ?? 0;
        const cat = issue.fields.status.statusCategory.key;
        if (cat === 'new') todoCount++;
        else if (cat === 'indeterminate') inProgressCount++;
        else if (cat === 'done') doneCount++;
      }

      result.push({
        key: group.label,
        columns,
        stats: { taskCount: allLaneIssues.length, totalEstSeconds, totalLoggedSeconds, todoCount, inProgressCount, doneCount },
      });
    }

    return result;
  }, [groupBy, subGroupBy, subSubGroupBy, filteredGrouped, dynamicColumns]);

  // ── Flat-mode sub-groups ───────────────────────────────────────────────
  // When swimlanes are undefined (groupBy is 'none', 'status', or 'statusCategory')
  // but subGroupBy is active, nest sub-groups within each column.
  const columnsWithSubGroups = useMemo(() => {
    if (swimlanes || subGroupBy === 'none') return visibleColumns;

    return visibleColumns.map(col => {
      const subMap = new Map<string, JiraIssue[]>();
      for (const issue of col.issues) {
        const sg = getFieldValue(issue, subGroupBy);
        const key = sg?.label ?? 'Other';
        if (!subMap.has(key)) subMap.set(key, []);
        subMap.get(key)!.push(issue);
      }
      const subGroups: SubGroup[] = Array.from(subMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([label, sgIssues]) => {
          let subSubGroups: SubSubGroup[] | undefined;
          if (subSubGroupBy !== 'none') {
            const ssMap = new Map<string, JiraIssue[]>();
            for (const issue of sgIssues) {
              const ssg = getFieldValue(issue, subSubGroupBy);
              const ssk = ssg?.label ?? 'Other';
              if (!ssMap.has(ssk)) ssMap.set(ssk, []);
              ssMap.get(ssk)!.push(issue);
            }
            subSubGroups = Array.from(ssMap.entries())
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([ssLabel, ssIssues]) => ({ label: ssLabel, issues: ssIssues }));
          }
          return { label, issues: sgIssues, subSubGroups };
        });
      return { ...col, subGroups };
    });
  }, [visibleColumns, swimlanes, subGroupBy, subSubGroupBy]);

  const columnDefs = useMemo(() => {
    // Status-as-columns: derive from unique status names in current data
    if (groupBy === 'status' && statusColumns) {
      return statusColumns.map(sc => ({
        id: sc.name.toLowerCase().replace(/\s+/g, '-'),
        label: sc.name,
        color: sc.color,
        statusIds: [],
      }));
    }
    if (!swimlanes) return undefined;
    if (dynamicColumns.length > 0) {
      return dynamicColumns.map(col => ({
        id: col.name.toLowerCase().replace(/\s+/g, '-'),
        label: col.name,
        color: col.color,
        wipMin: col.wipMin,
        wipMax: col.wipMax,
        statusIds: col.statusIds,
      }));
    }
    return [
      { id: 'to-do', label: 'To Do', color: '#5E6C84', wipMax: 5, statusIds: [] },
      { id: 'in-progress', label: 'In Progress', color: '#0052CC', wipMax: 5, statusIds: [] },
      { id: 'done', label: 'Done', color: '#36B37E', statusIds: [] },
    ];
  }, [swimlanes, dynamicColumns, groupBy, statusColumns]);

  // Filter columnDefs to only show relevant columns per issue type
  const visibleColumnDefs = useMemo(() => {
    if (!columnDefs) return undefined;
    if (swimlanes) {
      return columnDefs.filter(cd => {
        // Check if any swimlane has issues in this column
        for (const lane of swimlanes) {
          const colData = lane.columns[cd.label];
          const flat = colData && 'subGroups' in colData
            ? colData.subGroups.flatMap(sg => sg.issues)
            : (colData as JiraIssue[]) || [];
          if (flat.length > 0) return true;
        }
        // Check if any visible type could have this column
        const visibleTypes = filters.issuetypeIn?.length
          ? new Set(filters.issuetypeIn)
          : new Set(typeColumnMap.keys());
        for (const typeName of visibleTypes) {
          if (typeColumnMap.get(typeName)?.has(cd.label)) return true;
        }
        return false;
      });
    }
    return columnDefs;
  }, [columnDefs, swimlanes, typeColumnMap, filters.issuetypeIn]);

  if (error) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-600 dark:text-red-400 mb-2 text-sm">Failed to load issues</p>
        <Button variant="outline" size="sm" onClick={() => mutate()}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen p-6 relative">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h1 className="text-xl font-semibold text-[#172B4D] dark:text-gray-100">
          Kanban Board
        </h1>
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
          {/* Edit/View toggle */}
          <div className="flex items-center rounded border border-[#DFE1E6] dark:border-gray-600 overflow-hidden shrink-0">
            <button
              type="button"
              onClick={() => setEditMode(false)}
              className={cn(
                'text-xs px-2.5 py-1.5 font-medium transition-colors border-r border-[#DFE1E6] dark:border-gray-600',
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
                'text-xs px-2.5 py-1.5 font-medium transition-colors inline-flex items-center gap-1',
                editMode
                  ? 'bg-[#0052CC] text-white'
                  : 'bg-white dark:bg-gray-800 text-[#5E6C84] dark:text-gray-400 hover:bg-[#F4F5F7] dark:hover:bg-gray-700',
              )}
            >
              <Pencil size={12} /> Edit
            </button>
          </div>
          {/* Legend popover */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setLegendOpen(v => !v)}
              className={cn(
                'text-xs px-2 py-1.5 rounded border transition-colors',
                legendOpen
                  ? 'bg-[#0052CC] text-white border-[#0052CC]'
                  : 'border-[#DFE1E6] dark:border-gray-600 text-[#5E6C84] dark:text-gray-400 hover:bg-[#F4F5F7] dark:hover:bg-gray-800',
              )}
              title="Legend"
            >
              <Info size={14} />
            </button>
            {legendOpen && (
              <div className="absolute top-full right-0 mt-1 w-64 bg-white dark:bg-gray-800 border border-[#DFE1E6] dark:border-gray-600 rounded shadow-xl z-50 p-3 text-[10px] text-[#5E6C84] dark:text-gray-400">
                <div className="font-semibold text-[#172B4D] dark:text-gray-200 text-xs mb-1.5">Card Colors</div>
                <div className="space-y-1 mb-2">
                  <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#DE350B] flex-shrink-0" /> Overdue / Missing estimate</div>
                  <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#FF8B00] flex-shrink-0" /> Due soon</div>
                </div>
                <div className="font-semibold text-[#172B4D] dark:text-gray-200 text-xs mb-1.5">Time Colors</div>
                <div className="space-y-1 mb-2">
                  <div>🕐 Log <span className="text-[#36B37E]">green</span> — on track</div>
                  <div>🕐 Log <span className="text-[#FF8B00]">orange</span> — over est</div>
                  <div>🕐 Log <span className="text-[#DE350B]">red</span> — {'>'}8h</div>
                  <div>⏱ Est <span className="text-[#FF8B00]">orange</span> — {'>'}8h</div>
                </div>
                <div className="font-semibold text-[#172B4D] dark:text-gray-200 text-xs mb-1.5">Icons</div>
                <div className="space-y-1">
                  <div>👤 Reporter · 👤✓ Assignee</div>
                  <div>✏️ Edit card · ⠿ Drag to move</div>
                  <div>📅 Due date · 🕐 Created</div>
                  <div>⏱ Estimate · 🕐 Logged time</div>
                </div>
              </div>
            )}
          </div>
          {editMode && (
            <Button
              variant="default"
              size="sm"
              onClick={() => setConfirmOpen(true)}
              disabled={totalDraftFields === 0}
              className={cn(
                'shrink-0 transition-all',
                totalDraftFields > 0
                  ? 'bg-[#36B37E] hover:bg-[#2D9B6C] text-white'
                  : 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed',
              )}
            >
              <Check size={14} />
              <span className="ml-1">Confirm ({totalDraftFields})</span>
            </Button>
          )}
          {editMode && (
            <Button
              variant="outline"
              size="sm"
              onClick={cancelAllDrafts}
              disabled={totalDraftFields === 0}
              className={cn(
                'shrink-0 transition-all border-[#DFE1E6] dark:border-gray-600',
                totalDraftFields > 0
                  ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-300'
                  : 'text-gray-400 cursor-not-allowed',
              )}
            >
              <X size={14} />
              <span className="ml-1">Cancel</span>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={async () => { setIsRefreshing(true); await mutate(); setIsRefreshing(false); }}
            disabled={isLoading || isRefreshing}
            className="border-[#DFE1E6] dark:border-gray-700 text-[#5E6C84] dark:text-gray-400 hover:bg-[#F4F5F7] dark:hover:bg-gray-800 shrink-0"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            <span className="ml-1.5">{isRefreshing ? 'Refreshing…' : 'Refresh'}</span>
          </Button>
        </div>
      </div>

      {/* ── Group selector ── */}
      {/* ── Sections hidden in minimal mode ── */}
      {displayMode === 'full' && (
        <>
      <GroupSelector
        groups={groups}
        selectedMembers={selectedMembers}
        memberDisplayNames={memberDisplayNames}
        onAddMember={addMember}
        onRemoveMember={removeMember}
        onSelectGroup={selectGroup}
        onSelectAllMembers={selectAllMembers}
      />

      <GroupByControls
        groupBy={groupBy}
        subGroupBy={subGroupBy}
        subSubGroupBy={subSubGroupBy}
        onGroupByChange={setGroupBy}
        onSubGroupByChange={setSubGroupBy}
        onSubSubGroupByChange={setSubSubGroupBy}
        groupByOptions={['none', 'epic', 'project', 'assignee', 'priority', 'type', 'parent', 'status', 'sprint', 'statusCategory', 'reporter']}
        subSubGroupByOptions={['none', 'epic', 'priority', 'type', 'parent']}
      />


      <FilterBar
        filters={filters as unknown as UnifiedFilters}
        onChange={(f) => setFilters(f as unknown as BoardFilters)}
        period={{
          options: [
            { key: 'today', label: 'Today' },
            { key: 'week', label: 'Week' },
            { key: 'month', label: 'Month' },
            { key: 'year', label: 'Year' },
          ],
          active: filters.period,
          onChange: (key) => setFilters(prev => ({ ...prev, period: key as BoardFilters['period'] })),
        }}
        quickPills={[
          { key: 'onlyMyIssues', label: 'Only My Issues', active: filters.onlyMyIssues, onToggle: () => setFilters(prev => ({ ...prev, onlyMyIssues: !prev.onlyMyIssues })) },
          { key: 'recentlyUpdated', label: 'Recently Updated', active: filters.recentlyUpdated, onToggle: () => setFilters(prev => ({ ...prev, recentlyUpdated: !prev.recentlyUpdated })) },
          { key: 'dueThisWeek', label: 'Due This Week', active: filters.dueThisWeek, onToggle: () => setFilters(prev => ({ ...prev, dueThisWeek: !prev.dueThisWeek })) },
          { key: 'highPriority', label: 'High Priority', active: filters.highPriority, onToggle: () => setFilters(prev => ({ ...prev, highPriority: !prev.highPriority })) },
        ]}
      />
      </>
      )}

      {/* Board */}
      <div className="flex-1 min-h-0 flex flex-col">
        <BoardEditContext.Provider value={{ editMode, editingCards, drafts, onToggleEditing: toggleEditing, onFieldDraft, onFieldRevert }}>
          <KanbanBoard
            columns={columnsWithSubGroups}
            isLoading={isLoading}
            onMoveRequest={handleMoveRequest}
            onCardClick={setQuickViewKey}
            onIssueUpdate={onIssueUpdate}
            swimlanes={swimlanes}
            columnDefs={visibleColumnDefs}
            groupBy={groupBy !== 'none' ? groupBy : undefined}
            subGroupBy={subGroupBy !== 'none' ? subGroupBy : undefined}
            subSubGroupBy={subSubGroupBy !== 'none' ? subSubGroupBy : undefined}
          />
        </BoardEditContext.Provider>
      </div>

      {/* ── Move confirmation popup ── */}
      {movePopup && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40" onClick={() => setMovePopup(null)}>
          <div className="bg-white dark:bg-gray-800 border border-[#DFE1E6] dark:border-gray-700 rounded-lg shadow-2xl w-96 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#DFE1E6] dark:border-gray-700">
              <h3 className="text-sm font-semibold text-[#172B4D] dark:text-gray-100">
                Move {movePopup.issueKey}
              </h3>
              <button onClick={() => setMovePopup(null)} className="text-[#5E6C84] hover:text-[#172B4D] dark:hover:text-gray-200">
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="p-4">
              <p className="text-xs text-[#5E6C84] dark:text-gray-400 mb-3">
                Select status for <strong className="text-[#172B4D] dark:text-gray-200">{movePopup.targetLabel}</strong>
              </p>

              {movePopup.loading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 size={20} className="animate-spin text-[#0052CC]" />
                </div>
              ) : movePopup.transitions && movePopup.transitions.length > 0 ? (
                <div className="space-y-1">
                  {movePopup.transitions.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        moveCard(movePopup.issueId, movePopup.issueKey, movePopup.targetCol, t.to.name, [t.to.id]);
                        setMovePopup(null);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-sm text-left hover:bg-[#F4F5F7] dark:hover:bg-gray-700 transition-colors"
                    >
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{
                        backgroundColor: t.to.statusCategory.key === 'new' ? '#5E6C84' : t.to.statusCategory.key === 'indeterminate' ? '#0052CC' : '#36B37E',
                      }} />
                      <span className="text-sm text-[#172B4D] dark:text-gray-200">{t.to.name}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#8993A4] dark:text-gray-500 text-center py-4">
                  No transitions available
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm apply popup ── */}
      {confirmOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40" onClick={() => { if (!applying) { setConfirmOpen(false); setApplySuccess(false); setApplyError(null); } }}>
          <div className="bg-white dark:bg-gray-800 border border-[#DFE1E6] dark:border-gray-700 rounded-xl shadow-2xl w-full max-w-3xl mx-4 flex flex-col" style={{ minHeight: '620px', maxHeight: '85vh' }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#DFE1E6] dark:border-gray-700 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className={cn(
                  'w-7 h-7 rounded-lg flex items-center justify-center',
                  applySuccess ? 'bg-[#E3FCEF]' : applyError ? 'bg-[#FFEBE6]' : 'bg-[#DEEBFF]',
                )}>
                  {applySuccess ? (
                    <CheckCircle2 size={14} className="text-[#36B37E]" />
                  ) : applyError ? (
                    <AlertTriangle size={14} className="text-[#DE350B]" />
                  ) : (
                    <CheckCircle2 size={14} className="text-[#0052CC]" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#172B4D] dark:text-gray-100">
                    {applySuccess ? 'Changes Applied' : applyError ? 'Apply Failed' : 'Review Changes'}
                  </h3>
                  <p className="text-[10px] text-[#5E6C84] dark:text-gray-400">
                    {applySuccess
                      ? 'All changes have been applied successfully.'
                      : applyError ? 'Some changes could not be applied.'
                      : `${Object.keys(drafts).length} issue(s) with ${Object.values(drafts).reduce((s, d) => s + Object.keys(d).length, 0)} change(s)`
                    }
                  </p>
                </div>
              </div>
              <button onClick={() => { if (!applying) { setConfirmOpen(false); setApplySuccess(false); setApplyError(null); } }} className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#F4F5F7] dark:hover:bg-gray-700 text-[#5E6C84] transition-colors"><X size={15} /></button>
            </div>

            {/* Body */}
            {applySuccess ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-5 py-12">
                <div className="w-14 h-14 rounded-full bg-[#E3FCEF] flex items-center justify-center mb-4">
                  <Check size={28} className="text-[#36B37E]" />
                </div>
                <p className="text-sm font-semibold text-[#172B4D] dark:text-gray-100 mb-1">
                  All changes applied successfully
                </p>
                <p className="text-xs text-[#5E6C84] dark:text-gray-400">
                  {Object.keys(drafts).length} issue(s) updated with {Object.values(drafts).reduce((s, d) => s + Object.keys(d).length, 0)} change(s).
                </p>
              </div>
            ) : applyError ? (
              <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
                <div className="flex items-center gap-2 text-xs text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <AlertTriangle size={14} /> {applyError}
                </div>
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
                {Object.entries(drafts).map(([issueKey, issueDrafts]) => {
                const issue = issueMap.get(issueKey);
                const issueSummary = issue?.fields?.summary ?? '';

                // Helpers to get human-readable value
                const getBeforeValue = (field: string): string => {
                  if (!issue) return '—';
                  switch (field) {
                    case 'summary': return issue.fields.summary ?? '';
                    case 'duedate': return issue.fields.duedate ?? 'not set';
                    case 'originalEstimate': return issue.fields.timetracking?.originalEstimateSeconds ? `${(issue.fields.timetracking.originalEstimateSeconds / 3600).toFixed(1)}h` : '0h';
                    case 'priority': return issue.fields.priority?.name ?? 'None';
                    case 'status': return issue.fields.status.name;
                    case 'assignee': return issue.fields.assignee?.displayName ?? 'Unassigned';
                    case 'timeSpent': return '—';
                    default: return '—';
                  }
                };

            const getAfterValue = (field: string, value: unknown): string => {
              switch (field) {
                case 'summary': return String(value);
                case 'duedate': return String(value || 'cleared');
                case 'originalEstimate': return `${String(value)}h`;
                case 'status':
                  if (value && typeof value === 'object' && 'name' in (value as Record<string, unknown>)) return String((value as Record<string, unknown>).name);
                  return String(value);
                case 'priority':
                  if (value && typeof value === 'object' && 'name' in (value as Record<string, unknown>)) return String((value as Record<string, unknown>).name);
                  return String(value);
                case 'assignee':
                  if (value === null || value === undefined) return 'Unassigned';
                  if (typeof value === 'object' && 'displayName' in (value as Record<string, unknown>)) return String((value as Record<string, unknown>).displayName);
                  return String(value);
                case 'timeSpent': return `${String(value)}h`;
                default: return String(value);
              }
            };

                return (
                <div key={issueKey} className="border border-[#DFE1E6] dark:border-gray-600 rounded-lg overflow-hidden">
                  {/* Issue header */}
                  <div className="flex items-center gap-2 px-3.5 py-2.5 bg-[#FAFBFC] dark:bg-gray-800 border-b border-[#DFE1E6] dark:border-gray-600">
                    <div className="w-2 h-2 rounded-full bg-[#0052CC] flex-shrink-0" />
                    <span className="text-xs font-semibold text-[#0052CC] dark:text-blue-400">{issueKey}</span>
                    <span className="text-[11px] text-[#5E6C84] dark:text-gray-400 truncate">{issueSummary}</span>
                    <span className="text-[10px] text-[#8993A4] dark:text-gray-500 ml-auto font-medium">{Object.keys(issueDrafts).length} change(s)</span>
                  </div>

                  {/* Changes table */}
                  <div className="divide-y divide-[#F4F5F7] dark:divide-gray-700">
                    {Object.entries(issueDrafts).map(([field, value]) => (
                      <div key={field} className="grid grid-cols-[100px_1fr_28px_1fr] gap-2 px-3.5 py-2.5 items-start">
                        {/* Field name */}
                        <span className="text-[11px] font-semibold text-[#5E6C84] dark:text-gray-400 uppercase tracking-wide pt-0.5 capitalize">
                          {field === 'originalEstimate' ? 'Estimate' : field}
                        </span>
                        {/* Before */}
                        <div className="min-w-0">
                          <span className="text-[11px] text-[#DE350B] dark:text-red-400 line-through block leading-tight break-words">
                            {getBeforeValue(field) || '—'}
                          </span>
                        </div>
                        {/* Arrow */}
                        <div className="flex items-center justify-center pt-0.5">
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6h7.5M7 3.5L9.5 6 7 8.5" stroke="#36B37E" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                        {/* After */}
                        <div className="min-w-0">
                          <span className="text-[11px] font-medium text-[#36B37E] dark:text-green-400 block leading-tight break-words">
                            {getAfterValue(field, value) || '—'}
                          </span>
                        </div>
                      </div>
                      ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

            {/* Footer */}
            <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-t border-[#DFE1E6] dark:border-gray-700 px-5 py-3.5 flex items-center justify-end gap-2">
              {applySuccess || applyError ? (
                <Button size="sm" onClick={() => { setConfirmOpen(false); setApplySuccess(false); setApplyError(null); }} className="bg-[#0052CC] text-white">
                  Close
                </Button>
              ) : (
                <>
                  <Button variant="outline" size="sm" onClick={() => setConfirmOpen(false)} disabled={applying}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={confirmApply}
                    disabled={applying}
                    className="bg-[#36B37E] hover:bg-[#2D9B6C] text-white"
                  >
                    {applying ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    <span className="ml-1.5">{applying ? 'Applying…' : 'Apply All Changes'}</span>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick View */}
      <IssueDetailPanel issueKey={quickViewKey} onClose={() => setQuickViewKey(null)} onUpdated={() => mutate()} />

      {/* Toast */}
      {toast && (
        <div
          className={cn(
            'fixed bottom-6 right-6 z-[60] flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all',
            toast.type === 'success' ? 'bg-[#36B37E] text-white' : 'bg-red-500 text-white',
          )}
        >
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          {toast.message}
        </div>
      )}
      <LoadingOverlay loading={isRefreshing} message="Refreshing…" />
    </div>
  );
}
