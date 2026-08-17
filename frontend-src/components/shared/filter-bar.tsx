'use client';
import { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { JiraProject } from '@/types/jira';
import type { UnifiedFilters } from '@/lib/filter-constants';
import { EMPTY_UNIFIED_FILTERS, ISSUE_TYPES, PRIORITY_OPTIONS } from '@/lib/filter-constants';
import { useSprints, useStatuses, CATEGORY_ORDER, CATEGORY_LABEL } from '@/hooks/use-filter-data';
import { useEpics } from '@/hooks/use-epics';
import { MultiSelectFilter, inputClass, type MultiSelectOption } from './multi-select-filter';
import { UserMultiFilter } from './user-multi-filter';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface FilterBarProps {
  filters: UnifiedFilters;
  onChange: (f: UnifiedFilters) => void;
  /** Hide the search input (e.g. team pages have separate search for members) */
  hideSearch?: boolean;
  /** Period quick-pick buttons — rendered inline at right end of main row */
  period?: {
    options: { key: string; label: string }[];
    active: string | undefined;
    onChange: (key: string | undefined) => void;
  };
  /** Quick filter pills — rendered in a row below the main filter row */
  quickPills?: {
    key: string;
    label: string;
    active: boolean;
    onToggle: () => void;
  }[];
}

// ─── FilterChip ───────────────────────────────────────────────────────────────

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] bg-[#E6F0FF] dark:bg-blue-900/40 text-[#0052CC] dark:text-blue-300 border border-[#0052CC]/20 rounded px-1.5 py-0.5">
      {label}
      <button onClick={onRemove} className="hover:text-red-500 transition-colors">
        <X size={9} />
      </button>
    </span>
  );
}

// ─── FilterBar ────────────────────────────────────────────────────────────────

