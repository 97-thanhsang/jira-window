'use client';
import { useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Tag,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { JiraIssue } from '@/types/jira';

interface BoardVersionPanelProps {
  allIssues: JiraIssue[];
  selectedVersion: string | null;
  onSelectVersion: (versionName: string | null) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export function BoardVersionPanel({
  allIssues,
  selectedVersion,
  onSelectVersion,
  isOpen,
  onToggle,
}: BoardVersionPanelProps) {
  const versions = useMemo(() => {
    const map = new Map<
      string,
      { name: string; released: boolean; count: number }
    >();
    for (const issue of allIssues) {
      const vers = issue.fields.fixVersions;
      if (!vers || vers.length === 0) continue;
      for (const v of vers) {
        const existing = map.get(v.name);
        if (existing) {
          existing.count++;
        } else {
          map.set(v.name, {
            name: v.name,
            released: v.released,
            count: 1,
          });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [allIssues]);

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="flex-shrink-0 w-6 bg-[#F4F5F7] dark:bg-gray-800 border-r border-[#DFE1E6] dark:border-gray-700 flex items-center justify-center hover:bg-[#DFE1E6] dark:hover:bg-gray-700 transition-colors"
        title="Open version panel"
      >
        <ChevronRight size={14} className="text-[#5E6C84]" />
      </button>
    );
  }

  return (
    <div className="flex-shrink-0 w-56 bg-[#F4F5F7] dark:bg-gray-800 border-r border-[#DFE1E6] dark:border-gray-700 flex flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#DFE1E6] dark:border-gray-700">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#5E6C84] dark:text-gray-400 uppercase tracking-wider">
          <Tag size={12} />
          Versions
        </div>
        <button
          onClick={onToggle}
          className="hover:text-[#0052CC] transition-colors"
        >
          <ChevronLeft size={14} className="text-[#5E6C84]" />
        </button>
      </div>

      {/* Version list */}
      <div className="flex-1 overflow-y-auto py-1">
        {/* All versions */}
        <button
          onClick={() => onSelectVersion(null)}
          className={cn(
            'w-full text-left px-3 py-2 text-xs transition-colors hover:bg-white dark:hover:bg-gray-700',
            !selectedVersion
              ? 'bg-white dark:bg-gray-700 font-medium text-[#0052CC]'
              : 'text-[#172B4D] dark:text-gray-200',
          )}
        >
          All Versions
        </button>

        {versions.map((version) => (
          <button
            key={version.name}
            onClick={() => onSelectVersion(version.name)}
            className={cn(
              'w-full text-left px-3 py-2 text-xs transition-colors hover:bg-white dark:hover:bg-gray-700',
              selectedVersion === version.name
                ? 'bg-white dark:bg-gray-700'
                : 'text-[#172B4D] dark:text-gray-200',
            )}
          >
            <div className="flex items-center justify-between">
              <span className="truncate flex-1">{version.name}</span>
              <span className="text-[10px] text-[#5E6C84] dark:text-gray-400 ml-2 shrink-0">
                {version.count}
              </span>
            </div>
            {/* Release status */}
            <div className="flex items-center gap-1 mt-0.5">
              {version.released ? (
                <>
                  <CheckCircle2
                    size={10}
                    className="text-[#36B37E] shrink-0"
                  />
                  <span className="text-[10px] text-[#36B37E]">
                    Released
                  </span>
                </>
              ) : (
                <>
                  <Clock
                    size={10}
                    className="text-[#FF8B00] shrink-0"
                  />
                  <span className="text-[10px] text-[#FF8B00]">
                    Unreleased
                  </span>
                </>
              )}
            </div>
          </button>
        ))}

        {versions.length === 0 && (
          <p className="px-3 py-4 text-xs text-[#5E6C84] dark:text-gray-500 text-center">
            No versions found
          </p>
        )}
      </div>
    </div>
  );
}
