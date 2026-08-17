'use client';
import { UserSearchInput } from '@/components/issues/user-search-input';

export interface WorklogFiltersType {
  username: string;
  dateFrom: string;
  dateTo: string;
  period: 'week' | 'month' | 'year' | 'custom';
  project: string;
}

interface WorklogFiltersProps {
  filters: WorklogFiltersType;
  onChange: (f: WorklogFiltersType) => void;
}

export function WorklogFilters({ filters, onChange }: WorklogFiltersProps) {
  return (
    <div className="flex items-center gap-3 flex-wrap flex-shrink-0 pb-3 border-b border-[#DFE1E6] dark:border-gray-700">
      <select
        className="text-xs border border-[#DFE1E6] dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-800 text-[#172B4D] dark:text-gray-100 focus:outline-none focus:border-[#0052CC]"
        value={filters.period}
        onChange={(e) => onChange({ ...filters, period: e.target.value as WorklogFiltersType['period'] })}
      >
        <option value="week">This Week</option>
        <option value="month">This Month</option>
        <option value="year">This Year</option>
        <option value="custom">Custom</option>
      </select>

      {filters.period === 'custom' && (
        <>
          <input type="date"
            className="text-xs border border-[#DFE1E6] dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-800 text-[#172B4D] dark:text-gray-100 focus:outline-none focus:border-[#0052CC]"
            value={filters.dateFrom} onChange={(e) => onChange({ ...filters, dateFrom: e.target.value })} />
          <span className="text-xs text-[#5E6C84]">to</span>
          <input type="date"
            className="text-xs border border-[#DFE1E6] dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-800 text-[#172B4D] dark:text-gray-100 focus:outline-none focus:border-[#0052CC]"
            value={filters.dateTo} onChange={(e) => onChange({ ...filters, dateTo: e.target.value })} />
        </>
      )}

      <div className="w-52">
        <UserSearchInput
          value={filters.username || undefined}
          onChange={(username) => onChange({ ...filters, username: username ?? '' })}
          placeholder="Filter by user..."
          includeUnassigned={false}
        />
      </div>
    </div>
  );
}
