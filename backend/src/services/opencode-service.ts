/**
 * opencode-service.ts
 * Manages the OpenCode server process lifecycle and proxies to its REST API.
 *
 * OpenCode server API: https://opencode.ai/docs/server/
 *
 * Important: Every request to the OpenCode server (except /global/*) requires
 * the `x-opencode-directory` header containing the base64-encoded project path.
 * This tells the server which project directory to operate on.
 */
import { spawn, ChildProcess } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import http from 'http';
import os from 'os';

// ─── Constants ────────────────────────────────────────────────────────────────

export const OPENCODE_PORT    = parseInt(process.env.OPENCODE_SERVER_PORT ?? '4096', 10);
const OPENCODE_CLI             = process.env.OPENCODE_CLI_PATH ?? 'opencode';
const PROJECT_DIR              = path.resolve(process.env.OPENCODE_PROJECT_DIR ?? process.cwd());

/** base64-encoded project directory — required on every non-global proxy call */
export const OPENCODE_DIR_HEADER = Buffer.from(PROJECT_DIR).toString('base64');

// Possible project-level config paths (highest priority first)
const PROJECT_CONFIG_PATHS = [
  path.join(PROJECT_DIR, '.opencode', 'opencode.json'),
  path.join(PROJECT_DIR, '.opencode', 'opencode.jsonc'),
  path.join(PROJECT_DIR, 'opencode.json'),
  path.join(PROJECT_DIR, 'opencode.jsonc'),
];

/** Global config path(s) — XDG on Linux/Mac, %APPDATA% on Windows, fallback ~/.config/opencode */
function globalConfigPaths(): string[] {
  if (process.platform === 'win32') {
    const appdata = process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming');
    return [
      path.join(appdata, 'opencode', 'opencode.json'),
      path.join(os.homedir(), '.config', 'opencode', 'opencode.json'),
    ];
  }
  return [
    path.join(
      process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config'),
      'opencode', 'opencode.json'
    ),
  ];
}

// ─── Process tracking ────────────────────────────────────────────────────────

let managedProc: ChildProcess | null       = null;
let managedStartedAt: Date | null          = null;
let managedPort: number                    = OPENCODE_PORT;

// ─── HTTP helper ─────────────────────────────────────────────────────────────

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** include x-opencode-directory header (true by default for non-global paths) */
  withDirectory?: boolean;
  port?: number;
}

function httpRequest<T = unknown>(apiPath: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, port = managedPort } = opts;
  const withDirectory = opts.withDirectory ?? !apiPath.startsWith('/global');

  const bodyStr = body !== undefined ? JSON.stringify(body) : undefined;

  const reqOpts: http.RequestOptions = {
    hostname: '127.0.0.1',
    port,
    path: apiPath,
    method,
    timeout: 8000,
    headers: {
      'Accept': 'application/json',
      ...(withDirectory ? { 'x-opencode-directory': OPENCODE_DIR_HEADER } : {}),
      ...(bodyStr ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
    },
  };

  return new Promise((resolve, reject) => {
    const req = http.request(reqOpts, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`OpenCode HTTP ${res.statusCode}: ${raw.slice(0, 200)}`));
          return;
        }
        try { resolve(JSON.parse(raw) as T); }
        catch { resolve(raw as unknown as T); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('OpenCode request timeout')); });
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ─── Health check ────────────────────────────────────────────────────────────

export function fetchOpenCodeHealth(port = managedPort): Promise<Record<string, unknown>> {
  return httpRequest<Record<string, unknown>>('/global/health', { withDirectory: false, port });
}

// ─── Proxy helpers ───────────────────────────────────────────────────────────

export const proxyToOpenCode    = <T>(p: string) => httpRequest<T>(p, { method: 'GET' });
export const proxyPostOpenCode  = <T>(p: string, body?: unknown) => httpRequest<T>(p, { method: 'POST', body });
export const proxyPatchOpenCode = <T>(p: string, body?: unknown) => httpRequest<T>(p, { method: 'PATCH', body });
export const proxyDeleteOpenCode = <T>(p: string) => httpRequest<T>(p, { method: 'DELETE' });

// ─── Service Status ──────────────────────────────────────────────────────────

export interface ServiceStatus {
  running: boolean;
  managed: boolean;
  pid?: number;
  port: number;
  version?: string;
  startedAt?: string;
  directory?: string;
}

export async function getServiceStatus(): Promise<ServiceStatus> {
  try {
    const health = await fetchOpenCodeHealth();
    return {
      running:   true,
      managed:   managedProc !== null && managedProc.exitCode === null,
      pid:       managedProc?.pid,
      port:      managedPort,
      version:   health.version as string | undefined,
      startedAt: managedStartedAt?.toISOString(),
      directory: PROJECT_DIR,
    };
  } catch {
    return { running: false, managed: false, port: managedPort, directory: PROJECT_DIR };
  }
}

