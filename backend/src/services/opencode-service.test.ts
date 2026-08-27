import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

type ServiceModule = typeof import('./opencode-service');

let projectDir: string;
let globalConfigHome: string;
let service: ServiceModule;

async function writeFile(relPath: string, contents: string): Promise<void> {
  const full = path.join(projectDir, relPath);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, contents, 'utf-8');
}

beforeAll(async () => {
  projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'opencode-service-'));
  globalConfigHome = await fs.mkdtemp(path.join(os.tmpdir(), 'opencode-xdg-'));
  process.env.OPENCODE_PROJECT_DIR = projectDir;
  process.env.XDG_CONFIG_HOME = globalConfigHome;
  process.env.OPENCODE_SERVER_PORT = '4321';
  service = await import('./opencode-service');
});

afterEach(async () => {
  await fs.rm(path.join(projectDir, '.opencode'), { recursive: true, force: true });
  await fs.rm(path.join(projectDir, 'opencode.json'), { force: true });
  await fs.rm(path.join(projectDir, 'opencode.jsonc'), { force: true });
  await fs.rm(path.join(globalConfigHome, 'opencode'), { recursive: true, force: true });
});

afterAll(async () => {
  delete process.env.OPENCODE_PROJECT_DIR;
  delete process.env.XDG_CONFIG_HOME;
  delete process.env.OPENCODE_SERVER_PORT;
  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.rm(globalConfigHome, { recursive: true, force: true });
});

describe('module constants', () => {
  it('reads the server port from the environment', () => {
    expect(service.OPENCODE_PORT).toBe(4321);
  });

  it('base64-encodes the resolved project directory for the directory header', () => {
    expect(Buffer.from(service.OPENCODE_DIR_HEADER, 'base64').toString()).toBe(projectDir);
  });
});

describe('readProjectConfig', () => {
  it('returns an empty config when no config file exists', async () => {
    await expect(service.readProjectConfig()).resolves.toEqual({ config: {}, filePath: null });
  });

  it('reads .opencode/opencode.json and reports its path', async () => {
    await writeFile('.opencode/opencode.json', '{"model":"anthropic/claude-sonnet-4-5"}');

    const { config, filePath } = await service.readProjectConfig();

    expect(config).toEqual({ model: 'anthropic/claude-sonnet-4-5' });
    expect(filePath).toBe(path.join(projectDir, '.opencode', 'opencode.json'));
  });

  it('strips line and block comments from JSONC files', async () => {
    await writeFile(
      '.opencode/opencode.jsonc',
      '{\n  // line comment\n  "model": "openai/gpt-4o"\n  /* block\n     comment */\n}\n',
    );

    const { config, filePath } = await service.readProjectConfig();

    expect(config).toEqual({ model: 'openai/gpt-4o' });
    expect(filePath).toBe(path.join(projectDir, '.opencode', 'opencode.jsonc'));
  });

  it('prefers .opencode/opencode.json over the other candidate paths', async () => {
    await writeFile('.opencode/opencode.json', '{"which":"dot-json"}');
    await writeFile('.opencode/opencode.jsonc', '{"which":"dot-jsonc"}');
    await writeFile('opencode.json', '{"which":"root-json"}');
    await writeFile('opencode.jsonc', '{"which":"root-jsonc"}');

    const { config } = await service.readProjectConfig();

    expect(config).toEqual({ which: 'dot-json' });
  });

  it('falls through to the next candidate when a config file is malformed', async () => {
    await writeFile('.opencode/opencode.json', 'not json at all');
    await writeFile('opencode.json', '{"which":"root-json"}');

    const { config, filePath } = await service.readProjectConfig();

    expect(config).toEqual({ which: 'root-json' });
    expect(filePath).toBe(path.join(projectDir, 'opencode.json'));
  });
});

describe('readGlobalConfig', () => {
  it('returns an empty object when no global config exists', async () => {
    await expect(service.readGlobalConfig()).resolves.toEqual({});
  });

  it('reads the config under XDG_CONFIG_HOME', async () => {
    const dir = path.join(globalConfigHome, 'opencode');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'opencode.json'), '{\n // c\n "theme": "dark"\n}', 'utf-8');

    await expect(service.readGlobalConfig()).resolves.toEqual({ theme: 'dark' });
  });
});

describe('writeProjectConfig', () => {
  it('writes pretty-printed JSON to .opencode/opencode.json, creating the directory', async () => {
    const target = await service.writeProjectConfig({ model: 'google/gemini-2.5-pro' });

    expect(target).toBe(path.join(projectDir, '.opencode', 'opencode.json'));
    await expect(fs.readFile(target, 'utf-8')).resolves.toBe(
      '{\n  "model": "google/gemini-2.5-pro"\n}',
    );
  });

  it('round-trips through readProjectConfig', async () => {
    await service.writeProjectConfig({ model: 'ollama/llama3', agent: { build: {} } });

    const { config } = await service.readProjectConfig();

    expect(config).toEqual({ model: 'ollama/llama3', agent: { build: {} } });
  });
});

describe('getServiceStatus', () => {
  it('reports not running when no OpenCode server answers the health check', async () => {
    await expect(service.getServiceStatus()).resolves.toEqual({
      running: false,
      managed: false,
      port: 4321,
      directory: projectDir,
    });
  });
});

describe('built-in catalogs', () => {
  it('exposes unique agent ids with valid modes', () => {
    const ids = service.BUILTIN_AGENTS.map(a => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const agent of service.BUILTIN_AGENTS) {
      expect(['primary', 'subagent']).toContain(agent.mode);
      expect(agent.description).not.toBe('');
    }
  });

  it('namespaces every known model under its provider id', () => {
    for (const provider of service.KNOWN_PROVIDERS) {
      expect(provider.models.length).toBeGreaterThan(0);
      for (const model of provider.models) {
        expect(model.startsWith(`${provider.id}/`)).toBe(true);
      }
    }
  });
});
