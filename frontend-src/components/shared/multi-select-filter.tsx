'use client';
import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MultiSelectOption {
  value: string;
  label: string;
  group?: string;
}

export interface MultiSelectFilterProps {
  label: string;
  options: MultiSelectOption[];
  selectedValues: string[];
  exclude: boolean;
  onChange: (values: string[], exclude: boolean) => void;
  loading?: boolean;
}

// ─── Style constants ──────────────────────────────────────────────────────────

export const btnBaseClass =
  'flex items-center gap-1 text-xs px-2.5 py-1.5 border rounded whitespace-nowrap transition-colors min-w-[100px] max-w-[180px]';

export const inputClass =
  'text-xs border border-[#DFE1E6] dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-800 text-[#172B4D] dark:text-gray-100 focus:outline-none focus:border-[#0052CC] dark:focus:border-blue-400';

const btnIdleClass =
  'bg-white dark:bg-gray-800 border-[#DFE1E6] dark:border-gray-600 text-[#5E6C84] dark:text-gray-400 hover:border-[#0052CC] hover:text-[#0052CC]';

const btnActiveClass =
  'bg-[#E6F0FF] dark:bg-blue-900/30 border-[#0052CC]/40 dark:border-blue-600/40 text-[#0052CC] dark:text-blue-300';

// ─── Component ────────────────────────────────────────────────────────────────

export function MultiSelectFilter({
  label,
  options,
  selectedValues,
  exclude,
  onChange,
  loading,
}: MultiSelectFilterProps) {
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
        <div className="absolute left-0 top-full mt-1 bg-white dark:bg-gray-800 border border-[#DFE1E6] dark:border-gray-700 rounded shadow-lg z-30 min-w-[200px]">
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
                          ? (exclude ? 'bg-orange-500 border-orange-500' : 'bg-[#0052CC] border-[#0052CC]')
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
  );
}
