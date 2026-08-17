'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Loader2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSearch } from '@/hooks/use-search';
import { StatusBadge } from '@/components/shared/status-badge';
import type { JiraIssue } from '@/types/jira';

const RECENT_KEY = 'recent_issues';
const MAX_RECENT = 5;

interface RecentItem {
  key: string;
  summary: string;
}

function saveRecent(issue: JiraIssue) {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const existing: RecentItem[] = raw ? JSON.parse(raw) : [];
    const filtered = existing.filter((r) => r.key !== issue.key);
    const updated = [
      { key: issue.key, summary: issue.fields.summary },
      ...filtered,
    ].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  } catch {
    // localStorage not available
  }
}

function getRecent(): RecentItem[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const { results, isLoading } = useSearch(query);

  // Ctrl+K / Cmd+K to open
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input when opened; load recent items (useEffect — not render body)
  useEffect(() => {
    if (open) {
      setQuery('');
      setRecent(getRecent());
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  function handleSelect(issueKey: string, issue?: JiraIssue) {
    if (issue) saveRecent(issue);
    setOpen(false);
    setQuery('');
    router.push(`/issues/${issueKey}`);
  }

  function handleRecentSelect(item: RecentItem) {
    setOpen(false);
    setQuery('');
    router.push(`/issues/${item.key}`);
  }

  if (!open) return null;

  const showRecent = query.trim().length < 2;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/* Palette panel */}
      <div className="relative w-full max-w-xl mx-4 bg-white rounded-xl shadow-2xl overflow-hidden">
        {/* Search input row */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#DFE1E6]">
          {isLoading ? (
            <Loader2 size={18} className="text-[#5E6C84] animate-spin flex-shrink-0" />
          ) : (
            <Search size={18} className="text-[#5E6C84] flex-shrink-0" />
          )}
          <input
            ref={inputRef}
            type="text"
            className="flex-1 text-sm text-[#172B4D] placeholder:text-[#5E6C84] bg-transparent outline-none"
            placeholder="Search issues… (e.g. PROJ-123 or keyword)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-xs font-mono text-[#5E6C84] bg-[#F4F5F7] border border-[#DFE1E6] rounded">
            ESC
          </kbd>
        </div>

        {/* Results list */}
        <div className="max-h-80 overflow-y-auto">
          {showRecent ? (
            recent.length > 0 ? (
              <>
                <div className="px-4 py-2 text-xs font-semibold text-[#5E6C84] uppercase tracking-wide bg-[#F4F5F7] border-b border-[#DFE1E6]">
                  Recent
                </div>
                {recent.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => handleRecentSelect(item)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F4F5F7] transition-colors text-left border-b border-[#DFE1E6] last:border-b-0"
                  >
                    <Clock size={14} className="text-[#5E6C84] flex-shrink-0" />
                    <span className="text-xs text-[#0052CC] font-medium w-24 flex-shrink-0 truncate">
                      {item.key}
                    </span>
                    <span className="flex-1 text-sm text-[#172B4D] truncate">
                      {item.summary}
                    </span>
                  </button>
                ))}
              </>
            ) : (
              <div className="flex items-center justify-center py-10 text-sm text-[#5E6C84]">
                Type to search issues…
              </div>
            )
          ) : results.length === 0 && !isLoading ? (
            <div className="flex items-center justify-center py-10 text-sm text-[#5E6C84]">
              No issues found for &quot;{query}&quot;
            </div>
          ) : (
            results.map((issue) => (
              <button
                key={issue.id}
                onClick={() => handleSelect(issue.key, issue)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F4F5F7] transition-colors text-left border-b border-[#DFE1E6] last:border-b-0'
                )}
              >
                <span className="text-xs text-[#0052CC] font-medium w-24 flex-shrink-0 truncate">
                  {issue.key}
                </span>
                <span className="flex-1 text-sm text-[#172B4D] truncate min-w-0">
                  {issue.fields.summary}
                </span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <StatusBadge status={issue.fields.status} />
                  <span className="text-xs text-[#5E6C84] truncate hidden sm:block max-w-[80px]">
                    {issue.fields.project.name}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-[#DFE1E6] bg-[#F4F5F7] flex items-center gap-4 text-xs text-[#5E6C84]">
          <span>
            <kbd className="font-mono">↵</kbd> to open
          </span>
          <span>
            <kbd className="font-mono">ESC</kbd> to close
          </span>
          <span className="ml-auto">
            <kbd className="font-mono">Ctrl K</kbd> to toggle
          </span>
        </div>
      </div>
    </div>
  );
}
