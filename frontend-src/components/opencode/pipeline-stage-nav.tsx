'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { usePipelineSummary } from '@/hooks/use-pipeline';
import { Search, Package, BrainCircuit, Hammer, Play } from 'lucide-react';
import type { PipelineStage, PipelineStatus } from '@/types/opencode';

interface PipelineStageNavProps {
  taskKey: string;
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

const LINE_CLASSES: Record<PipelineStatus, string> = {
  IDLE:    'bg-border',
  RUNNING: 'bg-blue-200',
  DONE:    'bg-emerald-400',
  FAILED:  'bg-red-200',
  BLOCKED: 'bg-orange-200',
};

const TAB_ACTIVE: Record<PipelineStatus, string> = {
  IDLE:    'border-muted-foreground/30 text-foreground/70',
  RUNNING: 'border-blue-500 text-blue-700',
  DONE:    'border-emerald-500 text-emerald-700',
  FAILED:  'border-red-500 text-red-700',
  BLOCKED: 'border-orange-500 text-orange-700',
};

/* ─── Component ───────────────────────────────────────────────── */

export function PipelineStageNav({ taskKey }: PipelineStageNavProps) {
  const pathname = usePathname();
  const { summary } = usePipelineSummary(taskKey);

  const segments = pathname.split('/');
  const activeStage = segments[segments.length - 1] as PipelineStage | undefined;

  return (
    <div className="space-y-3">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/opencode" className="text-muted-foreground hover:text-foreground transition-colors font-medium">
          OpenCode
        </Link>
        <span className="text-muted-foreground/40">›</span>
        <span className="font-mono font-semibold text-foreground">{taskKey}</span>
      </div>

      {/* Stage tabs */}
      <div className="flex items-center gap-0 overflow-x-auto pb-1">
        {STAGE_ORDER.map((stage, idx) => {
          const Icon = STAGE_ICON[stage];
          const label = STAGE_LABEL[stage];
          const stageData = summary?.stages?.[stage];
          const status: PipelineStatus = stageData?.status ?? 'IDLE';
          const isActive = activeStage === stage;

          return (
            <div key={stage} className="flex items-center shrink-0">
              <Link
                href={`/opencode/${taskKey}/${stage}`}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-all whitespace-nowrap',
                  isActive
                    ? cn('shadow-sm bg-card', TAB_ACTIVE[status])
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40',
                )}
              >
                {/* Status dot */}
                <span className={cn('inline-block w-2 h-2 rounded-full border', DOT_CLASSES[status])} />
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </Link>

              {/* Connector */}
              {idx < STAGE_ORDER.length - 1 && (
                <div className={cn('w-5 h-0.5 shrink-0 mx-0.5 rounded-full', LINE_CLASSES[status])} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
