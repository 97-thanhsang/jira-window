'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  ExternalLink,
  Clock,
  Sparkles,
  Loader2,
  X,
} from 'lucide-react';
import { useIssue } from '@/hooks/use-issue';
import { WikiRenderer } from '@/components/issue/wiki-renderer';
import { AttachmentGallery } from '@/components/issue/attachment-gallery';
import { TransitionButton } from '@/components/issue/transition-button';
import { LogWorkModal } from '@/components/issue/log-work-modal';
import { CommentSection } from '@/components/issue/comment-section';
import { StatusBadge } from '@/components/shared/status-badge';
import { PriorityIcon } from '@/components/shared/priority-icon';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { aiSummarize, aiSuggestTransition } from '@/lib/ai';
import type { JiraUser, JiraTimeTracking } from '@/types/jira';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function UserField({ user }: { user: JiraUser | null }) {
  if (!user) {
    return <span className="text-sm text-[#5E6C84]">Unassigned</span>;
  }
  return (
    <div className="flex items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={user.avatarUrls['24x24']}
        alt={user.displayName}
        className="w-6 h-6 rounded-full flex-shrink-0"
        width={24}
        height={24}
      />
      <span className="text-sm text-[#172B4D] dark:text-gray-100">
        {user.displayName}
      </span>
    </div>
  );
}

