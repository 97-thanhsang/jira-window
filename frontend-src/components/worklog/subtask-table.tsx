'use client';

import { useMemo, useState, Fragment } from 'react';
import { Pencil, Calendar, Clock, ChevronDown, ChevronRight, FolderTree } from 'lucide-react';
import { format } from 'date-fns';
import { getDuedateColor, getStatusBgColor, getStatusColor } from '@/lib/jira-status';
import { PRIORITY_HEX_COLORS, getIssueTypeBadgeClass } from '@/lib/jira-colors';
import { cn } from '@/lib/utils';
import type { WorklogEntry } from '@/types/jira';

// ─── Helpers (matching board-issue-table.tsx) ────────────────────────────

function getPriorityColor(name?: string): string {
  return name ? (PRIORITY_HEX_COLORS[name] ?? '#6B778C') : '#6B778C';
}

// ─── Component ───────────────────────────────────────────────────────────

interface SubTaskTableProps {
  entries: WorklogEntry[];
  editMode?: boolean;
  onEntryClick?: (entry: WorklogEntry) => void;
}

export function SubTaskTable({ entries, editMode, onEntryClick }: SubTaskTableProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  function toggleParent(key: string) {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  }

  // Group entries by parent-task, then by issue key
  const parentGroups = useMemo(() => {
    const issueMap = new Map<string, { entry: WorklogEntry; logSeconds: number }>();
    for (const e of entries) {
      if (issueMap.has(e.issueKey)) {
        issueMap.get(e.issueKey)!.logSeconds += e.timeSpentSeconds;
      } else {
        issueMap.set(e.issueKey, { entry: e, logSeconds: e.timeSpentSeconds });
      }
    }
    const issues = Array.from(issueMap.values())
      .sort((a, b) => a.entry.issueKey.localeCompare(b.entry.issueKey));

    const groupMap = new Map<string, { parentKey: string; parentSummary: string; issues: typeof issues }>();
    const noParent: typeof issues = [];

    for (const item of issues) {
      const pk = item.entry.parentKey;
      if (pk) {
        if (!groupMap.has(pk)) {
          groupMap.set(pk, {
            parentKey: pk,
            parentSummary: item.entry.parentSummary || pk,
            issues: [],
          });
        }
        groupMap.get(pk)!.issues.push(item);
      } else {
        noParent.push(item);
      }
    }

    const groups = Array.from(groupMap.values())
      .sort((a, b) => a.parentKey.localeCompare(b.parentKey));

    if (noParent.length > 0) {
      groups.push({ parentKey: '', parentSummary: 'No Parent', issues: noParent });
    }

    return groups;
  }, [entries]);

  if (parentGroups.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-[11px] text-[#8993A4] dark:text-gray-500">
        No sub-tasks found
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

  const COL_COUNT = 11;

  return (
    <div className="overflow-x-auto">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-b border-[#DFE1E6] dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="flex items-center gap-1.5 text-[10px] text-[#5E6C84] dark:text-gray-400 font-medium">
          <FolderTree size={12} />
          <span>Parent Group</span>
          <span className="text-[#8993A4]">·</span>
          <span className="text-[#0052CC] dark:text-blue-400 font-semibold">{parentGroups.reduce((s, g) => s + g.issues.length, 0)} sub-task(s)</span>
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
            <th className="text-center font-semibold text-[#5E6C84] dark:text-gray-400 uppercase tracking-wide py-2 px-1.5 w-12">Start</th>
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
            const isOpen = expanded[groupKey] === true; // default collapsed
            const groupTotalHours = group.issues.reduce((s, i) => s + i.logSeconds / 3600, 0);
            const groupEstHours = group.issues.reduce((s, i) => s + i.entry.estSeconds / 3600, 0);
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
                        <span className="text-[11px] text-[#5E6C84] dark:text-gray-400 italic">Sub-tasks without parent</span>
                      )}
                      <span className="ml-auto flex items-center gap-3">
                        <span className="text-[10px] font-medium text-[#5E6C84] dark:text-gray-400">{group.issues.length} sub-task(s)</span>
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

                {/* Sub-task rows */}
                {isOpen && group.issues.map(({ entry: e, logSeconds }) => {
                  const estH = e.estSeconds > 0 ? (e.estSeconds / 3600).toFixed(1) : null;
                  const logH = (logSeconds / 3600).toFixed(1);
                  const logColor = logSeconds > (e.estSeconds || 0)
                    ? { bg: '#FFEBE6', fg: '#DE350B' }
                    : { bg: '#DEEBFF', fg: '#0052CC' };
                  const duedateColor = getDuedateColor(e.status, e.duedate);

                  return (
                    <tr key={e.issueKey} className="border-b border-[#F4F5F7] dark:border-gray-700/50 hover:bg-[#FAFBFC] dark:hover:bg-gray-800/50 transition-colors">
                      {/* Key */}
                      <td className="py-1.5 px-1.5 w-28">
                        <button
                          onClick={() => onEntryClick?.(e)}
                          className="font-semibold text-[#0052CC] dark:text-blue-400 hover:underline text-left text-[10px]"
                        >
                          {e.issueKey}
                        </button>
                      </td>
                      {/* Summary */}
                      <td className="py-1.5 px-1.5 w-44">
                        <span className="text-[#5E6C84] dark:text-gray-400 whitespace-nowrap">
                          {e.issueSummary}
                        </span>
                      </td>
                      {/* Type */}
                      <td className="py-1.5 px-1.5 text-center w-20">
                        <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-sm leading-none', getIssueTypeBadgeClass(e.issueTypeName))}>
                          {e.issueTypeName}
                        </span>
                      </td>
                      {/* Status */}
                      <td className="py-1.5 px-1.5 text-center w-24">
                        {e.status && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm leading-none"
                            style={{ backgroundColor: getStatusBgColor(e.status), color: getStatusColor(e.status) }}>
                            {e.status}
                          </span>
                        )}
                      </td>
                      {/* Start date */}
                      <td className="py-1.5 px-1.5 text-center w-12">
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-[#8993A4] dark:text-gray-500 leading-none whitespace-nowrap">
                          <Clock size={8} />{format(new Date(e.started), 'dd/MM')}
                        </span>
                      </td>
                      {/* Due date */}
                      <td className="py-1.5 px-1.5 text-center w-12">
                        {e.duedate ? (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium leading-none whitespace-nowrap" style={{ color: duedateColor }}>
                            <Calendar size={8} />{format(new Date(e.duedate + 'T12:00:00'), 'dd/MM')}
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
                          {e.author?.displayName || e.author?.name || '—'}
                        </span>
                      </td>
                      {/* Edit */}
                      <td className="py-1.5 px-1.5 text-center w-8">
                        {editMode ? (
                          <button
                            onClick={() => onEntryClick?.(e)}
                            className="text-[#5E6C84] hover:text-[#0052CC] transition-colors p-0.5"
                            title="Edit worklog"
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
