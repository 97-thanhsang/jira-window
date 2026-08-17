'use client';

import { useState, useCallback } from 'react';
import { AlertTriangle, CalendarDays, Search, Loader2 } from 'lucide-react';
import { useWorkEst } from '@/hooks/use-work-est';
import { FilterBar } from '@/components/shared/filter-bar';
import type { UnifiedFilters } from '@/lib/filter-constants';
import { EstTaskSelector } from '@/components/work-est/est-task-selector';
import { EstSubTaskTable } from '@/components/work-est/est-sub-task-table';
import { EstTimeline } from '@/components/work-est/est-timeline';
import { EstActionButtons } from '@/components/work-est/est-apply-button';
import { MEMBER_DISPLAY_NAMES } from '@/lib/team-constants';

export default function WorkEstPage() {
  const [parentKeys, setParentKeys] = useState<string[]>([]);

  const {
    subTasks, filteredCount, totalCount, isLoading, filters, setFilters,
    selectedIds, toggleSelection, toggleSelectAll, isAllSelected,
    manualEstimates, setManualEstimate,
    dateRange, setDateRange,
    selectedUser, setSelectedUser,
    distribution, runDistribution, resetDistribution,
    hasLoaded, loadExistingData, isLoadingExisting,
    hasAllocated,
    distributionErrors,
    memberSubTasks, isLoadingMemberSubTasks,
  } = useWorkEst(parentKeys);

  const handleAddParent = useCallback((key: string) => setParentKeys(prev => [...prev, key]), []);
  const handleRemoveParent = useCallback((key: string) => setParentKeys(prev => prev.filter(k => k !== key)), []);

  const canDistribute = selectedIds.size > 0 && !!dateRange.from && !!dateRange.to;
  const timelineVisible = hasLoaded || hasAllocated;

  // Tính số ngày làm việc
  const workingDays = (() => {
    if (!dateRange.from || !dateRange.to) return 0;
    const s = new Date(dateRange.from + 'T00:00:00');
    const e = new Date(dateRange.to + 'T00:00:00');
    let c = 0; const cur = new Date(s);
    while (cur <= e) { const d = cur.getDay(); if (d !== 0 && d !== 6) c++; cur.setDate(cur.getDate() + 1); }
    return c;
  })();

  return (
    <div className="flex flex-col gap-4 p-6 w-full">
      {/* Header */}
      <div className="flex items-center gap-3">
        <CalendarDays size={24} className="text-[#0052CC]" />
        <h1 className="text-xl font-bold text-[#172B4D] dark:text-gray-100">Work Estimate Schedule</h1>
        <span className="text-xs text-[#5E6C84] dark:text-gray-400 bg-[#F4F5F7] dark:bg-gray-800 px-2 py-0.5 rounded">Lập kế hoạch & phân bổ estimate</span>
      </div>

      {/* ═══ Section A: Xem workload của member ═══ */}
      <div className="space-y-1">
        <div className="flex items-center gap-3 mb-1">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#0052CC] text-white text-[11px] font-bold leading-none">A</span>
          <span className="text-xs font-semibold text-[#172B4D] dark:text-gray-200 uppercase tracking-wide">Xem workload của member</span>
        </div>
        <div className="flex items-center gap-4 flex-wrap bg-white dark:bg-gray-900 border border-[#DFE1E6] dark:border-gray-700 rounded-lg p-4">
          {/* Chọn member */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-[#5E6C84] dark:text-gray-400 uppercase tracking-wide shrink-0">Nhân sự</label>
            <select
              value={selectedUser}
              onChange={e => setSelectedUser(e.target.value)}
              className="px-2.5 py-1.5 text-sm border border-[#DFE1E6] dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-[#172B4D] dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#0052CC] min-w-[130px]"
            >
              <option value="">Chính tôi</option>
              {Object.entries(MEMBER_DISPLAY_NAMES).map(([username, displayName]) => (
                <option key={username} value={username}>{displayName}</option>
              ))}
            </select>
          </div>

          <div className="w-px h-7 bg-[#DFE1E6] dark:border-gray-700" />

          {/* Daterange gộp */}
          <div className="flex items-center border border-[#DFE1E6] dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 overflow-hidden">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#FAFBFC] dark:bg-gray-800/60 border-r border-[#DFE1E6] dark:border-gray-700">
              <CalendarDays size={14} className="text-[#5E6C84] dark:text-gray-400 shrink-0" />
            </div>
            <input type="date" value={dateRange.from}
              onChange={e => setDateRange({ ...dateRange, from: e.target.value })}
              className="px-2 py-1.5 text-sm bg-transparent text-[#172B4D] dark:text-gray-200 focus:outline-none w-[130px] border-0" />
            <span className="text-xs text-[#8993A4] dark:text-gray-500 px-1 select-none">→</span>
            <input type="date" value={dateRange.to}
              onChange={e => setDateRange({ ...dateRange, to: e.target.value })}
              className="px-2 py-1.5 text-sm bg-transparent text-[#172B4D] dark:text-gray-200 focus:outline-none w-[130px] border-0" />
          </div>

          {/* Thông tin ngày */}
          {workingDays > 0 && (
            <>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#DEEBFF] dark:bg-blue-900/30 text-[#0052CC] dark:text-blue-300 rounded-full text-xs font-medium">
                {workingDays} ngày · {workingDays * 8}h
              </span>
              <span className="text-[10px] text-[#5E6C84]">(Bỏ T7/CN)</span>
            </>
          )}

          {/* Nút Load */}
          <button
            onClick={loadExistingData}
            disabled={isLoadingExisting || isLoadingMemberSubTasks}
            className="inline-flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-md bg-[#0052CC] text-white hover:bg-[#0065FF] disabled:opacity-50 disabled:cursor-not-allowed transition-colors ml-auto"
          >
            {(isLoadingExisting || isLoadingMemberSubTasks) ? (
              <><Loader2 size={14} className="animate-spin" /> Đang tải...</>
            ) : (
              <><Search size={14} /> Tải dữ liệu</>
            )}
          </button>
        </div>
      </div>

      {/* ═══ Section B: Phân rã task (tùy chọn) ═══ */}
      <div className="space-y-1">
        <div className="flex items-center gap-3 mb-1">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#0052CC] text-white text-[11px] font-bold leading-none">B</span>
          <span className="text-xs font-semibold text-[#172B4D] dark:text-gray-200 uppercase tracking-wide">Phân rã thêm task</span>
          <span className="text-[10px] text-[#5E6C84] dark:text-gray-400">(tùy chọn — thêm task để phân bổ cho member)</span>
        </div>

        {/* Step B1: Parent task selector */}
        <EstTaskSelector
          parentKeys={parentKeys}
          onAddParent={handleAddParent}
          onRemoveParent={handleRemoveParent}
        />

        {/* Step B2: Sub-task table */}
        {(totalCount > 0 || memberSubTasks.length > 0) && (
          <>
            <div className="flex items-center gap-2">
              <FilterBar
                filters={filters}
                onChange={(f: UnifiedFilters) => setFilters(f)}
              />
              <span className="text-[11px] text-[#5E6C84] dark:text-gray-400 shrink-0">({selectedIds.size}/{subTasks.length} chọn)</span>
            </div>
            <EstSubTaskTable
              subTasks={subTasks}
              selectedIds={selectedIds}
              isAllSelected={isAllSelected}
              onToggleSelection={toggleSelection}
              onToggleSelectAll={toggleSelectAll}
              manualEstimates={manualEstimates}
              onSetManualEstimate={setManualEstimate}
            />
          </>
        )}

        {/* Step B3: Action buttons */}
        <div className="flex items-center gap-4 flex-wrap bg-white dark:bg-gray-900 border border-[#DFE1E6] dark:border-gray-700 rounded-lg p-4">
          <EstActionButtons
            schedule={distribution?.schedule ?? []}
            canDistribute={canDistribute}
            hasDistributed={hasAllocated}
            dateLabel={`${dateRange.from} → ${dateRange.to}`}
            assigneeUsername={selectedUser || undefined}
            onDistribute={runDistribution}
            onReset={resetDistribution}
            compact
          />
          {distributionErrors && distributionErrors.length > 0 && (
            <div className="w-full mt-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle size={14} className="text-red-500 dark:text-red-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-red-700 dark:text-red-300 mb-1">Không thể phân rã</p>
                  {distributionErrors.map((e, i) => (
                    <p key={i} className="text-xs text-red-600 dark:text-red-400">{e}</p>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ Section C: Timeline (duy nhất — tự động cập nhật) ═══ */}
      {timelineVisible && distribution && (
        <div className="space-y-1">
          <div className="flex items-center gap-3 mb-1">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#0052CC] text-white text-[11px] font-bold leading-none shrink-0">C</span>
            <span className="text-xs font-semibold text-[#172B4D] dark:text-gray-200 uppercase tracking-wide">
              Timeline — {hasAllocated ? 'Workload + phân bổ mới' : 'Workload hiện tại'} của {selectedUser ? (MEMBER_DISPLAY_NAMES[selectedUser] || selectedUser) : 'bạn'}
            </span>
            <span className="text-[10px] text-[#5E6C84] dark:text-gray-400 bg-[#F4F5F7] dark:bg-gray-800 px-2 py-0.5 rounded">
              {hasAllocated ? 'Card dashed = (cũ) · Card màu = (mới)' : 'Log = (cũ) · Est = card màu'}
            </span>
            {/* Error banner inline với timeline header */}
            {distributionErrors && distributionErrors.length > 0 && (
              <div className="flex items-center gap-2 ml-auto">
                <AlertTriangle size={14} className="text-red-500 shrink-0" />
                <span className="text-xs font-semibold text-red-600 dark:text-red-400">{distributionErrors[0]}</span>
              </div>
            )}
          </div>
          <EstTimeline
            schedule={distribution.schedule}
            workingDays={distribution.workingDays}
          />
        </div>
      )}
    </div>
  );
}
