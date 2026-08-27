'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { ExternalLink, X, Search, Loader2, GripVertical, Calendar, Pencil, Check, Undo2, Timer, Clock, User, UserCheck } from 'lucide-react';
import type { JiraIssue, JiraUser, JiraPriority, JiraTransition } from '@/types/jira';
import { PriorityIcon } from '@/components/shared/priority-icon';
import { cn } from '@/lib/utils';
import { useDndContext } from '@dnd-kit/core';
import { useBoardEdit } from '@/contexts/board-edit';
import { LogWorkModal } from '@/components/issue/log-work-modal';
import { PencilV2Modal } from '@/components/issue/pencil-v2-modal';
import {
  PRIORITY_HEX_COLORS,
  STATUS_CATEGORY_BADGE_CLASSES,
  getIssueTypeBadgeClass,
} from '@/lib/jira-colors';

export interface IssueCardProps {
  issue: JiraIssue;
  onCardClick?: (key: string) => void;
  onIssueUpdate?: () => void;
  /** DnD drag handle props — spread onto the grip icon only */
  dragHandleProps?: Record<string, unknown>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIORITY_OPTIONS: Array<{ name: JiraPriority['name']; color: string }> = [
  { name: 'Highest', color: '#DE350B' }, { name: 'High', color: '#FF5630' },
  { name: 'Medium', color: '#FFAB00' }, { name: 'Low', color: '#2684FF' },
  { name: 'Lowest', color: '#2684FF' }, { name: 'Blocker', color: '#DE350B' },
  { name: 'Minor', color: '#6B778C' },
];

const LABEL_COLORS = ['#0052CC', '#36B37E', '#DE350B', '#FF8B00', '#6554C0', '#008DA6', '#E774BB', '#FF5630', '#00B8D9', '#8777D9'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function issueTypeLabel(name: string): string {
  if (name === 'Sub-task') return 'SUB';
  if (name === 'Story') return 'STR';
  if (name === 'Bug') return 'BUG';
  return name.slice(0, 3).toUpperCase();
}

function getDueDateStatus(duedate?: string): 'overdue' | 'due-soon' | null {
  if (!duedate) return 'overdue'; // no duedate = red
  const now = new Date();
  const due = new Date(duedate);
  if (due < now) return 'overdue';
  if (due.getTime() - now.getTime() <= 3 * 24 * 60 * 60 * 1000) return 'due-soon';
  return null;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}

function formatHours(seconds: number): string {
  if (!seconds) return '0h';
  const h = seconds / 3600;
  return h >= 10 ? `${Math.round(h)}h` : `${h.toFixed(1)}h`;
}

function draftChanged(draft: Record<string, unknown> | undefined, field: string): boolean {
  return draft != null && draft[field] !== undefined;
}

/** Parse Jira duration string like "2h 30m" or "1d 4h" to seconds. */
function parseJiraDuration(dur: string): number {
  let total = 0;
  const dayMatch = dur.match(/(\d+(?:\.\d+)?)d/);
  if (dayMatch) total += parseFloat(dayMatch[1]) * 8 * 3600; // 1d = 8h
  const hourMatch = dur.match(/(\d+(?:\.\d+)?)h/);
  if (hourMatch) total += parseFloat(hourMatch[1]) * 3600;
  const minMatch = dur.match(/(\d+(?:\.\d+)?)m/);
  if (minMatch) total += parseFloat(minMatch[1]) * 60;
  return total;
}

function labelColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return LABEL_COLORS[Math.abs(hash) % LABEL_COLORS.length];
}

/** Extract story points from common custom fields. */
function getStoryPoints(issue: JiraIssue): number | null {
  const raw = issue.fields as Record<string, unknown>;
  for (const cf of ['customfield_10006', 'customfield_10002', 'customfield_10004']) {
    const v = raw[cf];
    if (typeof v === 'number' && v > 0) return v;
  }
  return null;
}

/** Get active sprint name. */
function getSprintName(issue: JiraIssue): string | null {
  const sprint = issue.fields.sprint;
  if (sprint) {
    if (Array.isArray(sprint)) {
      const active = sprint.find(s => s.state === 'active');
      if (active) return active.name;
    } else {
      return sprint.name;
    }
  }
  const cf = issue.fields.customfield_10020;
  if (cf) {
    if (Array.isArray(cf)) {
      const active = cf.find(s => s.state === 'active');
      if (active) return active.name;
    } else {
      return cf.name;
    }
  }
  return null;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function searchUsers(query: string): Promise<JiraUser[]> {
  const res = await api.get('/user/search', { params: { username: query, maxResults: 8 } });
  return Array.isArray(res.data) ? res.data : (res.data?.values ?? []);
}

async function assignIssue(key: string, username: string | null): Promise<void> {
  await api.put(`/issue/${key}/assignee`, { name: username ?? '-1' });
}

async function updateIssuePriority(key: string, priorityName: string): Promise<void> {
  await api.put(`/issue/${key}`, { fields: { priority: { name: priorityName } } });
}

async function addIssueLabel(key: string, label: string): Promise<void> {
  await api.put(`/issue/${key}`, { update: { labels: [{ add: label }] } });
}

async function removeIssueLabel(key: string, label: string): Promise<void> {
  await api.put(`/issue/${key}`, { update: { labels: [{ remove: label }] } });
}

async function getIssueTransitions(key: string): Promise<JiraTransition[]> {
  const res = await api.get<{ transitions: JiraTransition[] }>(`/issue/${key}/transitions`);
  return res.data?.transitions ?? [];
}

async function transitionIssue(key: string, transitionId: string): Promise<void> {
  await api.post(`/issue/${key}/transitions`, { transition: { id: transitionId } });
}

async function updateIssueDueDate(key: string, duedate: string | null): Promise<void> {
  await api.put(`/issue/${key}`, { fields: { duedate } });
}

import { api } from '@/lib/api';

// ─── Styles ───────────────────────────────────────────────────────────────────

const POPOVER_BASE = 'absolute bottom-full left-0 mb-1 z-50 bg-white dark:bg-gray-800 border border-[#DFE1E6] dark:border-gray-600 rounded-sm shadow-lg';
const POPOVER_ITEM = 'w-full flex items-center gap-2 text-left px-3 py-1.5 text-xs transition-colors text-[#172B4D] dark:text-gray-200 hover:bg-[#F4F5F7] dark:hover:bg-gray-700';

function FieldActions({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <span className="inline-flex items-center gap-0.5 ml-1 flex-shrink-0">
      <button type="button" onClick={e => { e.stopPropagation(); onConfirm(); }} className="p-0.5 rounded text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30" title="Confirm"><Check size={10} /></button>
      <button type="button" onClick={e => { e.stopPropagation(); onCancel(); }} className="p-0.5 rounded text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30" title="Revert"><X size={10} /></button>
    </span>
  );
}

function draftHighlight(field: string, draft?: Record<string, unknown>) {
  return draft?.[field] !== undefined
    ? '!text-[#1B7C44] !font-semibold bg-[#E3FCEF] dark:bg-green-900/25 rounded px-1 -mx-0.5 ring-1 ring-[#36B37E]/40'
    : '';
}

// ─── Main component ───────────────────────────────────────────────────────────

export function IssueCard({ issue, onCardClick, onIssueUpdate, dragHandleProps }: IssueCardProps) {
  const { active: dndActive } = useDndContext();
  const isDraggingActive = !!dndActive;

  // Read edit state from context
  const ctx = useBoardEdit();
  const editMode = ctx?.editMode ?? false;
  const editingCard = ctx?.editingCards.has(issue.key) ?? false;
  const draft = ctx?.drafts[issue.key];
  const hasDraft = draft && Object.keys(draft).length > 0;
  const onFieldDraft = ctx?.onFieldDraft ? (field: string, value: unknown) => ctx.onFieldDraft!(issue.key, field, value) : undefined;
  const onFieldRevert = ctx?.onFieldRevert ? (field: string) => ctx.onFieldRevert!(issue.key, field) : undefined;
  const onToggleEditing = ctx?.onToggleEditing ? () => ctx.onToggleEditing!(issue.key) : undefined;

  // Quick log modal state
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [pencilV2Open, setPencilV2Open] = useState(false);

  const typeColor = getIssueTypeBadgeClass(issue.fields.issuetype?.name ?? '');
  const statusCat = issue.fields.status.statusCategory.key;
  const dueDateStatus = statusCat === 'done' ? null : getDueDateStatus(issue.fields.duedate);
  const components = issue.fields.components ?? [];
  const storyPoints = getStoryPoints(issue);
  const sprintName = getSprintName(issue);
  const tt = issue.fields.timetracking;
  const loggedStr = tt?.timeSpent;
  const estimatedStr = tt?.originalEstimate;
  const logged = tt?.timeSpentSeconds ?? (loggedStr ? parseJiraDuration(loggedStr) : 0);
  const estimated = tt?.originalEstimateSeconds ?? (estimatedStr ? parseJiraDuration(estimatedStr) : 0);
  const hasTimeTracking = !!(estimated || logged);
  const progress = estimated > 0 ? Math.min(logged / estimated, 1) : 0;

  const logColor = logged <= 0 ? 'text-gray-300 dark:text-gray-600'
    : logged > 28800 ? 'text-[#DE350B]'
    : estimated > 0 && logged > estimated ? 'text-[#FF8B00]'
    : 'text-[#36B37E]';

  const estColor = estimated <= 0 ? 'text-gray-300 dark:text-gray-600'
    : estimated > 28800 ? 'text-[#FF8B00]'
    : 'text-[#5E6C84] dark:text-gray-400';

  // ── Warning badge: explains WHY card has colored background ─────────
  const warningBadge = ((): { label: string; color: string } | null => {
    if (statusCat === 'done') return null;
    if (dueDateStatus === 'overdue') return { label: 'Overdue', color: '#DE350B' };
    if (estimated <= 0) return { label: 'Missing estimate', color: '#DE350B' };
    if (dueDateStatus === 'due-soon') return { label: 'Due soon', color: '#FF8B00' };
    return null;
  })();

  const [optAssignee, setOptAssignee] = useState<JiraUser | null | undefined>(undefined);
  const [optPriority, setOptPriority] = useState<JiraPriority | undefined>(undefined);
  const [optLabels, setOptLabels] = useState<string[] | undefined>(undefined);

  const displayAssignee = optAssignee !== undefined ? optAssignee : issue.fields.assignee;
  const displayPriority = optPriority ?? issue.fields.priority;
  const displayLabels = optLabels ?? (issue.fields.labels ?? []);
  const hasTags = displayLabels.length > 0 || components.length > 0;

  const [openPopover, setOpenPopover] = useState<'assignee' | 'priority' | 'labels' | 'status' | 'duedate' | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [userQuery, setUserQuery] = useState('');
  const [userResults, setUserResults] = useState<JiraUser[]>([]);
  const [userSearching, setUserSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [labelInput, setLabelInput] = useState('');
  const [labelSubmitting, setLabelSubmitting] = useState(false);
  const [transitions, setTransitions] = useState<JiraTransition[]>([]);
  const [statusLoading, setStatusLoading] = useState(false);
  const [dueDateInput, setDueDateInput] = useState(issue.fields.duedate ?? '');

  useEffect(() => {
    if (!openPopover) return;
    function handler(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setOpenPopover(null);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openPopover]);

  useEffect(() => {
    if (openPopover !== 'status') return;
    setStatusLoading(true);
    getIssueTransitions(issue.key).then(setTransitions).catch(() => setTransitions([])).finally(() => setStatusLoading(false));
  }, [openPopover, issue.key]);

  const doUserSearch = useCallback((q: string) => {
    if (q.length < 1) { setUserResults([]); return; }
    setUserSearching(true);
    searchUsers(q).then(setUserResults).catch(() => setUserResults([])).finally(() => setUserSearching(false));
  }, []);

  useEffect(() => {
    if (openPopover !== 'assignee') return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doUserSearch(userQuery), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [userQuery, openPopover, doUserSearch]);

  useEffect(() => { if (!openPopover) { setUserQuery(''); setUserResults([]); } }, [openPopover]);

  const handleTogglePopover = useCallback((kind: 'assignee' | 'priority' | 'labels', e: React.MouseEvent | React.PointerEvent) => {
    e.stopPropagation(); e.preventDefault();
    setOpenPopover(prev => prev === kind ? null : kind);
  }, []);

  const handleToggleInlinePopover = useCallback((kind: 'status' | 'duedate', e: React.MouseEvent | React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setOpenPopover(prev => prev === kind ? null : kind);
  }, []);

  const handleAssign = useCallback(async (user: JiraUser | null) => {
    if (editingCard) {
      setOptAssignee(user);
      onFieldDraft?.('assignee', user ? { name: user.name, displayName: user.displayName } : null);
      setOpenPopover(null);
      return;
    }
    setOptAssignee(user); setOpenPopover(null);
    try { await assignIssue(issue.key, user?.name ?? null); onIssueUpdate?.(); }
    catch { setOptAssignee(undefined); }
  }, [issue.key, onIssueUpdate, editingCard, onFieldDraft]);

  const handlePriorityChange = useCallback(async (p: JiraPriority) => {
    if (editingCard) {
      setOptPriority(p);
      onFieldDraft?.('priority', p.name);
      setOpenPopover(null);
      return;
    }
    setOptPriority(p); setOpenPopover(null);
    try { await updateIssuePriority(issue.key, p.name); onIssueUpdate?.(); }
    catch { setOptPriority(undefined); }
  }, [issue.key, onIssueUpdate, editingCard, onFieldDraft]);

  const handleAddLabel = useCallback(async (label: string) => {
    const prev = displayLabels;
    if (editingCard) { const next = [...prev, label]; setOptLabels(next); onFieldDraft?.('labels', next); setLabelInput(''); return; }
    setOptLabels([...prev, label]); setLabelInput(''); setLabelSubmitting(true);
    try { await addIssueLabel(issue.key, label); onIssueUpdate?.(); }
    catch { setOptLabels(prev); setLabelInput(label); }
    finally { setLabelSubmitting(false); }
  }, [issue.key, displayLabels, onIssueUpdate, editingCard, onFieldDraft]);

  const handleRemoveLabel = useCallback(async (label: string) => {
    const prev = displayLabels;
    if (editingCard) { const next = prev.filter(l => l !== label); setOptLabels(next); onFieldDraft?.('labels', next); return; }
    setOptLabels(prev.filter(l => l !== label)); setLabelSubmitting(true);
    try { await removeIssueLabel(issue.key, label); onIssueUpdate?.(); }
    catch { setOptLabels(prev); }
    finally { setLabelSubmitting(false); }
  }, [issue.key, displayLabels, onIssueUpdate, editingCard, onFieldDraft]);

  const handleLabelKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && labelInput.trim()) { e.preventDefault(); handleAddLabel(labelInput.trim()); }
  }, [labelInput, handleAddLabel]);

  const handleTransition = useCallback(async (transitionId: string, targetName: string) => {
    if (editingCard) { onFieldDraft?.('status', { transitionId, targetName }); setOpenPopover(null); return; }
    setStatusLoading(true);
    try { await transitionIssue(issue.key, transitionId); onIssueUpdate?.(); setOpenPopover(null); }
    finally { setStatusLoading(false); }
  }, [issue.key, onIssueUpdate, editingCard, onFieldDraft]);

  const handleSaveDueDate = useCallback(async () => {
    if (editingCard) { onFieldDraft?.('duedate', dueDateInput || null); setOpenPopover(null); return; }
    try { await updateIssueDueDate(issue.key, dueDateInput || null); onIssueUpdate?.(); setOpenPopover(null); }
    catch { }
  }, [issue.key, dueDateInput, onIssueUpdate, editingCard, onFieldDraft]);

  return (
    <>
    <div
      onClick={!editMode ? () => onCardClick?.(issue.key) : undefined}
      className={cn(
        'group relative p-3 rounded-sm transition-all border border-[#DFE1E6] dark:border-gray-700 m-2',
        !editMode && 'cursor-pointer',
        editMode && 'ring-1 ring-[#0052CC]/25',
        editingCard && '!ring-2 !ring-[#36B37E] !border-[#36B37E]/40 bg-[#F0FFF4] dark:bg-green-950/20',
        hasDraft && '!border-[#36B37E] !bg-[#F0FFF4] dark:!bg-green-950/20 shadow-[inset_0_0_0_1px_#36B37E]',
        isDraggingActive && 'hover:shadow-md',
        (dueDateStatus === 'overdue' || (statusCat !== 'done' && !estimated))
          ? 'bg-red-50 dark:bg-red-950/20 border-l-2 border-l-red-500'
          : dueDateStatus === 'due-soon'
            ? 'bg-orange-50 dark:bg-orange-950/20 border-l-2 border-l-orange-400'
            : (!editingCard && 'bg-white dark:bg-gray-800'),
      )}
    >
      {/* Row 1: Status + Type badge + Key + Drag handle + External link */}
      <div className="flex items-center gap-1.5 mb-2">
        <button
          type="button"
          className={cn(
            'text-[10px] font-bold px-1.5 py-0.5 rounded-sm flex-shrink-0 leading-none',
            STATUS_CATEGORY_BADGE_CLASSES[statusCat] ?? 'bg-gray-400 text-white',
            (editMode || editingCard) && 'cursor-pointer ring-1 ring-[#0052CC]/40',
            editingCard && 'ring-2 ring-[#0052CC]',
            draft?.status != null && '!ring-2 !ring-[#36B37E]',
          )}
          title={editingCard ? 'Change status' : issue.fields.status.name}
          onClick={undefined}
        >
          {issue.fields.status.name}
        </button>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm ${typeColor}`}>
          {issue.fields.issuetype?.name ?? ''}
        </span>
        {draft?.status != null && (
          <span className={cn('text-[10px] font-medium', draftHighlight('status', draft))}>
            {(draft.status as { targetName?: string })?.targetName ?? ''}
          </span>
        )}
        {draft?.status != null && editingCard && (
          <FieldActions onConfirm={() => {}} onCancel={() => onFieldRevert?.('status')} />
        )}
        <button type="button" onClick={() => onCardClick?.(issue.key)} className="text-xs text-[#0052CC] dark:text-blue-400 font-medium hover:underline">
          {issue.key}
        </button>
        {hasDraft && (
          <span className="text-[9px] font-semibold bg-[#36B37E] text-white px-1.5 py-0.5 rounded-sm leading-none ml-auto flex-shrink-0">
            Edited
          </span>
        )}
        {/* Parent task — for sub-tasks */}
        {issue.fields.parent && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onCardClick?.(issue.fields.parent!.key); }}
            className="inline-flex items-center gap-0.5 text-[10px] text-[#5E6C84] dark:text-gray-400 hover:text-[#0052CC] dark:hover:text-blue-400 hover:underline truncate max-w-[120px]"
            title={issue.fields.parent.fields.summary}
          >
            ↳ {issue.fields.parent.key}
          </button>
        )}
        {/* Project — shown after parent key */}
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onCardClick?.(issue.key); }}
          className="inline-flex items-center gap-0.5 text-[10px] text-[#5E6C84] dark:text-gray-400 hover:text-[#0052CC] dark:hover:text-blue-400 hover:underline truncate max-w-[100px]"
          title={issue.fields.project.name}
        >
          {issue.fields.project.key}
        </button>
        {/* Pencil icon — opens PencilV2 modal */}
        {editMode && (
          <>
          <button
            type="button"
            onClick={e => { e.stopPropagation(); setPencilV2Open(true); }}
            className={cn(
              'flex-shrink-0 transition-colors opacity-0 group-hover:opacity-60 text-[#5E6C84] hover:text-[#0052CC]',
            )}
            title="Edit this card"
          >
            <Pencil size={11} />
          </button>
          {/* Quick log — opens create-only LogWorkModal */}
          <button
            type="button"
            onClick={e => { e.stopPropagation(); setLogModalOpen(true); }}
            className={cn(
              'flex-shrink-0 transition-colors opacity-0 group-hover:opacity-60 text-[#5E6C84] hover:text-[#36B37E]',
              editingCard && 'opacity-60',
            )}
            title="Quick log work"
          >
            <Timer size={11} />
          </button>
          </>
        )}
        {/* Drag handle — only interactive DnD surface */}
        {dragHandleProps && (
          <span
            {...(dragHandleProps as React.HTMLAttributes<HTMLSpanElement>)}
            className="ml-auto opacity-0 group-hover:opacity-60 cursor-grab active:cursor-grabbing touch-none text-[#5E6C84] hover:text-[#172B4D] transition-opacity flex-shrink-0"
            title="Drag to move"
            onClick={e => e.stopPropagation()}
          >
            <GripVertical size={13} />
          </span>
        )}
        <a href={`https://task.ascvn.com.vn/browse/${issue.key}`} target="_blank" rel="noopener noreferrer"
          className={cn(
            'opacity-0 group-hover:opacity-100 text-[#5E6C84] hover:text-[#0052CC] transition-opacity flex-shrink-0',
            dragHandleProps ? '' : 'ml-auto',
          )}
          title="Open in Jira" onClick={e => e.stopPropagation()}>
          <ExternalLink size={12} />
        </a>
        {editMode && openPopover === 'status' && (
          <div ref={popoverRef} className={cn(POPOVER_BASE, 'w-52')} onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
            {statusLoading ? (
              <div className="px-3 py-2 text-xs text-[#5E6C84] flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> Loading…</div>
            ) : transitions.length === 0 ? (
              <div className="px-3 py-2 text-xs text-[#5E6C84]">No transitions</div>
            ) : transitions.map(t => (
              <button key={t.id} type="button" onClick={() => handleTransition(t.id, t.to?.name ?? '')} className={POPOVER_ITEM}>
                <span>{t.to?.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Row 2: Summary — prominent */}
      {editingCard ? (
        <div className="mb-2">
          <input
            type="text"
            defaultValue={issue.fields.summary}
            onBlur={e => { if (e.target.value.trim() !== issue.fields.summary) onFieldDraft?.('summary', e.target.value.trim()); }}
            onKeyDown={e => { if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim() !== issue.fields.summary) { onFieldDraft?.('summary', (e.target as HTMLInputElement).value.trim()); } }}
            placeholder="Summary"
            className="w-full text-sm border border-[#0052CC] rounded px-2 py-1 bg-white dark:bg-gray-800 text-[#172B4D] dark:text-gray-200 focus:outline-none"
          />
          {draft?.summary != null && (
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-[10px] text-[#36B37E] font-medium truncate">{String(draft.summary)}</span>
              <FieldActions onConfirm={() => {}} onCancel={() => onFieldRevert?.('summary')} />
            </div>
          )}
        </div>
      ) : (
        <button type="button" onClick={() => onCardClick?.(issue.key)} className={cn('w-full text-left mb-2', draft?.summary != null && 'relative')}>
          <p className={cn('text-sm leading-snug line-clamp-2 transition-colors', draft?.summary != null ? 'text-[#1B7C44] font-semibold' : 'text-[#172B4D] dark:text-gray-200 hover:text-[#0052CC] dark:hover:text-blue-400')}>
            {issue.fields.summary}
          </p>
          {draft?.summary != null && <span className="text-[9px] text-[#36B37E] font-medium">(edited)</span>}
        </button>
      )}

      {/* Row 3: Time tracking bar */}
      {hasTimeTracking && (
        <div className="mb-2">
          <div className="flex items-center justify-between text-[10px] mb-0.5">
            <span className="text-[#5E6C84] dark:text-gray-400">
              ⏱ {formatHours(logged)} / {formatHours(estimated)}
            </span>
            <span className="text-[#8993A4] dark:text-gray-500">{Math.round(progress * 100)}%</span>
          </div>
          <div className="w-full h-1 bg-[#DFE1E6] dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', progress >= 1 ? 'bg-[#36B37E]' : 'bg-[#0052CC]')}
              style={{ width: `${Math.min(progress * 100, 100)}%` }}
            />
        </div>
      </div>
      )}

      {/* Row 4: Sprint + Created date + Due date (left) | Est + Log (right) */}
      {(sprintName || issue.fields.created || issue.fields.duedate || estimated > 0 || logged > 0) && (
      <div className="flex items-center justify-between gap-2 text-[10px] text-[#5E6C84] dark:text-gray-400 mb-2">
        <div className="flex items-center gap-3">
          {sprintName && <span>📅 {sprintName}</span>}
          {issue.fields.created && <span>🕐 {formatDate(issue.fields.created)}</span>}
          {/* Due date — always visible, only editable when pencil active */}
          {editingCard ? (
            <div className="relative">
              <button type="button" onClick={undefined} className={cn('inline-flex items-center gap-1 text-[#0052CC]', draftChanged(draft, 'duedate') && '!text-[#1B7C44] font-semibold')}>
                <Calendar size={10} /> {draft?.duedate !== undefined ? (draft.duedate ? formatDate(draft.duedate as string) : 'None') : (issue.fields.duedate ? formatDate(issue.fields.duedate) : 'Set due')}
              </button>
              {draft?.duedate !== undefined && (
                <FieldActions onConfirm={() => {}} onCancel={() => onFieldRevert?.('duedate')} />
              )}
              {openPopover === 'duedate' && (
                <div ref={popoverRef} className={cn(POPOVER_BASE, 'w-48')} onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
                  <div className="p-2 flex items-center gap-1.5">
                    <input type="date" value={dueDateInput} onChange={e => setDueDateInput(e.target.value)} className="text-xs border border-[#DFE1E6] rounded px-1.5 py-1 flex-1" />
                    <button type="button" onClick={handleSaveDueDate} className="text-xs px-2 py-1 bg-[#0052CC] text-white rounded">Save</button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            issue.fields.duedate && <span>📅 {formatDate(issue.fields.duedate)}</span>
          )}
        </div>
        {/* Log (read-only) + Est (editable when editingCard) */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {logged > 0 && (
            <span className={cn('inline-flex items-center gap-1', logColor)}><Clock size={10} /> {formatHours(logged)}</span>
          )}
          {editingCard ? (
            <span className="inline-flex items-center gap-1">
              <Timer size={10} />
              <input type="number" min="0" step="0.5" defaultValue={estimated / 3600}
                onBlur={e => { const v = parseFloat(e.target.value); if (v > 0 && v * 3600 !== estimated) onFieldDraft?.('originalEstimate', v); }}
                onKeyDown={e => { if (e.key === 'Enter') { const v = parseFloat((e.target as HTMLInputElement).value); if (v > 0 && v * 3600 !== estimated) onFieldDraft?.('originalEstimate', v); } }}
                placeholder="h"                 className="w-14 text-[10px] border border-[#0052CC] rounded px-1 py-0.5 bg-white dark:bg-gray-800 text-[#172B4D]" />
              {draft?.originalEstimate != null && <FieldActions onConfirm={() => {}} onCancel={() => onFieldRevert?.('originalEstimate')} />}
            </span>
          ) : (estimated > 0 && (
            <span className={cn('inline-flex items-center gap-1', draft?.originalEstimate != null ? 'text-[#1B7C44] font-semibold' : estColor)}><Timer size={10} /> {formatHours(estimated)}</span>
          ))}
        </div>
      </div>
      )}

      {/* Row 5: Labels + Components (only when has tags or popover open) */}
      {(hasTags || openPopover === 'labels') && (
      <div className="relative mb-2">
          <button type="button" className={cn('w-full text-left cursor-pointer', editingCard && 'ring-2 ring-[#0052CC]/30 rounded', draftHighlight('labels', draft))} onClick={undefined}>
          {hasTags && (
            <div className="flex items-center gap-1 flex-wrap">
              {components.map(c => (
                <span key={c.id} className="text-[10px] px-1.5 py-0.5 rounded-sm bg-[#DFE1E6] dark:bg-gray-700 text-[#5E6C84] dark:text-gray-400">{c.name}</span>
              ))}
              {displayLabels.map(label => (
                <span key={label} className="text-[10px] font-medium px-1.5 py-0.5 rounded-sm text-white" style={{ backgroundColor: labelColor(label) }}>{label}</span>
              ))}
            </div>
          )}
        </button>
        {draft?.labels != null && editingCard && (
          <FieldActions onConfirm={() => {}} onCancel={() => onFieldRevert?.('labels')} />
        )}
        {openPopover === 'labels' && (
          <div ref={popoverRef} className={cn(POPOVER_BASE, 'w-56')} onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
            {displayLabels.length > 0 && (
              <div className="p-2 space-y-1 border-b border-[#DFE1E6] dark:border-gray-600">
                {displayLabels.map(label => (
                  <div key={label} className="flex items-center justify-between px-2 py-0.5 text-[10px] font-medium rounded-sm text-white" style={{ backgroundColor: labelColor(label) }}>
                    <span>{label}</span>
                    <button type="button" onClick={() => handleRemoveLabel(label)} disabled={labelSubmitting} className="ml-1 opacity-70 hover:opacity-100"><X size={10} /></button>
                  </div>
                ))}
              </div>
            )}
            <div className="p-2">
              <input type="text" value={labelInput} onChange={e => setLabelInput(e.target.value)} onKeyDown={handleLabelKeyDown}
                placeholder="Type label + Enter" disabled={labelSubmitting} autoFocus
                className="w-full text-xs border border-[#DFE1E6] dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-800 text-[#172B4D] dark:text-gray-100 placeholder:text-[#8993A4] focus:outline-none focus:border-[#0052CC]" />
            </div>
          </div>
        )}
      </div>
      )}

      {/* Row 6: Footer */}
      <div className="flex items-center gap-1.5 leading-none">
        <div className="relative">
          <button
            type="button"
            onClick={editingCard ? (e) => handleTogglePopover('priority', e) : undefined}
            onPointerDown={editingCard ? (e) => e.stopPropagation() : undefined}
            className={cn(
              'flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-sm transition-colors',
              editingCard ? 'cursor-pointer ring-2 ring-[#0052CC]/30' : 'cursor-default',
              draftHighlight('priority', draft),
            )}
            style={{ color: PRIORITY_HEX_COLORS[displayPriority?.name ?? ''] ?? '#6B778C' }}
            title={displayPriority?.name ?? 'No priority'}
          >
            {displayPriority?.name ?? '—'}
          </button>
          {draft?.priority != null && editingCard && (
            <FieldActions onConfirm={() => {}} onCancel={() => onFieldRevert?.('priority')} />
          )}
          {openPopover === 'priority' && (
            <div ref={popoverRef} className={cn(POPOVER_BASE, 'w-36')} onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
              {PRIORITY_OPTIONS.map(p => (
                <button key={p.name} type="button" onClick={() => handlePriorityChange({ name: p.name, iconUrl: '' })}
                  className={cn(POPOVER_ITEM, displayPriority?.name === p.name && 'bg-[#F4F5F7] dark:bg-gray-700 font-semibold')}>
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                  <span>{p.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {storyPoints != null && (
          <span className="text-[10px] font-medium text-[#0052CC] dark:text-blue-400">
            ⭐ {storyPoints} {storyPoints === 1 ? 'pt' : 'pts'}
          </span>
        )}

        {warningBadge && (
          <div className='relative'>
              <span
              className="flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-sm transition-colors"
              style={{ color: warningBadge.color }}
            >
              {warningBadge.label}
            </span>
          </div>

        )}

        {/* Reporter: avatar + name (push right) */}
        <div className="flex items-center gap-1 flex-shrink-0 ml-auto" title={`Reporter: ${issue.fields.reporter?.displayName}`}>
          <User size={10} className="text-[#8993A4]" />
          {issue.fields.reporter?.avatarUrls?.['24x24'] ? (
            <img src={issue.fields.reporter.avatarUrls['24x24']} alt="" className="w-4 h-4 rounded-full" />
          ) : (
            <span className="w-4 h-4 rounded-full bg-[#DFE1E6] dark:bg-gray-600 flex items-center justify-center text-[7px] text-[#5E6C84]">
              {issue.fields.reporter?.displayName?.charAt(0) ?? '?'}
            </span>
          )}
          <span className="text-[9px] text-[#8993A4] dark:text-gray-500">
            {issue.fields.reporter?.displayName}
          </span>
        </div>

        <span className="text-[#DFE1E6] dark:text-gray-600 select-none">·</span>

        {/* Assignee: avatar + name (clickable to edit) */}
        <div className="relative flex-shrink-0">
          <button type="button" onClick={editingCard ? (e) => handleTogglePopover('assignee', e) : undefined} onPointerDown={editingCard ? (e) => e.stopPropagation() : undefined} className={cn(
            'flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity',
            draftHighlight('assignee', draft),
            editingCard && 'ring-1 ring-[#0052CC]/30 rounded px-1',
          )}>
            <UserCheck size={10} className="text-[#5E6C84]" />
            {displayAssignee ? (
              <img src={displayAssignee.avatarUrls['24x24']} alt="" className="w-4 h-4 rounded-full border border-[#DFE1E6] dark:border-gray-600" />
            ) : (
              <span className="w-4 h-4 rounded-full bg-[#DFE1E6] dark:bg-gray-700 flex items-center justify-center text-[7px] text-[#5E6C84]">?</span>
            )}
            <span className="text-[9px] text-[#5E6C84] dark:text-gray-400">
              {displayAssignee?.displayName ?? 'Unassigned'}
            </span>
          </button>
          {draft?.assignee != null && editingCard && (
            <FieldActions onConfirm={() => {}} onCancel={() => onFieldRevert?.('assignee')} />
          )}
          {openPopover === 'assignee' && (
            <div ref={popoverRef} className={cn(POPOVER_BASE, 'w-60')} onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
              <button type="button" onClick={() => handleAssign(null)} className={cn(POPOVER_ITEM, !displayAssignee && 'bg-[#F4F5F7] dark:bg-gray-700 font-semibold')}>
                <div className="w-5 h-5 rounded-full bg-[#DFE1E6] dark:bg-gray-600 flex items-center justify-center text-[10px]">?</div>
                <span>Unassigned</span>
              </button>
              <div className="border-t border-[#DFE1E6] dark:border-gray-600 my-0.5" />
              <div className="px-2 py-1">
                <div className="relative">
                  <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#5E6C84] dark:text-gray-500 pointer-events-none" />
                    <input type="text" value={userQuery} onChange={e => setUserQuery(e.target.value)} placeholder="Search users..." 
                      className="w-full text-xs border border-[#DFE1E6] dark:border-gray-600 rounded pl-7 pr-2 py-1.5 bg-white dark:bg-gray-800 text-[#172B4D] dark:text-gray-100 placeholder:text-[#8993A4] focus:outline-none focus:border-[#0052CC]" />
                </div>
              </div>
              <div className="max-h-48 overflow-y-auto">
                {userSearching && <div className="flex items-center gap-2 px-3 py-2 text-xs text-[#5E6C84] dark:text-gray-400"><Loader2 size={12} className="animate-spin" /> Searching...</div>}
                {!userSearching && userResults.map(user => (
                  <button key={user.name} type="button" onClick={() => handleAssign(user)}
                    className={cn(POPOVER_ITEM, displayAssignee?.name === user.name && 'bg-[#F4F5F7] dark:bg-gray-700 font-semibold')}>
                    <img src={user.avatarUrls['24x24']} alt="" className="w-5 h-5 rounded-full flex-shrink-0" />
                    <span>{user.displayName}</span>
                    {displayAssignee?.name === user.name && <span className="ml-auto text-[10px] text-[#8993A4]">current</span>}
                  </button>
                ))}
                {!userSearching && userQuery.length >= 1 && userResults.length === 0 && <div className="px-3 py-2 text-xs text-[#5E6C84] dark:text-gray-400">No users found</div>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    {/* Quick log modal */}
    {logModalOpen && (
      <LogWorkModal
        issueKey={issue.key}
        issueSummary={issue.fields.summary}
        issueDuedate={issue.fields.duedate}
        onClose={() => setLogModalOpen(false)}
        onSuccess={() => {
          setLogModalOpen(false);
          onIssueUpdate?.();
        }}
      />
    )}
    {/* Pencil V2 modal */}
    {pencilV2Open && (
      <PencilV2Modal
        issue={issue}
        estimated={estimated}
        onConfirm={(drafts) => {
          for (const [field, value] of Object.entries(drafts)) {
            ctx?.onFieldDraft(issue.key, field, value);
          }
        }}
        onClose={() => setPencilV2Open(false)}
      />
    )}
    </>
  );
}
