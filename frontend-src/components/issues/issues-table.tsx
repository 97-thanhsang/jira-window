'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Image from 'next/image';
import type { JiraIssue, JiraTransition, JiraSprint } from '@/types/jira';
import { StatusBadge } from '@/components/shared/status-badge';
import { PriorityIcon } from '@/components/shared/priority-icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { api } from '@/lib/api';
import { IssueDetailPanel } from './issue-detail-panel';
import {
  Loader2, X, ChevronDown, ChevronRight,
  ChevronUp, ChevronsUpDown,
  Columns, Download, Check, User, Calendar, GripVertical,
  AlertTriangle, Pencil, Save, MoreVertical,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { StatusEditor, InlineTextEditor, DateEditor, EstEditor } from '../team/inline-editors';
import { SaveConfirmModal, type EditEntry } from '../team/save-confirm-modal';

// ─── Edit mode helpers ────────────────────────────────────────────

interface AssigneeEdit {
  issueKey: string;
  oldValue: string;
  newValue: string;
  newDisplayName: string;
}

/** Map IssuesTable column key → EditEntry field */
function colToField(col: ColumnKey): EditEntry['field'] | null {
  switch (col) {
    case 'summary': return 'summary';
    case 'status':  return 'status';
    case 'due':     return 'duedate';
    case 'est':     return 'est';
    default:        return null;
  }
}

/** Get the current value for a column as displayed */
function getColValue(col: ColumnKey, issue: JiraIssue): string {
  switch (col) {
    case 'summary': return issue.fields.summary;
    case 'status':  return issue.fields.status.name;
    case 'due':     return issue.fields.duedate ?? '';
    case 'est':     return issue.fields.timetracking?.originalEstimate ?? '';
    case 'assignee': return issue.fields.assignee?.name ?? '';
    default:        return '';
  }
}

// ─── Column config ────────────────────────────────────────────────

export type ColumnKey =
  | 'key' | 'summary' | 'type' | 'status' | 'priority'
  | 'assignee' | 'reporter' | 'sprint' | 'est' | 'logged'
  | 'labels' | 'due' | 'updated';

export type GroupBy = 'none' | 'epic' | 'project' | 'status' | 'type' | 'sprint' | 'assignee' | 'priority' | 'statusCategory' | 'reporter' | 'parent';

export type SubGroupBy =
  | 'none'
  | 'epic'
  | 'type'
  | 'status'
  | 'statusCategory'
  | 'assignee'
  | 'priority'
  | 'sprint'
  | 'reporter'
  | 'project'
  | 'parent';

export type SubSubGroupBy =
  | 'none'
  | 'epic'
  | 'type'
  | 'status'
  | 'priority'
  | 'assignee'
  | 'sprint'
  | 'reporter'
  | 'project'
  | 'statusCategory'
  | 'parent';

interface ColumnDef {
  key: ColumnKey;
  label: string;
  widthClass: string;
  sortField?: string;
  defaultVisible: boolean;
  align?: 'right';
}

const COLUMNS: ColumnDef[] = [
  { key: 'key',      label: 'Key',      widthClass: 'w-36',  sortField: 'key',      defaultVisible: true  },
  { key: 'summary',  label: 'Summary',  widthClass: 'flex-1',sortField: 'summary',  defaultVisible: true  },
  { key: 'type',     label: 'Type',     widthClass: 'w-28',                          defaultVisible: true  },
  { key: 'status',   label: 'Status',   widthClass: 'w-36',  sortField: 'status',   defaultVisible: true  },
  { key: 'priority', label: 'Priority', widthClass: 'w-16',  sortField: 'priority', defaultVisible: true  },
  { key: 'assignee', label: 'Assignee', widthClass: 'w-36',  sortField: 'assignee', defaultVisible: true  },
  { key: 'reporter', label: 'Reporter', widthClass: 'w-40',  sortField: 'reporter', defaultVisible: true  },
  { key: 'sprint',   label: 'Sprint',   widthClass: 'w-32',                          defaultVisible: true  },
  { key: 'est',      label: 'Est',      widthClass: 'w-20',                          defaultVisible: true  },
  { key: 'logged',   label: 'Logged',   widthClass: 'w-20',                          defaultVisible: true },
  { key: 'labels',   label: 'Labels',   widthClass: 'w-40',                          defaultVisible: false },
  { key: 'due',      label: 'Due',      widthClass: 'w-24',  sortField: 'duedate',  defaultVisible: true  },
  { key: 'updated',  label: 'Updated',  widthClass: 'w-24',  sortField: 'updated',  defaultVisible: true, align: 'right' },
];

const DEFAULT_VISIBLE = new Set<ColumnKey>(
  COLUMNS.filter(c => c.defaultVisible).map(c => c.key)
);

const DEFAULT_ORDER: ColumnKey[] = COLUMNS.map(c => c.key);

const INLINE_EDITABLE: ColumnKey[] = [];

const EDIT_MODE_EDITABLE: ColumnKey[] = [];

const PRIORITY_NAMES = ['Highest', 'High', 'Medium', 'Low', 'Lowest', 'Blocker', 'Minor'];

const GROUP_BY_LABELS: Record<GroupBy, string> = {
  none: 'None', epic: 'Epic', status: 'Status', priority: 'Priority',
  type: 'Type', assignee: 'Assignee', reporter: 'Reporter',
  sprint: 'Sprint', project: 'Project', statusCategory: 'Status Category',
  parent: 'Parent',
};

const SUB_GROUP_BY_LABELS: Record<SubGroupBy, string> = {
  none: 'None', epic: 'Epic', status: 'Status', priority: 'Priority',
  type: 'Type', assignee: 'Assignee', reporter: 'Reporter',
  sprint: 'Sprint', project: 'Project', statusCategory: 'Status Category',
  parent: 'Parent',
};

/** SubGroupBy options that are compatible with a given GroupBy (excludes the same field) */
function getSubGroupOptions(groupBy: GroupBy): SubGroupBy[] {
  const all: SubGroupBy[] = ['none', 'epic', 'status', 'priority', 'type', 'assignee', 'reporter', 'sprint', 'project', 'statusCategory', 'parent'];
  // Map groupBy → SubGroupBy keys that overlap (to exclude)
  const exclude: Partial<Record<GroupBy, SubGroupBy[]>> = {
    status:    ['status', 'statusCategory'],
    type: ['type'],
    assignee:  ['assignee'],
    priority:  ['priority'],
    sprint:    ['sprint'],
    reporter:  ['reporter'],
    project:   ['project'],
  };
  const blocked = new Set<SubGroupBy>(exclude[groupBy] ?? []);
  return all.filter(s => !blocked.has(s));
}

const SUB_SUB_GROUP_BY_LABELS: Record<SubSubGroupBy, string> = {
  none: 'None', epic: 'Epic', status: 'Status', priority: 'Priority',
  type: 'Type', sprint: 'Sprint', assignee: 'Assignee',
  reporter: 'Reporter', project: 'Project', statusCategory: 'Status Category',
  parent: 'Parent',
};

/** SubSubGroupBy options compatible with a given GroupBy and SubGroupBy (excludes overlapping fields) */
function getSubSubGroupOptions(groupBy: GroupBy, subGroupBy: SubGroupBy): SubSubGroupBy[] {
  const all: SubSubGroupBy[] = ['none', 'epic', 'status', 'priority', 'type', 'assignee', 'reporter', 'sprint', 'project', 'statusCategory', 'parent'];
  // Map field → SubSubGroupBy keys that overlap (to exclude)
  const exclude: Partial<Record<GroupBy | SubGroupBy, SubSubGroupBy[]>> = {
    status:         ['status'],
    statusCategory: ['status', 'statusCategory'],
    type:      ['type'],
    assignee:       ['assignee'],
    priority:       ['priority'],
    sprint:         ['sprint'],
    reporter:       ['reporter'],
    project:        ['project'],
  };
  const blocked = new Set<SubSubGroupBy>([
    ...(exclude[groupBy] ?? []),
    ...(exclude[subGroupBy] ?? []),
  ]);
  return all.filter(s => !blocked.has(s));
}

// ─── Helpers ─────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function isOverdue(duedate: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(duedate) < today;
}

/** Resolve sprint from both `sprint` and `customfield_10020` (Jira Server alias),
 *  and fallback to scanning all issue fields for sprint-like data */
function resolveSprint(issue: JiraIssue): JiraSprint | null {
  // Try known field names first
  const raw = issue.fields.sprint ?? issue.fields.customfield_10020;
  if (raw) {
    if (Array.isArray(raw)) {
      return (raw as JiraSprint[]).find(s => s.state === 'active')
        ?? (raw as JiraSprint[])[raw.length - 1]
        ?? null;
    }
    return raw as JiraSprint;
  }

  // Fallback: scan ALL fields for any sprint-shaped data (handles customfield_XXXXX)
  for (const value of Object.values(issue.fields)) {
    if (!value) continue;
    const items = Array.isArray(value) ? value : [value];
    for (const item of items) {
      const it = item as Record<string, unknown>;
      if (
        typeof it === 'object' &&
        typeof it.id === 'number' &&
        typeof it.name === 'string' &&
        typeof it.state === 'string'
      ) {
        return it as unknown as JiraSprint;
      }
    }
  }

  return null;
}

function getCellText(key: ColumnKey, issue: JiraIssue): string {
  const f = issue.fields;
  switch (key) {
    case 'key':      return issue.key;
    case 'summary':  return f.summary;
    case 'type':     return f.issuetype.name;
    case 'status':   return f.status.name;
    case 'priority': return f.priority?.name ?? '';
    case 'assignee': return f.assignee?.displayName ?? 'Unassigned';
    case 'reporter': return f.reporter?.displayName ?? '';
    case 'sprint':   return resolveSprint(issue)?.name ?? '';
    case 'est':      return f.timetracking?.originalEstimate ?? '';
    case 'logged':   return f.timetracking?.timeSpent ?? '';
    case 'labels':   return (f.labels ?? []).join(', ');
    case 'due':      return f.duedate ?? '';
    case 'updated':  return formatDate(f.updated);
    default:         return '';
  }
}

function groupIssues(issues: JiraIssue[], groupBy: GroupBy, epicSummaries?: Record<string, string>) {
  if (groupBy === 'none') return [{ key: '__all', label: '', issues }];
  const map = new Map<string, { label: string; issues: JiraIssue[] }>();

  for (const issue of issues) {
    const f = issue.fields;
    let gKey: string, gLabel: string;

    switch (groupBy) {
      case 'project':
        gKey = f.project.key; gLabel = `${f.project.name} (${f.project.key})`; break;
      case 'status':
        gKey = f.status.name;
        gLabel = f.status.name;
        break;
      case 'type':
        gKey = f.issuetype.name; gLabel = f.issuetype.name; break;
      case 'sprint': {
        const s = resolveSprint(issue);
        gKey = s ? String(s.id) : '__nosprint';
        gLabel = s?.name ?? 'No Sprint'; break;
      }
      case 'assignee':
        gKey = f.assignee?.name ?? '__unassigned';
        gLabel = f.assignee?.displayName ?? 'Unassigned'; break;
      case 'priority':
        gKey = f.priority?.name ?? 'None';
        gLabel = f.priority?.name ?? 'None'; break;
      case 'reporter':
        gKey = f.reporter?.name ?? '__noreporter';
        gLabel = f.reporter?.displayName ?? 'No Reporter'; break;
      case 'statusCategory': {
        const cat = f.status.statusCategory.key;
        const catLabels: Record<string, string> = { new: 'To Do', indeterminate: 'In Progress', done: 'Done' };
        gKey = cat; gLabel = catLabels[cat] ?? cat; break;
      }
      case 'parent':
        if (f.parent) {
          gKey = f.parent.key;
          gLabel = f.parent.fields?.summary ? `${f.parent.key} — ${f.parent.fields.summary}` : f.parent.key;
        } else {
          gKey = '__no_parent';
          gLabel = 'No Parent';
        }
        break;
      case 'epic': {
        const epicKey = (f as unknown as Record<string, unknown>).customfield_10107 as string | undefined;
        if (epicKey && epicSummaries?.[epicKey]) {
          gKey = epicKey;
          gLabel = `${epicKey} — ${epicSummaries[epicKey]}`;
        } else {
          gKey = epicKey || '__no_epic';
          gLabel = epicKey || 'No Epic';
        }
        break;
      }
      default:
        gKey = '__all'; gLabel = '';
    }

    if (!map.has(gKey)) map.set(gKey, { label: gLabel, issues: [] });
    map.get(gKey)!.issues.push(issue);
  }

  return Array.from(map.entries()).map(([key, val]) => ({ key, label: val.label, issues: val.issues }));
}

