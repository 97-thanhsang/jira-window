'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import useSWR from 'swr';
import { api } from '@/lib/api';
import type { IssueFilters } from '@/hooks/use-issues-list';
import type { JiraProject } from '@/types/jira';
import { UserSearchInput } from './user-search-input';
import {
  Search, ChevronDown, ChevronUp, X, Check,
  UserX, Save, Bookmark, Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────

interface SavedFilter {
  id: string;
  name: string;
  filters: IssueFilters;
  createdAt: string;
}

interface FilterPanelProps {
  filters: IssueFilters;
  onUpdate: (f: Partial<IssueFilters>) => void;
  onClear: () => void;
}

// ─── Style constants ──────────────────────────────────────────────

const selectClass =
  'text-xs border border-[#DFE1E6] dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-800 text-[#172B4D] dark:text-gray-100 focus:outline-none focus:border-[#0052CC] dark:focus:border-blue-400 min-w-[110px] max-w-[200px]';

const inputClass =
  'text-xs border border-[#DFE1E6] dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-800 text-[#172B4D] dark:text-gray-100 focus:outline-none focus:border-[#0052CC] dark:focus:border-blue-400 placeholder-[#5E6C84] dark:placeholder-gray-500';

function FilterLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-medium text-[#5E6C84] dark:text-gray-400 whitespace-nowrap">
      {children}
    </span>
  );
}

// ─── Static option lists ──────────────────────────────────────────

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
  { id: '1',     name: 'Highest' },
  { id: '2',     name: 'High'    },
  { id: '3',     name: 'Medium'  },
  { id: '4',     name: 'Low'     },
  { id: '5',     name: 'Lowest'  },
  { id: '10000', name: 'Blocker' },
  { id: '10001', name: 'Minor'   },
];

// Status options are fetched dynamically — see useStatuses() hook below

const RESOLUTION_OPTIONS = [
  'Done', "Won't Do", 'Duplicate', 'Cannot Reproduce',
  'Declined', 'Known Error', 'Hardware failure', 'Software failure',
];

const CREATED_OPTIONS = [
  { value: '-1d',  label: 'Last 24h'    },
  { value: '-7d',  label: 'Last 7 days' },
  { value: '-30d', label: 'Last 30 days'},
  { value: '-90d', label: 'Last 90 days'},
];

const UPDATED_OPTIONS = [
  { value: '-1d',  label: 'Last 24h'    },
  { value: '-7d',  label: 'Last 7 days' },
  { value: '-30d', label: 'Last 30 days'},
];

const DUEDATE_OPTIONS = [
  { value: 'overdue',   label: 'Overdue'   },
  { value: 'this_week', label: 'This week' },
  { value: 'next_week', label: 'Next week' },
];

// ─── Saved filters localStorage ──────────────────────────────────

const LS_KEY = 'jira-saved-filters';

function loadSavedFilters(): SavedFilter[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]') as SavedFilter[];
  } catch {
    return [];
  }
}

function persistSavedFilters(list: SavedFilter[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(list));
}

// ─── MultiSelectOption ────────────────────────────────────────────

interface MultiSelectOption {
  value: string;
  label: string;
  group?: string;
}

