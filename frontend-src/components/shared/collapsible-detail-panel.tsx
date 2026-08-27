'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CollapsibleDetailPanelProps {
  label?: string;
  countLabel: string;
  stats: ReactNode;
  table: ReactNode;
}

export function CollapsibleDetailPanel({
  label = 'Project Detail',
  countLabel,
  stats,
  table,
}: CollapsibleDetailPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-t border-[#DFE1E6] dark:border-gray-700">
      {/* Toggle header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center gap-2 px-4 py-2.5 text-left font-medium transition-colors',
          isOpen
            ? 'bg-[#DEEBFF] dark:bg-blue-900/20 text-[#0052CC] dark:text-blue-400'
            : 'text-[#5E6C84] dark:text-gray-400 hover:bg-[#F4F5F7] dark:hover:bg-gray-700',
        )}
      >
        <div className={cn(
          'w-6 h-6 rounded flex items-center justify-center transition-colors',
          isOpen
            ? 'bg-[#0052CC] text-white'
            : 'bg-[#F4F5F7] dark:bg-gray-700 text-[#5E6C84]',
        )}>
          <BarChart3 size={13} />
        </div>
        <span className={cn('text-[12px]', isOpen && 'font-semibold')}>{label}</span>
        <div className={cn(
          'ml-auto flex items-center gap-2',
          isOpen ? 'text-[#0052CC] dark:text-blue-400' : 'text-[#8993A4] dark:text-gray-500',
        )}>
          <span className="text-[10px] font-medium">{countLabel}</span>
          {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </div>
      </button>

      {/* Detail panel */}
      {isOpen && (
        <div className="bg-[#FAFBFC] dark:bg-gray-800/60 border-t border-[#DFE1E6] dark:border-gray-700">
          <div className="grid grid-cols-[260px_1fr] gap-0">
            {/* Left: Project Stats */}
            <div className="border-r border-[#DFE1E6] dark:border-gray-700 p-3 overflow-y-auto max-h-[400px]">
              {stats}
            </div>
            {/* Right: Issue Table */}
            <div className="overflow-x-auto overflow-y-auto max-h-[400px] p-2">
              {table}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
