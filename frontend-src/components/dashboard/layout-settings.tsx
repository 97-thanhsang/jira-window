'use client';

import { useState, useRef, useEffect } from 'react';
import { Settings, Eye, EyeOff, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LayoutSettingsProps {
  hiddenWidgets: string[];
  onToggleWidget: (id: string) => void;
  onReset: () => void;
}

const WIDGET_LABELS: Record<string, string> = {
  'my-issues': 'My Issues',
  'worklog': 'Worklog',
  'quick-actions': 'Quick Actions',
  'project-stats': 'Project Stats',
  'recent-activity': 'Recent Activity',
  'due-soon': 'Due Soon',
  'team-overview': 'Team Overview',
  'sprint-progress': 'Sprint Progress',
};

export function LayoutSettings({ hiddenWidgets, onToggleWidget, onReset }: LayoutSettingsProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler, true);
    return () => document.removeEventListener('mousedown', handler, true);
  }, [open]);

  const visibleIds = Object.keys(WIDGET_LABELS).filter(id => !hiddenWidgets.includes(id));

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded transition-colors text-[#5E6C84] dark:text-gray-400 hover:bg-[#F4F5F7] dark:hover:bg-gray-800"
        title="Layout settings"
      >
        <Settings size={12} />
        <span>Layout</span>
        {hiddenWidgets.length > 0 && (
          <span className="text-[#DE350B] font-bold">{hiddenWidgets.length}</span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-gray-900 border border-[#DFE1E6] dark:border-gray-700 rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-[#DFE1E6] dark:border-gray-700 bg-[#FAFBFC] dark:bg-gray-800/60">
            <span className="text-[10px] font-semibold text-[#5E6C84] dark:text-gray-400 uppercase tracking-wide">Widgets ({visibleIds.length}/{Object.keys(WIDGET_LABELS).length})</span>
          </div>
          <div className="py-1 max-h-64 overflow-y-auto">
            {Object.entries(WIDGET_LABELS).map(([id, label]) => {
              const isHidden = hiddenWidgets.includes(id);
              return (
                <button
                  key={id}
                  onClick={() => onToggleWidget(id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#F4F5F7] dark:hover:bg-gray-800 transition-colors text-left"
                >
                  <div className={cn(
                    'w-4 h-4 rounded border flex items-center justify-center transition-colors flex-shrink-0',
                    isHidden
                      ? 'border-[#DFE1E6] dark:border-gray-600 bg-transparent'
                      : 'border-[#0052CC] bg-[#0052CC]',
                  )}>
                    {!isHidden && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5L4 7L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <span className={cn(
                    'text-[11px] flex-1',
                    isHidden ? 'text-[#8993A4] dark:text-gray-500' : 'text-[#172B4D] dark:text-gray-200 font-medium',
                  )}>{label}</span>
                  {isHidden ? (
                    <EyeOff size={12} className="text-[#8993A4]" />
                  ) : (
                    <Eye size={12} className="text-[#5E6C84]" />
                  )}
                </button>
              );
            })}
          </div>
          <div className="px-3 py-2 border-t border-[#DFE1E6] dark:border-gray-700">
            <button
              onClick={onReset}
              className="w-full flex items-center justify-center gap-1.5 text-[10px] font-medium text-[#0052CC] dark:text-blue-400 hover:bg-[#DEEBFF] dark:hover:bg-blue-900/30 px-2 py-1.5 rounded transition-colors"
            >
              <RotateCcw size={11} />
              <span>Reset to Default</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
