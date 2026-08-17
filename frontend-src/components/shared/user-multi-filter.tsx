'use client';
import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { USER_PRESETS } from '@/lib/filter-constants';
import { btnBaseClass } from './multi-select-filter';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserMultiFilterProps {
  label: string;
  selectedValues: string[];
  exclude: boolean;
  onChange: (values: string[], exclude: boolean) => void;
}

interface UserSuggestion {
  name: string;
  displayName: string;
}

// ─── Style constants ──────────────────────────────────────────────────────────

export const inputClass =
  'text-xs border border-[#DFE1E6] dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-800 text-[#172B4D] dark:text-gray-100 focus:outline-none focus:border-[#0052CC] dark:focus:border-blue-400 placeholder-[#5E6C84] dark:placeholder-gray-500';

const btnIdleClass =
  'bg-white dark:bg-gray-800 border-[#DFE1E6] dark:border-gray-600 text-[#5E6C84] dark:text-gray-400 hover:border-[#0052CC] hover:text-[#0052CC]';

const btnActiveClass =
  'bg-[#E6F0FF] dark:bg-blue-900/30 border-[#0052CC]/40 dark:border-blue-600/40 text-[#0052CC] dark:text-blue-300';

// ─── Component ────────────────────────────────────────────────────────────────

export function UserMultiFilter({ label, selectedValues, exclude, onChange }: UserMultiFilterProps) {
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

  // Debounced user search suggestions
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (searchText.trim().length < 1) {
      setSuggestions([]);
      return;
    }
    setSuggestionsLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await api.get<UserSuggestion[]>('/user/search', {
          params: { username: searchText.trim(), maxResults: 8 },
        });
        setSuggestions(Array.isArray(r.data) ? r.data : []);
      } catch {
        setSuggestions([]);
      } finally {
        setSuggestionsLoading(false);
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchText]);

  const hasSelection = selectedValues.length > 0;
  const customUsers = selectedValues.filter(v => !USER_PRESETS.find(p => p.value === v));

  const btnLabel = !hasSelection
    ? label
    : selectedValues.length === 1
      ? USER_PRESETS.find(p => p.value === selectedValues[0])?.label ?? selectedValues[0]
      : (exclude ? 'NOT ' : '') + `${selectedValues.length} selected`;

  function toggleValue(value: string) {
    const next = selectedValues.includes(value)
      ? selectedValues.filter(v => v !== value)
      : [...selectedValues, value];
    onChange(next, exclude);
  }

  function toggleExclude() { onChange(selectedValues, !exclude); }

  function selectSuggestion(user: UserSuggestion) {
    if (selectedValues.includes(user.name)) return;
    onChange([...selectedValues, user.name], exclude);
    setSearchText('');
    setSuggestions([]);
    inputRef.current?.focus();
  }

  function addSearch() {
    const v = searchText.trim();
    if (!v || selectedValues.includes(v)) { setSearchText(''); return; }
    onChange([...selectedValues, v], exclude);
    setSearchText('');
    setSuggestions([]);
    inputRef.current?.focus();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(p => !p)}
        className={cn(
          btnBaseClass,
          hasSelection
            ? (exclude
                ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-400 dark:border-orange-500 text-orange-700 dark:text-orange-300'
                : btnActiveClass)
            : btnIdleClass,
        )}
      >
        <span className="flex-1 text-left truncate">{btnLabel}</span>
        <ChevronDown size={10} className="flex-shrink-0 opacity-60" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 bg-white dark:bg-gray-800 border border-[#DFE1E6] dark:border-gray-700 rounded shadow-lg z-30 min-w-[220px]">
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#DFE1E6] dark:border-gray-700">
            <span className="text-[11px] font-semibold text-[#172B4D] dark:text-gray-100">{label}</span>
            <button
              onClick={toggleExclude}
              disabled={!hasSelection}
              title={exclude ? 'Switch to INCLUDE' : 'Switch to EXCLUDE'}
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
                    checked
                      ? (exclude ? 'bg-orange-500 border-orange-500' : 'bg-[#0052CC] border-[#0052CC]')
                      : 'border-[#DFE1E6] dark:border-gray-500',
                  )}>
                    {checked && <Check size={9} className="text-white" />}
                  </div>
                  <span className="text-xs text-[#172B4D] dark:text-gray-200">{preset.label}</span>
                </button>
              );
            })}
          </div>

          {/* User search with suggestions */}
          <div className="px-3 py-2 border-t border-[#DFE1E6] dark:border-gray-700">
            <div className="flex items-center gap-1">
              <input
                ref={inputRef}
                type="text"
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addSearch(); }}
                placeholder="Search user…"
                className={cn(inputClass, 'flex-1 py-1')}
              />
              <button
                onClick={addSearch}
                disabled={!searchText.trim()}
                className="text-xs px-2 py-1 bg-[#0052CC] text-white rounded hover:bg-[#0747A6] disabled:opacity-40 transition-colors"
              >+</button>
            </div>

            {searchText.trim().length > 0 && (
              <div className="mt-1 border border-[#DFE1E6] dark:border-gray-600 rounded max-h-40 overflow-y-auto">
                {suggestionsLoading ? (
                  <div className="px-3 py-2 text-[10px] text-[#5E6C84] dark:text-gray-400 text-center">Searching…</div>
                ) : suggestions.length === 0 ? (
                  <div className="px-3 py-2 text-[10px] text-[#5E6C84] dark:text-gray-400 text-center">No users found</div>
                ) : (
                  suggestions.map(u => {
                    const alreadySelected = selectedValues.includes(u.name);
                    return (
                      <button
                        key={u.name}
                        onClick={() => selectSuggestion(u)}
                        disabled={alreadySelected}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-[#F4F5F7] dark:hover:bg-gray-700 text-[#172B4D] dark:text-gray-200 flex items-center justify-between disabled:opacity-40"
                      >
                        <span>{u.displayName}</span>
                        <span className="text-[10px] text-[#5E6C84] dark:text-gray-500">{u.name}</span>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

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
              <button onClick={() => onChange([], false)} className="text-[11px] text-[#5E6C84] dark:text-gray-400 hover:text-red-500 transition-colors">
                Clear
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
