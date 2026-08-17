'use client';

import { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { Search, ChevronDown, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { JiraProject, WorklogEntry } from '@/types/jira';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WorklogFilterBarFilters {
  searchText: string;
  projectIn?: string[];
  projectExclude?: boolean;
  issuetypeIn?: string[];
  issuetypeExclude?: boolean;
  statusIn?: string[];
  statusExclude?: boolean;
  priorityIn?: string[];
  priorityExclude?: boolean;
  assigneeIn?: string[];
  assigneeExclude?: boolean;
  sprintIn?: string[];
  reporterIn?: string[];
  groupBy?: 'Project' | 'Type' | 'Assignee' | 'Status' | 'None';
  period?: 'today' | 'week' | 'month' | 'year';
  dateRangeMode?: 'current' | 'old';
  onlyMyIssues?: boolean;
  recentlyUpdated?: boolean;
  dueThisWeek?: boolean;
  highPriority?: boolean;
}

export const EMPTY_WORKLOG_FILTERS: WorklogFilterBarFilters = {
  searchText: '',
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface WorklogFilterBarProps {
  filters: WorklogFilterBarFilters;
  onChange: (f: WorklogFilterBarFilters) => void;
  hideGroupBy?: boolean;
}

// ─── Style constants ──────────────────────────────────────────────────────────

const inputClass =
  'text-xs border border-[#DFE1E6] dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-800 text-[#172B4D] dark:text-gray-100 focus:outline-none focus:border-[#0052CC] dark:focus:border-blue-400 placeholder-[#5E6C84] dark:placeholder-gray-500';

const btnBaseClass =
  'flex items-center gap-1 text-xs px-2.5 py-1.5 border rounded whitespace-nowrap transition-colors min-w-[100px] max-w-[180px]';

const btnIdleClass =
  'bg-white dark:bg-gray-800 border-[#DFE1E6] dark:border-gray-600 text-[#5E6C84] dark:text-gray-400 hover:border-[#0052CC] hover:text-[#0052CC]';

const btnActiveClass =
  'bg-[#E6F0FF] dark:bg-blue-900/30 border-[#0052CC]/40 dark:border-blue-600/40 text-[#0052CC] dark:text-blue-300';

// ─── MultiSelectFilter ────────────────────────────────────────────────────────

interface MultiSelectOption {
  value: string;
  label: string;
  group?: string;
}

interface MultiSelectFilterProps {
  label: string;
  options: MultiSelectOption[];
  selectedValues: string[];
  exclude: boolean;
  onChange: (values: string[], exclude: boolean) => void;
  loading?: boolean;
}

function MultiSelectFilter({ label, options, selectedValues, exclude, onChange, loading }: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const hasSelection = selectedValues.length > 0;

  let btnLabel: string;
  if (!hasSelection) {
    btnLabel = label;
  } else if (selectedValues.length === 1) {
    const opt = options.find(o => o.value === selectedValues[0]);
    btnLabel = (exclude ? '≠ ' : '') + (opt?.label ?? selectedValues[0]);
  } else {
    btnLabel = (exclude ? 'NOT ' : '') + `${selectedValues.length} selected`;
  }

  function toggleValue(value: string) {
    const next = selectedValues.includes(value)
      ? selectedValues.filter(v => v !== value)
      : [...selectedValues, value];
    onChange(next, exclude);
  }

  function toggleExclude() { onChange(selectedValues, !exclude); }
  function clearAll() { onChange([], false); setOpen(false); }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(p => !p)}
        className={cn(
          btnBaseClass,
          hasSelection ? (exclude ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-400 dark:border-orange-500 text-orange-700 dark:text-orange-300' : btnActiveClass) : btnIdleClass,
        )}
      >
        <span className="flex-1 text-left truncate">{btnLabel}</span>
        <ChevronDown size={10} className="flex-shrink-0 opacity-60" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 bg-white dark:bg-gray-800 border border-[#DFE1E6] dark:border-gray-700 rounded shadow-lg z-30 min-w-[200px]">
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#DFE1E6] dark:border-gray-700">
            <span className="text-[11px] font-semibold text-[#172B4D] dark:text-gray-100">{label}</span>
            <button
              onClick={toggleExclude}
              disabled={!hasSelection}
              className={cn(
                'flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border transition-colors disabled:opacity-40',
                exclude ? 'bg-orange-100 dark:bg-orange-900/30 border-orange-400 text-orange-700 dark:text-orange-300' : 'bg-white dark:bg-gray-700 border-[#DFE1E6] dark:border-gray-600 text-[#5E6C84] dark:text-gray-400 hover:border-orange-400 hover:text-orange-600',
              )}
            >
              {exclude ? '≠ Exclude' : '= Include'}
            </button>
          </div>
          <div className="py-1 max-h-64 overflow-y-auto">
            {loading ? (
              <div className="px-3 py-3 text-xs text-[#5E6C84] dark:text-gray-400 text-center">Loading…</div>
            ) : options.length === 0 ? (
              <div className="px-3 py-3 text-xs text-[#5E6C84] dark:text-gray-400 text-center">No options</div>
            ) : (() => {
              let lastGroup: string | undefined;
              return options.map(opt => {
                const checked = selectedValues.includes(opt.value);
                const showGroupHeader = opt.group !== undefined && opt.group !== lastGroup;
                lastGroup = opt.group;
                return (
                  <div key={opt.value}>
                    {showGroupHeader && (
                      <div className="px-3 pt-2 pb-0.5 text-[10px] font-semibold text-[#5E6C84] dark:text-gray-500 uppercase tracking-wide border-t border-[#DFE1E6] dark:border-gray-700 first:border-t-0 mt-1 first:mt-0">
                        {opt.group}
                      </div>
                    )}
                    <button
                      onClick={() => toggleValue(opt.value)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#F4F5F7] dark:hover:bg-gray-700 transition-colors text-left"
                    >
                      <div className={cn(
                        'w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0',
                        checked ? (exclude ? 'bg-orange-500 border-orange-500' : 'bg-[#0052CC] border-[#0052CC]') : 'border-[#DFE1E6] dark:border-gray-500',
                      )}>
                        {checked && <Check size={9} className="text-white" />}
                      </div>
                      <span className="text-xs text-[#172B4D] dark:text-gray-200">{opt.label}</span>
                    </button>
                  </div>
                );
              });
            })()}
          </div>
          {hasSelection && (
            <div className="border-t border-[#DFE1E6] dark:border-gray-700 px-3 py-2">
              <button onClick={clearAll} className="text-[11px] text-[#5E6C84] dark:text-gray-400 hover:text-red-500 transition-colors">
                Clear
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── UserMultiFilter ──────────────────────────────────────────────────────────

const USER_PRESETS = [
  { value: 'currentUser()', label: 'Me' },
  { value: 'EMPTY', label: 'Unassigned' },
];

interface UserSuggestion {
  name: string;
  displayName: string;
}

function UserMultiFilter({ label, selectedValues, onChange }: { label: string; selectedValues: string[]; onChange: (values: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (searchText.trim().length < 1) { setSuggestions([]); return; }
    setSuggestionsLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await api.get<UserSuggestion[]>('/user/search', { params: { username: searchText.trim(), maxResults: 8 } });
        setSuggestions(Array.isArray(r.data) ? r.data : []);
      } catch { setSuggestions([]); }
      finally { setSuggestionsLoading(false); }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchText]);

  const hasSelection = selectedValues.length > 0;
  const customUsers = selectedValues.filter(v => !USER_PRESETS.find(p => p.value === v));

  const btnLabel = !hasSelection ? label
    : selectedValues.length === 1
      ? USER_PRESETS.find(p => p.value === selectedValues[0])?.label ?? selectedValues[0]
      : `${selectedValues.length} selected`;

  function toggleValue(value: string) {
    const next = selectedValues.includes(value)
      ? selectedValues.filter(v => v !== value)
      : [...selectedValues, value];
    onChange(next);
  }

  function selectSuggestion(user: UserSuggestion) {
    if (selectedValues.includes(user.name)) return;
    onChange([...selectedValues, user.name]);
    setSearchText(''); setSuggestions([]);
    inputRef.current?.focus();
  }

  function addSearch() {
    const v = searchText.trim();
    if (!v || selectedValues.includes(v)) { setSearchText(''); return; }
    onChange([...selectedValues, v]);
    setSearchText(''); setSuggestions([]);
    inputRef.current?.focus();
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(p => !p)} className={cn(btnBaseClass, hasSelection ? btnActiveClass : btnIdleClass)}>
        <span className="flex-1 text-left truncate">{btnLabel}</span>
        <ChevronDown size={10} className="flex-shrink-0 opacity-60" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 bg-white dark:bg-gray-800 border border-[#DFE1E6] dark:border-gray-700 rounded shadow-lg z-30 min-w-[220px]">
          <div className="px-3 py-2 border-b border-[#DFE1E6] dark:border-gray-700">
            <span className="text-[11px] font-semibold text-[#172B4D] dark:text-gray-100">{label}</span>
          </div>
          <div className="py-1">
            {USER_PRESETS.map(preset => {
              const checked = selectedValues.includes(preset.value);
              return (
                <button key={preset.value} onClick={() => toggleValue(preset.value)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#F4F5F7] dark:hover:bg-gray-700 transition-colors text-left">
                  <div className={cn('w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0',
                    checked ? 'bg-[#0052CC] border-[#0052CC]' : 'border-[#DFE1E6] dark:border-gray-500')}>
                    {checked && <Check size={9} className="text-white" />}
                  </div>
                  <span className="text-xs text-[#172B4D] dark:text-gray-200">{preset.label}</span>
                </button>
              );
            })}
          </div>
          <div className="px-3 py-2 border-t border-[#DFE1E6] dark:border-gray-700">
            <div className="flex items-center gap-1">
              <input ref={inputRef} type="text" value={searchText}
                onChange={e => setSearchText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addSearch(); }}
                placeholder="Search user…" className={cn(inputClass, 'flex-1 py-1')} />
              <button onClick={addSearch} disabled={!searchText.trim()}
                className="text-xs px-2 py-1 bg-[#0052CC] text-white rounded hover:bg-[#0747A6] disabled:opacity-40 transition-colors">+</button>
            </div>
            {searchText.trim().length > 0 && (
              <div className="mt-1 border border-[#DFE1E6] dark:border-gray-600 rounded max-h-40 overflow-y-auto">
                {suggestionsLoading ? (
                  <div className="px-3 py-2 text-[10px] text-[#5E6C84] dark:text-gray-400 text-center">Searching…</div>
                ) : suggestions.length === 0 ? (
                  <div className="px-3 py-2 text-[10px] text-[#5E6C84] dark:text-gray-400 text-center">No users found</div>
                ) : suggestions.map(u => {
                  const alreadySelected = selectedValues.includes(u.name);
                  return (
                    <button key={u.name} onClick={() => selectSuggestion(u)} disabled={alreadySelected}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-[#F4F5F7] dark:hover:bg-gray-700 text-[#172B4D] dark:text-gray-200 flex items-center justify-between disabled:opacity-40">
                      <span>{u.displayName}</span>
                      <span className="text-[10px] text-[#5E6C84] dark:text-gray-500">{u.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {customUsers.length > 0 && (
            <div className="px-3 py-2 border-t border-[#DFE1E6] dark:border-gray-700 flex flex-wrap gap-1">
              {customUsers.map(v => (
                <span key={v} className="inline-flex items-center gap-1 text-[10px] bg-[#E6F0FF] dark:bg-blue-900/30 text-[#0052CC] dark:text-blue-300 border border-[#0052CC]/20 rounded px-1.5 py-0.5">
                  {v}
                  <button onClick={() => toggleValue(v)} className="hover:text-red-500 transition-colors"><X size={8} /></button>
                </span>
              ))}
            </div>
          )}
          {hasSelection && (
            <div className="border-t border-[#DFE1E6] dark:border-gray-700 px-3 py-2">
              <button onClick={() => { onChange([]); setOpen(false); }} className="text-[11px] text-[#5E6C84] dark:text-gray-400 hover:text-red-500 transition-colors">Clear</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
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

// ─── Static option lists ──────────────────────────────────────────────────────

const ISSUE_TYPES = [
  { id: '10100', name: 'Task' },
  { id: '10101', name: 'Sub-task' },
  { id: '10001', name: 'Story' },
  { id: '10000', name: 'Epic' },
  { id: '10102', name: 'Bug' },
  { id: '10203', name: 'Support' },
  { id: '10400', name: 'Enhancement' },
  { id: '10500', name: 'Improvement' },
  { id: '10501', name: 'New Feature' },
  { id: '10201', name: 'Build Release' },
  { id: '10202', name: 'Bug after release' },
  { id: '10200', name: 'WBS' },
];

const PRIORITY_OPTIONS = [
  { id: '1', name: 'Highest' },
  { id: '2', name: 'High' },
  { id: '3', name: 'Medium' },
  { id: '4', name: 'Low' },
  { id: '5', name: 'Lowest' },
  { id: '10000', name: 'Blocker' },
  { id: '10001', name: 'Minor' },
];

// ─── Data hooks ───────────────────────────────────────────────────────────────

function useSprints() {
  const { data: boards } = useSWR<{ values: { id: number }[] }>(
    '/agile/board?maxResults=50',
    (url: string) => api.get<{ values: { id: number }[] }>(url).then(r => r.data),
  );

  const { data: sprints } = useSWR<{ values: { id: number; name: string }[] }>(
    boards ? 'sprints' : null,
    async () => {
      if (!boards?.values?.length) return { values: [] };
      const results = await Promise.all(
        boards.values.map(b =>
          api.get<{ values: { id: number; name: string }[] }>(
            `/agile/board/${b.id}/sprint?state=active,future`,
          ).then(r => r.data.values).catch(() => [] as { id: number; name: string }[]),
        ),
      );
      const seen = new Set<string>();
      const unique: { id: number; name: string }[] = [];
      results.flat().forEach(s => {
        if (!seen.has(s.name)) { seen.add(s.name); unique.push(s); }
      });
      unique.sort((a, b) => a.name.localeCompare(b.name));
      return { values: unique };
    },
  );

  return sprints?.values ?? [];
}

interface JiraStatusRaw {
  id: string;
  name: string;
  statusCategory: { key: string; name: string; colorName: string };
}

const CATEGORY_ORDER: Record<string, number> = { new: 0, indeterminate: 1, done: 2 };
const CATEGORY_LABEL: Record<string, string> = { new: 'To Do', indeterminate: 'In Progress', done: 'Done' };

function useStatuses() {
  const { data, isLoading } = useSWR<JiraStatusRaw[]>(
    '/status',
    (url: string) =>
      api.get<JiraStatusRaw[]>(url)
        .then(r => Array.isArray(r.data) ? r.data : [])
        .catch(() => []),
  );
  return { statuses: data ?? [], loading: isLoading && !data };
}

export function WorklogFilterBar({
  filters,
  onChange,
  hideGroupBy,
}: WorklogFilterBarProps) {
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
    (!hideGroupBy && !!filters.groupBy);

  return (
    <div className="mb-4 rounded-sm border border-[#DFE1E6] dark:border-gray-700 bg-[#F4F5F7] dark:bg-gray-800/60 relative z-20">
      {/* ── Main filter row ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2.5 flex-wrap">
        {/* Text search */}
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

        {/* Project */}
        <MultiSelectFilter
          label="Project"
          options={(projects ?? []).map(p => ({ value: p.key, label: p.name }))}
          selectedValues={filters.projectIn ?? []}
          exclude={false}
          onChange={(values) => onChange({ ...filters, projectIn: values.length ? values : undefined })}
        />

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
          onChange={values => onChange({ ...filters, assigneeIn: values.length ? values : undefined })}
        />

        {/* Sprint */}
        <MultiSelectFilter
          label="Sprint"
          options={sprintOptions}
          selectedValues={filters.sprintIn ?? []}
          exclude={false}
          onChange={(values) => onChange({ ...filters, sprintIn: values.length ? values : undefined })}
        />

        {/* Reporter */}
        <UserMultiFilter
          label="Reporter"
          selectedValues={filters.reporterIn ?? []}
          onChange={values => onChange({ ...filters, reporterIn: values.length ? values : undefined })}
        />

        {/* Period (started date) */}
      </div>

      {/* ── Group-by buttons (board-style) ──────────────────────── */}
      {!hideGroupBy && (
      <div className="px-4 py-2 border-t border-[#DFE1E6] dark:border-gray-700">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-[#5E6C84] dark:text-gray-400 w-16">Group by</span>
          {(['None', 'Project', 'Type', 'Assignee', 'Status'] as const).map((g) => (
            <button key={g}
              onClick={() => onChange({
                ...filters,
                groupBy: g === 'None' ? undefined : g,
              })}
              className={cn(
                'text-xs px-2 py-0.5 rounded border transition-colors',
                (filters.groupBy ?? 'None') === g
                  ? 'bg-[#0052CC] text-white border-[#0052CC]'
                  : 'border-[#DFE1E6] dark:border-gray-600 text-[#5E6C84] dark:text-gray-400 hover:bg-white dark:hover:bg-gray-700',
              )}
            >
              {g}
            </button>
          ))}
        </div>
      </div>
      )}

      {/* ── Active filter chips row ─────────────────────────────────────────── */}
      {hasAnyFilter && (
        <div className="flex items-center gap-1.5 px-4 py-2 border-t border-[#DFE1E6] dark:border-gray-700 flex-wrap">
          {filters.searchText && (
            <FilterChip label={`Text: "${filters.searchText}"`} onRemove={() => onChange({ ...filters, searchText: '' })} />
          )}
          {filters.projectIn?.map(p => (
            <FilterChip key={`p-${p}`} label={`Project: ${projects?.find(pr => pr.key === p)?.name ?? p}`} onRemove={() => onChange({ ...filters, projectIn: filters.projectIn?.filter(v => v !== p) })} />
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
            <FilterChip key={`a-${a}`} label={`Assignee: ${a === 'currentUser()' ? 'Me' : a === 'EMPTY' ? 'Unassigned' : a}`} onRemove={() => {
              const next = filters.assigneeIn?.filter(v => v !== a);
              onChange({ ...filters, assigneeIn: next?.length ? next : undefined });
            }} />
          ))}
          {filters.sprintIn?.map(s => (
            <FilterChip key={`sp-${s}`} label={`Sprint: ${s}`} onRemove={() => {
              const next = filters.sprintIn?.filter(v => v !== s);
              onChange({ ...filters, sprintIn: next?.length ? next : undefined });
            }} />
          ))}
          {filters.reporterIn?.map(r => (
            <FilterChip key={`r-${r}`} label={`Reporter: ${r === 'currentUser()' ? 'Me' : r}`} onRemove={() => {
              const next = filters.reporterIn?.filter(v => v !== r);
              onChange({ ...filters, reporterIn: next?.length ? next : undefined });
            }} />
          ))}
          {!hideGroupBy && filters.groupBy && (
            <FilterChip label={`Group by: ${filters.groupBy}`} onRemove={() => onChange({ ...filters, groupBy: undefined })} />
          )}
          <button
            onClick={() => onChange(EMPTY_WORKLOG_FILTERS)}
            className="text-[11px] text-[#0052CC] dark:text-blue-400 hover:underline ml-1"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}

// ─── applyWorklogFilters ──────────────────────────────────────────────────────

/** Compute start of current week (Monday 00:00) */
function getWeekStart(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.getFullYear(), now.getMonth(), diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/** Compute end of current week (Sunday 23:59:59.999) */
function getWeekEnd(): Date {
  const monday = getWeekStart();
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return sunday;
}

/** Apply client-side filters to worklog entries. */
export function applyWorklogFilters(
  entries: WorklogEntry[],
  filters: WorklogFilterBarFilters,
  currentUsername?: string,
  selectedMembers?: string[],
): WorklogEntry[] {
  const now = new Date();
  const weekStart = getWeekStart().getTime();
  const weekEnd = getWeekEnd().getTime();

  return entries.filter((entry) => {
    // ── Search text (issueKey + issueSummary) ────────────────────────────
    if (filters.searchText) {
      const q = filters.searchText.toLowerCase();
      if (
        !entry.issueKey.toLowerCase().includes(q) &&
        !entry.issueSummary.toLowerCase().includes(q)
      ) return false;
    }

    // ── Project (multi-select) ───────────────────────────────────────────
    if (filters.projectIn?.length) {
      const match = filters.projectIn.includes(entry.projectKey);
      if (filters.projectExclude ? match : !match) return false;
    }

    // ── Issue type (multi-select) ────────────────────────────────────────
    if (filters.issuetypeIn?.length) {
      const match = filters.issuetypeIn.includes(entry.issueTypeName);
      if (filters.issuetypeExclude ? match : !match) return false;
    }

    // ── Status (multi-select) ────────────────────────────────────────────
    if (filters.statusIn?.length) {
      const entryStatus = entry.status ?? '';
      const match = filters.statusIn.includes(entryStatus);
      if (filters.statusExclude ? match : !match) return false;
    }

    // ── Priority (multi-select) ──────────────────────────────────────────
    if (filters.priorityIn?.length) {
      const entryPriority = entry.priority ?? '';
      const match = filters.priorityIn.includes(entryPriority);
      if (filters.priorityExclude ? match : !match) return false;
    }

    // ── Assignee (multi-select) — filter by author.name ──────────────────
    if (filters.assigneeIn?.length) {
      const authorName = entry.author?.name;
      let match = false;

      for (const v of filters.assigneeIn) {
        if (v === 'currentUser()') {
          if (authorName === currentUsername) { match = true; break; }
        } else if (v === 'EMPTY') {
          if (!authorName) { match = true; break; }
        } else if (authorName === v) {
          match = true; break;
        }
      }
      if (filters.assigneeExclude ? match : !match) return false;
    }

    // ── Sprint — not available on WorklogEntry, skip ─────────────────────
    // (sprintIn + sprintExclude filtering is intentionally skipped — worklog entries have no sprint field)

    // ── Reporter — not available on WorklogEntry, skip ───────────────────
    // (reporterIn + reporterExclude filtering is intentionally skipped — worklog entries have no reporter field)

    // ── Period / Date range (filter by started date) ─────────────────────
    if (filters.period) {
      if (!entry.started) return false;
      const startedMs = new Date(entry.started).getTime();
      const startOfDay = (d: Date) => {
        const c = new Date(d);
        c.setHours(0, 0, 0, 0);
        return c.getTime();
      };
      const endOfDay = (d: Date) => {
        const c = new Date(d);
        c.setHours(23, 59, 59, 999);
        return c.getTime();
      };

      switch (filters.period) {
        case 'today':
          if (startedMs < startOfDay(now) || startedMs > endOfDay(now)) return false;
          break;
        case 'week':
          if (startedMs < weekStart || startedMs > weekEnd) return false;
          break;
        case 'month':
          if (
            new Date(entry.started).getMonth() !== now.getMonth() ||
            new Date(entry.started).getFullYear() !== now.getFullYear()
          ) return false;
          break;
        case 'year':
          if (new Date(entry.started).getFullYear() !== now.getFullYear()) return false;
          break;
      }
    }

    // ── Team group member filter ──────────────────────────────────────────
    if (selectedMembers && selectedMembers.length > 0) {
      const authorName = entry.author?.name;
      if (!authorName || !selectedMembers.includes(authorName)) return false;
    }

    return true;
  });
}
