'use client';
import { Check, X, RefreshCw, Download, Columns, NotebookPen, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ToolBarProps {
  editMode?: boolean;
  onToggleEditMode?: (edit: boolean) => void;
  onNotes?: () => void;
  onRefresh: () => void;
  refreshing?: boolean;
  onExport?: () => void;
  onConfigColumns?: () => void;
  legendOpen?: boolean;
  onToggleLegend?: () => void;
  hasPendingChanges?: boolean;
  totalChanges?: number;
  onConfirm?: () => void;
  onCancel?: () => void;
}

const btnBase = 'text-xs px-2.5 py-1.5 rounded border transition-colors flex items-center gap-1.5 shrink-0 font-medium';
const btnIdle = 'bg-white dark:bg-gray-800 border-[#DFE1E6] dark:border-gray-600 text-[#5E6C84] dark:text-gray-400 hover:bg-[#F4F5F7] dark:hover:bg-gray-700';
const btnActive = 'bg-[#0052CC] text-white border-[#0052CC]';

export function ToolBar({
  editMode, onToggleEditMode, onNotes, onRefresh, refreshing,
  onExport, onConfigColumns, legendOpen, onToggleLegend,
  hasPendingChanges, totalChanges, onConfirm, onCancel,
}: ToolBarProps) {
  return (
    <div className="flex items-center gap-2">
      {onToggleEditMode && (
        <div className="flex items-center rounded border border-[#DFE1E6] dark:border-gray-600 overflow-hidden shrink-0">
          <button type="button" onClick={() => onToggleEditMode(false)}
            className={cn('text-xs px-2.5 py-1.5 font-medium transition-colors border-r border-[#DFE1E6] dark:border-gray-600',
              !editMode ? btnActive : cn(btnIdle, 'border-none'))}>
            View
          </button>
          <button type="button" onClick={() => onToggleEditMode(true)}
            className={cn('text-xs px-2.5 py-1.5 font-medium transition-colors',
              editMode ? btnActive : cn(btnIdle, 'border-none'))}>
            Edit
          </button>
        </div>
      )}
      {onNotes && (
        <button type="button" onClick={onNotes} className={cn(btnBase, btnIdle)}>
          <NotebookPen size={13} /> Notes
        </button>
      )}
      <button type="button" onClick={onRefresh} className={cn(btnBase, btnIdle)}>
        <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
        {refreshing ? 'Refreshing…' : 'Refresh'}
      </button>
      {onToggleLegend && (
        <button type="button" onClick={onToggleLegend} className={cn(btnBase, legendOpen ? btnActive : btnIdle)} title="Legend">
          <Info size={13} />
        </button>
      )}
      {onExport && (
        <button type="button" onClick={onExport} className={cn(btnBase, btnIdle)}>
          <Download size={13} /> Export
        </button>
      )}
      {onConfigColumns && (
        <button type="button" onClick={onConfigColumns} className={cn(btnBase, btnIdle)}>
          <Columns size={13} /> Columns
        </button>
      )}
      {editMode && onConfirm && (
        <button type="button" onClick={onConfirm} disabled={!hasPendingChanges}
          className={cn(btnBase, hasPendingChanges
            ? 'bg-[#36B37E] hover:bg-[#2D9B6C] text-white border-[#36B37E]'
            : 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed border-gray-300 dark:border-gray-600')}>
          <Check size={13} /> Confirm{totalChanges ? ` (${totalChanges})` : ''}
        </button>
      )}
      {editMode && onCancel && (
        <button type="button" onClick={onCancel} disabled={!hasPendingChanges}
          className={cn(btnBase, hasPendingChanges
            ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-300 border-[#DFE1E6] dark:border-gray-600'
            : 'text-gray-400 cursor-not-allowed border-[#DFE1E6] dark:border-gray-600')}>
          <X size={13} /> Cancel
        </button>
      )}
    </div>
  );
}
