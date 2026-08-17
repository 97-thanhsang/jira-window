'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useIssuesList } from '@/hooks/use-issues-list';
import type { IssueFilters } from '@/hooks/use-issues-list';
import { IssuesTable } from '@/components/issues/issues-table';
import { FilterBar } from '@/components/shared/filter-bar';
import { LoadingOverlay } from '@/components/shared/loading-overlay';
import type { UnifiedFilters } from '@/lib/filter-constants';
import { DEFAULT_GROUPS, MEMBER_DISPLAY_NAMES } from '@/lib/team-constants';
import { GroupSelector } from '@/components/shared/group-selector';
import { GroupByControls } from '@/components/shared/group-by-controls';
import { ToolBar } from '@/components/shared/tool-bar';
import { PencilV2Modal } from '@/components/issue/pencil-v2-modal';
import { LogWorkModal } from '@/components/issue/log-work-modal';
import type { JiraIssue } from '@/types/jira';
import { cn } from '@/lib/utils';
import type { TeamGroup } from '@/types/jira';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Loader2, Check, X, CheckCircle2, AlertTriangle } from 'lucide-react';

// ─── Adapters: IssueFilters ↔ UnifiedFilters ─────────────────────────────────

function issueToUnified(f: IssueFilters): UnifiedFilters {
  return {
    searchText: f.text ?? '',
    projectIn: f.projectIn, projectExclude: f.projectExclude,
    issuetypeIn: f.issuetypeIn, issuetypeExclude: f.issuetypeExclude,
    statusIn: f.statusIn, statusExclude: f.statusExclude,
    priorityIn: f.priorityIn, priorityExclude: f.priorityExclude,
    assigneeIn: f.assigneeIn, assigneeExclude: f.assigneeExclude,
    sprintIn: f.sprintIn, sprintExclude: f.sprintExclude,
    reporterIn: f.reporterIn, reporterExclude: f.reporterExclude,
    epicIn: f.epicIn, epicExclude: f.epicExclude,
    dateRangeMode: f.dateRangeMode,
  };
}

function unifiedToIssue(u: UnifiedFilters): Partial<IssueFilters> {
  return {
    text: u.searchText || undefined,
    projectIn: u.projectIn, projectExclude: u.projectExclude,
    issuetypeIn: u.issuetypeIn, issuetypeExclude: u.issuetypeExclude,
    statusIn: u.statusIn, statusExclude: u.statusExclude,
    priorityIn: u.priorityIn, priorityExclude: u.priorityExclude,
    assigneeIn: u.assigneeIn, assigneeExclude: u.assigneeExclude,
    sprintIn: u.sprintIn, sprintExclude: u.sprintExclude,
    reporterIn: u.reporterIn, reporterExclude: u.reporterExclude,
    epicIn: u.epicIn, epicExclude: u.epicExclude,
    dateRangeMode: u.dateRangeMode,
  };
}

