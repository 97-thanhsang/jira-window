'use client';

import { useState } from 'react';
import { RefreshCw, CheckCircle, XCircle, Loader2, Upload, RotateCcw } from 'lucide-react';
import { batchUpdateEstimate } from '@/lib/work-est-api';
import type { WorkEstDaySchedule } from '@/lib/work-est-api';

interface Props {
  schedule: WorkEstDaySchedule[];
  canDistribute: boolean;
  hasDistributed: boolean;
  dateLabel?: string;
  compact?: boolean;
  assigneeUsername?: string;
  onDistribute: () => void;
  onReset: () => void;
}

export function EstActionButtons({ schedule, canDistribute, hasDistributed, dateLabel, compact, assigneeUsername, onDistribute, onReset }: Props) {
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<{ success: number; failed: number } | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const handleApply = async () => {
    setApplying(true);
    setResult(null);

    const issueMap = new Map<string, { seconds: number; duedate: string }>();
    for (const day of schedule) {
      for (const alloc of day.allocations) {
        const existing = issueMap.get(alloc.issueKey);
        const totalSecs = (existing ? existing.seconds : 0) + alloc.seconds;
        if (!existing || day.date > existing.duedate) {
          issueMap.set(alloc.issueKey, { seconds: totalSecs, duedate: day.date });
        } else {
          issueMap.set(alloc.issueKey, { ...existing, seconds: totalSecs });
        }
      }
    }

    const updates = Array.from(issueMap.entries()).map(([issueKey, data]) => ({
      issueKey,
      estimateSeconds: data.seconds,
      duedate: data.duedate,
      ...(assigneeUsername ? { assignee: assigneeUsername } : {}),
    }));

    const res = await batchUpdateEstimate(updates, (done, total) => {
      setProgress({ done, total });
    });

    setResult({ success: res.success, failed: res.failed });
    setApplying(false);
  };

  const totalAllocations = schedule.reduce((s, d) => s + d.allocations.length, 0);
  const hasSchedule = totalAllocations > 0;

  const content = (
    <div className="flex items-center gap-3 flex-wrap">
      <button onClick={onDistribute} disabled={!canDistribute}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-[#0052CC] text-white hover:bg-[#0065FF] disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
        <RefreshCw size={14} /> Phân rã sub-task
      </button>
      {dateLabel && <span className="text-[11px] text-[#5E6C84] dark:text-gray-400">Phân rã cho: {dateLabel}</span>}

      {hasDistributed && (
        <button onClick={handleApply} disabled={applying || !hasSchedule}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          {applying ? <><Loader2 size={14} className="animate-spin" /> Đang cập nhật {progress.done}/{progress.total}...</>
            : <><Upload size={14} /> Áp dụng vào Jira</>}
        </button>
      )}

      {hasDistributed && (
        <button onClick={onReset} disabled={applying}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md border border-[#DFE1E6] dark:border-gray-600 text-[#5E6C84] dark:text-gray-400 hover:bg-[#F4F5F7] dark:hover:bg-gray-800 transition-colors">
          <RotateCcw size={14} /> Reset
        </button>
      )}

      {result && (
        <div className="flex items-center gap-2 text-xs">
          {result.success > 0 && <span className="inline-flex items-center gap-1 text-green-600"><CheckCircle size={12} /> {result.success} thành công</span>}
          {result.failed > 0 && <span className="inline-flex items-center gap-1 text-red-500"><XCircle size={12} /> {result.failed} thất bại</span>}
        </div>
      )}

      {hasDistributed && hasSchedule && (
        <span className="text-xs text-[#5E6C84] dark:text-gray-400 ml-auto">{totalAllocations} sub-tasks đã phân bổ</span>
      )}
    </div>
  );

  if (compact) return content;
  return (
    <div className="bg-white dark:bg-gray-900 border border-[#DFE1E6] dark:border-gray-700 rounded-lg p-4">
      {content}
    </div>
  );
}
