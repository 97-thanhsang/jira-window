'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { usePipelineSummary } from '@/hooks/use-pipeline';
import { PipelineProgressBar } from './pipeline-progress-bar';
import { PipelineBadge } from './pipeline-badge';
import { DecomposePanel } from './stages/decompose-panel';
import { ExtractorPanel } from './stages/extractor-panel';
import { AnalyzePanel } from './stages/analyze-panel';
import { SolutionPanel } from './stages/solution-panel';
import { ExecutePanel } from './stages/execute-panel';
import { STAGE_CONFIG } from '@/types/opencode';
import type { PipelineStage } from '@/types/opencode';
import { cn } from '@/lib/utils';

const STAGE_ORDER: PipelineStage[] = ['decompose', 'extractor', 'analyze', 'solution', 'execute'];

interface TaskPipelineDetailProps {
  taskKey: string;
  defaultStage?: PipelineStage;
}

const STAGE_PANELS: Record<PipelineStage, React.ComponentType<{ taskKey: string; onRunComplete?: () => void }>> = {
  decompose: DecomposePanel,
  extractor: ExtractorPanel,
  analyze:   AnalyzePanel,
  solution:  SolutionPanel,
  execute:   ExecutePanel,
};

export function TaskPipelineDetail({ taskKey, defaultStage }: TaskPipelineDetailProps) {
  const [activeStage, setActiveStage] = useState<PipelineStage>(defaultStage ?? 'decompose');
  const { summary, isLoading, refresh } = usePipelineSummary(taskKey);

  const Panel = STAGE_PANELS[activeStage];

  const completedCount = summary
    ? Object.values(summary.stages).filter((s) => s.status === 'DONE').length
    : 0;

  return (
    <div className="space-y-6">
      {/* Breadcrumb + Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/opencode"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Pipeline Hub
        </Link>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-xl font-bold font-mono">{taskKey}</h1>
        <Button variant="ghost" size="icon" className="ml-auto" onClick={() => refresh()}>
          🔄
        </Button>
      </div>

      {/* Progress overview */}
      {isLoading ? (
        <div className="h-8 bg-muted animate-pulse rounded" />
      ) : (
        <div className="flex items-center gap-4 p-4 rounded-lg border bg-muted/30 flex-wrap">
          <PipelineProgressBar
            stages={summary?.stages ?? {}}
            onStageClick={setActiveStage}
          />
          <span className="text-sm text-muted-foreground ml-2">
            {completedCount}/5 stages complete
          </span>
          {summary?.currentStage && (
            <PipelineBadge
              status="RUNNING"
              label={`Running: ${STAGE_CONFIG[summary.currentStage].label}`}
              size="md"
            />
          )}
        </div>
      )}

      {/* Stage Tabs */}
      <div className="flex border-b overflow-x-auto">
        {STAGE_ORDER.map((stage) => {
          const cfg = STAGE_CONFIG[stage];
          const stageData = summary?.stages[stage];
          const status = stageData?.status ?? 'IDLE';
          const isActive = stage === activeStage;

          return (
            <button
              key={stage}
              onClick={() => setActiveStage(stage)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0',
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/40'
              )}
            >
              <span>{cfg.icon}</span>
              <span>{cfg.label}</span>
              {status !== 'IDLE' && (
                <span className={cn(
                  'w-2 h-2 rounded-full',
                  status === 'DONE'    && 'bg-emerald-500',
                  status === 'RUNNING' && 'bg-blue-500 animate-pulse',
                  status === 'FAILED'  && 'bg-red-500',
                  status === 'BLOCKED' && 'bg-orange-400',
                )} />
              )}
            </button>
          );
        })}
      </div>

      {/* Active Panel */}
      <Panel taskKey={taskKey} onRunComplete={refresh} />
    </div>
  );
}