export default function IssuesPage() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filters, setFilters] = useState<IssueFilters>({});
  const [editMode, setEditMode] = useState(false);
  const [displayMode, setDisplayMode] = useState<'full' | 'focus'>('full');
  const exportRef = useRef<(() => void) | null>(null);
  const [sortField, setSortField] = useState('updated');
  const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>('DESC');
  const [pencilV2Issue, setPencilV2Issue] = useState<JiraIssue | null>(null);
  const [logWorkIssue, setLogWorkIssue] = useState<{ key: string; summary: string; duedate?: string } | null>(null);
  // ── Drafts / confirm state ──
  const [drafts, setDrafts] = useState<Record<string, Record<string, unknown>>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applySuccess, setApplySuccess] = useState(false);

  // ── Group / member filter state ──
  const [groups] = useState<TeamGroup[]>(DEFAULT_GROUPS);
  const [selectedMembers, setSelectedMembers] = useState<string[]>(
    () => DEFAULT_GROUPS[0]?.members ?? [],
  );
  const [memberDisplayNames, setMemberDisplayNames] = useState<Record<string, string>>(
    () => {
      const names: Record<string, string> = {};
      for (const m of DEFAULT_GROUPS[0]?.members ?? []) names[m] = MEMBER_DISPLAY_NAMES[m] || m;
      return names;
    },
  );
  // ── Group-by controls state ──
  const [groupBy, setGroupBy] = useState<string>('project');
  const [subGroupBy, setSubGroupBy] = useState<string>('epic');
  const [subSubGroupBy, setSubSubGroupBy] = useState<string>('parent');
  // ── Default filters after mount (avoid SSR hydration issues) ──
  useEffect(() => {
    setFilters(prev => ({
      ...prev,
      period: 'month',
      dateRangeMode: 'current',
      issuetypeIn: ['Sub-task'],
      statusIn: ['Cancelled', 'Closed', 'Done', 'Rejected'],
      statusExclude: true,
      assigneeIn: ['currentUser()'],
    }));
  }, []);
  // ── Group / member helpers ──
  function addMember(username: string, displayName: string) {
    if (selectedMembers.includes(username)) return;
    setSelectedMembers((prev) => [...prev, username]);
    setMemberDisplayNames((prev) => ({ ...prev, [username]: displayName }));
  }

  function removeMember(username: string) {
    setSelectedMembers((prev) => prev.filter((m) => m !== username));
  }

  function selectAllMembers() {
    setSelectedMembers([]);
  }

  function selectGroup(group: TeamGroup) {
    const names: Record<string, string> = {};
    for (const m of group.members) names[m] = MEMBER_DISPLAY_NAMES[m] || m;
    setSelectedMembers(group.members);
    setMemberDisplayNames((prev) => ({ ...prev, ...names }));
  }

  const { issues, total, isLoading, error, mutate, epicSummaries } = useIssuesList({
    ...filters,
    sortField,
    sortDir,
    // Only apply team default assignee when FilterBar hasn't set an assignee filter
    ...(!filters.assigneeIn && !filters.assignee ? (
      selectedMembers.length > 0
        ? { assigneeIn: selectedMembers }
        : { assignee: 'currentUser()' }
    ) : {}),
  });

  function handleSortChange(field: string, dir: 'ASC' | 'DESC') {
    setSortField(field);
    setSortDir(dir);
  }

  // Listen for bulk transition events → mutate
  useEffect(() => {
    const handler = () => { mutate(); };
    window.addEventListener('issues-bulk-transitioned', handler);
    return () => window.removeEventListener('issues-bulk-transitioned', handler);
  }, [mutate]);

  function updateFilters(newFilters: Partial<IssueFilters>) {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }

  const totalDraftFields = useMemo(() =>
    Object.values(drafts).reduce((s, d) => s + Object.keys(d).length, 0),
  [drafts]);

  function cancelAllDrafts() {
    setDrafts({});
  }

  async function handleConfirm() {
    setApplying(true);
    setApplyError(null);
    const issueByKey = new Map<string, JiraIssue>();
    for (const issue of issues) issueByKey.set(issue.key, issue);

    const issuesWithErrors: string[] = [];
    for (const [issueKey, issueDrafts] of Object.entries(drafts)) {
      try {
        const fields: Record<string, unknown> = {};
        for (const [field, value] of Object.entries(issueDrafts)) {
          switch (field) {
            case 'status': {
              const statusObj = value && typeof value === 'object' ? value as { id?: string; name?: string } : null;
              const { data: transData } = await api.get<{ transitions: Array<{ id: string; to?: { name: string } }> }>(
                `/issue/${issueKey}/transitions`,
              );
              const freshTransition = statusObj?.name
                ? transData.transitions.find(t => t.to?.name === statusObj.name)
                : null;
              if (freshTransition) {
                await api.post(`/issue/${issueKey}/transitions`, { transition: { id: Number(freshTransition.id) } });
              }
              break;
            }
            case 'assignee':
              if (value && typeof value === 'object' && 'name' in (value as Record<string, unknown>)) {
                fields.assignee = { name: (value as Record<string, unknown>).name };
              } else if (value === null) {
                fields.assignee = null;
              }
              break;
            case 'priority':
              if (value && typeof value === 'object' && 'name' in (value as Record<string, unknown>)) {
                fields.priority = { name: (value as Record<string, unknown>).name };
              }
              break;
            case 'summary':
              fields.summary = value;
              break;
            case 'duedate':
              fields.duedate = value || null;
              break;
            case 'originalEstimate':
              if (typeof value === 'number' && !isNaN(value) && value > 0) {
                fields.timetracking = { originalEstimate: `${value}h` };
              } else {
                fields.timetracking = { originalEstimate: null };
              }
              break;
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
      setApplyError(`Failed for: ${issuesWithErrors.join(', ')}`);
      setApplySuccess(false);
    } else {
      setDrafts({});
      mutate();
      setApplyError(null);
      setApplySuccess(true);
    }
    setApplying(false);
  }

  return (
    <div className="p-6 relative">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-xl font-semibold text-[#172B4D] dark:text-gray-100">
          Issue List
        </h1>
        {!isLoading && (
          <span className="text-xs bg-[#DFE1E6] dark:bg-gray-700 text-[#42526E] dark:text-gray-300 px-2 py-0.5 rounded-full font-medium">
            {total}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {/* Full/Focus toggle */}
          <div className="flex items-center rounded border border-[#DFE1E6] dark:border-gray-600 overflow-hidden shrink-0">
            <button type="button" onClick={() => setDisplayMode('full')}
              className={cn('text-[10px] px-2 py-1.5 font-medium transition-colors border-r border-[#DFE1E6] dark:border-gray-600',
                displayMode === 'full' ? 'bg-[#0052CC] text-white' : 'bg-white dark:bg-gray-800 text-[#5E6C84] dark:text-gray-400 hover:bg-[#F4F5F7] dark:hover:bg-gray-700')}>
              Full
            </button>
            <button type="button" onClick={() => setDisplayMode('focus')}
              className={cn('text-[10px] px-2 py-1.5 font-medium transition-colors',
                displayMode === 'focus' ? 'bg-[#0052CC] text-white' : 'bg-white dark:bg-gray-800 text-[#5E6C84] dark:text-gray-400 hover:bg-[#F4F5F7] dark:hover:bg-gray-700')}>
              Focus
            </button>
          </div>
          <ToolBar
            editMode={editMode}
            onToggleEditMode={(edit) => { setEditMode(edit); if (!edit) { cancelAllDrafts(); setApplySuccess(false); setApplyError(null); } }}
            onRefresh={async () => { setIsRefreshing(true); await mutate(); setIsRefreshing(false); }}
            refreshing={isRefreshing}
            onExport={() => exportRef.current?.()}
            onConfigColumns={() => {}}
            hasPendingChanges={totalDraftFields > 0}
            totalChanges={totalDraftFields}
            onConfirm={() => setConfirmOpen(true)}
            onCancel={cancelAllDrafts}
          />
        </div>
      </div>

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
        subSubGroupByOptions={['none', 'epic', 'parent', 'priority', 'type', 'status', 'sprint']}
      />

      {error ? (
        <div className="flex items-center justify-center py-16">
          <p className="text-sm text-red-600">
            Failed to load issues. Please try again.
          </p>
        </div>
      ) : (
        <>
            <FilterBar
              filters={issueToUnified(filters)}
              onChange={(u) => setFilters(prev => ({ ...prev, ...unifiedToIssue(u) }))}
              period={{
                options: [
                  { key: 'today', label: 'Today' },
                  { key: 'week', label: 'Week' },
                  { key: 'month', label: 'Month' },
                  { key: 'year', label: 'Year' },
                ],
                active: filters.period as string | undefined,
                onChange: (key) => setFilters(prev => ({ ...prev, period: key })),
              }}
              quickPills={[
                { key: 'onlyMyIssues', label: 'Only My Issues', active: !!filters.onlyMyIssues, onToggle: () => setFilters(prev => ({ ...prev, onlyMyIssues: !prev.onlyMyIssues })) },
                { key: 'recentlyUpdated', label: 'Recently Updated', active: !!filters.recentlyUpdated, onToggle: () => setFilters(prev => ({ ...prev, recentlyUpdated: !prev.recentlyUpdated })) },
                { key: 'dueThisWeek', label: 'Due This Week', active: !!filters.dueThisWeek, onToggle: () => setFilters(prev => ({ ...prev, dueThisWeek: !prev.dueThisWeek })) },
                { key: 'highPriority', label: 'High Priority', active: !!filters.highPriority, onToggle: () => setFilters(prev => ({ ...prev, highPriority: !prev.highPriority })) },
              ]}
            />
          </>
        )}
        </>
        )}

      {error ? (
        <div className="flex items-center justify-center py-16">
          <p className="text-sm text-red-600">
            Failed to load issues. Please try again.
          </p>
        </div>
      ) : (<>
            <IssuesTable
              issues={issues}
              total={total}
              isLoading={isLoading}
              sortField={sortField}
              sortDir={sortDir}
              onSortChange={handleSortChange}
              onIssueUpdate={() => mutate()}
              groupBy={groupBy}
              subGroupBy={subGroupBy}
              subSubGroupBy={subSubGroupBy}
              toolBarEditMode={editMode}
              hideInternalToolbar
              epicSummaries={epicSummaries}
              drafts={drafts}
              onBulkDraft={(issueKeys, fields) => {
                setDrafts(prev => {
                  const next = { ...prev };
                  for (const key of issueKeys) {
                    next[key] = { ...next[key], ...fields };
                  }
                  return next;
                });
              }}
              onExportReady={(fn) => { exportRef.current = fn; }}
              onOpenPencilV2={(issueKey, issue) => setPencilV2Issue(issue)}
              onOpenLogWork={(issueKey, issue) => setLogWorkIssue({ key: issueKey, summary: issue.fields.summary ?? '', duedate: issue.fields.duedate ?? undefined })}
            />
        </>
        )}
        <LoadingOverlay loading={isRefreshing} message="Refreshing…" />

        {/* Review Changes popup */}
        {confirmOpen && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40" onClick={() => { if (!applying) { setConfirmOpen(false); setApplySuccess(false); setApplyError(null); } }}>
            <div className="bg-white dark:bg-gray-800 border border-[#DFE1E6] dark:border-gray-700 rounded-xl shadow-2xl w-full max-w-3xl mx-4 flex flex-col" style={{ minHeight: '560px', maxHeight: '85vh' }} onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#DFE1E6] dark:border-gray-700 flex-shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center',
                    applySuccess ? 'bg-[#E3FCEF]' : applyError ? 'bg-[#FFEBE6]' : 'bg-[#DEEBFF]')}>
                    {applySuccess ? <CheckCircle2 size={14} className="text-[#36B37E]" /> : applyError ? <AlertTriangle size={14} className="text-[#DE350B]" /> : <CheckCircle2 size={14} className="text-[#0052CC]" />}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#172B4D] dark:text-gray-100">
                      {applySuccess ? 'Changes Applied' : applyError ? 'Apply Failed' : 'Review Changes'}
                    </h3>
                    <p className="text-[10px] text-[#5E6C84] dark:text-gray-400">
                      {applySuccess ? 'All changes applied successfully.' : applyError ? 'Some changes could not be applied.' : `${Object.keys(drafts).length} issue(s) with ${totalDraftFields} change(s)`}
                    </p>
                  </div>
                </div>
                <button onClick={() => { if (!applying) { setConfirmOpen(false); setApplySuccess(false); setApplyError(null); } }} className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#F4F5F7] dark:hover:bg-gray-700 text-[#5E6C84] transition-colors"><X size={15} /></button>
              </div>

              {applySuccess ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center px-5 py-12">
                  <div className="w-14 h-14 rounded-full bg-[#E3FCEF] flex items-center justify-center mb-4"><Check size={28} className="text-[#36B37E]" /></div>
                  <p className="text-sm font-semibold text-[#172B4D] dark:text-gray-100 mb-1">All changes applied successfully</p>
                  <p className="text-xs text-[#5E6C84] dark:text-gray-400">{Object.keys(drafts).length} issue(s) updated with {totalDraftFields} change(s).</p>
                </div>
              ) : applyError ? (
                <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
                  <div className="flex items-center gap-2 text-xs text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3"><AlertTriangle size={14} /> {applyError}</div>
                </div>
              ) : (
                <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
                  {Object.entries(drafts).map(([issueKey, issueDrafts]) => (
                    <div key={issueKey} className="border border-[#DFE1E6] dark:border-gray-600 rounded-lg overflow-hidden">
                      <div className="flex items-center gap-2 px-3.5 py-2.5 bg-[#FAFBFC] dark:bg-gray-800 border-b border-[#DFE1E6] dark:border-gray-600">
                        <span className="text-xs font-semibold text-[#0052CC] dark:text-blue-400">{issueKey}</span>
                        <span className="text-[11px] text-[#5E6C84] dark:text-gray-400 truncate">{issues.find(i => i.key === issueKey)?.fields.summary ?? ''}</span>
                        <span className="text-[10px] text-[#8993A4] ml-auto font-medium">{Object.keys(issueDrafts).length} change(s)</span>
                      </div>
                      <div className="divide-y divide-[#F4F5F7] dark:divide-gray-700">
                          {Object.entries(issueDrafts).map(([field, value]) => {
                            const issue = issues.find(i => i.key === issueKey);
                            const beforeVal = (() => {
                              if (!issue) return '—';
                              switch (field) {
                                case 'summary': return issue.fields.summary ?? '';
                                case 'duedate': return issue.fields.duedate ?? 'not set';
                                case 'originalEstimate': return issue.fields.timetracking?.originalEstimateSeconds ? `${(issue.fields.timetracking.originalEstimateSeconds / 3600).toFixed(1)}h` : 'not set';
                                case 'priority': return issue.fields.priority?.name ?? 'None';
                                case 'status': return issue.fields.status.name;
                                case 'assignee': return issue.fields.assignee?.displayName ?? 'Unassigned';
                                default: return '—';
                              }
                            })();
                            const afterVal = (() => {
                              switch (field) {
                                case 'summary': return String(value);
                                case 'duedate': return String(value || 'cleared');
                                case 'originalEstimate': {
                                  const v = Number(value);
                                  return (!isNaN(v) && v > 0) ? `${v}h` : 'cleared';
                                }
                                case 'status': return typeof value === 'object' && value && 'name' in (value as Record<string, unknown>) ? String((value as Record<string, unknown>).name) : String(value);
                                case 'priority': return typeof value === 'object' && value && 'name' in (value as Record<string, unknown>) ? String((value as Record<string, unknown>).name) : String(value);
                                case 'assignee': return value === null ? 'Unassigned' : typeof value === 'object' && value && 'displayName' in (value as Record<string, unknown>) ? String((value as Record<string, unknown>).displayName) : String(value);
                                default: return String(value);
                              }
                            })();
                            return (
                          <div key={field} className="grid grid-cols-[100px_1fr_28px_1fr] gap-2 px-3.5 py-2.5 items-start">
                            <span className="text-[11px] font-semibold text-[#5E6C84] uppercase tracking-wide pt-0.5 capitalize">{field === 'originalEstimate' ? 'Estimate' : field}</span>
                            <span className="text-[11px] text-[#DE350B] line-through block leading-tight break-words">{beforeVal}</span>
                            <div className="flex items-center justify-center pt-0.5"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6h7.5M7 3.5L9.5 6 7 8.5" stroke="#36B37E" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
                            <span className="text-[11px] font-medium text-[#36B37E] block leading-tight break-words">{afterVal}</span>
                          </div>
                            );
                          })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-t border-[#DFE1E6] dark:border-gray-700 px-5 py-3.5 flex items-center justify-end gap-2">
                {applySuccess || applyError ? (
                  <Button size="sm" onClick={() => { setConfirmOpen(false); setApplySuccess(false); setApplyError(null); }} className="bg-[#0052CC] text-white">Close</Button>
                ) : (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setConfirmOpen(false)} disabled={applying}>Cancel</Button>
                    <Button size="sm" onClick={handleConfirm} disabled={applying} className="bg-[#36B37E] hover:bg-[#2D9B6C] text-white">
                      {applying ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                      <span className="ml-1.5">{applying ? 'Applying…' : 'Apply All Changes'}</span>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Pencil V2 modal */}
        {pencilV2Issue && (
          <PencilV2Modal
            issue={pencilV2Issue}
            estimated={pencilV2Issue.fields.timetracking?.originalEstimateSeconds ?? 0}
            onConfirm={(newDrafts) => {
              setDrafts(prev => ({
                ...prev,
                [pencilV2Issue.key]: { ...prev[pencilV2Issue.key], ...newDrafts },
              }));
              setPencilV2Issue(null);
            }}
            onClose={() => setPencilV2Issue(null)}
          />
        )}

        {/* Log Work modal */}
        {logWorkIssue && (
          <LogWorkModal
            issueKey={logWorkIssue.key}
            issueSummary={logWorkIssue.summary}
            issueDuedate={logWorkIssue.duedate}
            onClose={() => setLogWorkIssue(null)}
            onSuccess={() => { setLogWorkIssue(null); mutate(); }}
          />
        )}
    </div>
  );
}
