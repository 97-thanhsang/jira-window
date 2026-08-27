// OpenCode pipeline types

export type PipelineStage =
  | 'decompose'
  | 'extractor'
  | 'analyze'
  | 'solution'
  | 'execute';

export const PIPELINE_STAGES: PipelineStage[] = [
  'decompose',
  'extractor',
  'analyze',
  'solution',
  'execute',
];

export type PipelineStatus =
  | 'IDLE'        // chưa chạy
  | 'RUNNING'     // đang chạy
  | 'DONE'        // hoàn thành
  | 'FAILED'      // lỗi
  | 'BLOCKED';    // bị block (chất lượng gate fail)

export interface PipelineRun {
  id: string;
  taskKey: string;
  stage: PipelineStage;
  status: PipelineStatus;
  startedAt: string;        // ISO timestamp
  completedAt?: string;
  outputFile?: string;      // relative path từ PROJECT_DIR
  wireLine?: string;        // raw wire signal line từ stdout
  errorMessage?: string;
}

export interface StageOutput {
  taskKey: string;
  stage: PipelineStage;
  status: PipelineStatus;
  content?: string;         // markdown content của report file
  frontmatter?: Record<string, unknown>;
  outputFile?: string;      // relative path từ PROJECT_DIR
  lastRun?: PipelineRun;
}

export interface PipelineTaskSummary {
  taskKey: string;
  stages: Partial<Record<PipelineStage, StageOutput>>;
  currentStage?: PipelineStage;
}

// Wire signals emitted by OpenCode
export const WIRE_SIGNALS: Record<PipelineStage, string> = {
  decompose: '[DECOMPOSE_DONE]',
  extractor: '[EXTRACTOR_DONE]',
  analyze:   '[VERDICT]',
  solution:  '[SOLUTION_DONE]',
  execute:   '[EXECUTE_DONE]',
};

// Output file patterns (relative to PROJECT_DIR)
export const OUTPUT_PATTERNS: Partial<Record<PipelineStage, string>> = {
  analyze:  'analysis-reports/{KEY}-analysis.md',
  solution: 'solution-designs/{KEY}-solution.md',
  execute:  'execution-reports/{KEY}-execute.md',
};
