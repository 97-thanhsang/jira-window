import { Router, Request, Response } from 'express';
import axios, { AxiosError } from 'axios';
import { config } from '../config';

const router = Router();
const JIRA_ORIGIN = new URL(config.jiraBaseUrl).origin;

function isAllowedJiraUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.origin === JIRA_ORIGIN;
  } catch {
    return false;
  }
}

function reattachAuth(
  targetHref: string | undefined,
  headers: Record<string, string>,
  authHeader: string
): void {
  if (targetHref && isAllowedJiraUrl(targetHref)) {
    headers.Authorization = `Basic ${authHeader}`;
  } else {
    delete headers.Authorization;
    delete headers.authorization;
  }
}

function hasPathTraversal(rawPath: string | string[]): boolean {
  const segments = Array.isArray(rawPath) ? rawPath : rawPath.split('/');
  return segments.some((segment) => segment === '..' || segment === '.');
}

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
  if (!isAllowedJiraUrl(avatarUrl)) {
    return res.status(400).json({ error: 'Avatar url not allowed' });
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
      beforeRedirect: (options: Record<string, unknown>, { headers }: { headers: Record<string, string> }) => {
        const targetHref = typeof options.href === 'string'
          ? options.href
          : `${String(options.protocol ?? '')}//${String(options.host ?? '')}${String(options.path ?? '')}`;
        reattachAuth(targetHref, headers, authHeader);
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

  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!/^\d+$/.test(id)) {
    return res.status(400).json({ error: 'Invalid attachment id' });
  }
  // Jira Server does NOT have /rest/api/2/attachment/content/{id} (Cloud only → 404).
  // The correct Jira Server URL comes from attachment metadata: /secure/attachment/{id}/{filename}
  // Frontend passes the full `content` URL (from attachment object) as query param `url`,
  // OR we fall back to fetching metadata first to get the real URL.
  const rawContentUrl = req.query.url;
  if (rawContentUrl !== undefined &&
      (typeof rawContentUrl !== 'string' || !isAllowedJiraUrl(rawContentUrl))) {
    return res.status(400).json({ error: 'Attachment url not allowed' });
  }
  const contentUrl = typeof rawContentUrl === 'string' ? rawContentUrl : undefined;
  const jiraUrl = contentUrl || `${config.jiraBaseUrl}/secure/attachment/${id}/attachment`;

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
        const targetHref = typeof options.href === 'string'
          ? options.href
          : `${String(options.protocol ?? '')}//${String(options.host ?? '')}${String(options.path ?? '')}`;
        reattachAuth(targetHref, headers, authHeader);
      },
    });

    const contentType = (response.headers['content-type'] as string) || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    response.data.pipe(res);
  } catch (err) {
    const error = err as AxiosError;
    console.error(`[attachment] ERROR status=${error.response?.status}`, error.message);
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

  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!/^\d+$/.test(id)) {
    return res.status(400).json({ error: 'Invalid attachment id' });
  }
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
        const targetHref = typeof options.href === 'string'
          ? options.href
          : `${String(options.protocol ?? '')}//${String(options.host ?? '')}${String(options.path ?? '')}`;
        reattachAuth(targetHref, options.headers as Record<string, string>, authHeader);
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
          const targetHref = typeof options.href === 'string'
            ? options.href
            : `${String(options.protocol ?? '')}//${String(options.host ?? '')}${String(options.path ?? '')}`;
          reattachAuth(targetHref, options.headers as Record<string, string>, authHeader);
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
router.all('/agile/*path', async (req: Request, res: Response) => {
  const rawAuth = req.headers['x-jira-auth'];
  const authHeader = Array.isArray(rawAuth) ? rawAuth[0] : rawAuth;
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing X-Jira-Auth header' });
  }

  const rawPath = req.params['path'];
  if (Array.isArray(rawPath) ? hasPathTraversal(rawPath) : hasPathTraversal(rawPath ?? '')) {
    return res.status(400).json({ error: 'Invalid path' });
  }
  const agilePath = Array.isArray(rawPath) ? rawPath.join('/') : (rawPath ?? '');
  const jiraUrl = `${config.jiraBaseUrl}/rest/agile/1.0/${agilePath}`;

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

    return res.status(response.status).json(response.data);
  } catch (err) {
    const error = err as AxiosError;
    const status = error.response?.status || 500;
    const data = error.response?.data || { error: 'Jira Agile API error' };
    return res.status(status).json(data);
  }
});

// ─── Generic proxy: all other /api/jira/* requests ──────────────────────────
// Proxy all requests: GET/POST /api/jira/* → Jira REST API v2
// Express v5 uses path-to-regexp v8: wildcards must be named (/*path not /*)
router.all('/*path', async (req: Request, res: Response) => {
  const rawAuth = req.headers['x-jira-auth'];
  const authHeader = Array.isArray(rawAuth) ? rawAuth[0] : rawAuth;
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing X-Jira-Auth header' });
  }

  // Express v5 path-to-regexp v8: /*path captures an ARRAY of segments, not a string
  // e.g. /issue/PROJ-123/transitions → ['issue', 'PROJ-123', 'transitions']
  const rawPath = req.params['path'];
  if (Array.isArray(rawPath) ? hasPathTraversal(rawPath) : hasPathTraversal(rawPath ?? '')) {
    return res.status(400).json({ error: 'Invalid path' });
  }
  const jiraPath = Array.isArray(rawPath) ? rawPath.join('/') : (rawPath ?? '');
  const jiraUrl = `${config.jiraBaseUrl}/rest/api/2/${jiraPath}`;

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

    return res.status(response.status).json(response.data);
  } catch (err) {
    const error = err as AxiosError;
    const status = error.response?.status || 500;
    const data = error.response?.data || { error: 'Jira API error' };
    return res.status(status).json(data);
  }
});

export default router;