// ─── Start ───────────────────────────────────────────────────────────────────

export function startService(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (managedProc && managedProc.exitCode === null) return resolve();

    managedPort = OPENCODE_PORT;

    const proc = spawn(
      OPENCODE_CLI,
      ['serve', '--port', String(OPENCODE_PORT)],
      {
        cwd:   PROJECT_DIR,
        stdio: ['ignore', 'pipe', 'pipe'],
        env:   { ...process.env },
        // On Windows, shell:true needed if opencode is a .cmd script
        shell: process.platform === 'win32',
      }
    );

    managedProc      = proc;
    managedStartedAt = new Date();

    // Parse stdout for "opencode server listening on http://<host>:<port>"
    proc.stdout?.on('data', (chunk: Buffer) => {
      const line = chunk.toString();
      const match = line.match(/listening on http:\/\/[^:]+:(\d+)/i);
      if (match) {
        managedPort = parseInt(match[1], 10);
      }
    });

    proc.on('error', (err) => {
      managedProc      = null;
      managedStartedAt = null;
      reject(err);
    });

    proc.on('exit', (code) => {
      managedProc      = null;
      managedStartedAt = null;
      if (code && code !== 0) {
        console.warn(`[opencode-service] process exited with code ${code}`);
      }
    });

    // Poll health until ready (max 20 s)
    let attempts = 0;
    const poll = setInterval(async () => {
      attempts++;
      try {
        await fetchOpenCodeHealth(managedPort);
        clearInterval(poll);
        resolve();
      } catch {
        if (attempts >= 40) {
          clearInterval(poll);
          reject(new Error('OpenCode server did not become healthy within 20 s'));
        }
      }
    }, 500);
  });
}

// ─── Stop ────────────────────────────────────────────────────────────────────

export function stopService(): Promise<void> {
  return new Promise((resolve) => {
    const proc = managedProc;
    if (!proc || proc.exitCode !== null) {
      managedProc      = null;
      managedStartedAt = null;
      return resolve();
    }
    proc.once('exit', () => {
      managedProc      = null;
      managedStartedAt = null;
      resolve();
    });
    try { proc.kill('SIGTERM'); }
    catch { managedProc = null; managedStartedAt = null; resolve(); }
  });
}

// ─── Config file management ──────────────────────────────────────────────────

/** Strip JSONC comments so we can JSON.parse */
function stripJsonc(raw: string): string {
  return raw
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
}

export async function readProjectConfig(): Promise<{
  config: Record<string, unknown>;
  filePath: string | null;
}> {
  for (const p of PROJECT_CONFIG_PATHS) {
    try {
      const raw = await fs.readFile(p, 'utf-8');
      return { config: JSON.parse(stripJsonc(raw)) as Record<string, unknown>, filePath: p };
    } catch { /* try next */ }
  }
  return { config: {}, filePath: null };
}

export async function readGlobalConfig(): Promise<Record<string, unknown>> {
  for (const p of globalConfigPaths()) {
    try {
      const raw = await fs.readFile(p, 'utf-8');
      return JSON.parse(stripJsonc(raw)) as Record<string, unknown>;
    } catch { /* try next */ }
  }
  return {};
}

/** Always writes to .opencode/opencode.json (highest-priority project config) */
export async function writeProjectConfig(config: Record<string, unknown>): Promise<string> {
  const target = PROJECT_CONFIG_PATHS[0]; // .opencode/opencode.json
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, JSON.stringify(config, null, 2), 'utf-8');
  return target;
}

// ─── Built-in fallback catalogs ───────────────────────────────────────────────

export const BUILTIN_AGENTS = [
  { id: 'build',    name: 'build',    mode: 'primary',  description: 'Default — full tool access: file edits, bash, web search' },
  { id: 'plan',     name: 'plan',     mode: 'primary',  description: 'Read-only analysis; edit/bash default to ask' },
  { id: 'general',  name: 'general',  mode: 'subagent', description: 'Multi-purpose, full tool access except todowrite' },
  { id: 'explore',  name: 'explore',  mode: 'subagent', description: 'Read-only codebase navigation — no file edits' },
  { id: 'scout',    name: 'scout',    mode: 'subagent', description: 'Read-only; clones dependencies into cache for inspection' },
];

export const KNOWN_PROVIDERS = [
  { id: 'anthropic', name: 'Anthropic', models: ['anthropic/claude-opus-4-5', 'anthropic/claude-sonnet-4-5', 'anthropic/claude-haiku-4-5'] },
  { id: 'openai',    name: 'OpenAI',    models: ['openai/gpt-4o', 'openai/gpt-4o-mini', 'openai/o3'] },
  { id: 'google',    name: 'Google',    models: ['google/gemini-2.5-pro', 'google/gemini-2.5-flash'] },
  { id: 'ollama',    name: 'Ollama',    models: ['ollama/llama3', 'ollama/qwen2.5-coder', 'ollama/mistral'] },
];