export function FilterBar({ filters, onChange, hideSearch, period, quickPills }: FilterBarProps) {
  const [textInput, setTextInput] = useState(filters.searchText ?? '');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!filters.searchText) setTextInput('');
  }, [filters.searchText]);

  function handleTextChange(value: string) {
    setTextInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onChange({ ...filters, searchText: value || '' });
    }, 400);
  }

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  // Data fetching
  const { data: projects } = useSWR<JiraProject[]>(
    '/project?maxResults=50',
    (url: string) => api.get<JiraProject[]>(url).then(r => r.data),
  );
  const sprints = useSprints();
  const { statuses, loading: statusesLoading } = useStatuses();
  const epics = useEpics();

  // Build grouped status options sorted by category then name
  const statusOptions: MultiSelectOption[] = statuses
    .slice()
    .sort((a, b) => {
      const catA = CATEGORY_ORDER[a.statusCategory.key] ?? 99;
      const catB = CATEGORY_ORDER[b.statusCategory.key] ?? 99;
      if (catA !== catB) return catA - catB;
      return a.name.localeCompare(b.name);
    })
    .map(s => ({
      value: s.name,
      label: s.name,
      group: CATEGORY_LABEL[s.statusCategory.key] ?? s.statusCategory.name,
    }));

  const sprintOptions: MultiSelectOption[] = sprints.map(s => ({ value: s.name, label: s.name }));

  const hasAnyFilter =
    !!filters.searchText ||
    (filters.projectIn?.length ?? 0) > 0 ||
    (filters.issuetypeIn?.length ?? 0) > 0 ||
    (filters.statusIn?.length ?? 0) > 0 ||
    (filters.priorityIn?.length ?? 0) > 0 ||
    (filters.assigneeIn?.length ?? 0) > 0 ||
    (filters.sprintIn?.length ?? 0) > 0 ||
    (filters.reporterIn?.length ?? 0) > 0 ||
    (filters.epicIn?.length ?? 0) > 0;

  return (
    <div className="mb-4 rounded-sm border border-[#DFE1E6] dark:border-gray-700 bg-[#F4F5F7] dark:bg-gray-800/60 relative z-20">
      {/* ── Row 1: search + 8 multi-select dropdowns + period buttons ────── */}
      <div className="flex items-center gap-2 px-4 py-2.5 flex-wrap">
        {/* Text search */}
        {!hideSearch && (
          <div className="relative flex items-center min-w-[140px] max-w-[220px]">
            <Search size={13} className="absolute left-2 text-[#5E6C84] dark:text-gray-500 pointer-events-none" />
            <input
              type="text"
              value={textInput}
              onChange={e => handleTextChange(e.target.value)}
              placeholder="Search…"
              className={cn(inputClass, 'pl-6 w-full')}
            />
          </div>
        )}

        {/* Project */}
        <MultiSelectFilter
          label="Project"
          options={(projects ?? []).map(p => ({ value: p.key, label: p.name }))}
          selectedValues={filters.projectIn ?? []}
          exclude={filters.projectExclude ?? false}
          onChange={(values, exc) => onChange({
            ...filters,
            projectIn: values.length ? values : undefined,
            projectExclude: exc || undefined,
          })}
        />

        {/* Epic */}
        {(() => {
          const epicOptions = epics.map(e => ({ value: e.key, label: `${e.key} — ${e.summary}` }));
          return (
            <MultiSelectFilter
              label="Epic"
              options={epicOptions}
              selectedValues={filters.epicIn ?? []}
              exclude={filters.epicExclude ?? false}
              onChange={(values, exc) => onChange({
                ...filters,
                epicIn: values.length ? values : undefined,
                epicExclude: exc || undefined,
              })}
            />
          );
        })()}

        {/* Type */}
        <MultiSelectFilter
          label="Type"
          options={ISSUE_TYPES.map(t => ({ value: t.name, label: t.name }))}
          selectedValues={filters.issuetypeIn ?? []}
          exclude={filters.issuetypeExclude ?? false}
          onChange={(values, exc) => onChange({
            ...filters,
            issuetypeIn: values.length ? values : undefined,
            issuetypeExclude: exc || undefined,
          })}
        />

        {/* Status */}
        <MultiSelectFilter
          label="Status"
          options={statusOptions}
          loading={statusesLoading}
          selectedValues={filters.statusIn ?? []}
          exclude={filters.statusExclude ?? false}
          onChange={(values, exc) => onChange({
            ...filters,
            statusIn: values.length ? values : undefined,
            statusExclude: exc || undefined,
          })}
        />

        {/* Priority */}
        <MultiSelectFilter
          label="Priority"
          options={PRIORITY_OPTIONS.map(p => ({ value: p.name, label: p.name }))}
          selectedValues={filters.priorityIn ?? []}
          exclude={filters.priorityExclude ?? false}
          onChange={(values, exc) => onChange({
            ...filters,
            priorityIn: values.length ? values : undefined,
            priorityExclude: exc || undefined,
          })}
        />

        {/* Assignee */}
        <UserMultiFilter
          label="Assignee"
          selectedValues={filters.assigneeIn ?? []}
          exclude={filters.assigneeExclude ?? false}
          onChange={(values, exc) => onChange({
            ...filters,
            assigneeIn: values.length ? values : undefined,
            assigneeExclude: exc || undefined,
          })}
        />

        {/* Sprint */}
        <MultiSelectFilter
          label="Sprint"
          options={sprintOptions}
          selectedValues={filters.sprintIn ?? []}
          exclude={filters.sprintExclude ?? false}
          onChange={(values, exc) => onChange({
            ...filters,
            sprintIn: values.length ? values : undefined,
            sprintExclude: exc || undefined,
          })}
        />

        {/* Reporter */}
        <UserMultiFilter
          label="Reporter"
          selectedValues={filters.reporterIn ?? []}
          exclude={filters.reporterExclude ?? false}
          onChange={(values, exc) => onChange({
            ...filters,
            reporterIn: values.length ? values : undefined,
            reporterExclude: exc || undefined,
          })}
        />

        {/* Period quick-pick buttons (inline, right-aligned) */}
        {period && (
          <div className="flex items-center gap-1 ml-auto">
            {/* Current/Old toggle */}
            <div className="flex items-center rounded border border-[#DFE1E6] dark:border-gray-600 overflow-hidden shrink-0 mr-0.5">
              <button
                type="button"
                onClick={() => onChange({ ...filters, dateRangeMode: 'current' })}
                className={cn(
                  'text-[10px] px-2 py-1 font-medium transition-colors border-r border-[#DFE1E6] dark:border-gray-600',
                  (filters.dateRangeMode ?? 'current') === 'current'
                    ? 'bg-[#0052CC] text-white'
                    : 'bg-white dark:bg-gray-800 text-[#5E6C84] dark:text-gray-400 hover:bg-[#F4F5F7] dark:hover:bg-gray-700',
                )}
              >
                Current
              </button>
              <button
                type="button"
                onClick={() => onChange({ ...filters, dateRangeMode: 'old' })}
                className={cn(
                  'text-[10px] px-2 py-1 font-medium transition-colors',
                  filters.dateRangeMode === 'old'
                    ? 'bg-[#0052CC] text-white'
                    : 'bg-white dark:bg-gray-800 text-[#5E6C84] dark:text-gray-400 hover:bg-[#F4F5F7] dark:hover:bg-gray-700',
                )}
              >
                Old
              </button>
            </div>
            {/* Period buttons */}
            <div className="flex items-center rounded border border-[#DFE1E6] dark:border-gray-600 overflow-hidden">
              {period.options.map((po, i) => (
                <button
                  key={po.key}
                  onClick={() => period.onChange(period.active === po.key ? undefined : po.key)}
                  className={cn(
                    'text-xs px-2.5 py-1.5 font-medium transition-colors',
                    period.active === po.key
                      ? 'bg-[#0052CC] text-white'
                      : 'bg-white dark:bg-gray-800 text-[#5E6C84] dark:text-gray-400 hover:bg-[#F4F5F7] dark:hover:bg-gray-700',
                    i < period.options.length - 1 && 'border-r border-[#DFE1E6] dark:border-gray-600',
                  )}
                >
                  {po.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Row 2: Quick filter pills (always visible) ────────────────────── */}
      {quickPills && quickPills.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 border-t border-[#DFE1E6] dark:border-gray-700 flex-wrap">
          {quickPills.map(qp => (
            <button
              key={qp.key}
              onClick={qp.onToggle}
              className={cn(
                'text-xs px-2.5 py-1.5 rounded-full border transition-colors font-medium',
                qp.active
                  ? 'bg-[#0052CC] text-white border-[#0052CC]'
                  : 'border-[#DFE1E6] dark:border-gray-600 text-[#5E6C84] dark:text-gray-400 hover:bg-white dark:hover:bg-gray-700',
              )}
            >
              {qp.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Row 3: Active filter chips ───────────────────────────────────── */}
      {hasAnyFilter && (
        <div className="flex items-center gap-1.5 px-4 py-2 border-t border-[#DFE1E6] dark:border-gray-700 flex-wrap">
          {filters.searchText && (
            <FilterChip label={`Text: "${filters.searchText}"`} onRemove={() => onChange({ ...filters, searchText: '' })} />
          )}
          {filters.projectIn?.map(p => (
            <FilterChip key={`p-${p}`} label={`Project ${filters.projectExclude ? '≠' : '='} ${projects?.find(pr => pr.key === p)?.name ?? p}`} onRemove={() => {
              const next = filters.projectIn?.filter(v => v !== p);
              onChange({ ...filters, projectIn: next?.length ? next : undefined, projectExclude: undefined });
            }} />
          ))}
          {filters.issuetypeIn?.map(t => (
            <FilterChip key={`t-${t}`} label={`Type ${filters.issuetypeExclude ? '≠' : '='} ${t}`} onRemove={() => {
              const next = filters.issuetypeIn?.filter(v => v !== t);
              onChange({ ...filters, issuetypeIn: next?.length ? next : undefined, issuetypeExclude: undefined });
            }} />
          ))}
          {filters.statusIn?.map(s => (
            <FilterChip key={`s-${s}`} label={`Status ${filters.statusExclude ? '≠' : '='} ${s}`} onRemove={() => {
              const next = filters.statusIn?.filter(v => v !== s);
              onChange({ ...filters, statusIn: next?.length ? next : undefined, statusExclude: undefined });
            }} />
          ))}
          {filters.priorityIn?.map(p => (
            <FilterChip key={`pr-${p}`} label={`Priority ${filters.priorityExclude ? '≠' : '='} ${p}`} onRemove={() => {
              const next = filters.priorityIn?.filter(v => v !== p);
              onChange({ ...filters, priorityIn: next?.length ? next : undefined, priorityExclude: undefined });
            }} />
          ))}
          {filters.assigneeIn?.map(a => (
            <FilterChip key={`a-${a}`} label={`Assignee ${filters.assigneeExclude ? '≠' : '='} ${a === 'currentUser()' ? 'Me' : a === 'EMPTY' ? 'Unassigned' : a}`} onRemove={() => {
              const next = filters.assigneeIn?.filter(v => v !== a);
              onChange({ ...filters, assigneeIn: next?.length ? next : undefined, assigneeExclude: undefined });
            }} />
          ))}
          {filters.sprintIn?.map(s => (
            <FilterChip key={`sp-${s}`} label={`Sprint ${filters.sprintExclude ? '≠' : '='} ${s}`} onRemove={() => {
              const next = filters.sprintIn?.filter(v => v !== s);
              onChange({ ...filters, sprintIn: next?.length ? next : undefined, sprintExclude: undefined });
            }} />
          ))}
          {filters.reporterIn?.map(r => (
            <FilterChip key={`r-${r}`} label={`Reporter ${filters.reporterExclude ? '≠' : '='} ${r === 'currentUser()' ? 'Me' : r}`} onRemove={() => {
              const next = filters.reporterIn?.filter(v => v !== r);
              onChange({ ...filters, reporterIn: next?.length ? next : undefined, reporterExclude: undefined });
            }} />
          ))}
          {filters.epicIn?.map(e => (
            <FilterChip key={`e-${e}`} label={`Epic ${filters.epicExclude ? '≠' : '='} ${e}`} onRemove={() => {
              const next = filters.epicIn?.filter(v => v !== e);
              onChange({ ...filters, epicIn: next?.length ? next : undefined, epicExclude: undefined });
            }} />
          ))}
          <button
            onClick={() => onChange(EMPTY_UNIFIED_FILTERS)}
            className="text-[11px] text-[#0052CC] dark:text-blue-400 hover:underline ml-1"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
