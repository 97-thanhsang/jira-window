import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

type ReaderModule = typeof import('./opencode-reader');

let projectDir: string;
let reader: ReaderModule;

/** Write an analysis report for `taskKey` inside the temp PROJECT_DIR. */
async function writeAnalysis(taskKey: string, body: string): Promise<void> {
  const dir = path.join(projectDir, 'analysis-reports');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${taskKey}-analysis.md`), body, 'utf-8');
}

beforeAll(async () => {
  projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'opencode-reader-'));
  process.env.OPENCODE_PROJECT_DIR = projectDir;
  reader = await import('./opencode-reader');
});

afterAll(async () => {
  delete process.env.OPENCODE_PROJECT_DIR;
  await fs.rm(projectDir, { recursive: true, force: true });
});

describe('validateTaskKey', () => {
  it.each(['EMSPRO2-1234', 'AB-1', 'ABC123-99'])('accepts %s', (key) => {
    expect(() => reader.validateTaskKey(key)).not.toThrow();
  });

  it.each([
    'emspro2-1234',
    'E-1',
    'EMSPRO2',
    'EMSPRO2-',
    'EMSPRO2-12a',
    '../../etc/passwd',
    'EMSPRO2-12/../../secret',
    '',
  ])('rejects %s', (key) => {
    expect(() => reader.validateTaskKey(key)).toThrowError(/Invalid taskKey/);
  });

  it('tags the error with code INVALID_KEY', () => {
    try {
      reader.validateTaskKey('nope');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as { code?: string }).code).toBe('INVALID_KEY');
    }
  });
});

describe('readStageOutput', () => {
  it('returns IDLE for stages that have no output file pattern', async () => {
    for (const stage of ['decompose', 'extractor'] as const) {
      const out = await reader.readStageOutput('ABC-1', stage);
      expect(out).toEqual({ taskKey: 'ABC-1', stage, status: 'IDLE' });
    }
  });

  it('returns IDLE when the output file does not exist', async () => {
    const out = await reader.readStageOutput('MISSING-1', 'analyze');
    expect(out).toEqual({ taskKey: 'MISSING-1', stage: 'analyze', status: 'IDLE' });
    expect(out.content).toBeUndefined();
  });

  it('parses frontmatter and content, and reports the relative output path', async () => {
    await writeAnalysis('PARSE-1', '---\nstate: DONE\nowner: "sang"\nempty-line-follows: 1\n---\n# Report\n\nbody\n');

    const out = await reader.readStageOutput('PARSE-1', 'analyze');

    expect(out.status).toBe('DONE');
    expect(out.content).toBe('# Report\n\nbody');
    expect(out.frontmatter).toEqual({ state: 'DONE', owner: 'sang', 'empty-line-follows': '1' });
    expect(out.outputFile).toBe('analysis-reports/PARSE-1-analysis.md');
  });

  it.each([
    ['TODO', 'IDLE'],
    ['in_progress', 'RUNNING'],
    ['BLOCKED', 'BLOCKED'],
    ['IN_REVIEW', 'DONE'],
    ['DONE', 'DONE'],
    ['SOMETHING_ELSE', 'DONE'],
  ])('maps frontmatter state %s to status %s', async (state, expected) => {
    const key = `STATE${state.replace(/[^A-Z0-9]/gi, '').toUpperCase()}-1`;
    await writeAnalysis(key, `---\nstate: ${state}\n---\ncontent\n`);

    const out = await reader.readStageOutput(key, 'analyze');

    expect(out.status).toBe(expected);
  });

  it('defaults to DONE when frontmatter has no state', async () => {
    await writeAnalysis('NOSTATE-1', '---\nowner: sang\n---\ncontent\n');

    const out = await reader.readStageOutput('NOSTATE-1', 'analyze');

    expect(out.status).toBe('DONE');
  });

  it('treats a file without frontmatter as raw content', async () => {
    await writeAnalysis('RAW-1', 'just markdown, no frontmatter\n');

    const out = await reader.readStageOutput('RAW-1', 'analyze');

    expect(out.frontmatter).toEqual({});
    expect(out.content).toBe('just markdown, no frontmatter\n');
    expect(out.status).toBe('DONE');
  });

  it('accepts CRLF frontmatter and a missing trailing newline', async () => {
    await writeAnalysis('CRLF-1', '---\r\nstate: BLOCKED\r\n---');

    const out = await reader.readStageOutput('CRLF-1', 'analyze');

    expect(out.status).toBe('BLOCKED');
    expect(out.content).toBe('');
  });

  it('rejects task keys that could escape PROJECT_DIR', async () => {
    await expect(reader.readStageOutput('../../etc/passwd', 'analyze')).rejects.toThrowError(
      /Invalid taskKey/,
    );
  });
});

describe('getPipelineSummary', () => {
  it('returns IDLE stages for a task with no output files', async () => {
    const summary = await reader.getPipelineSummary('EMPTY-1');

    expect(summary.taskKey).toBe('EMPTY-1');
    expect(Object.keys(summary.stages).sort()).toEqual([
      'analyze',
      'decompose',
      'execute',
      'extractor',
      'solution',
    ]);
    expect(Object.values(summary.stages).every(s => s?.status === 'IDLE')).toBe(true);
    expect(summary.currentStage).toBeUndefined();
  });

  it('reports the running stage as currentStage', async () => {
    await writeAnalysis('RUN-1', '---\nstate: IN_PROGRESS\n---\nworking\n');

    const summary = await reader.getPipelineSummary('RUN-1');

    expect(summary.stages.analyze?.status).toBe('RUNNING');
    expect(summary.currentStage).toBe('analyze');
  });

  it('prefers the latest non-idle stage when several are unfinished', async () => {
    await writeAnalysis('MULTI-1', '---\nstate: BLOCKED\n---\nblocked\n');
    const dir = path.join(projectDir, 'execution-reports');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'MULTI-1-execute.md'), '---\nstate: IN_PROGRESS\n---\nrunning\n', 'utf-8');

    const summary = await reader.getPipelineSummary('MULTI-1');

    expect(summary.stages.analyze?.status).toBe('BLOCKED');
    expect(summary.currentStage).toBe('execute');
  });

  it('propagates the validation error for an unsafe task key', async () => {
    await expect(reader.getPipelineSummary('bad key')).rejects.toThrowError(/Invalid taskKey/);
  });
});
