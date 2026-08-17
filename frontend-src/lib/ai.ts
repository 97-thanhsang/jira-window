/**
 * AI helper — calls backend /api/ai/* routes.
 * Key is read from localStorage('ai_api_key') and sent as X-AI-Key header.
 * NEVER calls Gemini directly from the browser.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getAiKey(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('ai_api_key') ?? '';
}

async function aiPost<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  const key = getAiKey();
  if (!key) {
    throw new Error('No AI API key configured. Please add your Gemini API key in Settings.');
  }

  const res = await fetch(`${API_URL}/api/ai/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-AI-Key': key,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({ error: res.statusText }))) as {
      error?: string;
    };
    throw new Error(data.error ?? `AI request failed (${res.status})`);
  }

  return res.json() as Promise<T>;
}

// ─────────────────────────────────────────────────────────────

export interface AiSummarizePayload {
  issueKey: string;
  summary: string;
  description: string;
  comments: string[];
}

export async function aiSummarize(
  payload: AiSummarizePayload
): Promise<{ bullets: string[] }> {
  return aiPost<{ bullets: string[] }>('summarize', payload as unknown as Record<string, unknown>);
}

// ─────────────────────────────────────────────────────────────

export interface AiDraftCommentPayload {
  issueKey: string;
  summary: string;
  intent: string;
}

export async function aiDraftComment(
  payload: AiDraftCommentPayload
): Promise<{ draft: string }> {
  return aiPost<{ draft: string }>('draft-comment', payload as unknown as Record<string, unknown>);
}

// ─────────────────────────────────────────────────────────────

export async function aiParseWorklog(
  input: string
): Promise<{ timeSpent: string; comment: string }> {
  return aiPost<{ timeSpent: string; comment: string }>('parse-worklog', { input });
}

// ─────────────────────────────────────────────────────────────

export interface AiSuggestTransitionPayload {
  issueKey: string;
  summary: string;
  description: string;
  currentStatus: string;
  comments: string[];
}

export async function aiSuggestTransition(
  payload: AiSuggestTransitionPayload
): Promise<{ suggestion: string; reason: string }> {
  return aiPost<{ suggestion: string; reason: string }>(
    'suggest-transition',
    payload as unknown as Record<string, unknown>
  );
}

// ─────────────────────────────────────────────────────────────

export interface WorklogItem {
  issueKey: string;
  summary: string;
  timeSpent: string;
  date: string;
  comment: string;
}

export async function aiSprintReview(
  worklogs: WorklogItem[]
): Promise<{ markdown: string }> {
  return aiPost<{ markdown: string }>('sprint-review', { worklogs });
}
