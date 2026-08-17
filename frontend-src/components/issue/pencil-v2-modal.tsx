'use client';
import { useState, useEffect, useRef } from 'react';
import { X, Loader2, Search, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { PriorityIcon } from '@/components/shared/priority-icon';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { JiraIssue, JiraTransition, JiraUser, JiraPriority } from '@/types/jira';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PencilV2ModalProps {
  issue: JiraIssue;
  estimated: number; // seconds
  onConfirm: (drafts: Record<string, unknown>) => void;
  onClose: () => void;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const PRIORITY_OPTIONS: Array<{ name: JiraPriority['name']; color: string }> = [
  { name: 'Highest', color: '#DE350B' }, { name: 'High', color: '#FF5630' },
  { name: 'Medium', color: '#FFAB00' }, { name: 'Low', color: '#2684FF' },
  { name: 'Lowest', color: '#2684FF' }, { name: 'Blocker', color: '#DE350B' },
  { name: 'Minor', color: '#6B778C' },
];

const STATUS_CATEGORY_COLORS: Record<string, string> = {
  new: 'bg-[#5E6C84] text-white',
  indeterminate: 'bg-[#0052CC] text-white',
  done: 'bg-[#00875A] text-white',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function PencilV2Modal({ issue, estimated, onConfirm, onClose }: PencilV2ModalProps) {
  const [isLoading, setIsLoading] = useState(true);

  // ── Field states ──────────────────────────────────────────────────────────
  const [summary, setSummary] = useState(issue.fields.summary ?? '');
  const [duedate, setDuedate] = useState(issue.fields.duedate ?? '');
  const [estHours, setEstHours] = useState(estimated > 0 ? (estimated / 3600).toFixed(1) : '');
  const [selectedPriority, setSelectedPriority] = useState<string>(issue.fields.priority?.name ?? '');
  const [selectedAssignee, setSelectedAssignee] = useState<{ name: string; displayName: string } | null>(
    issue.fields.assignee ? { name: issue.fields.assignee.name, displayName: issue.fields.assignee.displayName } : null,
  );
  const [selectedStatus, setSelectedStatus] = useState<string>(issue.fields.status.name);

  // ── Transitions ───────────────────────────────────────────────────────────
  const [transitions, setTransitions] = useState<JiraTransition[]>([]);
  const [statusOpen, setStatusOpen] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [userQuery, setUserQuery] = useState('');
  const [userResults, setUserResults] = useState<JiraUser[]>([]);
  const [userSearching, setUserSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch transitions on mount
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const r = await api.get<{ transitions: JiraTransition[] }>(`/issue/${issue.key}/transitions`);
        if (!cancelled) setTransitions(r.data.transitions ?? []);
      } catch { /* ignore */ }
      finally { if (!cancelled) setIsLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [issue.key]);

  // Build status → category map from transitions + current status
  const statusCategoryMap: Record<string, string> = {};
  if (issue.fields.status?.name && issue.fields.status?.statusCategory?.key) {
    statusCategoryMap[issue.fields.status.name] = issue.fields.status.statusCategory.key;
  }
  for (const t of transitions) {
    if (t.to?.name && t.to?.statusCategory?.key) {
      statusCategoryMap[t.to.name] = t.to.statusCategory.key;
    }
  }

  // User search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (userQuery.trim().length < 1) { setUserResults([]); return; }
    setUserSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await api.get<JiraUser[]>('/user/search', { params: { username: userQuery.trim(), maxResults: 8 } });
        setUserResults(Array.isArray(r.data) ? r.data : []);
      } catch { setUserResults([]); }
      finally { setUserSearching(false); }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [userQuery]);

  function handleConfirm() {
    const drafts: Record<string, unknown> = {};

    if (summary !== issue.fields.summary) drafts.summary = summary;
    if (duedate !== (issue.fields.duedate ?? '')) drafts.duedate = duedate || undefined;
    const newEst = parseFloat(estHours);
    const estCleared = estHours.trim() === '' && estimated > 0;
    const estChanged = !isNaN(newEst) && newEst >= 0 && Math.round(newEst * 3600) !== estimated;
    if (estCleared || estChanged) {
      drafts.originalEstimate = estCleared ? 0 : newEst;
    }
    if (selectedPriority !== (issue.fields.priority?.name ?? '')) {
      const p = PRIORITY_OPTIONS.find(o => o.name === selectedPriority);
      if (p) drafts.priority = { name: p.name, id: '' };
    }
    if ((selectedAssignee?.name ?? null) !== (issue.fields.assignee?.name ?? null)) {
      if (selectedAssignee) drafts.assignee = selectedAssignee;
      else drafts.assignee = null;
    }
    if (selectedStatus !== issue.fields.status.name) {
      const t = transitions.find(tr => tr.to?.name === selectedStatus);
      if (t) drafts.status = { id: t.id, name: selectedStatus };
    }

    onConfirm(drafts);
    onClose();
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-3xl mx-4 flex flex-col" style={{ minHeight: '620px' }}>

        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[#DFE1E6] flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-[#E6F0FF] flex items-center justify-center flex-shrink-0">
              <span className="text-xs">✏️</span>
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-[#172B4D]">Edit Issue</h2>
              <p className="text-[11px] text-[#5E6C84] truncate">{issue.key} · {issue.fields.summary}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#F4F5F7] text-[#5E6C84] transition-colors">
            <X size={15} />
          </button>
        </div>

        {isLoading ? (

          <div className="flex items-center justify-center flex-1">
            <Loader2 size={16} className="animate-spin text-[#5E6C84]" />
          </div>

        ) : (

          <div className="flex-1 flex flex-col px-5 py-4 min-h-0">
            <div className="flex-1 min-h-0 overflow-y-auto space-y-3.5">

              {/* Status */}
              <div className="relative">
                <label className="block text-[10px] font-semibold text-[#5E6C84] uppercase tracking-wide mb-1">
                  Status
                </label>
                <button
                  type="button"
                  onClick={() => { setStatusOpen(v => !v); setPriorityOpen(false); setAssigneeOpen(false); }}
                  className="w-full flex items-center gap-2 px-2.5 h-8 rounded-lg border border-[#DFE1E6] bg-white text-xs text-left hover:border-[#0052CC] transition-colors"
                >
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', STATUS_CATEGORY_COLORS[statusCategoryMap[selectedStatus] ?? ''])}>
                    {selectedStatus}
                  </span>
                  <span className="text-[#8993A4] ml-auto">▼</span>
                </button>
                {statusOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#DFE1E6] rounded-lg shadow-xl z-30 max-h-48 overflow-y-auto">
                    {(() => {
                      // Current status + all unique transition targets
                      const seen = new Set<string>();
                      const options: { name: string; categoryKey: string }[] = [];
                      // Always include current issue status
                      const currentCat = issue.fields.status?.statusCategory?.key ?? '';
                      options.push({ name: issue.fields.status.name, categoryKey: currentCat });
                      seen.add(issue.fields.status.name);
                      // Add unique transitions
                      for (const t of transitions) {
                        if (t.to && !seen.has(t.to.name)) {
                          seen.add(t.to.name);
                          options.push({ name: t.to.name, categoryKey: t.to.statusCategory?.key ?? '' });
                        }
                      }
                      return options.length === 0 ? (
                        <div className="px-3 py-2 text-[11px] text-[#5E6C84]">No transitions available</div>
                      ) : (
                        options.map((opt, i) => (
                          <button
                            key={`${opt.name}-${i}`}
                            type="button"
                            onClick={() => { setSelectedStatus(opt.name); setStatusOpen(false); }}
                            className={cn(
                              'w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-[#F4F5F7] transition-colors',
                              selectedStatus === opt.name && 'bg-[#E6F0FF]',
                            )}
                          >
                            <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', STATUS_CATEGORY_COLORS[opt.categoryKey] ?? '')}>
                              {opt.name}
                            </span>
                          </button>
                        ))
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Summary */}
              <div>
                <label className="block text-[10px] font-semibold text-[#5E6C84] uppercase tracking-wide mb-1">
                  Summary
                </label>
                <textarea
                  value={summary}
                  onChange={e => setSummary(e.target.value)}
                  rows={2}
                  className="w-full text-xs border border-[#DFE1E6] rounded-lg px-2.5 py-1.5 resize-none focus:outline-none focus:border-[#0052CC]"
                />
              </div>

              {/* Duedate + Est */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-[#5E6C84] uppercase tracking-wide mb-1">Due date</label>
                  <Input type="date" value={duedate} onChange={e => setDuedate(e.target.value)} className="w-full" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-[#5E6C84] uppercase tracking-wide mb-1">Est. (hours)</label>
                  <Input type="number" min="0" step="0.5" placeholder="0" value={estHours} onChange={e => setEstHours(e.target.value)} className="w-full" />
                </div>
              </div>

              {/* Priority */}
              <div className="relative">
                <label className="block text-[10px] font-semibold text-[#5E6C84] uppercase tracking-wide mb-1">Priority</label>
                <button
                  type="button"
                  onClick={() => { setPriorityOpen(v => !v); setStatusOpen(false); setAssigneeOpen(false); }}
                  className="w-full flex items-center gap-2 px-2.5 h-8 rounded-lg border border-[#DFE1E6] bg-white text-xs text-left hover:border-[#0052CC] transition-colors"
                >
                  <PriorityIcon priority={selectedPriority ? { name: selectedPriority as JiraPriority['name'], iconUrl: '' } : null} />
                  <span>{selectedPriority || 'None'}</span>
                  <span className="text-[#8993A4] ml-auto">▼</span>
                </button>
                {priorityOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#DFE1E6] rounded-lg shadow-xl z-30">
                    {PRIORITY_OPTIONS.map(p => (
                      <button
                        key={p.name}
                        type="button"
                        onClick={() => { setSelectedPriority(p.name); setPriorityOpen(false); }}
                        className={cn(
                          'w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-[#F4F5F7] transition-colors',
                          selectedPriority === p.name && 'bg-[#E6F0FF]',
                        )}
                      >
                        <PriorityIcon priority={{ name: p.name, iconUrl: '' }} />
                        <span>{p.name}</span>
                        {selectedPriority === p.name && <Check size={12} className="text-[#0052CC] ml-auto" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Assignee */}
              <div className="relative">
                <label className="block text-[10px] font-semibold text-[#5E6C84] uppercase tracking-wide mb-1">Assignee</label>
                {assigneeOpen ? (
                  <div className="border border-[#DFE1E6] rounded-lg overflow-hidden">
                    <div className="flex items-center gap-1 px-2.5 border-b border-[#DFE1E6]">
                      <Search size={12} className="text-[#8993A4] flex-shrink-0" />
                      <input
                        type="text"
                        value={userQuery}
                        onChange={e => setUserQuery(e.target.value)}
                        placeholder="Search user…"
                        autoFocus
                        className="flex-1 h-8 text-xs border-none outline-none bg-transparent"
                      />
                    </div>
                    <div className="max-h-40 overflow-y-auto">
                      {userSearching ? (
                        <div className="px-3 py-2 text-[10px] text-[#5E6C84]">Searching…</div>
                      ) : userQuery.trim().length > 0 && userResults.length === 0 ? (
                        <div className="px-3 py-2 text-[10px] text-[#5E6C84]">No users found</div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => { setSelectedAssignee(null); setAssigneeOpen(false); setUserQuery(''); }}
                            className={cn(
                              'w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-[#F4F5F7] transition-colors',
                              !selectedAssignee && 'bg-[#E6F0FF]',
                            )}
                          >
                            <span className="text-[#8993A4]">—</span>
                            <span className="text-[#5E6C84]">Unassigned</span>
                            {!selectedAssignee && <Check size={12} className="text-[#0052CC] ml-auto" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setSelectedAssignee({ name: 'currentUser()', displayName: 'Me' }); setAssigneeOpen(false); setUserQuery(''); }}
                            className={cn(
                              'w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-[#F4F5F7] transition-colors',
                              selectedAssignee?.name === 'currentUser()' && 'bg-[#E6F0FF]',
                            )}
                          >
                            <span>👤</span>
                            <span>Me</span>
                            {selectedAssignee?.name === 'currentUser()' && <Check size={12} className="text-[#0052CC] ml-auto" />}
                          </button>
                          {userResults.map(u => (
                            <button
                              key={u.name}
                              type="button"
                              onClick={() => { setSelectedAssignee({ name: u.name, displayName: u.displayName }); setAssigneeOpen(false); setUserQuery(''); }}
                              className={cn(
                                'w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-[#F4F5F7] transition-colors',
                                selectedAssignee?.name === u.name && 'bg-[#E6F0FF]',
                              )}
                            >
                              {u.avatarUrls?.['24x24'] ? (
                                <img src={u.avatarUrls['24x24']} alt="" className="w-5 h-5 rounded-full flex-shrink-0 object-cover" />
                              ) : (
                                <span className="w-5 h-5 rounded-full bg-[#DFE1E6] text-[#5E6C84] text-[9px] flex items-center justify-center font-medium flex-shrink-0">
                                  {u.displayName.charAt(0).toUpperCase()}
                                </span>
                              )}
                              <div className="flex-1 min-w-0">
                                <span className="block truncate">{u.displayName}</span>
                                <span className="block text-[10px] text-[#8993A4]">{u.name}</span>
                              </div>
                              {selectedAssignee?.name === u.name && <Check size={12} className="text-[#0052CC] flex-shrink-0" />}
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setAssigneeOpen(true); setStatusOpen(false); setPriorityOpen(false); }}
                    className="w-full flex items-center gap-2 px-2.5 h-8 rounded-lg border border-[#DFE1E6] bg-white text-xs text-left hover:border-[#0052CC] transition-colors"
                  >
                    {selectedAssignee ? (
                      <>
                        {selectedAssignee.name === 'currentUser()' ? (
                          <span className="w-5 h-5 rounded-full bg-[#0052CC] text-white text-[9px] flex items-center justify-center font-medium flex-shrink-0">
                            {selectedAssignee.displayName.charAt(0).toUpperCase()}
                          </span>
                        ) : (
                          <img
                            src={`https://task.ascvn.com.vn/secure/useravatar?ownerId=${selectedAssignee.name}&avatarId=106`}
                            alt=""
                            className="w-5 h-5 rounded-full flex-shrink-0 object-cover"
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        )}
                        <span>{selectedAssignee.displayName}</span>
                      </>
                    ) : (
                      <span className="text-[#8993A4]">— Unassigned</span>
                    )}
                    <span className="text-[#8993A4] ml-auto">▼</span>
                  </button>
                )}
              </div>

            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 mt-auto border-t border-[#DFE1E6]">
              <Button variant="outline" size="sm" type="button" onClick={onClose}>Cancel</Button>
              <Button size="sm" type="button" onClick={handleConfirm}>Confirm Draft</Button>
            </div>

          </div>

        )}

      </div>
    </div>
  );
}
