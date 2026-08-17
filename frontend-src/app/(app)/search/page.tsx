'use client';

import { useState, useRef } from 'react';
import { Search, Play, Loader2 } from 'lucide-react';
import { useJqlSearch } from '@/hooks/use-jql-search';
import { IssueRow } from '@/components/issues/issue-row';
import { Button } from '@/components/ui/button';

interface Preset {
  label: string;
  jql: string;
}

const PRESETS: Preset[] = [
  {
    label: 'My open issues',
    jql: 'assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC',
  },
  {
    label: 'Updated today',
    jql: 'updated >= startOfDay() ORDER BY updated DESC',
  },
  {
    label: 'High priority',
    jql: 'assignee = currentUser() AND priority in (Highest, High) AND resolution = Unresolved',
  },
  {
    label: 'In Progress',
    jql: 'assignee = currentUser() AND status = "In Progress"',
  },
];

export default function SearchPage() {
  const [inputValue, setInputValue] = useState('');
  const [activeJql, setActiveJql] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { issues, total, isLoading, error } = useJqlSearch(activeJql);

  function runSearch(jql?: string) {
    const query = (jql ?? inputValue).trim();
    if (!query) return;
    setActiveJql(query);
  }

  function applyPreset(preset: Preset) {
    setInputValue(preset.jql);
    setActiveJql(preset.jql);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      runSearch();
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Search size={20} className="text-[#0052CC]" />
        <h1 className="text-xl font-semibold text-[#172B4D] dark:text-gray-100">JQL Search</h1>
      </div>

      {/* JQL Input */}
      <div className="bg-white dark:bg-gray-800 rounded-sm border border-[#DFE1E6] dark:border-gray-700 p-4 mb-4">
        <label className="text-xs font-semibold text-[#5E6C84] dark:text-gray-400 uppercase tracking-wide block mb-2">
          JQL Query
        </label>
        <div className="flex gap-2 items-start">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC"
            rows={2}
            className="flex-1 text-sm text-[#172B4D] dark:text-gray-100 bg-[#F4F5F7] dark:bg-gray-700 border border-[#DFE1E6] dark:border-gray-600 rounded px-3 py-2 font-mono placeholder:text-[#5E6C84] dark:placeholder:text-gray-500 focus:outline-none focus:border-[#0052CC] resize-none transition-colors"
          />
          <Button
            onClick={() => runSearch()}
            disabled={!inputValue.trim() || isLoading}
            className="flex items-center gap-2 flex-shrink-0"
            size="sm"
          >
            {isLoading ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Play size={13} />
            )}
            Run
          </Button>
        </div>
        <p className="text-xs text-[#5E6C84] dark:text-gray-500 mt-1.5">
          Press <kbd className="font-mono text-[10px] px-1 py-0.5 bg-[#DFE1E6] dark:bg-gray-700 rounded">Enter</kbd> to run,{' '}
          <kbd className="font-mono text-[10px] px-1 py-0.5 bg-[#DFE1E6] dark:bg-gray-700 rounded">Shift+Enter</kbd> for new line
        </p>
      </div>

      {/* Preset chips */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <span className="text-xs text-[#5E6C84] dark:text-gray-400 font-medium">Quick filters:</span>
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            onClick={() => applyPreset(preset)}
            className="text-xs px-3 py-1 rounded-full border border-[#DFE1E6] dark:border-gray-600 text-[#172B4D] dark:text-gray-200 bg-white dark:bg-gray-800 hover:border-[#0052CC] dark:hover:border-blue-500 hover:text-[#0052CC] dark:hover:text-blue-400 transition-colors"
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Results */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-sm px-4 py-3 mb-4">
          <p className="text-sm text-red-700 dark:text-red-400">
            Invalid JQL or server error. Please check your query.
          </p>
        </div>
      )}

      {activeJql && !error && (
        <>
          {/* Result count */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-medium text-[#172B4D] dark:text-gray-100">
              Results
            </span>
            {!isLoading && (
              <span className="text-xs bg-[#DFE1E6] dark:bg-gray-700 text-[#42526E] dark:text-gray-300 px-2 py-0.5 rounded-full font-medium">
                {total} total · showing {issues.length}
              </span>
            )}
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-gray-800 rounded-sm border border-[#DFE1E6] dark:border-gray-700 overflow-hidden">
            {/* Table header */}
            <div className="flex items-center gap-3 px-4 py-2 bg-[#F4F5F7] dark:bg-gray-700 border-b border-[#DFE1E6] dark:border-gray-600">
              <span className="text-xs font-semibold text-[#5E6C84] dark:text-gray-400 uppercase tracking-wide w-28">Key</span>
              <span className="flex-1 text-xs font-semibold text-[#5E6C84] dark:text-gray-400 uppercase tracking-wide">Summary</span>
              <span className="text-xs font-semibold text-[#5E6C84] dark:text-gray-400 uppercase tracking-wide w-28">Status</span>
              <span className="text-xs font-semibold text-[#5E6C84] dark:text-gray-400 uppercase tracking-wide w-24">Priority</span>
              <span className="text-xs font-semibold text-[#5E6C84] dark:text-gray-400 uppercase tracking-wide w-28">Project</span>
              <span className="text-xs font-semibold text-[#5E6C84] dark:text-gray-400 uppercase tracking-wide w-20 text-right">Updated</span>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 size={24} className="animate-spin text-[#0052CC]" />
              </div>
            ) : issues.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-sm text-[#5E6C84] dark:text-gray-400">
                No issues found for this query
              </div>
            ) : (
              issues.map((issue) => <IssueRow key={issue.id} issue={issue} />)
            )}
          </div>
        </>
      )}

      {!activeJql && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Search size={40} className="text-[#DFE1E6] dark:text-gray-600 mb-3" />
          <p className="text-sm text-[#5E6C84] dark:text-gray-400">
            Enter a JQL query or pick a quick filter above
          </p>
        </div>
      )}
    </div>
  );
}
