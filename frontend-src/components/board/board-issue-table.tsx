'use client';

import { useMemo, useState, Fragment } from 'react';
import { Pencil, Calendar, ChevronDown, ChevronRight, FolderTree } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { JiraIssue } from '@/types/jira';
import {
  PRIORITY_HEX_COLORS,
  STATUS_CATEGORY_BADGE_CLASSES,
  getIssueTypeBadgeClass,
} from '@/lib/jira-colors';

// ─── Helpers (matching patterns from issue-card.tsx) ─────────────────────

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}

function getStatusBgClass(catKey: string): string {
  return STATUS_CATEGORY_BADGE_CLASSES[catKey] ?? 'bg-gray-400 text-white';
}

function getPriorityColor(name?: string): string {
  return name ? (PRIORITY_HEX_COLORS[name] ?? '#6B778C') : '#6B778C';
}

function getDuedateColor(statusCat: string, duedate?: string): string {
  if (!duedate) return '#2684FF';
  if (statusCat === 'done') return '#36B37E';
  const now = new Date();
  const due = new Date(duedate);
  return due < now ? '#DE350B' : '#2684FF';
}

// ─── Component ───────────────────────────────────────────────────────────

interface BoardIssueTableProps {
  issues: JiraIssue[];
  editMode?: boolean;
  onIssueClick?: (key: string) => void;
}

