'use client';

import { useMemo, useRef, useEffect, useState } from 'react';
import { ChevronDown, Calendar, Users, FolderKanban } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProjects } from '@/hooks/use-projects';
import { DEFAULT_GROUPS } from '@/lib/team-constants';

// ─── Types ────────────────────────────────────────────────────────────────

export interface DashboardFiltersState {
  team: string;
  period: 'today' | 'week' | 'month' | 'custom';
  project: string;
  dateFrom: string;
  dateTo: string;
}

interface DashboardFiltersProps {
  filters: DashboardFiltersState;
  onChange: (filters: DashboardFiltersState) => void;
}

const PERIOD_OPTIONS: { value: DashboardFiltersState['period']; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'custom', label: 'Custom' },
];

export const DEFAULT_FILTERS: DashboardFiltersState = {
  team: '',
  period: 'week',
  project: '',
  dateFrom: '',
  dateTo: '',
};

// ─── Dropdown helper ──────────────────────────────────────────────────────

function useDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler, true);
    return () => document.removeEventListener('mousedown', handler, true);
  }, [open]);
  return { open, setOpen, ref };
}

// ─── Component ────────────────────────────────────────────────────────────

export function DashboardFilters({ filters, onChange }: DashboardFiltersProps) {
  return (
    <div className="flex items-center gap-1.5">
      <TeamDropdown filters={filters} onChange={onChange} />
      <PeriodDropdown filters={filters} onChange={onChange} />
      <ProjectDropdown filters={filters} onChange={onChange} />
    </div>
  );
}

// ─── Team Dropdown ────────────────────────────────────────────────────────

