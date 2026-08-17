'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Clock, Sparkles, Loader2, ClipboardCopy, X } from 'lucide-react';
import { getWorklogs } from '@/lib/worklogs';
import { aiSprintReview } from '@/lib/ai';
import type { WorklogEntry } from '@/lib/worklogs';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function WorklogsTab() {
  const [worklogs, setWorklogs] = useState<WorklogEntry[]>([]);
  const [hasAiKey, setHasAiKey] = useState(false);

  // AI sprint review state
  const [reviewMarkdown, setReviewMarkdown] = useState<string | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showReview, setShowReview] = useState(false);

  // Read from localStorage only on client (useEffect)
  useEffect(() => {
    setWorklogs(getWorklogs());
    setHasAiKey(!!localStorage.getItem('ai_api_key'));
  }, []);

  async function handleSprintReview() {
    setReviewLoading(true);
    setReviewError(null);
    setReviewMarkdown(null);
    setShowReview(true);
    try {
      const result = await aiSprintReview(
        worklogs.map((w) => ({
          issueKey: w.issueKey,
          summary: w.summary || w.issueKey,
          timeSpent: w.timeSpent,
          date: w.date,
          comment: w.comment,
        }))
      );
      setReviewMarkdown(result.markdown);
    } catch (err: unknown) {
      const e = err instanceof Error ? err.message : 'AI error';
      setReviewError(e);
    } finally {
      setReviewLoading(false);
    }
  }

  function handleCopy() {
    if (!reviewMarkdown) return;
    navigator.clipboard.writeText(reviewMarkdown).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // clipboard access failed silently
    });
  }

  if (worklogs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Clock size={40} className="text-[#DFE1E6] dark:text-gray-600 mb-3" />
        <p className="text-sm text-[#5E6C84] dark:text-gray-400">
          No worklogs yet. Log work on an issue using the{' '}
          <kbd className="font-mono text-xs px-1 py-0.5 bg-[#F4F5F7] dark:bg-gray-700 border border-[#DFE1E6] dark:border-gray-600 rounded">
            L
          </kbd>{' '}
          key or the Log Work button.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* AI Sprint Review button */}
      {hasAiKey && (
        <div className="mb-4">
          <button
            onClick={handleSprintReview}
            disabled={reviewLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-60 transition-colors"
          >
            {reviewLoading ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Sparkles size={12} />
            )}
            {reviewLoading ? 'Generating…' : '✨ Generate Sprint Review'}
          </button>
        </div>
      )}

      {/* Sprint Review panel */}
      {showReview && (
        <div className="mb-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-md p-4 relative">
          <button
            onClick={() => { setShowReview(false); setReviewMarkdown(null); setReviewError(null); }}
            className="absolute top-2.5 right-2.5 text-indigo-400 hover:text-indigo-600"
            title="Close"
          >
            <X size={14} />
          </button>

          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={13} className="text-indigo-600" />
            <span className="text-xs font-semibold text-indigo-700">AI Sprint Review</span>
            {reviewMarkdown && (
              <button
                onClick={handleCopy}
                className="ml-auto inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-indigo-200 bg-white text-indigo-600 hover:bg-indigo-100 transition-colors"
              >
                <ClipboardCopy size={11} />
                {copied ? 'Copied!' : '📋 Copy'}
              </button>
            )}
          </div>

          {reviewLoading && (
            <div className="flex items-center gap-2 py-4 justify-center">
              <Loader2 size={16} className="animate-spin text-indigo-500" />
              <span className="text-sm text-indigo-600">Generating sprint review…</span>
            </div>
          )}

          {reviewError && (
            <p className="text-xs text-red-600">{reviewError}</p>
          )}

          {reviewMarkdown && (
            <pre className="whitespace-pre-wrap text-sm text-[#172B4D] dark:text-gray-200 font-sans leading-relaxed">
              {reviewMarkdown}
            </pre>
          )}
        </div>
      )}

      <p className="text-xs text-[#5E6C84] dark:text-gray-400 mb-3">
        Last {worklogs.length} worklogs (stored locally)
      </p>
      <div className="bg-white dark:bg-gray-800 rounded-sm border border-[#DFE1E6] dark:border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[120px_1fr_80px_100px_1fr] gap-3 px-4 py-2 bg-[#F4F5F7] dark:bg-gray-700 border-b border-[#DFE1E6] dark:border-gray-600">
          <span className="text-xs font-semibold text-[#5E6C84] dark:text-gray-400 uppercase tracking-wide">Issue</span>
          <span className="text-xs font-semibold text-[#5E6C84] dark:text-gray-400 uppercase tracking-wide">Summary</span>
          <span className="text-xs font-semibold text-[#5E6C84] dark:text-gray-400 uppercase tracking-wide">Time</span>
          <span className="text-xs font-semibold text-[#5E6C84] dark:text-gray-400 uppercase tracking-wide">Date</span>
          <span className="text-xs font-semibold text-[#5E6C84] dark:text-gray-400 uppercase tracking-wide">Comment</span>
        </div>

        {worklogs.map((entry, idx) => (
          <div
            key={idx}
            className="grid grid-cols-[120px_1fr_80px_100px_1fr] gap-3 px-4 py-3 border-b border-[#DFE1E6] dark:border-gray-700 last:border-b-0 hover:bg-[#F4F5F7] dark:hover:bg-gray-700 transition-colors"
          >
            <Link
              href={`/issues/${entry.issueKey}`}
              className="text-xs text-[#0052CC] font-medium truncate hover:underline"
            >
              {entry.issueKey}
            </Link>
            <span className="text-sm text-[#172B4D] dark:text-gray-200 truncate">
              {entry.summary && entry.summary !== entry.issueKey
                ? entry.summary
                : '—'}
            </span>
            <span className="text-xs font-medium text-[#172B4D] dark:text-gray-200 font-mono">
              {entry.timeSpent}
            </span>
            <span className="text-xs text-[#5E6C84] dark:text-gray-400">
              {formatDate(entry.date)}
            </span>
            <span className="text-xs text-[#5E6C84] dark:text-gray-400 truncate">
              {entry.comment || '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
