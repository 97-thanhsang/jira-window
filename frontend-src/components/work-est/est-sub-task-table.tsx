'use client';

import Image from 'next/image';
import { StatusBadge } from '@/components/shared/status-badge';
import { PriorityIcon } from '@/components/shared/priority-icon';
import { cn } from '@/lib/utils';
import type { WorkEstSubTask } from '@/lib/work-est-api';

function toStatusCategory(status: string): 'new' | 'indeterminate' | 'done' {
  const s = status.toLowerCase();
  if (['done','closed','resolved'].some(x => s.includes(x))) return 'done';
  if (['in progress','in review','development','testing','review'].some(x => s.includes(x))) return 'indeterminate';
  return 'new';
}

interface Props {
  subTasks: WorkEstSubTask[];
  selectedIds: Set<string>;
  isAllSelected: boolean;
  onToggleSelection: (key: string) => void;
  onToggleSelectAll: () => void;
  manualEstimates: Map<string, number>;
  onSetManualEstimate: (key: string, hours: number | null) => void;
}

const STATUS_COLORS: Record<string, string> = {
  'Open': 'bg-[#DEEBFF] text-[#0747A6]',
  'In Progress': 'bg-[#FFF0B3] text-[#974F0C]',
  'Done': 'bg-[#E3FCEF] text-[#006644]',
  'To Do': 'bg-[#DFE1E6] text-[#42526E]',
  'Reopened': 'bg-[#DEEBFF] text-[#0747A6]',
  'Closed': 'bg-[#E3FCEF] text-[#006644]',
};

function formatDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('vi-VN');
}