function subGroupIssues(issues: JiraIssue[], subGroupBy: SubGroupBy, epicSummaries?: Record<string, string>): { key: string; label: string; issues: JiraIssue[] }[] {
  if (subGroupBy === 'none') return [{ key: '__all', label: '', issues }];
  const map = new Map<string, { label: string; issues: JiraIssue[] }>();

  for (const issue of issues) {
    const f = issue.fields;
    let gKey: string, gLabel: string;

    switch (subGroupBy) {
      case 'type':
        gKey = f.issuetype.name; gLabel = f.issuetype.name; break;
      case 'status':
        gKey = f.status.name; gLabel = f.status.name; break;
      case 'statusCategory': {
        const cat = f.status.statusCategory.key;
        const catLabels: Record<string, string> = {
          new: 'To Do',
          indeterminate: 'In Progress',
          done: 'Done',
        };
        gKey = cat; gLabel = catLabels[cat] ?? cat; break;
      }
      case 'assignee':
        gKey = f.assignee?.name ?? '__unassigned';
        gLabel = f.assignee?.displayName ?? 'Unassigned'; break;
      case 'priority':
        gKey = f.priority?.name ?? 'None';
        gLabel = f.priority?.name ?? 'None'; break;
      case 'sprint': {
        const s = resolveSprint(issue);
        gKey = s ? String(s.id) : '__nosprint';
        gLabel = s?.name ?? 'No Sprint'; break;
      }
      case 'reporter':
        gKey = f.reporter?.name ?? '__noreporter';
        gLabel = f.reporter?.displayName ?? 'No Reporter'; break;
      case 'project':
        gKey = f.project.key; gLabel = `${f.project.name} (${f.project.key})`; break;
      case 'parent':
        if (f.parent) {
          gKey = f.parent.key;
          gLabel = f.parent.fields?.summary ? `${f.parent.key} — ${f.parent.fields.summary}` : f.parent.key;
        } else {
          gKey = '__no_parent';
          gLabel = 'No Parent';
        }
        break;
      case 'epic': {
        const epicKey = (f as unknown as Record<string, unknown>).customfield_10107 as string | undefined;
        if (epicKey && epicSummaries?.[epicKey]) {
          gKey = epicKey;
          gLabel = `${epicKey} — ${epicSummaries[epicKey]}`;
        } else {
          gKey = epicKey || '__no_epic';
          gLabel = epicKey || 'No Epic';
        }
        break;
      }
      default:
        gKey = '__all'; gLabel = '';
    }

    if (!map.has(gKey)) map.set(gKey, { label: gLabel, issues: [] });
    map.get(gKey)!.issues.push(issue);
  }

  return Array.from(map.entries()).map(([key, val]) => ({ key, label: val.label, issues: val.issues }));
}

function subSubGroupIssues(issues: JiraIssue[], subSubGroupBy: SubSubGroupBy, epicSummaries?: Record<string, string>): { key: string; label: string; issues: JiraIssue[] }[] {
  if (subSubGroupBy === 'none') return [{ key: '__all', label: '', issues }];
  const map = new Map<string, { label: string; issues: JiraIssue[] }>();

  for (const issue of issues) {
    const f = issue.fields;
    let gKey: string, gLabel: string;

    switch (subSubGroupBy) {
      case 'type':
        gKey = f.issuetype.name; gLabel = f.issuetype.name; break;
      case 'status':
        gKey = f.status.name; gLabel = f.status.name; break;
      case 'statusCategory': {
        const cat = f.status.statusCategory.key;
        const catLabels: Record<string, string> = {
          new: 'To Do',
          indeterminate: 'In Progress',
          done: 'Done',
        };
        gKey = cat; gLabel = catLabels[cat] ?? cat; break;
      }
      case 'assignee':
        gKey = f.assignee?.name ?? '__unassigned';
        gLabel = f.assignee?.displayName ?? 'Unassigned'; break;
      case 'priority':
        gKey = f.priority?.name ?? 'None';
        gLabel = f.priority?.name ?? 'None'; break;
      case 'sprint': {
        const s = resolveSprint(issue);
        gKey = s ? String(s.id) : '__nosprint';
        gLabel = s?.name ?? 'No Sprint'; break;
      }
      case 'reporter':
        gKey = f.reporter?.name ?? '__noreporter';
        gLabel = f.reporter?.displayName ?? 'No Reporter'; break;
      case 'project':
        gKey = f.project.key; gLabel = `${f.project.name} (${f.project.key})`; break;
      case 'parent':
        if (f.parent) {
          gKey = f.parent.key;
          gLabel = f.parent.fields?.summary ? `${f.parent.key} — ${f.parent.fields.summary}` : f.parent.key;
        } else {
          gKey = '__no_parent';
          gLabel = 'No Parent';
        }
        break;
      case 'epic': {
        const epicKey = (f as unknown as Record<string, unknown>).customfield_10107 as string | undefined;
        if (epicKey && epicSummaries?.[epicKey]) {
          gKey = epicKey;
          gLabel = `${epicKey} — ${epicSummaries[epicKey]}`;
        } else {
          gKey = epicKey || '__no_epic';
          gLabel = epicKey || 'No Epic';
        }
        break;
      }
      default:
        gKey = '__all'; gLabel = '';
    }

    if (!map.has(gKey)) map.set(gKey, { label: gLabel, issues: [] });
    map.get(gKey)!.issues.push(issue);
  }

  return Array.from(map.entries()).map(([key, val]) => ({ key, label: val.label, issues: val.issues }));
}

// ─── Toast ───────────────────────────────────────────────────────

interface ToastInfo { msg: string; type: 'success' | 'error' }

