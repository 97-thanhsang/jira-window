import { cn } from '@/lib/utils';
import { Search, Package, BrainCircuit, Hammer, Play } from 'lucide-react';
import type { PipelineStage, PipelineStatus } from '@/types/opencode';

interface PipelineProgressBarProps {
  stages: Partial<Record<PipelineStage, { status: PipelineStatus }>>;
  onStageClick?: (stage: PipelineStage) => void;
}

/* ─── Stage config ────────────────────────────────────────────── */

const STAGE_ORDER: PipelineStage[] = ['decompose', 'extractor', 'analyze', 'solution', 'execute'];

const STAGE_ICON: Record<PipelineStage, React.ComponentType<{ className?: string }>> = {
  decompose: Search,
  extractor: Package,
  analyze:   BrainCircuit,
  solution:  Hammer,
  execute:   Play,
};

const STAGE_LABEL: Record<PipelineStage, string> = {
  decompose: 'Decompose',
  extractor: 'Extractor',
  analyze:   'Analyze',
  solution:  'Solution',
  execute:   'Execute',
};

/* ─── Status colors ───────────────────────────────────────────── */

const DOT_CLASSES: Record<PipelineStatus, string> = {
  IDLE:    'bg-muted-foreground/25 border-muted-foreground/20',
  RUNNING: 'bg-blue-400 border-blue-500 animate-pulse',
  DONE:    'bg-emerald-500 border-emerald-600',
  FAILED:  'bg-red-500 border-red-600',
  BLOCKED: 'bg-orange-400 border-orange-500',
};

const LINE_COLORS: Record<PipelineStatus, string> = {
  IDLE:    'bg-border',
  RUNNING: 'bg-blue-200 dark:bg-blue-800',
  DONE:    'bg-emerald-300 dark:bg-emerald-700',
  FAILED:  'bg-red-200 dark:bg-red-800',
  BLOCKED: 'bg-orange-200 dark:bg-orange-800',
};

/* ─── Component ───────────────────────────────────────────────── */

export function PipelineProgressBar({ stages, onStageClick }: PipelineProgressBarProps) {
  const completed = STAGE_ORDER.filter((s) => stages[s]?.status === 'DONE').length;
  const hasFailed = STAGE_ORDER.some((s) => stages[s]?.status === 'FAILED');

  return (
    <div className="space-y-1.5">
      {/* Dot connectors */}
      <div className="flex items-center gap-0">
        {STAGE_ORDER.map((stage, idx) => {
          const status: PipelineStatus = stages[stage]?.status ?? 'IDLE';
          const Icon = STAGE_ICON[stage];
          const label = STAGE_LABEL[stage];
          const isDone = status === 'DONE';
          const isRunning = status === 'RUNNING';

          return (
            <div key={stage} className="flex items-center">
              <button
                title={`${label}: ${status}`}
                onClick={() => onStageClick?.(stage)}
                className={cn(
                  'flex items-center justify-center w-6 h-6 rounded-full border-2 transition-all hover:scale-110',
                  isDone ? 'bg-emerald-500 border-emerald-600 text-white' :
                  isRunning ? 'bg-blue-400 border-blue-500 text-white' :
                  'bg-muted border-muted-foreground/20 text-muted-foreground',
                )}
              >
                {isDone ? (
                  <span className="text-[9px] font-bold">✓</span>
                ) : isRunning ? (
                  <Icon className="w-3 h-3 animate-spin" />
                ) : (
                  <Icon className="w-2.5 h-2.5 opacity-40" />
                )}
              </button>
              {idx < STAGE_ORDER.length - 1 && (
                <div className={cn('w-6 sm:w-8 h-0.5 rounded-full', LINE_COLORS[status])} />
              )}
            </div>
          );
        })}
      </div>

      {/* Progress text */}
      <p className={cn('text-[10px] font-medium', hasFailed ? 'text-red-500' : 'text-muted-foreground')}>
        {completed}/{STAGE_ORDER.length} stages
        {hasFailed && ' — failed'}
      </p>
    </div>
  );
}
