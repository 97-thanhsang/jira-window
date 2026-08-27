import { Router, Request, Response, NextFunction } from 'express';
import { readStageOutput, getPipelineSummary, validateTaskKey } from '../services/opencode-reader';
import { runPipelineStage } from '../services/opencode-runner';
import {
  getServiceStatus,
  startService,
  stopService,
  proxyToOpenCode,
  proxyPostOpenCode,
  proxyDeleteOpenCode,
  readProjectConfig,
  readGlobalConfig,
  writeProjectConfig,
  BUILTIN_AGENTS,
  KNOWN_PROVIDERS,
} from '../services/opencode-service';
import type { PipelineStage } from '../types/opencode';

const router = Router();

// ─── Auth middleware — require X-Jira-Auth on every opencode route ────────────
function requireAuth(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers['x-jira-auth'];
  if (!auth) {
    return res.status(401).json({ success: false, error: 'Missing X-Jira-Auth header' });
  }
  next();
}

router.use(requireAuth);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/opencode/pipeline/:taskKey
// Lấy tổng quan pipeline status của một task
// ─────────────────────────────────────────────────────────────────────────────
router.get('/pipeline/:taskKey', async (req: Request, res: Response) => {
  try {
    const taskKey = Array.isArray(req.params.taskKey) ? req.params.taskKey[0] : req.params.taskKey;
    validateTaskKey(taskKey);
    const summary = await getPipelineSummary(taskKey);
    res.json({ success: true, data: summary });
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'INVALID_KEY') return res.status(400).json({ success: false, error: String(err) });
    console.error('[opencode] pipeline summary error:', err);
    res.status(500).json({ success: false, error: String(err) });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/opencode/stage/:taskKey/:stage
// Lấy chi tiết output của một stage cụ thể
// ─────────────────────────────────────────────────────────────────────────────
router.get('/stage/:taskKey/:stage', async (req: Request, res: Response) => {
  try {
    const taskKey = Array.isArray(req.params.taskKey) ? req.params.taskKey[0] : req.params.taskKey;
    const stage = Array.isArray(req.params.stage) ? req.params.stage[0] : req.params.stage;
    validateTaskKey(taskKey);
    const output = await readStageOutput(taskKey, stage as PipelineStage);
    res.json({ success: true, data: output });
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'INVALID_KEY') return res.status(400).json({ success: false, error: String(err) });
    console.error('[opencode] stage output error:', err);
    res.status(500).json({ success: false, error: String(err) });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/opencode/run
// Trigger một pipeline stage — stream progress via SSE
// Body: { taskKey: string, stage: PipelineStage, mode?: string }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/run', async (req: Request, res: Response) => {
  const { taskKey, stage, mode } = req.body as {
    taskKey: string;
    stage: PipelineStage;
    mode?: 'quick' | 'full' | 'auto';
  };

  if (!taskKey || !stage) {
    return res.status(400).json({ success: false, error: 'taskKey and stage required' });
  }

  try {
    validateTaskKey(taskKey);
  } catch {
    return res.status(400).json({ success: false, error: `Invalid taskKey: ${taskKey}` });
  }

  // SSE headers — stream progress lines
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    send('start', { taskKey, stage, mode });

    const wireLine = await runPipelineStage({
      taskKey,
      stage,
      mode,
      autoApprove: false,
      onProgress: (line) => {
        if (line.trim()) send('progress', { line });
      },
      onDone: (wire) => {
        send('done', { wireLine: wire });
      },
      onError: (err) => {
        send('stderr', { message: err });
      },
    });

    send('complete', { success: true, wireLine });
  } catch (err: unknown) {
    send('error', { message: String(err) });
  } finally {
    res.end();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/opencode/tasks
// Lấy danh sách tasks có pipeline output (scan analysis-reports/ + solution-designs/)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/tasks', async (_req: Request, res: Response) => {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const PROJECT_DIR = process.env.OPENCODE_PROJECT_DIR || process.cwd();

    const readTaskKeys = async (directory: string, suffix: string) => {
      try {
        const files = await fs.readdir(directory);
        return files
          .filter((file) => file.endsWith(suffix))
          .map((file) => file.slice(0, -suffix.length));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
        throw error;
      }
    };

    const taskKeys = Array.from(new Set((await Promise.all([
      readTaskKeys(path.join(PROJECT_DIR, 'analysis-reports'), '-analysis.md'),
      readTaskKeys(path.join(PROJECT_DIR, 'solution-designs'), '-solution.md'),
      readTaskKeys(path.join(PROJECT_DIR, 'execution-reports'), '-execute.md'),
    ])).flat()));

    res.json({ success: true, data: { taskKeys } });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// SERVICE MANAGEMENT
// ═════════════════════════════════════════════════════════════════════════════

router.get('/service', async (_req, res: Response) => {
  try { res.json({ success: true, data: await getServiceStatus() }); }
  catch (err) { res.status(500).json({ success: false, error: String(err) }); }
});

router.post('/service/start', async (_req, res: Response) => {
  try {
    await startService();
    res.json({ success: true, data: await getServiceStatus() });
  } catch (err) { res.status(500).json({ success: false, error: String(err) }); }
});

router.post('/service/stop', async (_req, res: Response) => {
  try {
    await stopService();
    res.json({ success: true, data: { running: false } });
  } catch (err) { res.status(500).json({ success: false, error: String(err) }); }
});

// ═════════════════════════════════════════════════════════════════════════════
// CONFIG — read/write opencode.json (file-based; also tries live /config)
// ═════════════════════════════════════════════════════════════════════════════

router.get('/config', async (_req, res: Response) => {
  try {
    const [project, global_] = await Promise.all([readProjectConfig(), readGlobalConfig()]);

    // Try to get the live merged config from OpenCode server too
    let live: Record<string, unknown> | null = null;
    try { live = await proxyToOpenCode<Record<string, unknown>>('/config'); } catch { /* offline */ }

    res.json({
      success: true,
      data: {
        project:  project.config,
        global:   global_,
        filePath: project.filePath,
        merged:   live ?? { ...global_, ...project.config },
      },
    });
  } catch (err) { res.status(500).json({ success: false, error: String(err) }); }
});

router.patch('/config', async (req: Request, res: Response) => {
  try {
    const updates = req.body as Record<string, unknown>;
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ success: false, error: 'Body must be a JSON object' });
    }
    const { config: current } = await readProjectConfig();
    const merged = { ...current, ...updates };
    const filePath = await writeProjectConfig(merged);
    res.json({ success: true, data: { config: merged, filePath } });
  } catch (err) { res.status(500).json({ success: false, error: String(err) }); }
});

// ═════════════════════════════════════════════════════════════════════════════
// AGENTS  — GET /agent  (correct endpoint per OpenCode API)
// ═════════════════════════════════════════════════════════════════════════════

router.get('/agents-list', async (_req, res: Response) => {
  try {
    const live = await proxyToOpenCode<unknown>('/agent');
    // /agent may return array or { agents: [...] }
    const data = Array.isArray(live) ? live
      : (live as Record<string, unknown>)?.agents ?? BUILTIN_AGENTS;
    res.json({ success: true, data, source: 'live' });
  } catch {
    res.json({ success: true, data: BUILTIN_AGENTS, source: 'builtin' });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// COMMANDS  — GET /command
// ═════════════════════════════════════════════════════════════════════════════

router.get('/commands-list', async (_req, res: Response) => {
  try {
    const live = await proxyToOpenCode<unknown>('/command');
    const data = Array.isArray(live) ? live
      : (live as Record<string, unknown>)?.commands ?? [];
    res.json({ success: true, data, source: 'live' });
  } catch {
    res.json({ success: true, data: [], source: 'offline' });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// SKILLS  — GET /skill
// ═════════════════════════════════════════════════════════════════════════════

router.get('/skills-list', async (_req, res: Response) => {
  try {
    const live = await proxyToOpenCode<unknown>('/skill');
    const data = Array.isArray(live) ? live
      : (live as Record<string, unknown>)?.skills ?? [];
    res.json({ success: true, data, source: 'live' });
  } catch {
    res.json({ success: true, data: [], source: 'offline' });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// PROVIDERS / MODELS  — GET /config/providers
// ═════════════════════════════════════════════════════════════════════════════

router.get('/providers', async (_req, res: Response) => {
  try {
    const live = await proxyToOpenCode<unknown>('/config/providers');
    res.json({ success: true, data: live, source: 'live' });
  } catch {
    res.json({ success: true, data: KNOWN_PROVIDERS, source: 'builtin' });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// MCP SERVERS  — GET /mcp
// ═════════════════════════════════════════════════════════════════════════════

function normalizeMcpResponse(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.servers)) return obj.servers as unknown[];
    // keyed by server name
    return Object.entries(obj).map(([name, val]) => ({
      name,
      ...(typeof val === 'object' && val !== null ? (val as Record<string, unknown>) : {}),
    }));
  }
  return [];
}

router.get('/mcp-status', async (_req, res: Response) => {
  try {
    const live = await proxyToOpenCode<unknown>('/mcp');
    res.json({ success: true, data: normalizeMcpResponse(live), source: 'live' });
  } catch {
    const { config } = await readProjectConfig();
    const mcpConfig = (config.mcp as Record<string, unknown>) ?? {};
    const servers = Object.entries(mcpConfig).map(([name, cfg]) => ({
      name, ...(cfg as Record<string, unknown>), status: 'unknown',
    }));
    res.json({ success: true, data: servers, source: 'config' });
  }
});

// MCP connect / disconnect
router.post('/mcp/:name/connect', async (req: Request, res: Response) => {
  try {
    const name = Array.isArray(req.params.name) ? req.params.name[0] : req.params.name;
    const result = await proxyPostOpenCode(`/mcp/${encodeURIComponent(name)}/connect`);
    res.json({ success: true, data: result });
  } catch (err) { res.status(500).json({ success: false, error: String(err) }); }
});

router.post('/mcp/:name/disconnect', async (req: Request, res: Response) => {
  try {
    const name = Array.isArray(req.params.name) ? req.params.name[0] : req.params.name;
    const result = await proxyPostOpenCode(`/mcp/${encodeURIComponent(name)}/disconnect`);
    res.json({ success: true, data: result });
  } catch (err) { res.status(500).json({ success: false, error: String(err) }); }
});

// ═════════════════════════════════════════════════════════════════════════════
// SESSIONS  — GET /session  (OpenCode native sessions)
// ═════════════════════════════════════════════════════════════════════════════

router.get('/sessions', async (_req, res: Response) => {
  try {
    const live = await proxyToOpenCode<unknown>('/session');
    const data = Array.isArray(live) ? live
      : (live as Record<string, unknown>)?.sessions ?? [];
    res.json({ success: true, data, source: 'live' });
  } catch {
    res.json({ success: true, data: [], source: 'offline' });
  }
});

router.get('/sessions/:sessionId/messages', async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
    const live = await proxyToOpenCode<unknown>(`/session/${encodeURIComponent(id)}/message`);
    const data = Array.isArray(live) ? live
      : (live as Record<string, unknown>)?.messages ?? [];
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, error: String(err) }); }
});

router.delete('/sessions/:sessionId', async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
    await proxyDeleteOpenCode(`/session/${encodeURIComponent(id)}`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: String(err) }); }
});

export default router;