function TimeTrackingField({ tt }: { tt: JiraTimeTracking }) {
  const spent = tt.timeSpentSeconds ?? 0;
  const original = tt.originalEstimateSeconds ?? 0;
  const remaining = tt.remainingEstimateSeconds ?? 0;

  const pct = original > 0 ? Math.min(100, Math.round((spent / original) * 100)) : 0;
  const overlogged = original > 0 && spent > original;

  return (
    <div className="space-y-1.5">
      {/* Progress bar */}
      {original > 0 && (
        <div className="h-1.5 bg-[#DFE1E6] dark:bg-gray-600 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              overlogged ? 'bg-red-500' : 'bg-[#36B37E]'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[#5E6C84]">
        {tt.timeSpent && (
          <span>
            <span className="text-[#172B4D] dark:text-gray-200 font-medium">
              {tt.timeSpent}
            </span>{' '}
            logged
          </span>
        )}
        {tt.remainingEstimate && (
          <span>
            <span className="text-[#172B4D] dark:text-gray-200 font-medium">
              {tt.remainingEstimate}
            </span>{' '}
            remaining
          </span>
        )}
        {tt.originalEstimate && (
          <span>
            <span className="text-[#172B4D] dark:text-gray-200 font-medium">
              {tt.originalEstimate}
            </span>{' '}
            estimated
          </span>
        )}
        {remaining === 0 && !tt.remainingEstimate && spent === 0 && !tt.timeSpent && !tt.originalEstimate && (
          <span className="italic">No time tracked</span>
        )}
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div className="p-6">
      <Skeleton className="h-5 w-40 mb-4" />
      <Skeleton className="h-7 w-3/4 mb-6" />
      <div className="grid grid-cols-[1fr_340px] gap-6">
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
          <Skeleton className="h-4 w-full" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-2/4" />
        </div>
      </div>
    </div>
  );
}

// ─── Sidebar label ─────────────────────────────────────────────────────────────

function SidebarLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-xs font-semibold text-[#5E6C84] uppercase tracking-wider block mb-1.5">
      {children}
    </label>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function IssueDetailPage() {
  const params = useParams();
  const issueKey = Array.isArray(params.key) ? params.key[0] : (params.key ?? '');
  const { issue, isLoading, error, mutate } = useIssue(issueKey);
  const [logWorkOpen, setLogWorkOpen] = useState(false);

  // AI state
  const [hasAiKey, setHasAiKey] = useState(false);
  const [summaryBullets, setSummaryBullets] = useState<string[] | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [transitionSuggestion, setTransitionSuggestion] = useState<{
    suggestion: string;
    reason: string;
  } | null>(null);
  const [transitionLoading, setTransitionLoading] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);

  // Check AI key from localStorage — only in useEffect
  useEffect(() => {
    setHasAiKey(!!localStorage.getItem('ai_api_key'));
  }, []);

  // Listen for the 'L' keyboard shortcut dispatched by the layout
  useEffect(() => {
    function handleOpenLogWork() {
      setLogWorkOpen(true);
    }
    window.addEventListener('open-log-work', handleOpenLogWork);
    return () => window.removeEventListener('open-log-work', handleOpenLogWork);
  }, []);

  async function handleAiSummarize() {
    if (!issue) return;
    setSummaryLoading(true);
    setSummaryError(null);
    setSummaryBullets(null);
    try {
      const f = issue.fields;
      const comments = (f.comment?.comments ?? []).map((c) => c.body);
      const result = await aiSummarize({
        issueKey,
        summary: f.summary,
        description: f.description ?? '',
        comments,
      });
      setSummaryBullets(result.bullets);
    } catch (err: unknown) {
      const e = err instanceof Error ? err.message : 'AI error';
      setSummaryError(e);
    } finally {
      setSummaryLoading(false);
    }
  }

  async function handleAiSuggestTransition() {
    if (!issue) return;
    setTransitionLoading(true);
    setTransitionError(null);
    setTransitionSuggestion(null);
    try {
      const f = issue.fields;
      const comments = (f.comment?.comments ?? []).map((c) => c.body);
      const result = await aiSuggestTransition({
        issueKey,
        summary: f.summary,
        description: f.description ?? '',
        currentStatus: f.status.name,
        comments,
      });
      setTransitionSuggestion(result);
    } catch (err: unknown) {
      const e = err instanceof Error ? err.message : 'AI error';
      setTransitionError(e);
    } finally {
      setTransitionLoading(false);
    }
  }

  if (isLoading) return <DetailSkeleton />;

  if (error || !issue) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-600 mb-3 text-sm">
          Issue not found or failed to load
        </p>
        <Link href="/board">
          <Button variant="outline" size="sm">
            ← Back to Board
          </Button>
        </Link>
      </div>
    );
  }

  const f = issue.fields;
  const attachments = f.attachment ?? [];

  return (
    <div className="p-6">
      {/* ── Breadcrumb ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-3 text-sm text-[#5E6C84]">
        <Link
          href="/board"
          className="hover:text-[#0052CC] flex items-center gap-1 transition-colors"
        >
          <ArrowLeft size={14} />
          Board
        </Link>
        <span>/</span>
        <span className="text-[#172B4D] dark:text-gray-200 font-medium">
          {f.project.name}
        </span>
        <span>/</span>
        <span className="text-[#172B4D] dark:text-gray-200 font-medium">
          {issueKey}
        </span>
      </div>

      {/* ── Title row ────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3 mb-4">
        {/* Issue type icon */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={f.issuetype.iconUrl}
          alt={f.issuetype.name}
          title={f.issuetype.name}
          className="w-5 h-5 mt-1 flex-shrink-0"
          width={20}
          height={20}
        />
        <h1 className="text-xl font-semibold text-[#172B4D] dark:text-gray-100 flex-1 leading-snug">
          {f.summary}
        </h1>
        <a
          href={`https://task.ascvn.com.vn/browse/${issueKey}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 text-[#5E6C84] hover:text-[#0052CC] mt-1 transition-colors"
          title="Open in Jira"
        >
          <ExternalLink size={16} />
        </a>
      </div>

      {/* ── AI Summarize button + result card ────────────────────────────── */}
      {hasAiKey && (
        <div className="mb-6">
          <button
            onClick={handleAiSummarize}
            disabled={summaryLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-60 transition-colors"
          >
            {summaryLoading ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Sparkles size={12} />
            )}
            {summaryLoading ? 'Summarizing…' : '✨ Summary'}
          </button>

          {summaryError && (
            <p className="text-xs text-red-600 mt-2">{summaryError}</p>
          )}

          {summaryBullets && (
            <div className="mt-3 bg-indigo-50 border border-indigo-200 rounded-md p-4 relative">
              <button
                onClick={() => setSummaryBullets(null)}
                className="absolute top-2 right-2 text-indigo-400 hover:text-indigo-600"
                title="Dismiss"
              >
                <X size={13} />
              </button>
              <p className="text-xs font-semibold text-indigo-700 mb-2 flex items-center gap-1">
                <Sparkles size={11} /> AI Summary
              </p>
              <ul className="space-y-1">
                {summaryBullets.map((bullet, i) => (
                  <li key={i} className="text-sm text-indigo-900 flex gap-2">
                    <span className="text-indigo-400 flex-shrink-0">•</span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ── Main 2-column layout ─────────────────────────────────────────── */}
      <div className="grid grid-cols-[1fr_340px] gap-6">
        {/* ── Left: content ───────────────────────────────────────────── */}
        <div className="space-y-6 min-w-0">
          {/* Description */}
          <section>
            <h2 className="text-xs font-semibold text-[#5E6C84] uppercase tracking-wider mb-3">
              Description
            </h2>
            <div className="bg-white dark:bg-gray-800 rounded-sm border border-[#DFE1E6] dark:border-gray-700 p-4">
              <WikiRenderer content={f.description} attachments={attachments} />
            </div>
          </section>

          {/* Attachments */}
          {attachments.length > 0 && (
            <section>
              <div className="bg-white dark:bg-gray-800 rounded-sm border border-[#DFE1E6] dark:border-gray-700 p-4">
                <AttachmentGallery attachments={attachments} />
              </div>
            </section>
          )}

          {/* Sub-tasks */}
          {f.subtasks && f.subtasks.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-[#5E6C84] uppercase tracking-wider mb-3">
                Sub-tasks ({f.subtasks.length})
              </h2>
              <div className="bg-white dark:bg-gray-800 rounded-sm border border-[#DFE1E6] dark:border-gray-700 divide-y divide-[#DFE1E6] dark:divide-gray-700">
                {f.subtasks.map((sub) => (
                  <Link
                    key={sub.id}
                    href={`/issues/${sub.key}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-[#F4F5F7] dark:hover:bg-gray-700 transition-colors"
                  >
                    <span className="text-xs text-[#0052CC] font-medium w-28 flex-shrink-0">
                      {sub.key}
                    </span>
                    <span className="text-sm text-[#172B4D] dark:text-gray-200 flex-1 truncate">
                      {sub.fields.summary}
                    </span>
                    <StatusBadge status={sub.fields.status} />
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Activity / Comments */}
          <CommentSection
            issueKey={issueKey}
            issueSummary={f.summary}
            comments={f.comment?.comments ?? []}
            onCommentAdded={() => mutate()}
          />
        </div>

        {/* ── Right: Sidebar ───────────────────────────────────────────── */}
        <div className="flex-shrink-0">
          <div className="bg-white dark:bg-gray-800 rounded-sm border border-[#DFE1E6] dark:border-gray-700 p-4 space-y-4">

            {/* 1. Status + AI Suggest */}
            <div>
              <SidebarLabel>Status</SidebarLabel>
              <TransitionButton
                issueKey={issueKey}
                currentStatus={f.status}
                onTransitioned={() => mutate()}
              />
              {hasAiKey && (
                <div className="mt-2">
                  <button
                    onClick={handleAiSuggestTransition}
                    disabled={transitionLoading}
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 disabled:opacity-60 transition-colors"
                  >
                    {transitionLoading ? (
                      <Loader2 size={10} className="animate-spin" />
                    ) : (
                      <Sparkles size={10} />
                    )}
                    {transitionLoading ? 'Thinking…' : '✨ Suggest'}
                  </button>
                  {transitionError && (
                    <p className="text-xs text-red-600 mt-1">{transitionError}</p>
                  )}
                  {transitionSuggestion && (
                    <div className="mt-2 bg-indigo-50 border border-indigo-200 rounded p-2.5 relative">
                      <button
                        onClick={() => setTransitionSuggestion(null)}
                        className="absolute top-1.5 right-1.5 text-indigo-300 hover:text-indigo-500"
                        title="Dismiss"
                      >
                        <X size={11} />
                      </button>
                      <p className="text-xs font-semibold text-indigo-700">
                        → {transitionSuggestion.suggestion}
                      </p>
                      <p className="text-xs text-indigo-600 mt-0.5">
                        {transitionSuggestion.reason}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 2. Log Work */}
            <div>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() => setLogWorkOpen(true)}
              >
                <Clock size={13} />
                Log Work
              </Button>
            </div>

            {/* 3. Assignee */}
            <div>
              <SidebarLabel>Assignee</SidebarLabel>
              <UserField user={f.assignee} />
            </div>

            {/* 4. Reporter */}
            <div>
              <SidebarLabel>Reporter</SidebarLabel>
              <UserField user={f.reporter} />
            </div>

            {/* 5. Priority */}
            <div>
              <SidebarLabel>Priority</SidebarLabel>
              <div className="flex items-center gap-2">
                <PriorityIcon priority={f.priority} />
                <span className="text-sm text-[#172B4D] dark:text-gray-100">
                  {f.priority?.name ?? 'None'}
                </span>
              </div>
            </div>

            {/* 6. Labels */}
            {f.labels && f.labels.length > 0 && (
              <div>
                <SidebarLabel>Labels</SidebarLabel>
                <div className="flex flex-wrap gap-1">
                  {f.labels.map((label) => (
                    <span
                      key={label}
                      className="text-xs bg-[#DFE1E6] dark:bg-gray-700 text-[#42526E] dark:text-gray-300 px-2 py-0.5 rounded-sm"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 7. Due Date */}
            {f.duedate && (
              <div>
                <SidebarLabel>Due Date</SidebarLabel>
                <span className="text-sm text-[#172B4D] dark:text-gray-100">
                  {new Date(f.duedate).toLocaleDateString('vi-VN', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })}
                </span>
              </div>
            )}

            {/* 8. Time Tracking */}
            {f.timetracking &&
              (f.timetracking.originalEstimate ||
                f.timetracking.timeSpent ||
                f.timetracking.remainingEstimate) && (
                <div>
                  <SidebarLabel>Time Tracking</SidebarLabel>
                  <TimeTrackingField tt={f.timetracking} />
                </div>
              )}

            {/* 9. Fix Versions */}
            {f.fixVersions && f.fixVersions.length > 0 && (
              <div>
                <SidebarLabel>Fix Version/s</SidebarLabel>
                <div className="flex flex-wrap gap-1">
                  {f.fixVersions.map((v) => (
                    <span
                      key={v.id}
                      className="text-xs bg-[#DFE1E6] dark:bg-gray-700 text-[#42526E] dark:text-gray-300 px-2 py-0.5 rounded-sm"
                    >
                      {v.name}
                      {v.released && (
                        <span className="ml-1 text-[#36B37E]">✓</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 10. Components */}
            {f.components && f.components.length > 0 && (
              <div>
                <SidebarLabel>Components</SidebarLabel>
                <div className="flex flex-wrap gap-1">
                  {f.components.map((c) => (
                    <span
                      key={c.id}
                      className="text-xs bg-[#DFE1E6] dark:bg-gray-700 text-[#42526E] dark:text-gray-300 px-2 py-0.5 rounded-sm"
                    >
                      {c.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <hr className="border-[#DFE1E6] dark:border-gray-700" />

            {/* 11. Project */}
            <div>
              <SidebarLabel>Project</SidebarLabel>
              <span className="text-sm text-[#172B4D] dark:text-gray-100">
                {f.project.name}
              </span>
            </div>

            {/* 12. Parent */}
            {f.parent && (
              <div>
                <SidebarLabel>Parent</SidebarLabel>
                <Link
                  href={`/issues/${f.parent.key}`}
                  className="text-sm text-[#0052CC] hover:underline"
                >
                  {f.parent.key}: {f.parent.fields.summary}
                </Link>
              </div>
            )}

            <hr className="border-[#DFE1E6] dark:border-gray-700" />

            {/* 13. Created */}
            <div>
              <SidebarLabel>Created</SidebarLabel>
              <span className="text-sm text-[#172B4D] dark:text-gray-100">
                {formatDate(f.created)}
              </span>
            </div>

            {/* 14. Updated */}
            <div>
              <SidebarLabel>Updated</SidebarLabel>
              <span className="text-sm text-[#172B4D] dark:text-gray-100">
                {formatDate(f.updated)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Log Work Modal */}
      {logWorkOpen && (
        <LogWorkModal
          issueKey={issueKey}
          onClose={() => setLogWorkOpen(false)}
          onSuccess={() => mutate()}
        />
      )}
    </div>
  );
}