export function BoardIssueTable({ issues, editMode, onIssueClick }: BoardIssueTableProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  function toggleParent(key: string) {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  }

  // Group by parentKey
  const parentGroups = useMemo(() => {
    const groupMap = new Map<string, { parentKey: string; parentSummary: string; issues: JiraIssue[] }>();
    const noParent: JiraIssue[] = [];
    const seenGlobal = new Set<string>();

    for (const issue of issues) {
      if (seenGlobal.has(issue.key)) continue;
      seenGlobal.add(issue.key);

      const parent = issue.fields.parent;
      if (parent) {
        if (!groupMap.has(parent.key)) {
          groupMap.set(parent.key, {
            parentKey: parent.key,
            parentSummary: parent.fields.summary,
            issues: [],
          });
        }
        groupMap.get(parent.key)!.issues.push(issue);
      } else {
        noParent.push(issue);
      }
    }

    const groups = Array.from(groupMap.values())
      .sort((a, b) => a.parentKey.localeCompare(b.parentKey));

    if (noParent.length > 0) {
      groups.push({ parentKey: '', parentSummary: 'No Parent', issues: noParent });
    }

    return groups;
  }, [issues]);

  if (parentGroups.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-[11px] text-[#8993A4] dark:text-gray-500">
        No issues found
      </div>
    );
  }

  function expandAll() {
    const allOpen: Record<string, boolean> = {};
    for (const g of parentGroups) {
      allOpen[g.parentKey || '__no_parent__'] = true;
    }
    setExpanded(allOpen);
  }

  function collapseAll() {
    const allClosed: Record<string, boolean> = {};
    for (const g of parentGroups) {
      allClosed[g.parentKey || '__no_parent__'] = false;
    }
    setExpanded(allClosed);
  }

  const allCollapsed = parentGroups.every(g => expanded[g.parentKey || '__no_parent__'] !== true);
  const allExpanded = parentGroups.every(g => expanded[g.parentKey || '__no_parent__'] === true);

  const COL_COUNT = 10;

  return (
    <div className="overflow-x-auto">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-b border-[#DFE1E6] dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="flex items-center gap-1.5 text-[10px] text-[#5E6C84] dark:text-gray-400 font-medium">
          <FolderTree size={12} />
          <span>Parent Group</span>
          <span className="text-[#8993A4]">·</span>
          <span className="text-[#0052CC] dark:text-blue-400 font-semibold">{issues.length} issue{issues.length !== 1 ? 's' : ''}</span>
        </div>
        <button
          onClick={allExpanded ? collapseAll : expandAll}
          className={cn(
            'text-[10px] font-medium px-2 py-0.5 rounded transition-colors',
            allExpanded
              ? 'bg-[#F4F5F7] dark:bg-gray-700 text-[#5E6C84] dark:text-gray-400 hover:bg-[#EBECF0] dark:hover:bg-gray-600'
              : 'text-[#0052CC] dark:text-blue-400 hover:bg-[#DEEBFF] dark:hover:bg-blue-900/30',
          )}
        >
          {allExpanded ? 'Collapse All' : 'Expand All'}
        </button>
      </div>

      {/* Table */}
      <table className="w-full text-[11px] border-collapse">
        <thead>
          <tr className="bg-[#FAFBFC] dark:bg-gray-800/80">
            <th className="text-left font-semibold text-[#5E6C84] dark:text-gray-400 uppercase tracking-wide py-2 px-1.5 w-28">Key</th>
            <th className="text-left font-semibold text-[#5E6C84] dark:text-gray-400 uppercase tracking-wide py-2 px-1.5 w-44">Summary</th>
            <th className="text-center font-semibold text-[#5E6C84] dark:text-gray-400 uppercase tracking-wide py-2 px-1.5 w-20">Type</th>
            <th className="text-center font-semibold text-[#5E6C84] dark:text-gray-400 uppercase tracking-wide py-2 px-1.5 w-24">Status</th>
            <th className="text-center font-semibold text-[#5E6C84] dark:text-gray-400 uppercase tracking-wide py-2 px-1.5 w-16">Priority</th>
            <th className="text-center font-semibold text-[#5E6C84] dark:text-gray-400 uppercase tracking-wide py-2 px-1.5 w-12">Due</th>
            <th className="text-center font-semibold text-[#5E6C84] dark:text-gray-400 uppercase tracking-wide py-2 px-1.5 w-10">Est</th>
            <th className="text-center font-semibold text-[#5E6C84] dark:text-gray-400 uppercase tracking-wide py-2 px-1.5 w-12">Log</th>
            <th className="text-left font-semibold text-[#5E6C84] dark:text-gray-400 uppercase tracking-wide py-2 px-1.5">Assignee</th>
            <th className="text-center font-semibold text-[#5E6C84] dark:text-gray-400 uppercase tracking-wide py-2 px-1.5 w-8">Edit</th>
          </tr>
        </thead>
        <tbody>
          {parentGroups.map(group => {
            const groupKey = group.parentKey || '__no_parent__';
            const isOpen = expanded[groupKey] === true;
            const groupTotalHours = group.issues.reduce((s, i) => s + (i.fields.timetracking?.timeSpentSeconds ?? 0) / 3600, 0);
            const groupEstHours = group.issues.reduce((s, i) => s + (i.fields.timetracking?.originalEstimateSeconds ?? 0) / 3600, 0);
            const groupProgress = groupEstHours > 0 ? Math.min(groupTotalHours / groupEstHours, 1) : 0;

            return (
              <Fragment key={groupKey}>
                {/* Parent header row */}
                <tr
                  className={cn(
                    'border-b border-[#DFE1E6] dark:border-gray-700 cursor-pointer transition-colors',
                    isOpen
                      ? 'bg-[#DEEBFF]/40 dark:bg-blue-900/15'
                      : 'bg-[#F4F5F7] dark:bg-gray-800/50 hover:bg-[#EBECF0] dark:hover:bg-gray-800',
                  )}
                  onClick={() => toggleParent(groupKey)}
                >
                  <td colSpan={COL_COUNT} className="py-2 px-2">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        'w-5 h-5 rounded flex items-center justify-center transition-colors',
                        isOpen ? 'bg-[#0052CC] text-white' : 'bg-[#DFE1E6] dark:bg-gray-700 text-[#5E6C84]',
                      )}>
                        {isOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                      </div>
                      <FolderTree size={13} className={isOpen ? 'text-[#0052CC]' : 'text-[#5E6C84] dark:text-gray-400'} />
                      {group.parentKey ? (
                        <>
                          <span className={cn(
                            'text-[11px] font-bold',
                            isOpen ? 'text-[#0052CC] dark:text-blue-400' : 'text-[#172B4D] dark:text-gray-200',
                          )}>{group.parentKey}</span>
                          <span className="text-[10px] text-[#5E6C84] dark:text-gray-400 truncate">{group.parentSummary}</span>
                        </>
                      ) : (
                        <span className="text-[11px] text-[#5E6C84] dark:text-gray-400 italic">Issues without parent</span>
                      )}
                      <span className="ml-auto flex items-center gap-3">
                        <span className="text-[10px] font-medium text-[#5E6C84] dark:text-gray-400">{group.issues.length} issue{group.issues.length !== 1 ? 's' : ''}</span>
                        {groupEstHours > 0 && (
                          <span className="text-[10px] text-[#8993A4] dark:text-gray-500">Est {groupEstHours.toFixed(1)}h</span>
                        )}
                        <span className="text-[11px] font-bold text-[#172B4D] dark:text-gray-200">{groupTotalHours.toFixed(1)}h</span>
                        {groupProgress > 0 && groupProgress < 1 && (
                          <div className="w-12 h-1 rounded-full overflow-hidden bg-[#DFE1E6] dark:bg-gray-700">
                            <div className="h-full rounded-full bg-[#0052CC]" style={{ width: `${Math.min(groupProgress * 100, 100)}%` }} />
                          </div>
                        )}
                      </span>
                    </div>
                  </td>
                </tr>

                {/* Issue rows */}
                {isOpen && group.issues.map(issue => {
                  const tt = issue.fields.timetracking;
                  const estH = tt?.originalEstimateSeconds ? (tt.originalEstimateSeconds / 3600).toFixed(1) : null;
                  const logSeconds = tt?.timeSpentSeconds ?? 0;
                  const logH = (logSeconds / 3600).toFixed(1);
                  const statusCat = issue.fields.status.statusCategory.key;
                  const duedateColor = getDuedateColor(statusCat, issue.fields.duedate);

                  const logColor = tt?.originalEstimateSeconds && logSeconds > tt.originalEstimateSeconds
                    ? { bg: '#FFEBE6', fg: '#DE350B' }
                    : { bg: '#DEEBFF', fg: '#0052CC' };

                  return (
                    <tr key={`${groupKey}-${issue.key}`} className="border-b border-[#F4F5F7] dark:border-gray-700/50 hover:bg-[#FAFBFC] dark:hover:bg-gray-800/50 transition-colors">
                      {/* Key */}
                      <td className="py-1.5 px-1.5 w-28">
                        <button
                          onClick={() => onIssueClick?.(issue.key)}
                          className="font-semibold text-[#0052CC] dark:text-blue-400 hover:underline text-left text-[10px]"
                        >
                          {issue.key}
                        </button>
                      </td>
                      {/* Summary */}
                      <td className="py-1.5 px-1.5 w-44">
                        <span className="text-[#5E6C84] dark:text-gray-400 whitespace-nowrap">
                          {issue.fields.summary}
                        </span>
                      </td>
                      {/* Type */}
                      <td className="py-1.5 px-1.5 text-center w-20">
                        <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-sm leading-none', getIssueTypeBadgeClass(issue.fields.issuetype.name))}>
                          {issue.fields.issuetype.name}
                        </span>
                      </td>
                      {/* Status */}
                      <td className="py-1.5 px-1.5 text-center w-24">
                        <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-sm leading-none', getStatusBgClass(statusCat))}>
                          {issue.fields.status.name}
                        </span>
                      </td>
                      {/* Priority */}
                      <td className="py-1.5 px-1.5 text-center w-16">
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-sm leading-none" style={{ color: getPriorityColor(issue.fields.priority?.name) }}>
                          {issue.fields.priority?.name ?? '—'}
                        </span>
                      </td>
                      {/* Due */}
                      <td className="py-1.5 px-1.5 text-center w-12">
                        {issue.fields.duedate ? (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium leading-none whitespace-nowrap" style={{ color: duedateColor }}>
                            <Calendar size={8} />{formatDate(issue.fields.duedate)}
                          </span>
                        ) : (
                          <span className="text-[10px] text-[#C1C7D0] leading-none">—</span>
                        )}
                      </td>
                      {/* Est */}
                      <td className="py-1.5 px-1.5 text-center w-10">
                        {estH != null ? (
                          <span className="text-[10px] text-[#8993A4] dark:text-gray-500 leading-none whitespace-nowrap">{estH}h</span>
                        ) : (
                          <span className="text-[10px] text-[#C1C7D0] leading-none">—</span>
                        )}
                      </td>
                      {/* Log */}
                      <td className="py-1.5 px-1.5 text-center w-12">
                        {logSeconds > 0 ? (
                          <span className="font-bold px-1.5 py-0.5 leading-none rounded-sm text-[10px] whitespace-nowrap"
                            style={{ backgroundColor: logColor.bg, color: logColor.fg }}>
                            {logH}h
                          </span>
                        ) : null}
                      </td>
                      {/* Assignee */}
                      <td className="py-1.5 px-1.5 overflow-visible">
                        <span className="text-[10px] text-[#5E6C84] dark:text-gray-400 whitespace-nowrap">
                          {issue.fields.assignee?.displayName || issue.fields.assignee?.name || 'Unassigned'}
                        </span>
                      </td>
                      {/* Edit */}
                      <td className="py-1.5 px-1.5 text-center w-8">
                        {editMode ? (
                          <button
                            onClick={() => onIssueClick?.(issue.key)}
                            className="text-[#5E6C84] hover:text-[#0052CC] transition-colors p-0.5"
                            title="Edit issue"
                          >
                            <Pencil size={9} />
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