export function EstSubTaskTable({
  subTasks,
  selectedIds,
  isAllSelected,
  onToggleSelection,
  onToggleSelectAll,
  manualEstimates,
  onSetManualEstimate,
}: Props) {
  if (subTasks.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 border border-[#DFE1E6] dark:border-gray-700 rounded-lg p-8 text-center text-sm text-[#5E6C84] dark:text-gray-400">
        Không có sub-task nào khớp với filter.
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 border border-[#DFE1E6] dark:border-gray-700 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
            <thead>
            <tr className="border-b border-[#DFE1E6] dark:border-gray-700 bg-[#FAFBFC] dark:bg-gray-800/60">
              <th className="w-10 px-2 py-2.5">
                <input type="checkbox" checked={isAllSelected} onChange={onToggleSelectAll} className="rounded border-[#DFE1E6] dark:border-gray-600" />
              </th>
              <th className="w-24 px-2 py-2.5 text-left text-[11px] font-semibold text-[#5E6C84] dark:text-gray-400 uppercase">Key</th>
              <th className="min-w-[200px] px-2 py-2.5 text-left text-[11px] font-semibold text-[#5E6C84] dark:text-gray-400 uppercase">Summary</th>
              <th className="w-28 px-2 py-2.5 text-left text-[11px] font-semibold text-[#5E6C84] dark:text-gray-400 uppercase">Type</th>
              <th className="w-36 px-2 py-2.5 text-left text-[11px] font-semibold text-[#5E6C84] dark:text-gray-400 uppercase">Status</th>
              <th className="w-14 px-2 py-2.5 text-left text-[11px] font-semibold text-[#5E6C84] dark:text-gray-400 uppercase">Pri</th>
              <th className="w-44 px-2 py-2.5 text-left text-[11px] font-semibold text-[#5E6C84] dark:text-gray-400 uppercase">Assignee</th>
              <th className="w-36 px-2 py-2.5 text-left text-[11px] font-semibold text-[#5E6C84] dark:text-gray-400 uppercase">Reporter</th>
              <th className="w-16 px-2 py-2.5 text-right text-[11px] font-semibold text-[#5E6C84] dark:text-gray-400 uppercase">Est</th>
              <th className="w-20 px-2 py-2.5 text-left text-[11px] font-semibold text-[#5E6C84] dark:text-gray-400 uppercase">Est (h)</th>
              <th className="w-16 px-2 py-2.5 text-right text-[11px] font-semibold text-[#5E6C84] dark:text-gray-400 uppercase">Log</th>
              <th className="w-24 px-2 py-2.5 text-left text-[11px] font-semibold text-[#5E6C84] dark:text-gray-400 uppercase">Due</th>
              <th className="w-24 px-2 py-2.5 text-left text-[11px] font-semibold text-[#5E6C84] dark:text-gray-400 uppercase">Updated</th>
            </tr>
          </thead>
          <tbody>
            {subTasks.map(st => {
              const checked = selectedIds.has(st.key);
              const manualVal = manualEstimates.get(st.key);
              return (
                <tr key={st.key} className={cn(
                  'border-b border-[#F4F5F7] dark:border-gray-800 hover:bg-[#FAFBFC] dark:hover:bg-gray-800/40 transition-colors',
                  checked && 'bg-[#DEEBFF]/30 dark:bg-blue-900/10',
                )}>
                  <td className="px-2 py-2">
                    <input type="checkbox" checked={checked} onChange={() => onToggleSelection(st.key)} className="rounded border-[#DFE1E6] dark:border-gray-600" />
                  </td>
                  <td className="px-2 py-2 font-medium text-[#0052CC] dark:text-blue-400 text-xs whitespace-nowrap">{st.key}</td>
                  <td className="px-2 py-2 text-[#172B4D] dark:text-gray-200 max-w-[300px]">
                    <div className="truncate text-xs" title={st.summary}>{st.summary}</div>
                    {st.parentKey && <div className="text-[10px] text-[#5E6C84] dark:text-gray-400 truncate">{st.parentKey} — {st.parentSummary}</div>}
                  </td>
                  <td className="px-2 py-2">
                    {st.issueTypeIconUrl ? (
                      <Image src={st.issueTypeIconUrl} alt={st.issueTypeName} width={14} height={14} className="flex-shrink-0" unoptimized title={st.issueTypeName} />
                    ) : (
                      <span className="text-[10px] text-[#5E6C84]">{st.issueTypeName}</span>
                    )}
                  </td>
                  <td className="px-2 py-2"><StatusBadge status={{ id: '', name: st.status, statusCategory: { key: toStatusCategory(st.status), colorName: '' } }} /></td>
                  <td className="px-2 py-2"><PriorityIcon priority={{ name: st.priority as any, iconUrl: '' }} /></td>
                  <td className="px-2 py-2 text-xs text-[#172B4D] dark:text-gray-200">
                    {st.assigneeDisplayName ? (
                      <div className="flex items-center gap-1.5">
                        {st.assigneeAvatarUrl && <img src={st.assigneeAvatarUrl} alt="" width={16} height={16} className="rounded-full" />}
                        <span className="truncate">{st.assigneeDisplayName}</span>
                      </div>
                    ) : <span className="text-[#C1C7D0]">—</span>}
                  </td>
                  <td className="px-2 py-2 text-xs text-[#5E6C84] dark:text-gray-400">
                    {st.reporterDisplayName ? (
                      <div className="flex items-center gap-1.5">
                        {st.reporterAvatarUrl && <img src={st.reporterAvatarUrl} alt="" width={16} height={16} className="rounded-full" />}
                        <span className="truncate">{st.reporterDisplayName}</span>
                      </div>
                    ) : '—'}
                  </td>
                  <td className="px-2 py-2 text-xs text-right text-[#5E6C84] dark:text-gray-400">{st.originalEstimateDisplay}</td>
                  <td className="px-2 py-2">
                    <input type="number" min={0} max={8} step={0.5} value={manualVal ?? ''} placeholder="Tự động"
                      onChange={e => onSetManualEstimate(st.key, e.target.value === '' ? null : Math.min(8, Math.max(0, parseFloat(e.target.value)) || 0))}
                      className="w-14 px-1.5 py-1 text-xs border border-[#DFE1E6] dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-[#172B4D] dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#0052CC]" />
                  </td>
                  <td className="px-2 py-2 text-xs text-right text-[#5E6C84] dark:text-gray-400">{st.loggedDisplay}</td>
                  <td className="px-2 py-2 text-xs text-[#5E6C84] dark:text-gray-400">{formatDate(st.duedate)}</td>
                  <td className="px-2 py-2 text-xs text-[#5E6C84] dark:text-gray-400">{formatDate(st.updated)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 border-t border-[#DFE1E6] dark:border-gray-700 bg-[#FAFBFC] dark:bg-gray-800/60 text-xs text-[#5E6C84] dark:text-gray-400">
        {subTasks.length} sub-tasks · {selectedIds.size} đã chọn
      </div>
    </div>
  );
}
