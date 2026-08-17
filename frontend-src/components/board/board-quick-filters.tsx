'use client';
import { Zap, UserCheck, Clock, Calendar, AlertTriangle } from 'lucide-react';
import type { BoardFilters } from './board-filters';

interface QuickFiltersProps {
  filters: BoardFilters;
  onChange: (filters: BoardFilters) => void;
}

const QUICK_FILTERS = [
  { key: 'onlyMyIssues',    label: 'Only My Issues',   icon: UserCheck }      as const,
  { key: 'recentlyUpdated', label: 'Recently Updated',  icon: Clock }          as const,
  { key: 'dueThisWeek',     label: 'Due This Week',     icon: Calendar }       as const,
  { key: 'highPriority',    label: 'High Priority',     icon: AlertTriangle }  as const,
];

export function BoardQuickFilters({ filters, onChange }: QuickFiltersProps) {
  const activeCount = QUICK_FILTERS.filter(qf => filters[qf.key]).length;

  return (
    <div className="flex items-center gap-2 flex-wrap pb-3 border-b border-[#DFE1E6] dark:border-gray-700 mb-4 flex-shrink-0">
      <Zap size={12} className="text-[#5E6C84] dark:text-gray-400" />
      {QUICK_FILTERS.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange({ ...filters, [key]: !filters[key] })}
          className={`text-xs px-2 py-1 rounded-sm border transition-colors flex items-center gap-1 ${
            filters[key]
              ? 'bg-[#0052CC] text-white border-[#0052CC]'
              : 'border-[#DFE1E6] dark:border-gray-600 text-[#5E6C84] dark:text-gray-400 hover:bg-[#F4F5F7] dark:hover:bg-gray-700'
          }`}
        >
          <Icon size={11} />
          {label}
        </button>
      ))}
      {activeCount > 0 && (
        <button
          type="button"
          onClick={() => onChange({
            ...filters,
            onlyMyIssues: false,
            recentlyUpdated: false,
            dueThisWeek: false,
            highPriority: false,
          })}
          className="text-xs text-[#0052CC] dark:text-blue-400 hover:underline ml-2"
        >
          Clear quick filters
        </button>
      )}
    </div>
  );
}
