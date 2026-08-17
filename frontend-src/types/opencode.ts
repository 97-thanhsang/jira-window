export type PipelineStage =
  | 'decompose'
  | 'extractor'
  | 'analyze'
  | 'solution'
  | 'execute';

export type PipelineStatus =
  | 'IDLE'
  | 'RUNNING'
  | 'DONE'
  | 'FAILED'
  | 'BLOCKED';

export interface StageOutput {
  taskKey: string;
  stage: PipelineStage;
  status: PipelineStatus;
  content?: string;           // Markdown content của report
  frontmatter?: Record<string, unknown>;
  outputFile?: string;
  lastRun?: PipelineRun;
}

export interface PipelineRun {
  id: string;
  taskKey: string;
  stage: PipelineStage;
  status: PipelineStatus;
  startedAt: string;
  completedAt?: string;
  wireLine?: string;
  errorMessage?: string;
}

export interface PipelineTaskSummary {
  taskKey: string;
  stages: Partial<Record<PipelineStage, StageOutput>>;
  currentStage?: PipelineStage;
}

// Config hiển thị cho từng stage
export const STAGE_CONFIG: Record<PipelineStage, {
  label: string;
  description: string;
  color: string;      // Tailwind color class
  icon: string;       // emoji
  command: string;
  nextStage?: PipelineStage;
}> = {
  decompose: {
    label: 'Decompose',
    description: 'Phân tích Jira task → tạo sub-tasks',
    color: 'purple',
    icon: '🔍',
    command: '/decompose {KEY}',
    nextStage: 'extractor',
  },
  extractor: {
    label: 'Extractor',
    description: 'Trích xuất BA knowledge + visual assets',
    color: 'sky',
    icon: '📦',
    command: '/extractor {KEY}',
    nextStage: 'analyze',
  },
  analyze: {
    label: 'Analyze',
    description: 'Phân tích kỹ thuật → analysis report',
    color: 'emerald',
    icon: '🧠',
    command: '/analyze-task {KEY}',
    nextStage: 'solution',
  },
  solution: {
    label: 'Solution',
    description: 'Thiết kế giải pháp → solution blueprint',
    color: 'amber',
    icon: '🏗️',
    command: '/solution-task {KEY}',
    nextStage: 'execute',
  },
  execute: {
    label: 'Execute',
    description: 'Implement code → execution report',
    color: 'teal',
    icon: '⚡',
    command: '/execute-task {KEY}',
  },
};