function Toast({ toast }: { toast: ToastInfo | null }) {
  if (!toast) return null;
  return (
    <div className={cn(
      'fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 text-xs px-4 py-2 rounded-full shadow-xl text-white font-medium z-[100] pointer-events-none',
      'animate-[fadeIn_0.2s_ease-out]',
      toast.type === 'success' ? 'bg-green-500' : 'bg-red-500',
    )}>
      {toast.type === 'success' ? <Check size={13} /> : <AlertTriangle size={13} />}
      {toast.msg}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────

function IssueTypeFallback({ name }: { name: string }) {
  const colors: Record<string, string> = {
    Bug: 'bg-red-500', Task: 'bg-blue-500', Story: 'bg-green-500',
    Epic: 'bg-purple-500', 'Sub-task': 'bg-sky-400',
  };
  return (
    <span
      className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded-sm ${colors[name] ?? 'bg-gray-400'} text-white text-[8px] font-bold flex-shrink-0`}
      title={name}
    >
      {name.charAt(0)}
    </span>
  );
}

function UserAvatar({ user }: { user: { displayName: string; avatarUrls: { '24x24': string } } }) {
  return user.avatarUrls['24x24']
    ? <Image src={user.avatarUrls['24x24']} alt={user.displayName} width={18} height={18} className="rounded-full flex-shrink-0" unoptimized />
    : <span className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-full bg-[#0052CC] text-white text-[9px] font-bold flex-shrink-0">{user.displayName.charAt(0)}</span>;
}

function SortableHeader({ label, field, sortField, sortDir, onSort, className }: {
  label: string; field: string; sortField: string; sortDir: 'ASC' | 'DESC';
  onSort: (f: string, d: 'ASC' | 'DESC') => void; className?: string;
}) {
  const active = sortField === field;
  return (
    <button
      onClick={() => onSort(field, active && sortDir === 'ASC' ? 'DESC' : 'ASC')}
      className={cn(
        'flex items-center gap-0.5 text-xs font-semibold uppercase tracking-wide transition-colors',
        active ? 'text-[#0052CC] dark:text-blue-400' : 'text-[#5E6C84] dark:text-gray-400 hover:text-[#172B4D] dark:hover:text-gray-200',
        className,
      )}
    >
      {label}
      <span className="flex-shrink-0">
        {active
          ? sortDir === 'ASC' ? <ChevronUp size={10} /> : <ChevronDown size={10} />
          : <ChevronsUpDown size={10} className="opacity-40" />}
      </span>
    </button>
  );
}

function CellContent({ col, issue, hasDraft }: { col: ColumnDef; issue: JiraIssue; hasDraft?: boolean }) {
  const f = issue.fields;

  switch (col.key) {
    case 'key':
      return (
        <a
          href={`/issues/${issue.key}`}
          data-no-panel
          onClick={e => e.stopPropagation()}
          className="flex items-center gap-1.5 hover:underline"
        >
          {f.issuetype.iconUrl
            ? <Image src={f.issuetype.iconUrl} alt={f.issuetype.name} width={14} height={14} className="flex-shrink-0" unoptimized />
            : <IssueTypeFallback name={f.issuetype.name} />}
          <span className="text-xs text-[#0052CC] dark:text-blue-400 font-medium truncate">{issue.key}</span>
          {hasDraft && (
            <span className="text-[9px] font-semibold bg-[#36B37E] text-white px-1.5 py-0.5 rounded-sm leading-none flex-shrink-0">
              Edited
            </span>
          )}
        </a>
      );

    case 'summary':
      return <span className="text-sm text-[#172B4D] dark:text-gray-100 truncate">{f.summary}</span>;

    case 'type':
      return (
        <div className="flex items-center gap-1.5">
          {f.issuetype.iconUrl
            ? <Image src={f.issuetype.iconUrl} alt={f.issuetype.name} width={14} height={14} className="flex-shrink-0" unoptimized />
            : <IssueTypeFallback name={f.issuetype.name} />}
          <span className="text-xs text-[#5E6C84] dark:text-gray-400 truncate">{f.issuetype.name}</span>
        </div>
      );

    case 'status':
      return <StatusBadge status={f.status} />;

    case 'priority':
      return <div className="flex items-center gap-1.5"><PriorityIcon priority={f.priority} /><span className="text-xs text-[#5E6C84] dark:text-gray-400">{f.priority?.name ?? ''}</span></div>;

    case 'assignee':
      return f.assignee ? (
        <div className="flex items-center gap-1.5 min-w-0">
          <UserAvatar user={f.assignee} />
          <span className="text-xs text-[#5E6C84] dark:text-gray-400 truncate">{f.assignee.displayName}</span>
        </div>
      ) : <span className="text-xs text-[#5E6C84] dark:text-gray-500 italic">Unassigned</span>;

    case 'reporter':
      return (
        <div className="flex items-center gap-1.5 min-w-0">
          <UserAvatar user={f.reporter} />
          <span className="text-xs text-[#5E6C84] dark:text-gray-400 truncate">{f.reporter.displayName}</span>
        </div>
      );

    case 'sprint': {
      const s = resolveSprint(issue);
      return (
        <span className="text-xs text-[#5E6C84] dark:text-gray-400 truncate">
          {s ? s.name : '—'}
        </span>
      );
    }

    case 'est':
      return <span className="text-xs text-[#5E6C84] dark:text-gray-400">{f.timetracking?.originalEstimate ?? '—'}</span>;

    case 'logged':
      const secs = f.timetracking?.timeSpentSeconds;
      return <span className="text-xs text-[#5E6C84] dark:text-gray-400">{secs != null ? `${(secs / 3600).toFixed(1)}h` : '—'}</span>;

    case 'labels':
      return (f.labels?.length ?? 0) > 0 ? (
        <div className="flex flex-wrap gap-1">
          {f.labels.slice(0, 2).map(l => (
            <span key={l} className="text-[10px] px-1.5 py-0.5 bg-[#DFE1E6] dark:bg-gray-600 text-[#42526E] dark:text-gray-300 rounded whitespace-nowrap">
              {l}
            </span>
          ))}
          {f.labels.length > 2 && (
            <span className="text-[10px] text-[#5E6C84]">+{f.labels.length - 2}</span>
          )}
        </div>
      ) : <span className="text-xs text-[#5E6C84] dark:text-gray-500">—</span>;

    case 'due': {
      if (!f.duedate) return <span className="text-xs text-[#5E6C84] dark:text-gray-400">—</span>;
      const over = isOverdue(f.duedate);
      return (
        <span className={cn('text-xs', over ? 'text-red-500 dark:text-red-400 font-medium' : 'text-[#5E6C84] dark:text-gray-400')}>
          {formatDate(f.duedate)}
        </span>
      );
    }

    case 'updated':
      return <span className="text-xs text-[#5E6C84] dark:text-gray-400">{formatDate(f.updated)}</span>;

    default:
      return null;
  }
}

// ── Inline edit cells ─────────────────────────────────────────────

function InlineStatusEdit({ issue, onDone, onCancel, onError }: {
  issue: JiraIssue; onDone: () => void; onCancel: () => void; onError?: () => void;
}) {
  const [transitions, setTransitions] = useState<JiraTransition[]>([]);
  const [loading, setLoading]         = useState(true);
  const [applying, setApplying]       = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get<{ transitions: JiraTransition[] }>(`/issue/${issue.key}/transitions`)
      .then(r => setTransitions(r.data.transitions ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [issue.key]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onCancel();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onCancel]);

  async function apply(t: JiraTransition) {
    setApplying(t.id);
    try {
      await api.post(`/issue/${issue.key}/transitions`, { transition: { id: t.id } });
      onDone();
    } catch {
      setApplying(null);
      onError?.();
    }
  }

  return (
    <div ref={ref} className="absolute left-0 top-full mt-0.5 bg-white dark:bg-gray-800 border border-[#DFE1E6] dark:border-gray-600 rounded shadow-lg z-30 min-w-[160px] py-1" onClick={e => e.stopPropagation()}>
      {loading ? (
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-[#5E6C84]"><Loader2 size={12} className="animate-spin" /> Loading…</div>
      ) : transitions.map(t => (
        <button
          key={t.id}
          onClick={() => apply(t)}
          disabled={applying !== null}
          className="w-full flex items-center gap-2 text-left text-xs px-3 py-2 hover:bg-[#F4F5F7] dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {applying === t.id ? <Loader2 size={12} className="animate-spin" /> : <ChevronDown size={11} className="text-[#5E6C84]" />}
          {t.name}
        </button>
      ))}
    </div>
  );
}

function InlinePriorityEdit({ issue, onDone, onCancel, onError }: {
  issue: JiraIssue; onDone: () => void; onCancel: () => void; onError?: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onCancel();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onCancel]);

  async function save(name: string) {
    setSaving(true);
    try {
      await api.put(`/issue/${issue.key}`, { fields: { priority: { name } } });
      onDone();
    } catch {
      setSaving(false);
      onError?.();
    }
  }

  return (
    <div ref={ref} className="absolute left-0 top-full mt-0.5 bg-white dark:bg-gray-800 border border-[#DFE1E6] dark:border-gray-600 rounded shadow-lg z-30 min-w-[130px] py-1" onClick={e => e.stopPropagation()}>
      {PRIORITY_NAMES.map(p => (
        <button
          key={p}
          onClick={() => save(p)}
          disabled={saving}
          className={cn(
            'w-full text-left text-xs px-3 py-2 hover:bg-[#F4F5F7] dark:hover:bg-gray-700 transition-colors disabled:opacity-50',
            issue.fields.priority?.name === p && 'font-semibold text-[#0052CC]',
          )}
        >
          {p}
        </button>
      ))}
    </div>
  );
}

function InlineDueDateEdit({ issue, onDone, onCancel, onError }: {
  issue: JiraIssue; onDone: () => void; onCancel: () => void; onError?: () => void;
}) {
  const [draft, setDraft] = useState(issue.fields.duedate ?? '');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await api.put(`/issue/${issue.key}`, { fields: { duedate: draft || null } });
      onDone();
    } catch {
      setSaving(false);
      onError?.();
    }
  }

  return (
    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
      <input
        autoFocus
        type="date"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onCancel(); }}
        disabled={saving}
        className="text-xs border border-[#0052CC] rounded px-1.5 py-1 bg-white dark:bg-gray-800 text-[#172B4D] dark:text-gray-100 focus:outline-none w-28"
      />
      <button onMouseDown={save} disabled={saving} className="p-1 rounded bg-[#0052CC] text-white hover:bg-[#0747A6] disabled:opacity-50">
        {saving ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
      </button>
      <button onMouseDown={onCancel} className="p-1 rounded border border-[#DFE1E6] text-[#5E6C84] hover:text-red-500">
        <X size={10} />
      </button>
    </div>
  );
}

// ── Inline Assignee Editor (EDIT mode) ──────────────────────────────

function InlineAssigneeEdit({ issue, onSave, onCancel }: {
  issue: JiraIssue; onSave: (username: string, displayName: string) => void; onCancel: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ name: string; displayName: string }>>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 1) { setResults([]); return; }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await api.get<Array<{ name: string; displayName: string }>>('/user/search', {
          params: { username: query, maxResults: 8 },
        });
        setResults(Array.isArray(r.data) ? r.data : []);
      } catch { setResults([]); }
      setLoading(false);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onCancel();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onCancel]);

  function select(name: string, displayName: string) {
    onSave(name, displayName);
  }

  return (
    <div ref={ref} className="absolute left-0 top-full mt-0.5 bg-white dark:bg-gray-800 border border-[#DFE1E6] dark:border-gray-600 rounded shadow-lg z-30 min-w-[200px] py-1" onClick={e => e.stopPropagation()}>
      <div className="px-2 pb-1">
        <input
          autoFocus
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search username…"
          className="w-full text-xs border border-[#DFE1E6] dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-800 text-[#172B4D] dark:text-gray-100 focus:outline-none focus:border-[#0052CC]"
        />
      </div>
      {loading ? (
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-[#5E6C84]"><Loader2 size={12} className="animate-spin" /> Searching…</div>
      ) : results.length === 0 ? (
        query.length > 0
          ? <div className="px-3 py-2 text-xs text-[#5E6C84] dark:text-gray-400">No users found</div>
          : <div className="px-3 py-2 text-xs text-[#5E6C84] dark:text-gray-400">Type to search</div>
      ) : (
        results.map(u => (
          <button
            key={u.name}
            onClick={() => select(u.name, u.displayName)}
            className="w-full text-left text-xs px-3 py-2 hover:bg-[#F4F5F7] dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
          >
            <span className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-full bg-[#0052CC] text-white text-[9px] font-bold flex-shrink-0">
              {u.displayName.charAt(0)}
            </span>
            <span className="text-[#172B4D] dark:text-gray-200">{u.displayName}</span>
            <span className="text-[10px] text-[#5E6C84] dark:text-gray-500 ml-auto">{u.name}</span>
          </button>
        ))
      )}
      <button
        onClick={onCancel}
        className="w-full text-left text-xs px-3 py-2 text-[#5E6C84] dark:text-gray-400 hover:bg-[#F4F5F7] dark:hover:bg-gray-700 border-t border-[#DFE1E6] dark:border-gray-700"
      >
        Cancel
      </button>
    </div>
  );
}

// ── Edit mode props interface ──────────────────────────────────────

interface RowEditProps {
  editMode: boolean;
  editingKey: string | null;
  edits: EditEntry[];
  startEdit: (key: string) => void;
  cancelEdit: () => void;
  addEdit: (entry: EditEntry) => void;
  hasEdit: (issueKey: string, field: string) => boolean;
  getEditClass: (issueKey: string, field: string) => string;
  addAssigneeEdit: (entry: AssigneeEdit) => void;
  hasAssigneeEdit: (issueKey: string) => boolean;
  /** Get new value for an assignee edit (for display in cell) */
  getAssigneeEditValue: (issueKey: string) => string | null;
}

// ── Helper: get new value for an edited field ──────────────────────

function editValue(edits: EditEntry[], issueKey: string, field: string): string {
  return edits.find(e => e.issueKey === issueKey && e.field === field)?.newValue ?? '';
}

function editDisplayValue(edits: EditEntry[], issueKey: string, field: string, original: string): string | null {
  const entry = edits.find(e => e.issueKey === issueKey && e.field === field);
  return entry ? entry.newValue : null;
}

// ─────────────────────────────────────────────────────────────────

function IssueTableRow({ issue, selected, onToggle, visibleCols, onOpenPanel, onInlineSaved, onInlineError, editProps, onOpenPencilV2, onOpenLogWork, issueDrafts }: {
  issue: JiraIssue; selected: boolean; onToggle: () => void;
  visibleCols: ColumnDef[];
  onOpenPanel: (key: string) => void;
  onInlineSaved: (msg: string) => void;
  onInlineError: (msg: string) => void;
  editProps?: RowEditProps;
  onOpenPencilV2?: (issueKey: string, issue: JiraIssue) => void;
  onOpenLogWork?: (issueKey: string, issue: JiraIssue) => void;
  issueDrafts?: Record<string, unknown>;
}) {
  const [inlineEdit, setInlineEdit] = useState<ColumnKey | null>(null);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const actionRef = useRef<HTMLDivElement>(null);
  const hasDraft = issueDrafts && Object.keys(issueDrafts).length > 0;

  // Map column keys to draft field names
  const DRAFT_FIELD_MAP: Record<string, string> = {
    summary: 'summary',
    status: 'status',
    priority: 'priority',
    assignee: 'assignee',
    due: 'duedate',
    est: 'originalEstimate',
  };

  useEffect(() => {
    if (!actionMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (actionRef.current && !actionRef.current.contains(e.target as Node)) {
        setActionMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [actionMenuOpen]);
  const ed = editProps;

  function handleCellClick(e: React.MouseEvent, col: ColumnDef) {
    if (ed) {
      // EDIT mode: only EDIT_MODE_EDITABLE columns are clickable
      if (!EDIT_MODE_EDITABLE.includes(col.key)) return;
      e.preventDefault();
      e.stopPropagation();
      ed.startEdit(`${issue.key}:${col.key}`);
    } else {
      // VIEW mode: only INLINE_EDITABLE columns are clickable (existing behavior)
      if (!INLINE_EDITABLE.includes(col.key)) return;
      e.preventDefault();
      e.stopPropagation();
      setInlineEdit(col.key);
    }
  }

  function handleInlineDone(field: string) {
    setInlineEdit(null);
    onInlineSaved(`${field} updated`);
  }
  function handleInlineCancel() { setInlineEdit(null); }
  function handleInlineError(field: string) {
    setInlineEdit(null);
    onInlineError(`Failed to update ${field}`);
  }

  function handleRowClick(e: React.MouseEvent) {
    if (inlineEdit) return;
    if (ed?.editingKey) return;
    if ((e.target as Element).closest('[data-no-panel]')) return;
    onOpenPanel(issue.key);
  }

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-2.5 border-b border-[#DFE1E6] dark:border-gray-700 last:border-b-0 hover:bg-[#F4F5F7] dark:hover:bg-gray-700/50 transition-colors cursor-pointer min-w-0',
        selected && 'bg-[#E6F0FF] dark:bg-blue-900/20',
        hasDraft && '!bg-[#F0FFF4] dark:!bg-green-950/20 !border-l-2 !border-l-[#36B37E]',
      )}
      onClick={handleRowClick}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        onClick={e => e.stopPropagation()}
        data-no-panel
        className="w-3.5 h-3.5 rounded border-[#DFE1E6] cursor-pointer accent-[#0052CC] flex-shrink-0"
        aria-label={`Select ${issue.key}`}
      />

      {editProps && onOpenPencilV2 && (
        <div className="relative flex-shrink-0 px-0.5" ref={actionRef} onClick={e => e.stopPropagation()}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setActionMenuOpen(v => !v); }}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[#F4F5F7] dark:hover:bg-gray-700 text-[#5E6C84] dark:text-gray-400 hover:text-[#172B4D] dark:hover:text-gray-200 transition-all"
            title="Actions"
          >
            <MoreVertical size={15} />
          </button>
          {actionMenuOpen && (
          <div className="absolute left-0 top-full mt-1.5 bg-white dark:bg-gray-800 border border-[#DFE1E6] dark:border-gray-700 rounded-xl shadow-xl z-30 min-w-[180px] overflow-hidden py-1">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setActionMenuOpen(false); onOpenPencilV2(issue.key, issue); }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-left hover:bg-[#F4F5F7] dark:hover:bg-gray-700 text-[#172B4D] dark:text-gray-200 transition-colors"
            >
              <span className="w-6 h-6 rounded-md bg-[#E6F0FF] dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                <Pencil size={12} className="text-[#0052CC]" />
              </span>
              <div className="flex flex-col">
                <span className="text-xs font-medium">Edit Issue</span>
                <span className="text-[10px] text-[#5E6C84] dark:text-gray-400">Modify fields of this issue</span>
              </div>
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setActionMenuOpen(false); onOpenLogWork?.(issue.key, issue); }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-left hover:bg-[#F4F5F7] dark:hover:bg-gray-700 text-[#172B4D] dark:text-gray-200 transition-colors"
            >
              <span className="w-6 h-6 rounded-md bg-[#E3FCEF] dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                <span className="text-[11px]">⏱</span>
              </span>
              <div className="flex flex-col">
                <span className="text-xs font-medium">Log Work</span>
                <span className="text-[10px] text-[#5E6C84] dark:text-gray-400">Add time spent on this issue</span>
              </div>
            </button>
          </div>
          )}
        </div>
      )}

      {visibleCols.map(col => {
        const isViewEditable = !ed && INLINE_EDITABLE.includes(col.key);
        const isEditingView = !ed && inlineEdit === col.key;
        const isEditModeEditable = ed && EDIT_MODE_EDITABLE.includes(col.key);
        const isEditingEditMode = ed && ed.editingKey === `${issue.key}:${col.key}`;

        return (
          <div
            key={col.key}
            className={cn(
              col.widthClass,
              col.key !== 'summary' && 'flex-shrink-0',
              col.key === 'summary' && 'min-w-0',
              col.align === 'right' && 'text-right',
              isViewEditable && !isEditingView && 'group/cell relative cursor-pointer',
              isEditingView && 'relative',
              isEditingEditMode && 'relative',
              isEditModeEditable && !isEditingEditMode && 'relative cursor-pointer',
              ed && col.key !== 'summary' && isEditModeEditable && 'hover:ring-1 hover:ring-[#0052CC]',
              ed && col.key === 'summary' && isEditModeEditable && 'hover:bg-blue-50 dark:hover:bg-blue-900/10',
              ed && ed.getEditClass(issue.key, colToField(col.key) ?? ''),
              ed && col.key === 'assignee' && ed.hasAssigneeEdit(issue.key) && 'bg-amber-50 dark:bg-amber-900/20 ring-1 ring-inset ring-amber-400',
            )}
            onClick={isEditModeEditable ? e => handleCellClick(e, col) : isViewEditable ? e => handleCellClick(e, col) : undefined}
            data-no-panel={isViewEditable || isEditModeEditable ? '' : undefined}
          >
            {isEditingEditMode ? (
              // ── EDIT mode inline editors ──
              <>
                {col.key === 'summary' && (
                  <InlineTextEditor
                    currentValue={issue.fields.summary}
                    onSave={(newVal) => ed!.addEdit({ issueKey: issue.key, field: 'summary', oldValue: issue.fields.summary, newValue: newVal })}
                    onCancel={ed!.cancelEdit}
                  />
                )}
                {col.key === 'status' && (
                  <StatusEditor
                    issueKey={issue.key}
                    currentStatus={issue.fields.status.name}
                    onSave={(newStatus, transitionId) =>
                      ed!.addEdit({ issueKey: issue.key, field: 'status', oldValue: issue.fields.status.name, newValue: newStatus, transitionId })
                    }
                    onCancel={ed!.cancelEdit}
                  />
                )}
                {col.key === 'due' && (
                  <DateEditor
                    currentValue={issue.fields.duedate ?? ''}
                    onSave={(newVal) => ed!.addEdit({ issueKey: issue.key, field: 'duedate', oldValue: issue.fields.duedate ?? '', newValue: newVal })}
                    onCancel={ed!.cancelEdit}
                  />
                )}
                {col.key === 'est' && (
                  <EstEditor
                    currentValue={issue.fields.timetracking?.originalEstimate ?? ''}
                    onSave={(newVal) => ed!.addEdit({ issueKey: issue.key, field: 'est', oldValue: issue.fields.timetracking?.originalEstimate ?? '', newValue: newVal })}
                    onCancel={ed!.cancelEdit}
                  />
                )}
                {col.key === 'assignee' && (
                  <InlineAssigneeEdit
                    issue={issue}
                    onSave={(username, displayName) => ed!.addAssigneeEdit({
                      issueKey: issue.key,
                      oldValue: issue.fields.assignee?.name ?? '',
                      newValue: username,
                      newDisplayName: displayName,
                    })}
                    onCancel={ed!.cancelEdit}
                  />
                )}
              </>
            ) : isEditingView ? (
              // ── VIEW mode inline editors (existing) ──
              <>
                {col.key === 'status'   && <InlineStatusEdit   issue={issue} onDone={() => handleInlineDone('Status')}   onCancel={handleInlineCancel} onError={() => handleInlineError('status')} />}
                {col.key === 'priority' && <InlinePriorityEdit issue={issue} onDone={() => handleInlineDone('Priority')} onCancel={handleInlineCancel} onError={() => handleInlineError('priority')} />}
                {col.key === 'due'      && <InlineDueDateEdit  issue={issue} onDone={() => handleInlineDone('Due date')} onCancel={handleInlineCancel} onError={() => handleInlineError('due date')} />}
              </>
            ) : (
              <div className={cn(
                'flex items-center min-w-0',
                isViewEditable && 'group-hover/cell:opacity-80 transition-opacity',
              )}>
                {/* Show edited value for EDIT mode cells with pending edits */}
                {ed && col.key === 'summary' && ed.hasEdit(issue.key, 'summary') ? (
                  <span className="text-sm text-[#B45309] dark:text-amber-400 truncate">{editValue(ed.edits, issue.key, 'summary')}</span>
                ) : ed && col.key === 'status' && ed.hasEdit(issue.key, 'status') ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-amber-100 dark:bg-amber-900/30 text-[#B45309] dark:text-amber-400">{editValue(ed.edits, issue.key, 'status')}</span>
                ) : ed && col.key === 'due' && ed.hasEdit(issue.key, 'duedate') ? (
                  <span className="text-xs text-[#B45309] dark:text-amber-400 font-medium">{editValue(ed.edits, issue.key, 'duedate')}</span>
                ) : ed && col.key === 'est' && ed.hasEdit(issue.key, 'est') ? (
                  <span className="text-xs text-[#B45309] dark:text-amber-400 font-medium">{editValue(ed.edits, issue.key, 'est') || '—'}</span>
                ) : ed && col.key === 'assignee' && ed.hasAssigneeEdit(issue.key) ? (
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-full bg-[#0052CC] text-white text-[9px] font-bold flex-shrink-0">
                      {(ed.getAssigneeEditValue(issue.key) ?? '').charAt(0)}
                    </span>
                    <span className="text-xs text-[#B45309] dark:text-amber-400 truncate">{ed.getAssigneeEditValue(issue.key)}</span>
                  </div>
                ) : (
                  <div className={cn(
                    'flex items-center min-w-0',
                    issueDrafts && DRAFT_FIELD_MAP[col.key] && issueDrafts[DRAFT_FIELD_MAP[col.key]] !== undefined && 'rounded px-0.5 bg-[#E3FCEF] dark:bg-green-900/30 text-[#1B7C44] dark:text-green-300 font-medium',
                  )}>
                    <CellContent col={col} issue={issue} hasDraft={hasDraft} />
                  </div>
                )}
                {isViewEditable && col.key !== 'status' && (
                  <span className="ml-1 flex-shrink-0 opacity-0 group-hover/cell:opacity-60 transition-opacity">
                    <ChevronDown size={9} className="text-[#5E6C84]" />
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────

interface IssuesTableProps {
  issues: JiraIssue[];
  total: number;
  isLoading: boolean;
  sortField: string;
  sortDir: 'ASC' | 'DESC';
  onSortChange: (field: string, dir: 'ASC' | 'DESC') => void;
  onIssueUpdate?: () => void;
  groupBy?: string;
  subGroupBy?: string;
  subSubGroupBy?: string;
  toolBarEditMode?: boolean;
  onToolBarEditMode?: (edit: boolean) => void;
  hideInternalToolbar?: boolean;
  /** Callback to expose the exportXlsx function for ToolBar usage */
  onExportReady?: (wrapper: () => void) => void;
  epicSummaries?: Record<string, string>;
  drafts?: Record<string, Record<string, unknown>>;
  onBulkDraft?: (issueKeys: string[], fields: Record<string, unknown>) => void;
  onOpenPencilV2?: (issueKey: string, issue: JiraIssue) => void;
  onOpenLogWork?: (issueKey: string, issue: JiraIssue) => void;
}

// ─── Group header helpers ──────────────────────────────────────────

/** Return border-left color for a group-header based on groupBy value */
function getGroupBorderColor(groupBy: GroupBy, issue?: JiraIssue): string {
  if (!issue) return '#0052CC';
  const f = issue.fields;
  switch (groupBy) {
    case 'status': {
      const cat = f.status.statusCategory.key;
      return cat === 'new' ? '#DFE1E6' : cat === 'indeterminate' ? '#0052CC' : '#006644';
    }
    case 'type': {
      const colors: Record<string, string> = {
        Bug: '#EF4444', Task: '#3B82F6', Story: '#22C55E',
        Epic: '#A855F7', 'Sub-task': '#38BDF8',
      };
      return colors[f.issuetype.name] ?? '#6B7280';
    }
    case 'priority': {
      const colors: Record<string, string> = {
        Highest: '#DE350B', High: '#FF5630', Medium: '#FFAB00',
        Low: '#2684FF', Lowest: '#2684FF', Blocker: '#DE350B', Minor: '#6B778C',
      };
      return f.priority ? (colors[f.priority.name] ?? '#DFE1E6') : '#DFE1E6';
    }
    case 'statusCategory': {
      const cat = f.status.statusCategory.key;
      return cat === 'new' ? '#DFE1E6' : cat === 'indeterminate' ? '#0052CC' : '#006644';
    }
    default:
      return '#0052CC';
  }
}

/** Render content inside a group-header button */
function GroupHeaderContent({ groupBy, group, firstIssue }: {
  groupBy: GroupBy;
  group: { key: string; label: string; issues: JiraIssue[] };
  firstIssue?: JiraIssue;
}) {
  if (!firstIssue) {
    return <span className="text-sm font-bold text-[#172B4D] dark:text-gray-100 tracking-tight">{group.label}</span>;
  }
  const f = firstIssue.fields;

  switch (groupBy) {
    case 'type':
      return (
        <div className="flex items-center gap-2 min-w-0">
          {f.issuetype.iconUrl
            ? <Image src={f.issuetype.iconUrl} alt={f.issuetype.name} width={16} height={16} className="flex-shrink-0" unoptimized />
            : <IssueTypeFallback name={f.issuetype.name} />}
          <span className="text-sm font-bold text-[#172B4D] dark:text-gray-100 tracking-tight truncate">{group.label}</span>
        </div>
      );

    case 'assignee':
    case 'reporter': {
      const user = groupBy === 'assignee' ? f.assignee : f.reporter;
      return (
        <div className="flex items-center gap-2 min-w-0">
          {user
            ? <UserAvatar user={user} />
            : <span className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-full bg-[#DFE1E6] dark:bg-gray-600 flex-shrink-0"><User size={11} className="text-[#5E6C84]" /></span>}
          <span className="text-sm font-bold text-[#172B4D] dark:text-gray-100 tracking-tight truncate">{group.label}</span>
        </div>
      );
    }

    case 'status':
    case 'statusCategory': {
      const catColors: Record<string, string> = {
        new: 'bg-[#DFE1E6] text-[#42526E]',
        indeterminate: 'bg-[#DEEBFF] text-[#0052CC]',
        done: 'bg-[#E3FCEF] text-[#006644]',
      };
      const catKey = groupBy === 'status' ? f.status.statusCategory.key : f.status.statusCategory.key;
      return (
        <span className={cn(
          'inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-semibold uppercase tracking-wide',
          catColors[catKey] ?? catColors['new'],
        )}>
          {group.label}
        </span>
      );
    }

    case 'priority':
      return (
        <div className="flex items-center gap-2 min-w-0">
          <PriorityIcon priority={f.priority} />
          <span className="text-sm font-bold text-[#172B4D] dark:text-gray-100 tracking-tight truncate">{group.label}</span>
        </div>
      );

    default:
      return <span className="text-sm font-bold text-[#172B4D] dark:text-gray-100 tracking-tight truncate">{group.label}</span>;
  }
}

/** Render content inside a sub-group-header button (smaller, indented) */
function SubGroupHeaderContent({ subGroupBy, sub, firstIssue }: {
  subGroupBy: SubGroupBy;
  sub: { key: string; label: string; issues: JiraIssue[] };
  firstIssue?: JiraIssue;
}) {
  if (!firstIssue) {
    return <span className="text-xs font-semibold text-[#172B4D] dark:text-gray-100">{sub.label}</span>;
  }
  const f = firstIssue.fields;

  switch (subGroupBy) {
    case 'type':
      return (
        <div className="flex items-center gap-1.5 min-w-0">
          {f.issuetype.iconUrl
            ? <Image src={f.issuetype.iconUrl} alt={f.issuetype.name} width={13} height={13} className="flex-shrink-0" unoptimized />
            : <IssueTypeFallback name={f.issuetype.name} />}
          <span className="text-xs font-semibold text-[#172B4D] dark:text-gray-100 truncate">{sub.label}</span>
        </div>
      );

    case 'assignee':
    case 'reporter': {
      const user = subGroupBy === 'assignee' ? f.assignee : f.reporter;
      return (
        <div className="flex items-center gap-1.5 min-w-0">
          {user
            ? <UserAvatar user={user} />
            : <span className="inline-flex items-center justify-center w-[16px] h-[16px] rounded-full bg-[#DFE1E6] dark:bg-gray-600 flex-shrink-0"><User size={9} className="text-[#5E6C84]" /></span>}
          <span className="text-xs font-semibold text-[#172B4D] dark:text-gray-100 truncate">{sub.label}</span>
        </div>
      );
    }

    case 'status':
    case 'statusCategory': {
      const catColors: Record<string, string> = {
        new: 'bg-[#DFE1E6] text-[#42526E]',
        indeterminate: 'bg-[#DEEBFF] text-[#0052CC]',
        done: 'bg-[#E3FCEF] text-[#006644]',
      };
      const catKey = firstIssue.fields.status.statusCategory.key;
      return (
        <span className={cn(
          'inline-flex items-center px-1.5 py-0.5 rounded-sm text-[11px] font-semibold uppercase tracking-wide',
          catColors[catKey] ?? catColors['new'],
        )}>
          {sub.label}
        </span>
      );
    }

    case 'priority':
      return (
        <div className="flex items-center gap-1.5 min-w-0">
          <PriorityIcon priority={f.priority} />
          <span className="text-xs font-semibold text-[#172B4D] dark:text-gray-100 truncate">{sub.label}</span>
        </div>
      );

    default:
      return <span className="text-xs font-semibold text-[#172B4D] dark:text-gray-100 truncate">{sub.label}</span>;
  }
}

/** Render content inside a sub-sub-group-header button (smallest, most indented) */
function SubSubGroupHeaderContent({ subSubGroupBy, subSub, firstIssue }: {
  subSubGroupBy: SubSubGroupBy;
  subSub: { key: string; label: string; issues: JiraIssue[] };
  firstIssue?: JiraIssue;
}) {
  if (!firstIssue) {
    return <span className="text-[10px] font-medium text-[#172B4D] dark:text-gray-100">{subSub.label}</span>;
  }
  const f = firstIssue.fields;

  switch (subSubGroupBy) {
    case 'type':
      return (
        <div className="flex items-center gap-1 min-w-0">
          {f.issuetype.iconUrl
            ? <Image src={f.issuetype.iconUrl} alt={f.issuetype.name} width={11} height={11} className="flex-shrink-0" unoptimized />
            : <IssueTypeFallback name={f.issuetype.name} />}
          <span className="text-[10px] font-medium text-[#172B4D] dark:text-gray-100 truncate">{subSub.label}</span>
        </div>
      );

    case 'assignee':
    case 'reporter': {
      const user = subSubGroupBy === 'assignee' ? f.assignee : f.reporter;
      return (
        <div className="flex items-center gap-1 min-w-0">
          {user
            ? <UserAvatar user={user} />
            : <span className="inline-flex items-center justify-center w-[14px] h-[14px] rounded-full bg-[#DFE1E6] dark:bg-gray-600 flex-shrink-0"><User size={8} className="text-[#5E6C84]" /></span>}
          <span className="text-[10px] font-medium text-[#172B4D] dark:text-gray-100 truncate">{subSub.label}</span>
        </div>
      );
    }

    case 'status': {
      const catColors: Record<string, string> = {
        new: 'bg-[#DFE1E6] text-[#42526E]',
        indeterminate: 'bg-[#DEEBFF] text-[#0052CC]',
        done: 'bg-[#E3FCEF] text-[#006644]',
      };
      const catKey = firstIssue.fields.status.statusCategory.key;
      return (
        <span className={cn(
          'inline-flex items-center px-1 py-0.5 rounded-sm text-[9px] font-semibold uppercase tracking-wide',
          catColors[catKey] ?? catColors['new'],
        )}>
          {subSub.label}
        </span>
      );
    }

    case 'priority':
      return (
        <div className="flex items-center gap-1 min-w-0">
          <PriorityIcon priority={f.priority} />
          <span className="text-[10px] font-medium text-[#172B4D] dark:text-gray-100 truncate">{subSub.label}</span>
        </div>
      );

    default:
      return <span className="text-[10px] font-medium text-[#172B4D] dark:text-gray-100 truncate">{subSub.label}</span>;
  }
}

export function IssuesTable({ issues, total, isLoading, sortField, sortDir, onSortChange, onIssueUpdate, groupBy, subGroupBy, subSubGroupBy, toolBarEditMode, onToolBarEditMode, hideInternalToolbar, onExportReady, epicSummaries, drafts, onOpenPencilV2, onOpenLogWork, onBulkDraft }: IssuesTableProps) {
  const [selected, setSelected]                 = useState<Set<string>>(new Set());
  const [transitioning, setTransitioning]       = useState(false);
  const [transitionDropOpen, setTransDropOpen]  = useState(false);
  const [commonTransitions, setCommonTrans]     = useState<JiraTransition[]>([]);
  const [transitionsLoading, setTransLoading]   = useState(false);
  const [collapsedGroups, setCollapsedGroups]   = useState<Set<string>>(new Set());
  const [visibleColumns, setVisibleColumns]     = useState<Set<ColumnKey>>(DEFAULT_VISIBLE);
  const [columnOrder, setColumnOrder]           = useState<ColumnKey[]>(DEFAULT_ORDER);
  const [internalGroupBy, setInternalGroupBy]                   = useState<GroupBy>('none');
  const [internalSubGroupBy, setInternalSubGroupBy]             = useState<SubGroupBy>('none');
  const [internalSubSubGroupBy, setInternalSubSubGroupBy]       = useState<SubSubGroupBy>('none');

  // Use external props if provided, else internal state
  const effectiveGroupBy = (groupBy ?? internalGroupBy) as GroupBy;
  const effectiveSubGroupBy = (subGroupBy ?? internalSubGroupBy) as SubGroupBy;
  const effectiveSubSubGroupBy = (subSubGroupBy ?? internalSubSubGroupBy) as SubSubGroupBy;
  const [showColumnPicker, setShowColPicker]    = useState(false);
  const [dragOverKey, setDragOverKey]           = useState<ColumnKey | null>(null);
  const dragSrcRef                              = useRef<ColumnKey | null>(null);
  // Panel
  const [panelKey, setPanelKey]                 = useState<string | null>(null);
  // Bulk extras
  const [bulkAssignOpen, setBulkAssignOpen]     = useState(false);
  const [bulkPriorityOpen, setBulkPriorityOpen] = useState(false);
  const [bulkDueOpen, setBulkDueOpen]           = useState(false);
  const [bulkAssignQuery, setBulkAssignQuery]   = useState('');
  const [bulkPriority, setBulkPriority]         = useState('');
  const [bulkDue, setBulkDue]                   = useState('');
  const [bulkApplying, setBulkApplying]         = useState(false);
  const bulkAssignRef  = useRef<HTMLDivElement>(null);
  const bulkPriorityRef = useRef<HTMLDivElement>(null);
  const bulkDueRef     = useRef<HTMLDivElement>(null);
  const colPickerRef   = useRef<HTMLDivElement>(null);
  // Toast
  const [toast, setToastState]                  = useState<ToastInfo | null>(null);
  const toastTimerRef                           = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToastState({ msg, type });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastState(null), 3000);
  }

  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);

  // ── Inline Edit State (batch edit system) ──────────────────────
  const [editMode, setEditMode] = useState(false);
  useEffect(() => { if (toolBarEditMode !== undefined) setEditMode(toolBarEditMode); }, [toolBarEditMode]);
  function handleEditModeToggle(next: boolean) { setEditMode(next); onToolBarEditMode?.(next); }
  const [edits, setEdits] = useState<EditEntry[]>([]);
  const [editingKey, setEditingKey] = useState<string | null>(null); // "ISSUE-KEY:columnKey"
  const [showConfirm, setShowConfirm] = useState(false);
  const [assigneeEdits, setAssigneeEdits] = useState<AssigneeEdit[]>([]);

  /** Check if a cell has a pending edit (by EditEntry field) */
  function hasEdit(issueKey: string, field: string) {
    return edits.some(e => e.issueKey === issueKey && e.field === field);
  }

  /** Get amber highlight class for an edited cell */
  function getEditClass(issueKey: string, field: string) {
    return hasEdit(issueKey, field)
      ? 'bg-amber-50 dark:bg-amber-900/20 ring-1 ring-inset ring-amber-400'
      : '';
  }

  /** Add or update an edit entry */
  function addEdit(entry: EditEntry) {
    setEdits(prev => {
      const filtered = prev.filter(
        e => !(e.issueKey === entry.issueKey && e.field === entry.field),
      );
      return [...filtered, entry];
    });
    setEditingKey(null);
  }

  /** Add/replace an assignee edit */
  function addAssigneeEdit(entry: AssigneeEdit) {
    setAssigneeEdits(prev => {
      const filtered = prev.filter(e => e.issueKey !== entry.issueKey);
      return [...filtered, entry];
    });
    setEditingKey(null);
  }

  /** Start editing a cell */
  function startEdit(key: string) {
    setEditingKey(key);
  }

  /** Cancel current inline edit */
  function cancelEdit() {
    setEditingKey(null);
  }

  /** Save all assignee edits via API */
  async function saveAssigneeEdits(): Promise<number> {
    let errors = 0;
    for (const ae of assigneeEdits) {
      try {
        await api.put(`/issue/${ae.issueKey}`, {
          fields: { assignee: ae.newValue ? { name: ae.newValue } : null },
        });
      } catch {
        errors++;
      }
    }
    return errors;
  }

  /** Called after all saves complete — clear edits and refresh */
  function handleSaved() {
    setEdits([]);
    setAssigneeEdits([]);
    setEditMode(false);
    setShowConfirm(false);
    onIssueUpdate?.();
    window.dispatchEvent(new CustomEvent('issues-bulk-transitioned'));
  }

  function handleOpenSave() {
    if (assigneeEdits.length > 0 && edits.length === 0) {
      // Only assignee edits — save directly
      saveAssigneeEdits().then((errCount) => {
        if (errCount === 0) showToast(`Updated ${assigneeEdits.length} assignee(s)`);
        else showToast(`${errCount} assignee update(s) failed`, 'error');
        handleSaved();
      });
    } else if (edits.length > 0) {
      // Save assignee edits first, then show confirm modal for remaining
      if (assigneeEdits.length > 0) {
        saveAssigneeEdits().then((errCount) => {
          if (errCount > 0) showToast(`${errCount} assignee update(s) failed`, 'error');
        });
      }
      setShowConfirm(true);
    }
  }

  // Close column picker on outside click
  useEffect(() => {
    if (!showColumnPicker) return;
    function onMouseDown(e: MouseEvent) {
      if (colPickerRef.current && !colPickerRef.current.contains(e.target as Node)) {
        setShowColPicker(false);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [showColumnPicker]);

  // Close bulk dropdowns on outside click
  useEffect(() => {
    if (!bulkAssignOpen && !bulkPriorityOpen && !bulkDueOpen) return;
    function handler(e: MouseEvent) {
      if (bulkAssignOpen   && bulkAssignRef.current   && !bulkAssignRef.current.contains(e.target as Node))   setBulkAssignOpen(false);
      if (bulkPriorityOpen && bulkPriorityRef.current && !bulkPriorityRef.current.contains(e.target as Node)) setBulkPriorityOpen(false);
      if (bulkDueOpen      && bulkDueRef.current      && !bulkDueRef.current.contains(e.target as Node))      setBulkDueOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [bulkAssignOpen, bulkPriorityOpen, bulkDueOpen]);

  // Bulk apply fields
  async function applyBulkField(fields: Record<string, unknown>, _successMsg: string) {
    const selectedIssues = issues.filter(i => selected.has(i.id));
    if (selectedIssues.length === 0) return;
    if (onBulkDraft) {
      // Convert API fields to draft format
      const draftFields: Record<string, unknown> = {};
      if ('assignee' in fields) {
        const a = fields.assignee as { name?: string } | null;
        draftFields.assignee = a?.name ? { name: a.name, displayName: a.name } : null;
      }
      if ('priority' in fields) {
        const p = fields.priority as { name?: string };
        draftFields.priority = { name: p.name ?? '', id: '' };
      }
      if ('duedate' in fields) {
        draftFields.duedate = (fields.duedate as string) || undefined;
      }
      onBulkDraft(selectedIssues.map(i => i.key), draftFields);
    } else {
      // Fallback: direct submit
      setBulkApplying(true);
      let errors = 0;
      for (const issue of selectedIssues) {
        try { await api.put(`/issue/${issue.key}`, { fields }); }
        catch { errors++; }
      }
      if (errors === 0) showToast(_successMsg);
      else showToast(`${errors} error(s)`, 'error');
      setBulkApplying(false);
    }
    setBulkAssignOpen(false);
    setBulkPriorityOpen(false);
    setBulkDueOpen(false);
    setBulkAssignQuery('');
    setBulkPriority('');
    setBulkDue('');
  }

  const visibleCols = useMemo(
    () => columnOrder
      .map(k => COLUMNS.find(c => c.key === k))
      .filter((c): c is ColumnDef => c !== undefined && (visibleColumns.has(c.key) || c.key === 'summary')),
    [visibleColumns, columnOrder],
  );

  const groups = useMemo(() => groupIssues(issues, effectiveGroupBy, epicSummaries), [issues, effectiveGroupBy, epicSummaries]);

  const rowEditProps = useMemo((): RowEditProps | undefined => {
    if (!editMode) return undefined;
    return {
      editMode,
      editingKey,
      edits,
      startEdit,
      cancelEdit,
      addEdit,
      hasEdit,
      getEditClass,
      addAssigneeEdit,
      hasAssigneeEdit: (key: string) => assigneeEdits.some(e => e.issueKey === key),
      getAssigneeEditValue: (key: string) => {
        const ae = assigneeEdits.find(e => e.issueKey === key);
        return ae ? ae.newDisplayName : null;
      },
    };
  }, [editMode, editingKey, edits, assigneeEdits, startEdit, cancelEdit, addEdit, hasEdit, getEditClass, addAssigneeEdit]);

  const allSelected = issues.length > 0 && issues.every(i => selected.has(i.id));

  function toggleSelectAll() {
    setSelected(prev => {
      const next = new Set(prev);
      if (allSelected) issues.forEach(i => next.delete(i.id));
      else issues.forEach(i => next.add(i.id));
      return next;
    });
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleGroupByChange(g: GroupBy) {
    setInternalGroupBy(g);
    setInternalSubGroupBy('none');    // always reset sub-group when primary group changes
    setInternalSubSubGroupBy('none'); // always reset sub-sub-group when primary group changes
  }

  function toggleGroup(key: string) {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function toggleColumn(key: ColumnKey) {
    setVisibleColumns(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  // ── Column drag-and-drop reorder ──
  function onColDragStart(key: ColumnKey) { dragSrcRef.current = key; }
  function onColDragOver(e: React.DragEvent, key: ColumnKey) {
    e.preventDefault();
    if (dragSrcRef.current && dragSrcRef.current !== key) setDragOverKey(key);
  }
  function onColDrop(targetKey: ColumnKey) {
    const src = dragSrcRef.current;
    if (!src || src === targetKey) { setDragOverKey(null); return; }
    setColumnOrder(prev => {
      const next = [...prev];
      const si = next.indexOf(src);
      const ti = next.indexOf(targetKey);
      next.splice(si, 1);
      next.splice(ti, 0, src);
      return next;
    });
    dragSrcRef.current = null;
    setDragOverKey(null);
  }
  function onColDragEnd() { dragSrcRef.current = null; setDragOverKey(null); }

  const selectedCount  = selected.size;
  const selectedIssues = useMemo(
    () => issues.filter(i => selected.has(i.id)),
    [issues, selected],
  );
  const firstSelectedKey = selectedIssues[0]?.key ?? null;

  const loadTransitions = useCallback(async () => {
    if (!firstSelectedKey) return;
    setTransLoading(true);
    setCommonTrans([]);
    try {
      const res = await api.get<{ transitions: JiraTransition[] }>(`/issue/${firstSelectedKey}/transitions`);
      setCommonTrans(res.data.transitions ?? []);
    } catch { setCommonTrans([]); }
    finally { setTransLoading(false); }
  }, [firstSelectedKey]);

  useEffect(() => {
    if (firstSelectedKey) loadTransitions();
    else { setCommonTrans([]); setTransLoading(false); }
  }, [firstSelectedKey, loadTransitions]);

  async function applyTransition(t: JiraTransition) {
    if (transitioning) return;
    setTransDropOpen(false);
    setTransitioning(true);
    let errors = 0;
    for (const issue of selectedIssues) {
      try { await api.post(`/issue/${issue.key}/transitions`, { transition: { id: t.id } }); }
      catch { errors++; }
    }
    setTransitioning(false);
    setSelected(new Set());
    window.dispatchEvent(new CustomEvent('issues-bulk-transitioned'));
    if (errors === 0) showToast(`Status → ${t.to?.name ?? t.name} applied to ${selectedIssues.length} issue(s)`);
    else showToast(`${errors} issue(s) failed to transition`, 'error');
  }

  async function exportXlsx() {
    const XLSX = await import('xlsx');
    const headers = visibleCols.map(c => c.label);
    const rows: string[][] = [headers];

    for (const group of groups) {
      if (effectiveGroupBy !== 'none' && group.label) {
        rows.push([group.label, ...Array<string>(headers.length - 1).fill('')]);
      }
      for (const issue of group.issues) {
        rows.push(visibleCols.map(c => getCellText(c.key, issue)));
      }
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Issues');
    XLSX.writeFile(wb, `issues-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  useEffect(() => { onExportReady?.(() => exportXlsx()); }, [onExportReady, visibleColumns]);

  if (isLoading) {
    return (
      <div className="space-y-3 mt-4">
        <Spinner size="md" className="py-4" />
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }

  return (
    <div>
      {/* ── Toolbar ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-3 gap-4 flex-wrap">
        {/* Group by + Sub group by (hidden when external props provided) */}
        {!groupBy && !subGroupBy && !subSubGroupBy && (
        <div className="flex flex-col gap-2 p-2.5 bg-[#F4F5F7] dark:bg-gray-700/40 rounded-md border border-[#DFE1E6] dark:border-gray-600">
          {/* Group by row */}
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-semibold text-[#0052CC] dark:text-blue-400 uppercase tracking-wide whitespace-nowrap w-[72px] select-none">
              Group by
            </span>
            <div className="flex rounded border border-[#DFE1E6] dark:border-gray-600 overflow-hidden shadow-sm">
              {(Object.keys(GROUP_BY_LABELS) as GroupBy[]).map(g => (
                <button
                  key={g}
                  onClick={() => handleGroupByChange(g)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-semibold transition-all border-r border-[#DFE1E6] dark:border-gray-600 last:border-r-0 whitespace-nowrap',
                    effectiveGroupBy === g
                      ? 'bg-[#0052CC] text-white shadow-inner'
                      : 'bg-white dark:bg-gray-800 text-[#42526E] dark:text-gray-400 hover:bg-[#DEEBFF] dark:hover:bg-gray-700 hover:text-[#0052CC] dark:hover:text-blue-400',
                  )}
                >
                  {GROUP_BY_LABELS[g]}
                </button>
              ))}
            </div>
            {effectiveGroupBy !== 'none' && (
              <span className="text-[10px] font-medium text-[#0052CC] dark:text-blue-400 bg-[#DEEBFF] dark:bg-blue-900/30 px-1.5 py-0.5 rounded select-none">
                {GROUP_BY_LABELS[effectiveGroupBy]}
              </span>
            )}
          </div>

          {/* Sub group by — only shown when Group By ≠ none */}
          {effectiveGroupBy !== 'none' && (
            <>
              {/* Separator */}
              <div className="border-t border-[#DFE1E6] dark:border-gray-600" />

              <div className="flex items-center gap-3">
                <span className="text-[11px] font-semibold text-[#6554C0] dark:text-purple-400 uppercase tracking-wide whitespace-nowrap w-[72px] select-none">
                  Sub group
                </span>
                <div className="flex rounded border border-[#DFE1E6] dark:border-gray-600 overflow-hidden shadow-sm">
                  {getSubGroupOptions(effectiveGroupBy).map(s => (
                    <button
                      key={s}
                      onClick={() => setInternalSubGroupBy(s)}
                      className={cn(
                        'px-3 py-1.5 text-xs font-semibold transition-all border-r border-[#DFE1E6] dark:border-gray-600 last:border-r-0 whitespace-nowrap',
                        effectiveSubGroupBy === s
                          ? 'bg-[#6554C0] text-white shadow-inner'
                          : 'bg-white dark:bg-gray-800 text-[#42526E] dark:text-gray-400 hover:bg-[#EAE6FF] dark:hover:bg-purple-900/30 hover:text-[#6554C0] dark:hover:text-purple-400',
                      )}
                    >
                      {SUB_GROUP_BY_LABELS[s]}
                    </button>
                  ))}
                </div>
                {effectiveSubGroupBy !== 'none' && (
                  <span className="text-[10px] font-medium text-[#6554C0] dark:text-purple-400 bg-[#EAE6FF] dark:bg-purple-900/30 px-1.5 py-0.5 rounded select-none">
                    {SUB_GROUP_BY_LABELS[effectiveSubGroupBy]}
                  </span>
                )}
              </div>
            </>
          )}

          {/* Sub sub group by — only shown when Sub Group By ≠ none */}
          {effectiveSubGroupBy !== 'none' && (
            <>
              {/* Separator */}
              <div className="border-t border-[#DFE1E6] dark:border-gray-600" />

              <div className="flex items-center gap-3">
                <span className="text-[11px] font-semibold text-[#998DD9] dark:text-purple-300 uppercase tracking-wide whitespace-nowrap w-[72px] select-none">
                  Sub sub
                </span>
                <div className="flex rounded border border-[#DFE1E6] dark:border-gray-600 overflow-hidden shadow-sm">
                  {getSubSubGroupOptions(effectiveGroupBy, effectiveSubGroupBy).map(s => (
                    <button
                      key={s}
                      onClick={() => setInternalSubSubGroupBy(s)}
                      className={cn(
                        'px-3 py-1.5 text-xs font-semibold transition-all border-r border-[#DFE1E6] dark:border-gray-600 last:border-r-0 whitespace-nowrap',
                        effectiveSubSubGroupBy === s
                          ? 'bg-[#998DD9] text-white shadow-inner'
                          : 'bg-white dark:bg-gray-800 text-[#42526E] dark:text-gray-400 hover:bg-[#F3F0FF] dark:hover:bg-purple-900/20 hover:text-[#998DD9] dark:hover:text-purple-300',
                      )}
                    >
                      {SUB_SUB_GROUP_BY_LABELS[s]}
                    </button>
                  ))}
                </div>
                {effectiveSubSubGroupBy !== 'none' && (
                  <span className="text-[10px] font-medium text-[#998DD9] dark:text-purple-300 bg-[#F3F0FF] dark:bg-purple-900/20 px-1.5 py-0.5 rounded select-none">
                    {SUB_SUB_GROUP_BY_LABELS[effectiveSubSubGroupBy]}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
        )}

        {!hideInternalToolbar && (
        <div className="flex items-center gap-2">
          {/* VIEW / EDIT toggle */}
          <div className="flex items-center rounded border border-[#DFE1E6] dark:border-gray-600 overflow-hidden">
            <button
              onClick={() => { handleEditModeToggle(false); setEditingKey(null); }}
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
              onClick={() => handleEditModeToggle(true)}
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
          {editMode && (edits.length + assigneeEdits.length) > 0 && (
            <button
              onClick={handleOpenSave}
              className="text-xs px-2 py-1 rounded border transition-colors flex items-center gap-1 bg-[#36B37E] text-white border-[#36B37E] hover:bg-green-600"
            >
              <Save size={12} />
              Save ({edits.length + assigneeEdits.length})
            </button>
          )}

          {/* Column picker */}
          <div className="relative" ref={colPickerRef}>
            <button
              onClick={() => setShowColPicker(p => !p)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-white dark:bg-gray-800 border border-[#DFE1E6] dark:border-gray-600 rounded text-[#172B4D] dark:text-gray-200 hover:border-[#0052CC] transition-colors"
            >
              <Columns size={13} />
              Columns
            </button>
            {showColumnPicker && (
              <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-[#DFE1E6] dark:border-gray-700 rounded shadow-lg z-30 w-52">
                <div className="flex items-center justify-between px-3 py-2 border-b border-[#DFE1E6] dark:border-gray-700">
                  <span className="text-xs font-semibold text-[#172B4D] dark:text-gray-100">Columns</span>
                  <span className="text-[10px] text-[#5E6C84] dark:text-gray-500">drag to reorder</span>
                </div>
                {columnOrder.map(key => {
                  const col = COLUMNS.find(c => c.key === key);
                  if (!col) return null;
                  const isOver = dragOverKey === key;
                  return (
                    <div
                      key={col.key}
                      draggable
                      onDragStart={() => onColDragStart(col.key)}
                      onDragOver={e => onColDragOver(e, col.key)}
                      onDrop={() => onColDrop(col.key)}
                      onDragEnd={onColDragEnd}
                      className={cn(
                        'flex items-center gap-2 px-2 py-2 transition-colors select-none',
                        isOver
                          ? 'bg-[#E6F0FF] dark:bg-blue-900/30 border-t-2 border-[#0052CC]'
                          : 'hover:bg-[#F4F5F7] dark:hover:bg-gray-700',
                      )}
                    >
                      <span className="text-[#C1C7D0] dark:text-gray-600 cursor-grab active:cursor-grabbing flex-shrink-0">
                        <GripVertical size={13} />
                      </span>
                      <button
                        onClick={() => toggleColumn(col.key)}
                        className="flex items-center gap-2 flex-1 min-w-0 text-left"
                      >
                        <div className={cn(
                          'w-4 h-4 rounded border flex items-center justify-center flex-shrink-0',
                          visibleColumns.has(col.key)
                            ? 'bg-[#0052CC] border-[#0052CC]'
                            : 'border-[#DFE1E6] dark:border-gray-500',
                        )}>
                          {visibleColumns.has(col.key) && <Check size={10} className="text-white" />}
                        </div>
                        <span className="text-xs text-[#172B4D] dark:text-gray-200 truncate">
                          {col.label}
                        </span>
                      </button>
                    </div>
                  );
                })}
                <div className="px-3 py-2 border-t border-[#DFE1E6] dark:border-gray-700">
                  <button
                    onClick={() => setColumnOrder(DEFAULT_ORDER)}
                    className="text-[11px] text-[#5E6C84] dark:text-gray-400 hover:text-[#0052CC] dark:hover:text-blue-400 transition-colors"
                  >
                    Reset order
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Export */}
          <button
            onClick={exportXlsx}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-white dark:bg-gray-800 border border-[#DFE1E6] dark:border-gray-600 rounded text-[#172B4D] dark:text-gray-200 hover:border-[#0052CC] transition-colors"
          >
            <Download size={13} />
            Export
          </button>
        </div>
        )}
      </div>

      {/* ── Bulk action bar ───────────────────────────────────── */}
      {selectedCount > 0 && (
        <div className="flex items-center gap-2 mb-3 px-4 py-2.5 bg-[#E6F0FF] dark:bg-blue-900/30 border border-[#0052CC]/30 dark:border-blue-600/30 rounded-sm flex-wrap">
          <span className="text-sm font-medium text-[#0052CC] dark:text-blue-300 mr-1">
            {selectedCount} selected
          </span>

          {/* Status (transition) */}
          <div className="relative">
            <button
              onClick={() => setTransDropOpen(p => !p)}
              disabled={transitioning || bulkApplying}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 bg-white dark:bg-gray-800 border border-[#DFE1E6] dark:border-gray-600 rounded text-[#172B4D] dark:text-gray-100 hover:border-[#0052CC] transition-colors disabled:opacity-50"
            >
              {transitioning
                ? <Loader2 size={11} className="animate-spin" />
                : <ChevronDown size={11} />}
              Status
            </button>
            {transitionDropOpen && (
              <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-[#DFE1E6] dark:border-gray-700 rounded shadow-lg z-20 min-w-[180px] py-1">
                <div className="px-3 py-1.5 text-[10px] font-semibold text-[#5E6C84] dark:text-gray-400 uppercase tracking-wide border-b border-[#DFE1E6] dark:border-gray-700">
                  Change status
                </div>
                {transitionsLoading ? (
                  <div className="flex items-center gap-2 px-3 py-2 text-xs text-[#5E6C84]">
                    <Loader2 size={12} className="animate-spin" /> Loading…
                  </div>
                ) : commonTransitions.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-[#5E6C84] dark:text-gray-400">
                    No transitions available
                  </div>
                ) : (
                  commonTransitions.map(t => (
                    <button
                      key={t.id}
                      onClick={() => applyTransition(t)}
                      disabled={transitioning}
                      className="w-full text-left text-xs px-3 py-2 text-[#172B4D] dark:text-gray-200 hover:bg-[#F4F5F7] dark:hover:bg-gray-700 border-b border-[#DFE1E6] dark:border-gray-700 last:border-b-0 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      <span className="w-2 h-2 rounded-full bg-current opacity-40 flex-shrink-0" />
                      {t.to?.name ?? t.name}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Bulk assign */}
          <div className="relative" ref={bulkAssignRef}>
            <button
              onClick={() => { setBulkAssignOpen(p => !p); setBulkPriorityOpen(false); setBulkDueOpen(false); }}
              disabled={bulkApplying}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 bg-white dark:bg-gray-800 border border-[#DFE1E6] dark:border-gray-600 rounded text-[#172B4D] dark:text-gray-100 hover:border-[#0052CC] transition-colors disabled:opacity-50"
            >
              <User size={11} />
              Assign to…
            </button>
            {bulkAssignOpen && (
              <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-[#DFE1E6] dark:border-gray-700 rounded shadow-lg z-20 p-3 min-w-[220px]">
                <p className="text-[10px] text-[#5E6C84] dark:text-gray-400 mb-2 font-semibold uppercase">Assign {selectedCount} issue{selectedCount > 1 ? 's' : ''} to</p>
                <input
                  autoFocus
                  type="text"
                  value={bulkAssignQuery}
                  onChange={e => setBulkAssignQuery(e.target.value)}
                  placeholder="Username…"
                  className="w-full text-xs border border-[#DFE1E6] dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-800 text-[#172B4D] dark:text-gray-100 focus:outline-none focus:border-[#0052CC] mb-2"
                />
                <div className="flex gap-1.5">
                  <button
                    onClick={() => applyBulkField({ assignee: bulkAssignQuery ? { name: bulkAssignQuery } : null }, `Assigned ${selectedCount} issue(s)`)}
                    disabled={bulkApplying}
                    className="flex-1 text-xs px-2 py-1.5 bg-[#0052CC] text-white rounded hover:bg-[#0747A6] disabled:opacity-50 transition-colors"
                  >
                    {bulkApplying ? <Loader2 size={11} className="animate-spin mx-auto" /> : 'Apply'}
                  </button>
                  <button onClick={() => setBulkAssignOpen(false)} className="text-xs px-2 py-1.5 border border-[#DFE1E6] rounded text-[#5E6C84] hover:text-[#172B4D]">Cancel</button>
                </div>
              </div>
            )}
          </div>

          {/* Bulk priority */}
          <div className="relative" ref={bulkPriorityRef}>
            <button
              onClick={() => { setBulkPriorityOpen(p => !p); setBulkAssignOpen(false); setBulkDueOpen(false); }}
              disabled={bulkApplying}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 bg-white dark:bg-gray-800 border border-[#DFE1E6] dark:border-gray-600 rounded text-[#172B4D] dark:text-gray-100 hover:border-[#0052CC] transition-colors disabled:opacity-50"
            >
              <ChevronDown size={11} />
              Set priority…
            </button>
            {bulkPriorityOpen && (
              <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-[#DFE1E6] dark:border-gray-700 rounded shadow-lg z-20 min-w-[140px] py-1">
                {PRIORITY_NAMES.map(p => (
                  <button
                    key={p}
                    onClick={() => { setBulkPriority(p); applyBulkField({ priority: { name: p } }, `Priority → ${p} applied`); }}
                    disabled={bulkApplying}
                    className={cn(
                      'w-full text-left text-xs px-3 py-2 hover:bg-[#F4F5F7] dark:hover:bg-gray-700 transition-colors disabled:opacity-50',
                      bulkPriority === p && 'text-[#0052CC] font-semibold',
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Bulk due date */}
          <div className="relative" ref={bulkDueRef}>
            <button
              onClick={() => { setBulkDueOpen(p => !p); setBulkAssignOpen(false); setBulkPriorityOpen(false); }}
              disabled={bulkApplying}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 bg-white dark:bg-gray-800 border border-[#DFE1E6] dark:border-gray-600 rounded text-[#172B4D] dark:text-gray-100 hover:border-[#0052CC] transition-colors disabled:opacity-50"
            >
              <Calendar size={11} />
              Set due date…
            </button>
            {bulkDueOpen && (
              <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-[#DFE1E6] dark:border-gray-700 rounded shadow-lg z-20 p-3 min-w-[200px]">
                <p className="text-[10px] text-[#5E6C84] dark:text-gray-400 mb-2 font-semibold uppercase">Due date for {selectedCount} issue{selectedCount > 1 ? 's' : ''}</p>
                <input
                  autoFocus
                  type="date"
                  value={bulkDue}
                  onChange={e => setBulkDue(e.target.value)}
                  className="w-full text-xs border border-[#DFE1E6] dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-800 text-[#172B4D] dark:text-gray-100 focus:outline-none focus:border-[#0052CC] mb-2"
                />
                <div className="flex gap-1.5">
                  <button
                    onClick={() => applyBulkField({ duedate: bulkDue || null }, `Due date updated for ${selectedCount} issue(s)`)}
                    disabled={bulkApplying}
                    className="flex-1 text-xs px-2 py-1.5 bg-[#0052CC] text-white rounded hover:bg-[#0747A6] disabled:opacity-50 transition-colors"
                  >
                    {bulkApplying ? <Loader2 size={11} className="animate-spin mx-auto" /> : 'Apply'}
                  </button>
                  <button onClick={() => setBulkDueOpen(false)} className="text-xs px-2 py-1.5 border border-[#DFE1E6] rounded text-[#5E6C84] hover:text-[#172B4D]">Cancel</button>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => setSelected(new Set())}
            className="flex items-center gap-1 text-xs text-[#5E6C84] dark:text-gray-400 hover:text-[#172B4D] dark:hover:text-gray-200 ml-auto transition-colors"
          >
            <X size={12} /> Clear
          </button>
        </div>
      )}

      {/* ── Table ─────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 rounded-sm border border-[#DFE1E6] dark:border-gray-700">
        {/* Sticky header */}
        <div className="flex items-center gap-3 px-4 py-2 bg-[#F4F5F7] dark:bg-gray-700 border-b border-[#DFE1E6] dark:border-gray-600 sticky top-0 z-10 rounded-t-sm">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleSelectAll}
            className="w-3.5 h-3.5 rounded border-[#DFE1E6] flex-shrink-0 cursor-pointer accent-[#0052CC]"
            aria-label="Select all"
          />
          {editMode && (
            <span className="w-7 flex-shrink-0 text-xs font-semibold text-[#5E6C84] dark:text-gray-400 text-center">
              ⋮
            </span>
          )}
          {visibleCols.map(col => col.sortField ? (
            <SortableHeader
              key={col.key}
              label={col.label}
              field={col.sortField}
              sortField={sortField}
              sortDir={sortDir}
              onSort={onSortChange}
              className={cn(
                col.widthClass,
                col.key !== 'summary' ? 'flex-shrink-0' : 'min-w-0',
              )}
            />
          ) : (
            <span
              key={col.key}
              className={cn(
                'text-xs font-semibold text-[#5E6C84] dark:text-gray-400 uppercase tracking-wide',
                col.widthClass,
                col.key !== 'summary' ? 'flex-shrink-0' : 'min-w-0',
              )}
            >
              {col.label}
            </span>
          ))}
        </div>

        {issues.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-sm text-[#5E6C84] dark:text-gray-400">
            No issues found
          </div>
        ) : (
          groups.map(group => {
            const collapsed = collapsedGroups.has(group.key);
                    const subGroups = subGroupIssues(group.issues, effectiveSubGroupBy, epicSummaries);
            return (
              <div key={group.key}>
                {effectiveGroupBy !== 'none' && (
                  <button
                    onClick={() => toggleGroup(group.key)}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 bg-[#EBECF0] dark:bg-gray-700 hover:bg-[#DFE1E6] dark:hover:bg-gray-600 border-b-2 border-[#DFE1E6] dark:border-gray-600 border-l-4 transition-colors text-left"
                    style={{ borderLeftColor: getGroupBorderColor(effectiveGroupBy, group.issues[0]) }}
                  >
                    {collapsed
                      ? <ChevronRight size={14} className="text-[#0052CC] dark:text-blue-400 flex-shrink-0" />
                      : <ChevronDown  size={14} className="text-[#0052CC] dark:text-blue-400 flex-shrink-0" />}
                    <GroupHeaderContent groupBy={effectiveGroupBy} group={group} firstIssue={group.issues[0]} />
                    <span className="inline-flex items-center justify-center min-w-[22px] h-[18px] text-[11px] font-bold text-white bg-[#0052CC] dark:bg-blue-600 rounded-full px-1.5 leading-none">
                      {group.issues.length}
                    </span>
                  </button>
                )}

                {!collapsed && effectiveSubGroupBy === 'none'
                  ? group.issues.map(issue => (
                    <IssueTableRow
                      key={issue.id}
                      issue={issue}
                      selected={selected.has(issue.id)}
                      onToggle={() => toggleSelect(issue.id)}
                      visibleCols={visibleCols}
                      onOpenPanel={setPanelKey}
                      onInlineSaved={msg => { showToast(msg); window.dispatchEvent(new CustomEvent('issues-bulk-transitioned')); }}
                      onInlineError={msg => showToast(msg, 'error')}
                      editProps={rowEditProps}
                      onOpenPencilV2={onOpenPencilV2}
                      onOpenLogWork={onOpenLogWork}
                      issueDrafts={drafts?.[issue.key]}
                    />
                  ))
                  : !collapsed && subGroups.map(sub => {
                    const subCollapsed = collapsedGroups.has(`${group.key}::${sub.key}`);
                      const subSubGroups = subSubGroupIssues(sub.issues, effectiveSubSubGroupBy, epicSummaries);
                    return (
                      <div key={sub.key}>
                        {/* Sub-group header */}
                        <button
                          onClick={() => toggleGroup(`${group.key}::${sub.key}`)}
                          className="w-full flex items-center gap-2 pl-10 pr-4 py-2 bg-[#F4F5F7] dark:bg-gray-750/80 hover:bg-[#EBECF0] dark:hover:bg-gray-700 border-b border-[#DFE1E6] dark:border-gray-700 border-l-[3px] transition-colors text-left"
                          style={{ borderLeftColor: getGroupBorderColor(effectiveSubGroupBy as unknown as GroupBy, sub.issues[0]) }}
                        >
                          {subCollapsed
                            ? <ChevronRight size={12} className="flex-shrink-0" style={{ color: getGroupBorderColor(effectiveSubGroupBy as unknown as GroupBy, sub.issues[0]) }} />
                            : <ChevronDown  size={12} className="flex-shrink-0" style={{ color: getGroupBorderColor(effectiveSubGroupBy as unknown as GroupBy, sub.issues[0]) }} />}
                          <SubGroupHeaderContent subGroupBy={effectiveSubGroupBy} sub={sub} firstIssue={sub.issues[0]} />
                          <span className="inline-flex items-center justify-center min-w-[20px] h-[16px] text-[10px] font-bold text-white rounded-full px-1.5 leading-none"
                            style={{ backgroundColor: getGroupBorderColor(effectiveSubGroupBy as unknown as GroupBy, sub.issues[0]) }}>
                            {sub.issues.length}
                          </span>
                        </button>
                        {!subCollapsed && effectiveSubSubGroupBy === 'none'
                          ? sub.issues.map(issue => (
                            <IssueTableRow
                              key={issue.id}
                              issue={issue}
                              selected={selected.has(issue.id)}
                              onToggle={() => toggleSelect(issue.id)}
                              visibleCols={visibleCols}
                              onOpenPanel={setPanelKey}
                              onInlineSaved={msg => { showToast(msg); window.dispatchEvent(new CustomEvent('issues-bulk-transitioned')); }}
                              onInlineError={msg => showToast(msg, 'error')}
                                      editProps={rowEditProps}
                                      onOpenPencilV2={onOpenPencilV2}
                                      onOpenLogWork={onOpenLogWork}
                                      issueDrafts={drafts?.[issue.key]}
                                    />
                          ))
                          : !subCollapsed && subSubGroups.map(subSub => {
                            const subSubCollapsed = collapsedGroups.has(`${group.key}::${sub.key}::${subSub.key}`);
                            return (
                              <div key={subSub.key}>
                                {/* Sub-sub-group header */}
                                <button
                                  onClick={() => toggleGroup(`${group.key}::${sub.key}::${subSub.key}`)}
                                  className="w-full flex items-center gap-1.5 pl-16 pr-4 py-1.5 bg-[#FAFBFC] dark:bg-gray-750/60 hover:bg-[#F4F5F7] dark:hover:bg-gray-700 border-b border-[#DFE1E6] dark:border-gray-700 border-l-[2px] transition-colors text-left"
                                  style={{ borderLeftColor: getGroupBorderColor(effectiveSubSubGroupBy as unknown as GroupBy, subSub.issues[0]) }}
                                >
                                  {subSubCollapsed
                                    ? <ChevronRight size={10} className="flex-shrink-0" style={{ color: getGroupBorderColor(effectiveSubSubGroupBy as unknown as GroupBy, subSub.issues[0]) }} />
                                    : <ChevronDown size={10} className="flex-shrink-0" style={{ color: getGroupBorderColor(effectiveSubSubGroupBy as unknown as GroupBy, subSub.issues[0]) }} />}
                                  <SubSubGroupHeaderContent subSubGroupBy={effectiveSubSubGroupBy} subSub={subSub} firstIssue={subSub.issues[0]} />
                                  <span className="inline-flex items-center justify-center min-w-[18px] h-[14px] text-[9px] font-bold text-white rounded-full px-1 leading-none"
                                    style={{ backgroundColor: getGroupBorderColor(effectiveSubSubGroupBy as unknown as GroupBy, subSub.issues[0]) }}>
                                    {subSub.issues.length}
                                  </span>
                                </button>
                                {!subSubCollapsed && subSub.issues.map(issue => (
                                  <IssueTableRow
                                    key={issue.id}
                                    issue={issue}
                                    selected={selected.has(issue.id)}
                                    onToggle={() => toggleSelect(issue.id)}
                                    visibleCols={visibleCols}
                                    onOpenPanel={setPanelKey}
                                    onInlineSaved={msg => { showToast(msg); window.dispatchEvent(new CustomEvent('issues-bulk-transitioned')); }}
                                    onInlineError={msg => showToast(msg, 'error')}
                                      editProps={rowEditProps}
                                      onOpenPencilV2={onOpenPencilV2}
                                      onOpenLogWork={onOpenLogWork}
                                      issueDrafts={drafts?.[issue.key]}
                                    />
                                ))}
                              </div>
                            );
                          })
                        }
                      </div>
                    );
                  })
                }
              </div>
            );
          })
        )}
      </div>

      {/* Footer count */}
      {total > 0 && (
        <div className="mt-2 px-1">
          <span className="text-xs text-[#5E6C84] dark:text-gray-400">
            {issues.length < total
              ? `Showing ${issues.length} / ${total} issues`
              : `${total} issues`}
          </span>
        </div>
      )}

      {/* Save Confirmation Modal */}
      {showConfirm && (
        <SaveConfirmModal
          edits={edits}
          onClose={() => setShowConfirm(false)}
          onSaved={handleSaved}
        />
      )}

      {/* Issue detail panel */}
      <IssueDetailPanel
        issueKey={panelKey}
        onClose={() => setPanelKey(null)}
        onUpdated={() => window.dispatchEvent(new CustomEvent('issues-bulk-transitioned'))}
      />

      {/* Global toast */}
      <Toast toast={toast} />
    </div>
  );
}
