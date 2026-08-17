import { Router, Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = Router();

const MODEL_NAME = 'gemini-2.5-flash';

// Shared helper: get API key from header or 401
function getApiKey(req: Request, res: Response): string | null {
  const raw = req.headers['x-ai-key'];
  const key = Array.isArray(raw) ? raw[0] : raw;
  if (!key) {
    res.status(401).json({ error: 'Missing X-AI-Key header. Configure your AI API key in Settings.' });
    return null;
  }
  return key;
}

// Shared helper: call Gemini with a system prompt + user content, parse JSON response
async function callGemini(
  apiKey: string,
  systemPrompt: string,
  userContent: string
): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction: systemPrompt,
  });
  const result = await model.generateContent(userContent);
  return result.response.text();
}

// Helper: strip markdown code fences if Gemini wraps JSON in ```json ... ```
function stripCodeFence(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
}

// ─────────────────────────────────────────────────────────────
// POST /api/ai/summarize
// Body: { issueKey, summary, description, comments: string[] }
// Returns: { bullets: string[] }
// ─────────────────────────────────────────────────────────────
router.post('/summarize', async (req: Request, res: Response) => {
  const key = getApiKey(req, res);
  if (!key) return;

  const { issueKey, summary, description, comments } = req.body as {
    issueKey: string;
    summary: string;
    description: string;
    comments: string[];
  };

  const systemPrompt = `You are a Jira assistant. Summarize the following issue into 3-5 concise bullet points.
Respond in the same language as the issue content (Vietnamese or English).
Return JSON: { "bullets": ["...", "...", "..."] }
No markdown, no extra text — only valid JSON.`;

  const userContent = `Issue: ${issueKey}
Title: ${summary}
Description: ${description || '(no description)'}
Comments:
${(comments ?? []).map((c, i) => `${i + 1}. ${c}`).join('\n') || '(no comments)'}`;

  try {
    const raw = await callGemini(key, systemPrompt, userContent);
    const parsed = JSON.parse(stripCodeFence(raw)) as { bullets: string[] };
    return res.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI error';
    return res.status(500).json({ error: `Gemini error: ${message}` });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/ai/draft-comment
// Body: { issueKey, summary, intent }
// Returns: { draft: string }
// ─────────────────────────────────────────────────────────────
router.post('/draft-comment', async (req: Request, res: Response) => {
  const key = getApiKey(req, res);
  if (!key) return;

  const { issueKey, summary, intent } = req.body as {
    issueKey: string;
    summary: string;
    intent: string;
  };

  const systemPrompt = `You are a Jira assistant helping write professional issue comments.
Given the issue context and the user's intent, write a clear, professional comment.
Respond in the same language as the intent.
Return JSON: { "draft": "..." }
No markdown outside the draft, no extra text — only valid JSON.`;

  const userContent = `Issue: ${issueKey}
Title: ${summary}
User's intent: ${intent}`;

  try {
    const raw = await callGemini(key, systemPrompt, userContent);
    const parsed = JSON.parse(stripCodeFence(raw)) as { draft: string };
    return res.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI error';
    return res.status(500).json({ error: `Gemini error: ${message}` });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/ai/parse-worklog
// Body: { input: string }
// Returns: { timeSpent: string, comment: string }
// ─────────────────────────────────────────────────────────────
router.post('/parse-worklog', async (req: Request, res: Response) => {
  const key = getApiKey(req, res);
  if (!key) return;

  const { input } = req.body as { input: string };

  const systemPrompt = `You are a time tracking assistant. Parse the natural language time description into Jira worklog format.
Vietnamese time words: 'tiếng'/'giờ' = hours (h), 'phút' = minutes (m), 'ngày' = days (d), 'nửa tiếng' = 30m.
Extract: timeSpent (Jira format like "2h", "1h 30m", "45m") and a clean comment summarizing the work.
Return JSON: { "timeSpent": "...", "comment": "..." }
No extra text — only valid JSON.`;

  const userContent = `Time description: ${input}`;

  try {
    const raw = await callGemini(key, systemPrompt, userContent);
    const parsed = JSON.parse(stripCodeFence(raw)) as { timeSpent: string; comment: string };
    return res.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI error';
    return res.status(500).json({ error: `Gemini error: ${message}` });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/ai/suggest-transition
// Body: { issueKey, summary, description, currentStatus, comments: string[] }
// Returns: { suggestion: string, reason: string }
// ─────────────────────────────────────────────────────────────
router.post('/suggest-transition', async (req: Request, res: Response) => {
  const key = getApiKey(req, res);
  if (!key) return;

  const { issueKey, summary, description, currentStatus, comments } = req.body as {
    issueKey: string;
    summary: string;
    description: string;
    currentStatus: string;
    comments: string[];
  };

  const systemPrompt = `You are a Jira workflow assistant. Based on the issue details, suggest the most appropriate next status transition.
Consider the current status, description, and comments to determine if the issue should move forward or backward in the workflow.
Respond in the same language as the issue content.
Return JSON: { "suggestion": "transition name or 'no change'", "reason": "brief explanation" }
No extra text — only valid JSON.`;

  const userContent = `Issue: ${issueKey}
Title: ${summary}
Current status: ${currentStatus}
Description: ${description || '(no description)'}
Comments:
${(comments ?? []).map((c, i) => `${i + 1}. ${c}`).join('\n') || '(no comments)'}`;

  try {
    const raw = await callGemini(key, systemPrompt, userContent);
    const parsed = JSON.parse(stripCodeFence(raw)) as { suggestion: string; reason: string };
    return res.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI error';
    return res.status(500).json({ error: `Gemini error: ${message}` });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/ai/sprint-review
// Body: { worklogs: Array<{issueKey, summary, timeSpent, date, comment}> }
// Returns: { markdown: string }
// ─────────────────────────────────────────────────────────────
router.post('/sprint-review', async (req: Request, res: Response) => {
  const key = getApiKey(req, res);
  if (!key) return;

  const { worklogs } = req.body as {
    worklogs: Array<{
      issueKey: string;
      summary: string;
      timeSpent: string;
      date: string;
      comment: string;
    }>;
  };

  const systemPrompt = `You are a sprint review assistant. Given the worklogs for this week, generate a concise sprint review report in Markdown format.
Include: summary paragraph, key accomplishments as bullet list, total time breakdown by category if possible.
Respond in Vietnamese if the worklog comments are in Vietnamese, otherwise English.
Return JSON: { "markdown": "..." }
No extra text — only valid JSON.`;

  const worklogLines = (worklogs ?? [])
    .map(
      (w) =>
        `- [${w.issueKey}] ${w.summary || w.issueKey} | ${w.timeSpent} | ${w.date} | ${w.comment || '(no comment)'}`
    )
    .join('\n');

  const userContent = `Worklogs:\n${worklogLines}`;

  try {
    const raw = await callGemini(key, systemPrompt, userContent);
    const parsed = JSON.parse(stripCodeFence(raw)) as { markdown: string };
    return res.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI error';
    return res.status(500).json({ error: `Gemini error: ${message}` });
  }
});

export default router;
