import fs from 'fs/promises';
import path from 'path';
import type { PipelineStage, StageOutput, PipelineTaskSummary } from '../types/opencode';
import { OUTPUT_PATTERNS } from '../types/opencode';

// PROJECT_DIR: thư mục nơi OpenCode tạo output files
const PROJECT_DIR = process.env.OPENCODE_PROJECT_DIR || process.cwd();

/** Jira task key pattern: uppercase letters, hyphen, digits (e.g. EMSPRO2-1234) */
const SAFE_TASK_KEY = /^[A-Z][A-Z0-9]+-\d+$/;

/**
 * Validate taskKey to prevent path traversal.
 * Throws if the key doesn't match the expected Jira format.
 */
export function validateTaskKey(taskKey: string): void {
  if (!SAFE_TASK_KEY.test(taskKey)) {
    throw Object.assign(new Error(`Invalid taskKey: ${taskKey}`), { code: 'INVALID_KEY' });
  }
}

/**
 * Đọc nội dung file output của một stage
 */
export async function readStageOutput(
  taskKey: string,
  stage: PipelineStage
): Promise<StageOutput> {
  validateTaskKey(taskKey);

  const pattern = OUTPUT_PATTERNS[stage];

  if (!pattern) {
    // Stage không có output file (decompose, extractor)
    return { taskKey, stage, status: 'IDLE' };
  }

  const relativePath = pattern.replace('{KEY}', taskKey);
  const fullPath = path.join(PROJECT_DIR, relativePath);

  // Extra containment guard: resolved path must stay inside PROJECT_DIR
  const resolvedBase = path.resolve(PROJECT_DIR);
  const resolvedFull = path.resolve(fullPath);
  if (!resolvedFull.startsWith(resolvedBase + path.sep) && resolvedFull !== resolvedBase) {
    throw Object.assign(new Error('Path traversal detected'), { code: 'ENOENT' });
  }

  try {
    const raw = await fs.readFile(fullPath, 'utf-8');
    const { frontmatter, content } = parseMarkdown(raw);

    // Xác định status từ frontmatter
    const state = (frontmatter.state as string)?.toUpperCase();
    let status: StageOutput['status'] = 'DONE';
    if (state === 'TODO') status = 'IDLE';
    else if (state === 'IN_PROGRESS') status = 'RUNNING';
    else if (state === 'BLOCKED') status = 'BLOCKED';
    else if (state === 'IN_REVIEW' || state === 'DONE') status = 'DONE';

    return {
      taskKey,
      stage,
      status,
      content,
      frontmatter,
      outputFile: relativePath,
    };
  } catch (err: unknown) {
    // File chưa tồn tại = stage chưa chạy
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { taskKey, stage, status: 'IDLE' };
    }
    throw err;
  }
}

/**
 * Lấy tổng quan pipeline của một task (tất cả stages)
 */
export async function getPipelineSummary(
  taskKey: string
): Promise<PipelineTaskSummary> {
  const stages: PipelineStage[] = ['decompose', 'extractor', 'analyze', 'solution', 'execute'];

  const stageOutputs = await Promise.all(
    stages.map((stage) => readStageOutput(taskKey, stage))
  );

  const stagesMap: PipelineTaskSummary['stages'] = {};
  let currentStage: PipelineStage | undefined;

  for (const output of stageOutputs) {
    stagesMap[output.stage] = output;
    if (output.status === 'RUNNING' || output.status === 'BLOCKED') {
      currentStage = output.stage;
    }
  }

  return { taskKey, stages: stagesMap, currentStage };
}

/**
 * Parse YAML frontmatter + markdown content
 * Format: ---\nkey: value\n---\ncontent...
 */
function parseMarkdown(raw: string): {
  frontmatter: Record<string, unknown>;
  content: string;
} {
  // Trailing newline after closing --- is optional (some editors omit it)
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n([\s\S]*))?$/;
  const match = raw.match(frontmatterRegex);

  if (!match) {
    return { frontmatter: {}, content: raw };
  }

  const [, yamlStr, rawContent] = match;
  const content = rawContent ?? '';
  const frontmatter: Record<string, unknown> = {};

  // Simple YAML parser (key: value only)
  for (const line of yamlStr.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
    frontmatter[key] = value;
  }

  return { frontmatter, content: content.trim() };
}
