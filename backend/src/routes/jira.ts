import { Router, Request, Response } from 'express';
import axios, { AxiosError } from 'axios';
import { config } from '../config';

const router = Router();

function getJiraAuth(req: Request): string | undefined {
  const rawAuth = req.headers['x-jira-auth'];
  return Array.isArray(rawAuth) ? rawAuth[0] : rawAuth;
}

function getWildcardPath(req: Request): string {
  // Express v5 path-to-regexp v8: /*path captures an ARRAY of segments, not a string
  // e.g. /issue/PROJ-123/transitions → ['issue', 'PROJ-123', 'transitions']
  const rawPath = req.params['path'];
  return Array.isArray(rawPath) ? rawPath.join('/') : (rawPath ?? '');
}

function createProxyHandler(pathPrefix: string, errorMessage: string) {
  return async (req: Request, res: Response) => {
    const authHeader = getJiraAuth(req);
    if (!authHeader) {
      res.status(401).json({ error: 'Missing X-Jira-Auth header' });
      return;
    }

    const jiraPath = getWildcardPath(req);
    const jiraUrl = `${config.jiraBaseUrl}${pathPrefix}${jiraPath}`;

    try {
      const response = await axios({
        method: req.method,
        url: jiraUrl,
        headers: {
          Authorization: `Basic ${authHeader}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        params: req.query,
        data: req.method !== 'GET' ? req.body : undefined,
      });

      res.status(response.status).json(response.data);
    } catch (err) {
      const error = err as AxiosError;
      const status = error.response?.status || 500;
      const data = error.response?.data || { error: errorMessage };
      res.status(status).json(data);
    }
  };
}

// ─── Avatar proxy: stream Jira avatar with auth ──────────────────────────────
router.get('/avatar', async (req: Request, res: Response) => {
  const authHeader = getJiraAuth(req);
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing auth' });
  }

  const avatarUrl = typeof req.query.url === 'string' ? req.query.url : '';
  if (!avatarUrl) {
    return res.status(400).json({ error: 'Missing avatar url' });
  }

  try {
    const response = await axios({
      method: 'GET',
      url: avatarUrl,
      headers: {
        Authorization: `Basic ${authHeader}`,
        'X-Atlassian-Token': 'no-check',
      },
      responseType: 'stream',
      maxRedirects: 5,
      beforeRedirect: (_options: Record<string, unknown>, { headers }: { headers: Record<string, string> }) => {
        headers['Authorization'] = `Basic ${authHeader}`;
      },
    });

    const contentType = (response.headers['content-type'] as string) || 'image/png';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    response.data.pipe(res);
  } catch (err) {
    const error = err as AxiosError;
    return res.status(error.response?.status || 500).json({ error: 'Avatar fetch failed' });
  }
});

// ─── Attachment proxy: stream binary content with auth ───────────────────────
// GET /api/jira/attachment-content/:id → streams image/file from Jira
// NOTE: Jira Server does NOT support ?redirect=false (Cloud only).
// We use maxRedirects + keep Authorization on redirect via httpAgent workaround.
router.get('/attachment-content/:id', async (req: Request, res: Response) => {
  const authHeader = getJiraAuth(req);
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing auth' });
  }

  const id = req.params.id;
  // Jira Server does NOT have /rest/api/2/attachment/content/{id} (Cloud only → 404).
  // The correct Jira Server URL comes from attachment metadata: /secure/attachment/{id}/{filename}
  // Frontend passes the full `content` URL (from attachment object) as query param `url`,
  // OR we fall back to fetching metadata first to get the real URL.
  const contentUrl = req.query.url as string | undefined;
  const jiraUrl = contentUrl || `${config.jiraBaseUrl}/secure/attachment/${id}/attachment`;

  console.log(`[attachment] fetching id=${id} url=${jiraUrl}`);

  try {
    const response = await axios({
      method: 'GET',
      url: jiraUrl,
      headers: {
        Authorization: `Basic ${authHeader}`,
        'X-Atlassian-Token': 'no-check',
      },
      responseType: 'stream',
      maxRedirects: 5,
      beforeRedirect: (options: Record<string, unknown>, { headers }: { headers: Record<string, string> }) => {
        console.log(`[attachment] redirect → ${String(options.href ?? options.path)}`);
        headers['Authorization'] = `Basic ${authHeader}`;
      },
    });

    console.log(`[attachment] success status=${response.status} content-type=${response.headers['content-type']}`);
    const contentType = (response.headers['content-type'] as string) || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    response.data.pipe(res);
  } catch (err) {
    const error = err as AxiosError;
    console.error(`[attachment] ERROR status=${error.response?.status}`, error.message);
    if (error.response?.data) {
      // drain stream if error body is a stream
      const d = error.response.data as { pipe?: unknown };
      if (typeof d.pipe === 'function') {
        const chunks: Buffer[] = [];
        (d as NodeJS.ReadableStream).on('data', (c: Buffer) => chunks.push(c));
        (d as NodeJS.ReadableStream).on('end', () => {
          console.error(`[attachment] error body: ${Buffer.concat(chunks).toString('utf8').slice(0, 300)}`);
        });
      }
    }
    return res.status(error.response?.status || 500).json({ error: 'Attachment fetch failed' });
  }
});

// ─── Thumbnail proxy ─────────────────────────────────────────────────────────
// GET /api/jira/attachment-thumbnail/:id → thumbnail (smaller)
router.get('/attachment-thumbnail/:id', async (req: Request, res: Response) => {
  const authHeader = getJiraAuth(req);
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing auth' });
  }

  const id = req.params.id;
  // Jira Server thumbnail: /secure/thumbnail/{id}/_thumb_{id}.png
  // REST thumbnail endpoint may not exist on Server — fall back to content
  const jiraUrl = `${config.jiraBaseUrl}/secure/thumbnail/${id}/_thumb_${id}.png`;

  try {
    const response = await axios({
      method: 'GET',
      url: jiraUrl,
      headers: {
        Authorization: `Basic ${authHeader}`,
        'X-Atlassian-Token': 'no-check',
      },
      responseType: 'stream',
      maxRedirects: 5,
      beforeRedirect: (options: Record<string, unknown>) => {
        (options.headers as Record<string, string>)['Authorization'] = `Basic ${authHeader}`;
      },
    });

    const contentType =
      (response.headers['content-type'] as string) || 'image/png';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    response.data.pipe(res);
  } catch {
    // Thumbnail not available — fall back to full content
    const fallbackUrl = `${config.jiraBaseUrl}/rest/api/2/attachment/content/${id}`;
    try {
      const response = await axios({
        method: 'GET',
        url: fallbackUrl,
        headers: { Authorization: `Basic ${authHeader}` },
        responseType: 'stream',
        maxRedirects: 5,
        beforeRedirect: (options: Record<string, unknown>) => {
          (options.headers as Record<string, string>)['Authorization'] = `Basic ${authHeader}`;
        },
      });
      const contentType = (response.headers['content-type'] as string) || 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      response.data.pipe(res);
    } catch (err2) {
      const error = err2 as AxiosError;
      return res.status(error.response?.status || 500).json({ error: 'Thumbnail fetch failed' });
    }
  }
});

// ─── Agile proxy: /api/jira/agile/* → Jira Agile REST API v1 ────────────────
// Used for board, sprint, and other agile endpoints
router.all('/agile/*path', createProxyHandler('/rest/agile/1.0/', 'Jira Agile API error'));

// ─── Generic proxy: all other /api/jira/* requests ──────────────────────────
// Proxy all requests: GET/POST /api/jira/* → Jira REST API v2
// Express v5 uses path-to-regexp v8: wildcards must be named (/*path not /*)
router.all('/*path', createProxyHandler('/rest/api/2/', 'Jira API error'));

export default router;
