'use client';

import { useState, useEffect } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import { aiDraftComment } from '@/lib/ai';
import { Button } from '@/components/ui/button';
import { WikiRenderer } from '@/components/issue/wiki-renderer';
import type { JiraComment } from '@/types/jira';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getInitials(displayName: string): string {
  return displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

interface CommentSectionProps {
  issueKey: string;
  issueSummary?: string;
  comments: JiraComment[];
  onCommentAdded: () => void;
}

export function CommentSection({
  issueKey,
  issueSummary = '',
  comments,
  onCommentAdded,
}: CommentSectionProps) {
  const [body, setBody] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // AI draft state
  const [hasAiKey, setHasAiKey] = useState(false);
  const [showDraftForm, setShowDraftForm] = useState(false);
  const [draftIntent, setDraftIntent] = useState('');
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);

  // Read AI key from localStorage — only in useEffect
  useEffect(() => {
    setHasAiKey(!!localStorage.getItem('ai_api_key'));
  }, []);

  async function handleSubmit() {
    if (!body.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await api.post(`/issue/${issueKey}/comment`, { body: body.trim() });
      setBody('');
      setShowForm(false);
      onCommentAdded();
    } catch {
      setError('Failed to add comment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleCancel() {
    setShowForm(false);
    setBody('');
    setError(null);
    setShowDraftForm(false);
    setDraftIntent('');
    setDraftError(null);
  }

  async function handleGenerateDraft() {
    if (!draftIntent.trim()) return;
    setDraftLoading(true);
    setDraftError(null);
    try {
      const result = await aiDraftComment({
        issueKey,
        summary: issueSummary,
        intent: draftIntent.trim(),
      });
      setBody(result.draft);
      setShowDraftForm(false);
      setDraftIntent('');
    } catch (err: unknown) {
      const e = err instanceof Error ? err.message : 'AI error';
      setDraftError(e);
    } finally {
      setDraftLoading(false);
    }
  }

  return (
    <section>
      <h2 className="text-xs font-semibold text-[#5E6C84] uppercase tracking-wider mb-3">
        Comments ({comments.length})
      </h2>

      {/* Existing comments */}
      {comments.length > 0 && (
        <div className="space-y-3 mb-4">
          {comments.map((c) => (
            <div
              key={c.id}
              className="bg-white rounded-sm border border-[#DFE1E6] p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-[#0052CC] text-white text-xs flex items-center justify-center flex-shrink-0 font-medium">
                  {getInitials(c.author.displayName)}
                </div>
                <span className="text-xs font-semibold text-[#172B4D]">
                  {c.author.displayName}
                </span>
                <span className="text-xs text-[#5E6C84]">
                  {formatDate(c.created)}
                </span>
              </div>
              <WikiRenderer content={c.body} />
            </div>
          ))}
        </div>
      )}

      {/* Add comment form */}
      {showForm ? (
        <div className="bg-white rounded-sm border border-[#DFE1E6] p-4">
          {/* AI Draft with AI button */}
          {hasAiKey && (
            <div className="mb-3">
              {!showDraftForm ? (
                <button
                  onClick={() => setShowDraftForm(true)}
                  className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
                >
                  <Sparkles size={11} />
                  ✨ Draft with AI
                </button>
              ) : (
                <div className="bg-indigo-50 border border-indigo-200 rounded-md p-3 space-y-2">
                  <p className="text-xs font-medium text-indigo-700">
                    What do you want to say? (brief intent)
                  </p>
                  <input
                    type="text"
                    placeholder="e.g. Cập nhật tiến độ task, xong rồi, cần review"
                    value={draftIntent}
                    onChange={(e) => setDraftIntent(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleGenerateDraft(); }}
                    className="w-full rounded border border-indigo-200 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:border-indigo-400"
                    autoFocus
                  />
                  {draftError && (
                    <p className="text-xs text-red-600">{draftError}</p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleGenerateDraft}
                      disabled={draftLoading || !draftIntent.trim()}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                      {draftLoading ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : (
                        <Sparkles size={11} />
                      )}
                      {draftLoading ? 'Generating…' : 'Generate'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => { setShowDraftForm(false); setDraftIntent(''); setDraftError(null); }}
                      disabled={draftLoading}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          <textarea
            className="w-full rounded-lg border border-[#DFE1E6] px-2.5 py-1.5 text-sm resize-none focus:outline-none focus:border-[#0052CC] placeholder:text-[#5E6C84] transition-colors"
            rows={4}
            placeholder="Add a comment…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            autoFocus={!hasAiKey}
          />
          {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
          <div className="flex items-center gap-2 mt-2">
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={isSubmitting || !body.trim()}
            >
              {isSubmitting && (
                <Loader2 size={12} className="animate-spin" />
              )}
              Save
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="w-full text-left px-4 py-2.5 text-sm text-[#5E6C84] bg-[#F4F5F7] rounded-sm border border-[#DFE1E6] hover:bg-[#EBECF0] transition-colors"
        >
          Add a comment…
        </button>
      )}
    </section>
  );
}