// ─── MultiSelectFilter ───────────────────────────────────────────

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
    btnLabel = 'All';
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
    <div className="flex items-center gap-1.5">
      <FilterLabel>{label}</FilterLabel>
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen(p => !p)}
          className={cn(
            'flex items-center gap-1 text-xs px-2.5 py-1.5 border rounded whitespace-nowrap transition-colors min-w-[80px] max-w-[180px]',
            hasSelection
              ? exclude
                ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-400 dark:border-orange-500 text-orange-700 dark:text-orange-300'
                : 'bg-[#E6F0FF] dark:bg-blue-900/30 border-[#0052CC]/40 dark:border-blue-600/40 text-[#0052CC] dark:text-blue-300'
              : 'bg-white dark:bg-gray-800 border-[#DFE1E6] dark:border-gray-600 text-[#5E6C84] dark:text-gray-400 hover:border-[#0052CC] hover:text-[#0052CC]',
          )}
        >
          <span className="flex-1 text-left truncate">{btnLabel}</span>
          <ChevronDown size={10} className="flex-shrink-0 opacity-60" />
        </button>

        {open && (
          <div className="absolute left-0 top-full mt-1 bg-white dark:bg-gray-800 border border-[#DFE1E6] dark:border-gray-700 rounded shadow-lg z-30 min-w-[180px]">
            {/* Exclude toggle */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-[#DFE1E6] dark:border-gray-700">
              <span className="text-[11px] font-semibold text-[#172B4D] dark:text-gray-100">{label}</span>
              <button
                onClick={toggleExclude}
                disabled={!hasSelection}
                title={exclude ? 'Switch to INCLUDE mode' : 'Switch to EXCLUDE mode'}
                className={cn(
                  'flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border transition-colors disabled:opacity-40',
                  exclude
                    ? 'bg-orange-100 dark:bg-orange-900/30 border-orange-400 text-orange-700 dark:text-orange-300'
                    : 'bg-white dark:bg-gray-700 border-[#DFE1E6] dark:border-gray-600 text-[#5E6C84] dark:text-gray-400 hover:border-orange-400 hover:text-orange-600',
                )}
              >
                {exclude ? '≠ Exclude' : '= Include'}
              </button>
            </div>

            {/* Option list */}
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
                          checked
                            ? exclude ? 'bg-orange-500 border-orange-500' : 'bg-[#0052CC] border-[#0052CC]'
                            : 'border-[#DFE1E6] dark:border-gray-500',
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
    </div>
  );
}

// ─── UserMultiFilter (assignee / reporter) ────────────────────────

interface UserMultiFilterProps {
  label: string;
  selectedValues: string[];    // 'currentUser()' | 'EMPTY' | username
  onChange: (values: string[]) => void;
}

const USER_PRESETS = [
  { value: 'currentUser()', label: 'Me' },
  { value: 'EMPTY',         label: 'Unassigned' },
];

function UserMultiFilter({ label, selectedValues, onChange }: UserMultiFilterProps) {
  const [open, setOpen]         = useState(false);
  const [searchText, setSearchText] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const hasSelection = selectedValues.length > 0;

  const customUsers = selectedValues.filter(v => !USER_PRESETS.find(p => p.value === v));

  const btnLabel = !hasSelection ? 'All'
    : selectedValues.length === 1
      ? USER_PRESETS.find(p => p.value === selectedValues[0])?.label ?? selectedValues[0]
      : `${selectedValues.length} selected`;

  function toggleValue(value: string) {
    const next = selectedValues.includes(value)
      ? selectedValues.filter(v => v !== value)
      : [...selectedValues, value];
    onChange(next);
  }

  function addSearch() {
    const v = searchText.trim();
    if (!v || selectedValues.includes(v)) { setSearchText(''); return; }
    onChange([...selectedValues, v]);
    setSearchText('');
    inputRef.current?.focus();
  }

  return (
    <div className="flex items-center gap-1.5">
      <FilterLabel>{label}</FilterLabel>
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen(p => !p)}
          className={cn(
            'flex items-center gap-1 text-xs px-2.5 py-1.5 border rounded whitespace-nowrap transition-colors min-w-[80px] max-w-[180px]',
            hasSelection
              ? 'bg-[#E6F0FF] dark:bg-blue-900/30 border-[#0052CC]/40 dark:border-blue-600/40 text-[#0052CC] dark:text-blue-300'
              : 'bg-white dark:bg-gray-800 border-[#DFE1E6] dark:border-gray-600 text-[#5E6C84] dark:text-gray-400 hover:border-[#0052CC] hover:text-[#0052CC]',
          )}
        >
          <span className="flex-1 text-left truncate">{btnLabel}</span>
          <ChevronDown size={10} className="flex-shrink-0 opacity-60" />
        </button>

        {open && (
          <div className="absolute left-0 top-full mt-1 bg-white dark:bg-gray-800 border border-[#DFE1E6] dark:border-gray-700 rounded shadow-lg z-30 min-w-[210px]">
            <div className="px-3 py-2 border-b border-[#DFE1E6] dark:border-gray-700">
              <span className="text-[11px] font-semibold text-[#172B4D] dark:text-gray-100">{label}</span>
            </div>

            {/* Quick presets */}
            <div className="py-1">
              {USER_PRESETS.map(preset => {
                const checked = selectedValues.includes(preset.value);
                return (
                  <button
                    key={preset.value}
                    onClick={() => toggleValue(preset.value)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#F4F5F7] dark:hover:bg-gray-700 transition-colors text-left"
                  >
                    <div className={cn(
                      'w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0',
                      checked ? 'bg-[#0052CC] border-[#0052CC]' : 'border-[#DFE1E6] dark:border-gray-500',
                    )}>
                      {checked && <Check size={9} className="text-white" />}
                    </div>
                    <span className="text-xs text-[#172B4D] dark:text-gray-200">{preset.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Custom user search */}
            <div className="px-3 py-2 border-t border-[#DFE1E6] dark:border-gray-700">
              <div className="flex items-center gap-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addSearch(); }}
                  placeholder="Username + Enter…"
                  className={cn(inputClass, 'flex-1 py-1')}
                />
                <button
                  onClick={addSearch}
                  disabled={!searchText.trim()}
                  className="text-xs px-2 py-1 bg-[#0052CC] text-white rounded hover:bg-[#0747A6] disabled:opacity-40 transition-colors"
                >+</button>
              </div>
            </div>

            {/* Custom user chips */}
            {customUsers.length > 0 && (
              <div className="px-3 py-2 border-t border-[#DFE1E6] dark:border-gray-700 flex flex-wrap gap-1">
                {customUsers.map(v => (
                  <span key={v} className="inline-flex items-center gap-1 text-[10px] bg-[#E6F0FF] dark:bg-blue-900/30 text-[#0052CC] dark:text-blue-300 border border-[#0052CC]/20 rounded px-1.5 py-0.5">
                    {v}
                    <button onClick={() => toggleValue(v)} className="hover:text-red-500 transition-colors">
                      <X size={8} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {hasSelection && (
              <div className="border-t border-[#DFE1E6] dark:border-gray-700 px-3 py-2">
                <button
                  onClick={() => { onChange([]); setOpen(false); }}
                  className="text-[11px] text-[#5E6C84] dark:text-gray-400 hover:text-red-500 transition-colors"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sprint + data hooks ──────────────────────────────────────────

function useSprints() {
  const { data: boards } = useSWR<{ values: { id: number }[] }>(
    '/agile/board?maxResults=50',
    (url: string) => api.get<{ values: { id: number }[] }>(url).then(r => r.data)
  );

  const { data: sprints } = useSWR<{ values: { id: number; name: string }[] }>(
    boards ? 'sprints' : null,
    async () => {
      if (!boards?.values?.length) return { values: [] };
      const results = await Promise.all(
        boards.values.map(b =>
          api.get<{ values: { id: number; name: string }[] }>(
            `/agile/board/${b.id}/sprint?state=active,future`
          ).then(r => r.data.values).catch(() => [] as { id: number; name: string }[])
        )
      );
      const seen = new Set<string>();
      const unique: { id: number; name: string }[] = [];
      results.flat().forEach(s => {
        if (!seen.has(s.name)) { seen.add(s.name); unique.push(s); }
      });
      unique.sort((a, b) => a.name.localeCompare(b.name));
      return { values: unique };
    }
  );

  return sprints?.values ?? [];
}

function useComponents(projectKey: string | undefined) {
  const { data } = useSWR<{ id: string; name: string }[]>(
    projectKey ? `/project/${projectKey}/components` : null,
    (url: string) => api.get<{ id: string; name: string }[]>(url)
      .then(r => Array.isArray(r.data) ? r.data : []).catch(() => [])
  );
  return data ?? [];
}

function useVersions(projectKey: string | undefined) {
  const { data } = useSWR<{ id: string; name: string }[]>(
    projectKey ? `/project/${projectKey}/versions` : null,
    (url: string) => api.get<{ id: string; name: string }[]>(url)
      .then(r => Array.isArray(r.data) ? r.data : []).catch(() => [])
  );
  return data ?? [];
}

interface JiraStatusRaw {
  id: string;
  name: string;
  statusCategory: { key: string; name: string; colorName: string };
}

const CATEGORY_ORDER: Record<string, number> = { new: 0, indeterminate: 1, done: 2 };
const CATEGORY_LABEL: Record<string, string> = {
  new: 'To Do',
  indeterminate: 'In Progress',
  done: 'Done',
};

function useStatuses() {
  const { data, isLoading } = useSWR<JiraStatusRaw[]>(
    '/status',
    (url: string) =>
      api.get<JiraStatusRaw[]>(url)
        .then(r => Array.isArray(r.data) ? r.data : [])
        .catch(() => [])
  );
  return { statuses: data ?? [], loading: isLoading && !data };
}

// ─── Saved Filters Panel ──────────────────────────────────────────

interface SavedFiltersPanelProps {
  currentFilters: IssueFilters;
  onApply: (f: IssueFilters) => void;
}

function SavedFiltersPanel({ currentFilters, onApply }: SavedFiltersPanelProps) {
  const [open, setOpen]         = useState(false);
  const [saved, setSaved]       = useState<SavedFilter[]>([]);
  const [saveName, setSaveName] = useState('');
  const [showInput, setShowInput] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setSaved(loadSavedFilters()); }, []);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setShowInput(false);
        setSaveName('');
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (showInput) inputRef.current?.focus();
  }, [showInput]);

  const hasFilters = Object.entries(currentFilters).some(
    ([k, v]) => !['sortField', 'sortDir', 'startAt'].includes(k) && v !== undefined && (Array.isArray(v) ? v.length > 0 : true)
  );

  function saveFilter() {
    if (!saveName.trim()) return;
    const { sortField: _sf, sortDir: _sd, startAt: _sa, ...rest } = currentFilters;
    void _sf; void _sd; void _sa;
    const newFilter: SavedFilter = {
      id: Date.now().toString(),
      name: saveName.trim(),
      filters: rest,
      createdAt: new Date().toISOString(),
    };
    const next = [newFilter, ...saved];
    setSaved(next);
    persistSavedFilters(next);
    setSaveName('');
    setShowInput(false);
  }

  function deleteFilter(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    const next = saved.filter(f => f.id !== id);
    setSaved(next);
    persistSavedFilters(next);
  }

  function applyFilter(sf: SavedFilter) {
    onApply(sf.filters);
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(p => !p)}
        className={cn(
          'flex items-center gap-1.5 text-xs px-2.5 py-1.5 border rounded transition-colors whitespace-nowrap',
          open || saved.length > 0
            ? 'bg-white dark:bg-gray-800 border-[#0052CC]/40 dark:border-blue-500/40 text-[#0052CC] dark:text-blue-300 hover:border-[#0052CC]'
            : 'bg-white dark:bg-gray-800 border-[#DFE1E6] dark:border-gray-600 text-[#5E6C84] dark:text-gray-400 hover:border-[#0052CC] hover:text-[#0052CC]',
        )}
      >
        <Bookmark size={12} />
        Saved
        {saved.length > 0 && (
          <span className="ml-0.5 inline-flex items-center justify-center rounded-full bg-[#0052CC] text-white text-[9px] font-bold w-3.5 h-3.5">
            {saved.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-[#DFE1E6] dark:border-gray-700 rounded shadow-lg z-30 w-64">
          <div className="px-3 py-2 border-b border-[#DFE1E6] dark:border-gray-700">
            {showInput ? (
              <div className="flex items-center gap-1.5">
                <input
                  ref={inputRef}
                  type="text"
                  value={saveName}
                  onChange={e => setSaveName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') saveFilter();
                    if (e.key === 'Escape') { setShowInput(false); setSaveName(''); }
                  }}
                  placeholder="Filter name…"
                  className={cn(inputClass, 'flex-1 py-1')}
                />
                <button
                  onClick={saveFilter}
                  disabled={!saveName.trim()}
                  className="text-xs px-2 py-1 bg-[#0052CC] text-white rounded disabled:opacity-40 hover:bg-[#0747A6] transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={() => { setShowInput(false); setSaveName(''); }}
                  className="text-[#5E6C84] hover:text-red-500 transition-colors"
                >
                  <X size={13} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowInput(true)}
                disabled={!hasFilters}
                className="flex items-center gap-1.5 text-xs text-[#0052CC] dark:text-blue-400 hover:underline disabled:opacity-40 disabled:no-underline"
              >
                <Save size={12} />
                Save current filters…
              </button>
            )}
          </div>

          {saved.length === 0 ? (
            <div className="px-3 py-4 text-xs text-center text-[#5E6C84] dark:text-gray-500">
              No saved filters
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto py-1">
              {saved.map(sf => (
                <div
                  key={sf.id}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-[#F4F5F7] dark:hover:bg-gray-700 transition-colors cursor-pointer group"
                  onClick={() => applyFilter(sf)}
                >
                  <Bookmark size={12} className="text-[#5E6C84] flex-shrink-0" />
                  <span className="text-xs text-[#172B4D] dark:text-gray-200 flex-1 truncate">{sf.name}</span>
                  <button
                    onClick={e => deleteFilter(sf.id, e)}
                    className="opacity-0 group-hover:opacity-100 text-[#5E6C84] hover:text-red-500 transition-all flex-shrink-0"
                    aria-label={`Delete ${sf.name}`}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main FilterPanel ─────────────────────────────────────────────

export function FilterPanel({ filters, onUpdate, onClear }: FilterPanelProps) {
  const [showMore, setShowMore]   = useState(false);
  const [textInput, setTextInput] = useState(filters.text ?? '');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!filters.text) setTextInput('');
  }, [filters.text]);

  function handleTextChange(value: string) {
    setTextInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onUpdate({ text: value || undefined });
    }, 400);
  }

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const { data: projects } = useSWR<JiraProject[]>(
    '/project?maxResults=50',
    (url: string) => api.get<JiraProject[]>(url).then(r => r.data)
  );

  const sprints     = useSprints();
  const activeProject = filters.projectIn?.[0] ?? filters.project;
  const components  = useComponents(activeProject);
  const fixVersions = useVersions(activeProject);
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

  // Sprint options for MultiSelectFilter
  const sprintOptions: MultiSelectOption[] = sprints.map(s => ({ value: s.name, label: s.name }));

  const applySavedFilter = useCallback((f: IssueFilters) => {
    onClear();
    setTimeout(() => onUpdate(f), 0);
  }, [onClear, onUpdate]);

  // Advanced row active count (for badge)
  const advancedActiveCount = [
    filters.reporter,
    filters.reporterIn?.length,
    filters.resolution,
    filters.createdAfter,
    filters.labels,
    filters.updatedAfter,
    filters.duedate,
    filters.component,
    filters.fixVersion,
  ].filter(Boolean).length;

  // ── Active filter chips ──
  const chips: { key: string; label: string }[] = [];

  if (filters.text) chips.push({ key: 'text', label: `Text: "${filters.text}"` });

  if (filters.statusIn?.length) {
    chips.push({ key: 'status', label: `Status ${filters.statusExclude ? '≠' : '='} ${filters.statusIn.join(', ')}` });
  }
  if (filters.priorityIn?.length) {
    chips.push({ key: 'priority', label: `Priority ${filters.priorityExclude ? '≠' : '='} ${filters.priorityIn.join(', ')}` });
  }
  if (filters.issuetypeIn?.length) {
    chips.push({ key: 'issuetype', label: `Type ${filters.issuetypeExclude ? '≠' : '='} ${filters.issuetypeIn.join(', ')}` });
  }
  if (filters.unassignedOnly) chips.push({ key: 'unassignedOnly', label: 'Unassigned only' });
  if (filters.assigneeIn?.length) {
    const labels = filters.assigneeIn.map(v =>
      v === 'currentUser()' ? 'Me' : v === 'EMPTY' ? 'Unassigned' : v
    ).join(', ');
    chips.push({ key: 'assigneeIn', label: `Assignee: ${labels}` });
  } else if (filters.assignee === 'currentUser()') {
    chips.push({ key: 'assignee', label: 'Assignee: Me' });
  } else if (filters.assignee) {
    chips.push({ key: 'assignee', label: `Assignee: ${filters.assignee}` });
  }
  if (filters.projectIn?.length) {
    const names = filters.projectIn.map(key => {
      const proj = projects?.find(p => p.key === key);
      return proj?.name ?? key;
    }).join(', ');
    chips.push({ key: 'projectIn', label: `Project: ${names}` });
  } else if (filters.project) {
    const proj = projects?.find(p => p.key === filters.project);
    chips.push({ key: 'project', label: `Project: ${proj?.name ?? filters.project}` });
  }
  if (filters.sprintIn?.length) {
    chips.push({ key: 'sprintIn', label: `Sprint: ${filters.sprintIn.join(', ')}` });
  } else if (filters.sprint) {
    chips.push({ key: 'sprint', label: `Sprint: ${filters.sprint}` });
  }
  if (filters.reporterIn?.length) {
    const labels = filters.reporterIn.map(v => v === 'currentUser()' ? 'Me' : v).join(', ');
    chips.push({ key: 'reporterIn', label: `Reporter: ${labels}` });
  } else if (filters.reporter === 'currentUser()') {
    chips.push({ key: 'reporter', label: 'Reporter: Me' });
  } else if (filters.reporter) {
    chips.push({ key: 'reporter', label: `Reporter: ${filters.reporter}` });
  }
  if (filters.resolution === 'all') chips.push({ key: 'resolution', label: 'Resolution: All' });
  else if (filters.resolution) chips.push({ key: 'resolution', label: `Resolution: ${filters.resolution}` });
  if (filters.createdAfter) {
    const c = CREATED_OPTIONS.find(o => o.value === filters.createdAfter);
    chips.push({ key: 'createdAfter', label: `Created: ${c?.label ?? filters.createdAfter}` });
  }
  if (filters.labels) chips.push({ key: 'labels', label: `Label: ${filters.labels}` });
  if (filters.updatedAfter) {
    const u = UPDATED_OPTIONS.find(o => o.value === filters.updatedAfter);
    chips.push({ key: 'updatedAfter', label: `Updated: ${u?.label ?? filters.updatedAfter}` });
  }
  if (filters.duedate) {
    const d = DUEDATE_OPTIONS.find(o => o.value === filters.duedate);
    chips.push({ key: 'duedate', label: `Due: ${d?.label ?? filters.duedate}` });
  }
  if (filters.component) chips.push({ key: 'component', label: `Component: ${filters.component}` });
  if (filters.fixVersion) chips.push({ key: 'fixVersion', label: `Fix version: ${filters.fixVersion}` });

  const hasAnyFilter = chips.length > 0;

  function removeChip(key: string) {
    if (key === 'text') setTextInput('');
    if (key === 'status')    { onUpdate({ statusIn: undefined,    statusExclude: undefined }); return; }
    if (key === 'priority')  { onUpdate({ priorityIn: undefined,  priorityExclude: undefined }); return; }
    if (key === 'issuetype') { onUpdate({ issuetypeIn: undefined, issuetypeExclude: undefined }); return; }
    if (key === 'assigneeIn') { onUpdate({ assigneeIn: undefined }); return; }
    if (key === 'reporterIn') { onUpdate({ reporterIn: undefined }); return; }
    if (key === 'sprintIn')  { onUpdate({ sprintIn: undefined }); return; }
    if (key === 'projectIn') { onUpdate({ projectIn: undefined }); return; }
    onUpdate({ [key]: undefined } as Partial<IssueFilters>);
  }

  return (
    <div className="mb-4 rounded-sm border border-[#DFE1E6] dark:border-gray-700 bg-[#F4F5F7] dark:bg-gray-800/60 relative z-20">

      {/* ── Row 1 — always visible ── */}
      <div className="flex items-center gap-2 px-4 py-2.5 flex-wrap">

        {/* Text search */}
        <div className="relative flex items-center min-w-[180px] max-w-xs">
          <Search size={13} className="absolute left-2 text-[#5E6C84] dark:text-gray-500 pointer-events-none" />
          <input
            type="text"
            value={textInput}
            onChange={e => handleTextChange(e.target.value)}
            placeholder="Search issues…"
            className={cn(inputClass, 'pl-6 w-full')}
          />
        </div>

        {/* Project — multi-select */}
        <MultiSelectFilter
          label="Project"
          options={(projects ?? []).map(p => ({ value: p.key, label: p.name }))}
          selectedValues={filters.projectIn ?? []}
          exclude={false}
          onChange={(values) => onUpdate({ projectIn: values.length ? values : undefined, project: undefined })}
        />

        {/* Type — multi-select */}
        <MultiSelectFilter
          label="Type"
          options={ISSUE_TYPES.map(t => ({ value: t.name, label: t.name }))}
          selectedValues={filters.issuetypeIn ?? []}
          exclude={filters.issuetypeExclude ?? false}
          onChange={(values, exc) => onUpdate({
            issuetypeIn: values.length ? values : undefined,
            issuetypeExclude: exc || undefined,
          })}
        />

        {/* Status — multi-select (fetched from Jira) */}
        <MultiSelectFilter
          label="Status"
          options={statusOptions}
          loading={statusesLoading}
          selectedValues={filters.statusIn ?? []}
          exclude={filters.statusExclude ?? false}
          onChange={(values, exc) => onUpdate({
            statusIn: values.length ? values : undefined,
            statusExclude: exc || undefined,
          })}
        />

        {/* Priority — multi-select */}
        <MultiSelectFilter
          label="Priority"
          options={PRIORITY_OPTIONS.map(p => ({ value: p.name, label: p.name }))}
          selectedValues={filters.priorityIn ?? []}
          exclude={filters.priorityExclude ?? false}
          onChange={(values, exc) => onUpdate({
            priorityIn: values.length ? values : undefined,
            priorityExclude: exc || undefined,
          })}
        />

        {/* Assignee — multi-user */}
        <UserMultiFilter
          label="Assignee"
          selectedValues={filters.assigneeIn ?? []}
          onChange={values => onUpdate({
            assigneeIn: values.length ? values : undefined,
            unassignedOnly: undefined,
          })}
        />

        {/* Sprint — multi-select */}
        <MultiSelectFilter
          label="Sprint"
          options={sprintOptions}
          selectedValues={filters.sprintIn ?? []}
          exclude={false}
          onChange={(values) => onUpdate({
            sprintIn: values.length ? values : undefined,
            sprint: undefined,
          })}
        />

        {/* Unassigned quick toggle */}
        <button
          onClick={() => onUpdate({ unassignedOnly: filters.unassignedOnly ? undefined : true, assigneeIn: undefined })}
          title="Show unassigned issues only"
          className={cn(
            'flex items-center gap-1.5 text-xs px-2.5 py-1.5 border rounded transition-colors whitespace-nowrap',
            filters.unassignedOnly
              ? 'bg-[#E6F0FF] dark:bg-blue-900/30 border-[#0052CC]/40 text-[#0052CC] dark:text-blue-300'
              : 'bg-white dark:bg-gray-800 border-[#DFE1E6] dark:border-gray-600 text-[#5E6C84] dark:text-gray-400 hover:border-[#0052CC] hover:text-[#0052CC]',
          )}
        >
          <UserX size={12} />
          Unassigned
        </button>

        {/* More filters toggle */}
        <button
          onClick={() => setShowMore(prev => !prev)}
          className={cn(
            'flex items-center gap-1 text-xs px-2.5 py-1.5 rounded border transition-colors',
            showMore || advancedActiveCount > 0
              ? 'bg-[#0052CC] border-[#0052CC] text-white'
              : 'bg-white dark:bg-gray-700 border-[#DFE1E6] dark:border-gray-600 text-[#5E6C84] dark:text-gray-300 hover:border-[#0052CC] hover:text-[#0052CC]',
          )}
        >
          {showMore ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          More
          {advancedActiveCount > 0 && (
            <span className={cn(
              'ml-1 inline-flex items-center justify-center rounded-full text-[10px] font-bold w-4 h-4',
              showMore || advancedActiveCount > 0 ? 'bg-white text-[#0052CC]' : 'bg-[#0052CC] text-white',
            )}>
              {advancedActiveCount}
            </span>
          )}
        </button>

        {/* Right side: saved filters + clear */}
        <div className="ml-auto flex items-center gap-2">
          <SavedFiltersPanel currentFilters={filters} onApply={applySavedFilter} />
          {hasAnyFilter && (
            <button
              onClick={onClear}
              className="text-xs text-[#0052CC] dark:text-blue-400 hover:underline whitespace-nowrap"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* ── Row 2 — More filters (collapsible) ── */}
      {showMore && (
        <div className="flex items-center gap-2 px-4 py-2 border-t border-[#DFE1E6] dark:border-gray-700 bg-white dark:bg-gray-800 flex-wrap">

          {/* Reporter — multi-user */}
          <UserMultiFilter
            label="Reporter"
            selectedValues={filters.reporterIn ?? []}
            onChange={values => onUpdate({
              reporterIn: values.length ? values : undefined,
              reporter: undefined,
            })}
          />

          {/* Resolution */}
          <div className="flex items-center gap-1.5">
            <FilterLabel>Resolution</FilterLabel>
            <select
              className={selectClass}
              value={filters.resolution === 'all' ? 'all' : (filters.resolution ?? '')}
              onChange={e => {
                const val = e.target.value;
                if (val === '')        onUpdate({ resolution: undefined });
                else if (val === 'all') onUpdate({ resolution: 'all' });
                else                   onUpdate({ resolution: val });
              }}
            >
              <option value="">Unresolved</option>
              <option value="all">All (including resolved)</option>
              {RESOLUTION_OPTIONS.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Created */}
          <div className="flex items-center gap-1.5">
            <FilterLabel>Created</FilterLabel>
            <select
              className={selectClass}
              value={filters.createdAfter ?? ''}
              onChange={e => onUpdate({ createdAfter: e.target.value || undefined })}
            >
              <option value="">Any time</option>
              {CREATED_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Labels */}
          <div className="flex items-center gap-1.5">
            <FilterLabel>Label</FilterLabel>
            <input
              type="text"
              placeholder="e.g. frontend"
              className={cn(inputClass, 'min-w-[120px]')}
              value={filters.labels ?? ''}
              onChange={e => onUpdate({ labels: e.target.value || undefined })}
            />
          </div>

          {/* Updated */}
          <div className="flex items-center gap-1.5">
            <FilterLabel>Updated</FilterLabel>
            <select
              className={selectClass}
              value={filters.updatedAfter ?? ''}
              onChange={e => onUpdate({ updatedAfter: e.target.value || undefined })}
            >
              <option value="">Any time</option>
              {UPDATED_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Due date */}
          <div className="flex items-center gap-1.5">
            <FilterLabel>Due date</FilterLabel>
            <select
              className={selectClass}
              value={filters.duedate ?? ''}
              onChange={e => onUpdate({ duedate: e.target.value || undefined })}
            >
              <option value="">Any</option>
              {DUEDATE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Component */}
          <div className="flex items-center gap-1.5">
            <FilterLabel>Component</FilterLabel>
            <select
              className={cn(selectClass, !filters.project && 'opacity-50 cursor-not-allowed')}
              value={filters.component ?? ''}
              disabled={!filters.project || components.length === 0}
              onChange={e => onUpdate({ component: e.target.value || undefined })}
            >
              <option value="">All</option>
              {components.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Fix Version */}
          <div className="flex items-center gap-1.5">
            <FilterLabel>Fix version</FilterLabel>
            <select
              className={cn(selectClass, !filters.project && 'opacity-50 cursor-not-allowed')}
              value={filters.fixVersion ?? ''}
              disabled={!filters.project || fixVersions.length === 0}
              onChange={e => onUpdate({ fixVersion: e.target.value || undefined })}
            >
              <option value="">All</option>
              {fixVersions.map(v => (
                <option key={v.id} value={v.name}>{v.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* ── Active filter chips ── */}
      {chips.length > 0 && (
        <div className="flex items-center gap-1.5 px-4 py-2 border-t border-[#DFE1E6] dark:border-gray-700 flex-wrap">
          {chips.map(chip => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1 text-xs bg-[#E6F0FF] dark:bg-blue-900/40 text-[#0052CC] dark:text-blue-300 border border-[#0052CC]/20 dark:border-blue-600/30 rounded px-2 py-0.5"
            >
              {chip.label}
              <button
                onClick={() => removeChip(chip.key)}
                className="hover:text-red-500 transition-colors ml-0.5"
                aria-label={`Remove ${chip.label} filter`}
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
