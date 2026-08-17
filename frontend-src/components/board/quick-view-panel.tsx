'use client';
import { useEffect, useState } from 'react';
import { X, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { JiraIssue } from '@/types/jira';
import { PriorityIcon } from '@/components/shared/priority-icon';
import { Button } from '@/components/ui/button';

// ─── Props ────────────────────────────────────────────────────────────────────

interface QuickViewPanelProps {
  issueKey: string | null;
  onClose:  () => void;
}

// ─── Status color helper ──────────────────────────────────────────────────────

function statusColor(cat: string): string {
  if (cat === 'new')          return 'bg-[#DFE1E6] text-[#5E6C84] dark:bg-gray-700 dark:text-gray-300';
  if (cat === 'indeterminate') return 'bg-blue-100 text-[#0052CC] dark:bg-blue-900/30 dark:text-blue-400';
  if (cat === 'done')          return 'bg-green-100 text-[#36B37E] dark:bg-green-900/30 dark:text-green-400';
  return 'bg-[#DFE1E6] text-[#5E6C84]';
}

// ─── Component ────────────────────────────────────────────────────────────────

export function QuickViewPanel({ issueKey, onClose }: QuickViewPanelProps) {
  const [issue,   setIssue]   = useState<JiraIssue | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  // Fetch issue details when key changes
  useEffect(() => {
    if (!issueKey) {
      setIssue(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    api
      .get<JiraIssue>(`/issue/${issueKey}`, {
        params: { fields: 'summary,status,priority,assignee,description' },
      })
      .then((r) => setIssue(r.data))
      .catch(() => setError('Failed to load issue details'))
      .finally(() => setLoading(false));
  }, [issueKey]);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const isOpen = !!issueKey;

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 dark:bg-black/40"
          onClick={onClose}
        />
      )}

      {/* Slide-in panel */}
      <div
        className={`fixed right-0 top-0 h-full w-96 z-50 bg-white dark:bg-gray-900 border-l border-[#DFE1E6] dark:border-gray-700 shadow-2xl flex flex-col transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#DFE1E6] dark:border-gray-700 flex-shrink-0">
          <span className="text-sm font-semibold text-[#172B4D] dark:text-gray-200 truncate pr-2">
            {issueKey ?? 'Issue Details'}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-7 w-7 p-0 flex-shrink-0"
          >
            <X size={14} />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Loading skeleton */}
          {loading && (
            <div className="space-y-3 animate-pulse">
              <div className="h-4 bg-[#DFE1E6] dark:bg-gray-700 rounded w-3/4" />
              <div className="h-4 bg-[#DFE1E6] dark:bg-gray-700 rounded" />
              <div className="h-4 bg-[#DFE1E6] dark:bg-gray-700 rounded w-1/2" />
              <div className="h-4 bg-[#DFE1E6] dark:bg-gray-700 rounded w-2/3" />
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
          )}

          {/* Content */}
          {issue && !loading && (
            <>
              {/* Key + summary */}
              <div>
                <span className="text-xs font-medium text-[#5E6C84] dark:text-gray-400">
                  {issue.key}
                </span>
                <h2 className="text-sm font-semibold text-[#172B4D] dark:text-gray-100 mt-1 leading-snug">
                  {issue.fields.summary}
                </h2>
              </div>

              {/* Status + priority row */}
              <div className="flex items-center gap-3 flex-wrap">
                <span
                  className={`text-xs px-2 py-0.5 rounded font-medium ${statusColor(
                    issue.fields.status.statusCategory.key,
                  )}`}
                >
                  {issue.fields.status.name}
                </span>
                <div className="flex items-center gap-1.5">
                  <PriorityIcon priority={issue.fields.priority} />
                  <span className="text-xs text-[#5E6C84] dark:text-gray-400">
                    {issue.fields.priority?.name || 'None'}
                  </span>
                </div>
              </div>

              {/* Assignee */}
              <div className="flex items-center gap-2">
                {issue.fields.assignee ? (
                  <>
                    <img
                      src={issue.fields.assignee.avatarUrls['24x24']}
                      alt={issue.fields.assignee.displayName}
                      className="w-6 h-6 rounded-full border border-[#DFE1E6] dark:border-gray-600"
                    />
                    <span className="text-xs text-[#5E6C84] dark:text-gray-400">
                      {issue.fields.assignee.displayName}
                    </span>
                  </>
                ) : (
                  <>
                    <div className="w-6 h-6 rounded-full bg-[#DFE1E6] dark:bg-gray-700 flex items-center justify-center text-[10px] text-[#5E6C84] dark:text-gray-400">
                      ?
                    </div>
                    <span className="text-xs text-[#5E6C84] dark:text-gray-400">Unassigned</span>
                  </>
                )}
              </div>

              {/* Description snippet */}
              {issue.fields.description && (
                <div>
                  <p className="text-xs font-medium text-[#5E6C84] dark:text-gray-400 mb-1">
                    Description
                  </p>
                  <p className="text-xs text-[#172B4D] dark:text-gray-300 leading-relaxed">
                    {issue.fields.description.length > 200
                      ? issue.fields.description.slice(0, 200) + '…'
                      : issue.fields.description}
                  </p>
                </div>
              )}

              {/* Open full issue */}
              <Link
                href={`/issues/${issue.key}`}
                onClick={onClose}
                className="flex items-center gap-1.5 text-xs text-[#0052CC] dark:text-blue-400 hover:underline font-medium"
              >
                Open full issue
                <ExternalLink size={12} />
              </Link>
            </>
          )}
        </div>
      </div>
    </>
  );
}