function TeamDropdown({ filters, onChange }: DashboardFiltersProps) {
  const { open, setOpen, ref } = useDropdown();
  const options = useMemo(() => [
    { value: '', label: 'My Issues' },
    ...DEFAULT_GROUPS.map(g => ({ value: g.id, label: g.name })),
  ], []);

  const current = options.find(o => o.value === filters.team) ?? options[0];

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded transition-colors text-[#5E6C84] dark:text-gray-400 hover:bg-[#F4F5F7] dark:hover:bg-gray-800"
      >
        <Users size={12} />
        <span className="max-w-[80px] truncate">{current.label}</span>
        <ChevronDown size={10} className={cn(open && 'rotate-180', 'transition-transform')} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 w-44 bg-white dark:bg-gray-900 border border-[#DFE1E6] dark:border-gray-700 rounded-lg shadow-lg z-50 overflow-hidden">
          {options.map(opt => (
            <button key={opt.value}
              onClick={() => { onChange({ ...filters, team: opt.value }); setOpen(false); }}
              className={cn('w-full text-left px-3 py-2 text-[11px] transition-colors',
                filters.team === opt.value
                  ? 'text-[#0052CC] dark:text-blue-400 font-semibold bg-[#DEEBFF] dark:bg-blue-900/20'
                  : 'text-[#172B4D] dark:text-gray-200 hover:bg-[#F4F5F7] dark:hover:bg-gray-800'
              )}>{opt.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Period Dropdown ──────────────────────────────────────────────────────

function PeriodDropdown({ filters, onChange }: DashboardFiltersProps) {
  const { open, setOpen, ref } = useDropdown();
  const [customOpen, setCustomOpen] = useState(false);

  const current = PERIOD_OPTIONS.find(o => o.value === filters.period) ?? PERIOD_OPTIONS[1];

  const handlePeriodSelect = (value: DashboardFiltersState['period']) => {
    if (value === 'custom') {
      setCustomOpen(true);
      return;
    }
    const now = new Date();
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    let dateFrom = '';
    let dateTo = fmt(now);

    if (value === 'today') {
      dateFrom = fmt(now);
    } else if (value === 'week') {
      const monday = new Date(now);
      monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      dateFrom = fmt(monday);
    } else if (value === 'month') {
      dateFrom = fmt(new Date(now.getFullYear(), now.getMonth(), 1));
    }

    onChange({ ...filters, period: value, dateFrom, dateTo });
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded transition-colors text-[#5E6C84] dark:text-gray-400 hover:bg-[#F4F5F7] dark:hover:bg-gray-800"
      >
        <Calendar size={12} />
        <span>{current.label}</span>
        <ChevronDown size={10} className={cn(open && 'rotate-180', 'transition-transform')} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 w-40 bg-white dark:bg-gray-900 border border-[#DFE1E6] dark:border-gray-700 rounded-lg shadow-lg z-50 overflow-hidden">
          {PERIOD_OPTIONS.map(opt => (
            <button key={opt.value}
              onClick={() => handlePeriodSelect(opt.value)}
              className={cn('w-full text-left px-3 py-2 text-[11px] transition-colors',
                filters.period === opt.value
                  ? 'text-[#0052CC] dark:text-blue-400 font-semibold bg-[#DEEBFF] dark:bg-blue-900/20'
                  : 'text-[#172B4D] dark:text-gray-200 hover:bg-[#F4F5F7] dark:hover:bg-gray-800'
              )}>{opt.label}</button>
          ))}
          {customOpen && (
            <div className="px-3 py-2 border-t border-[#DFE1E6] dark:border-gray-700 space-y-1.5">
              <input type="date" value={filters.dateFrom}
                onChange={e => onChange({ ...filters, dateFrom: e.target.value })}
                className="w-full text-[10px] px-1.5 py-1 border border-[#DFE1E6] dark:border-gray-700 rounded bg-transparent"
              />
              <input type="date" value={filters.dateTo}
                onChange={e => onChange({ ...filters, dateTo: e.target.value })}
                className="w-full text-[10px] px-1.5 py-1 border border-[#DFE1E6] dark:border-gray-700 rounded bg-transparent"
              />
              <button
                onClick={() => { onChange({ ...filters, period: 'custom' }); setOpen(false); setCustomOpen(false); }}
                className="w-full text-[10px] font-medium text-white bg-[#0052CC] rounded py-1 hover:bg-[#0065FF]"
              >Apply</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Project Dropdown ─────────────────────────────────────────────────────

function ProjectDropdown({ filters, onChange }: DashboardFiltersProps) {
  const { open, setOpen, ref } = useDropdown();
  const { projects } = useProjects();

  const current = filters.project
    ? projects?.find(p => p.key === filters.project)
    : null;

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded transition-colors text-[#5E6C84] dark:text-gray-400 hover:bg-[#F4F5F7] dark:hover:bg-gray-800"
      >
        <FolderKanban size={12} />
        <span className="max-w-[80px] truncate">{current?.name ?? 'All Projects'}</span>
        {filters.project && (
          <span onClick={e => { e.stopPropagation(); onChange({ ...filters, project: '' }); }}
            className="ml-0.5 text-[#8993A4] hover:text-[#DE350B] cursor-pointer" role="button" tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onChange({ ...filters, project: '' }); } }}>
            ✕
          </span>
        )}
        <ChevronDown size={10} className={cn(open && 'rotate-180', 'transition-transform')} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 w-52 bg-white dark:bg-gray-900 border border-[#DFE1E6] dark:border-gray-700 rounded-lg shadow-lg z-50 overflow-hidden max-h-60 overflow-y-auto">
          <button onClick={() => { onChange({ ...filters, project: '' }); setOpen(false); }}
            className={cn('w-full text-left px-3 py-2 text-[11px] transition-colors',
              !filters.project
                ? 'text-[#0052CC] dark:text-blue-400 font-semibold bg-[#DEEBFF] dark:bg-blue-900/20'
                : 'text-[#172B4D] dark:text-gray-200 hover:bg-[#F4F5F7] dark:hover:bg-gray-800'
            )}>All Projects</button>
          {(projects ?? []).map(p => (
            <button key={p.key} onClick={() => { onChange({ ...filters, project: p.key }); setOpen(false); }}
              className={cn('w-full text-left px-3 py-2 text-[11px] transition-colors',
                filters.project === p.key
                  ? 'text-[#0052CC] dark:text-blue-400 font-semibold bg-[#DEEBFF] dark:bg-blue-900/20'
                  : 'text-[#172B4D] dark:text-gray-200 hover:bg-[#F4F5F7] dark:hover:bg-gray-800'
              )}>{p.name} ({p.key})</button>
          ))}
        </div>
      )}
    </div>
  );
}
