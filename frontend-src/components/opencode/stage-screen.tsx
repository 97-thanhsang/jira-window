'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { usePipelineTasks } from '@/hooks/use-pipeline';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Package, BrainCircuit, Hammer, Play } from 'lucide-react';
import type { PipelineStage } from '@/types/opencode';
import { DecomposePanel } from './stages/decompose-panel';
import { ExtractorPanel } from './stages/extractor-panel';
import { AnalyzePanel } from './stages/analyze-panel';
import { SolutionPanel } from './stages/solution-panel';
import { ExecutePanel } from './stages/execute-panel';

/* ─── Stage config ──────────────────────────────────────────── */

const STAGE_META: Record<PipelineStage, { icon: React.ComponentType<{ className?: string }>; label: string; description: string }> = {
  decompose: { icon: Search,        label: 'Decompose',  description: 'Phân tích Jira task → tạo sub-tasks' },
  extractor: { icon: Package,       label: 'Extractor',  description: 'Trích xuất BA knowledge từ Jira vào module-wisdom' },
  analyze:   { icon: BrainCircuit,  label: 'Analyze',    description: 'Phân tích kỹ thuật → create analysis report với verdict' },
  solution:  { icon: Hammer,        label: 'Solution',   description: 'Thiết kế solution blueprint từ analysis report' },
  execute:   { icon: Play,          label: 'Execute',    description: 'Implement code theo solution blueprint — quality gates' },
};

interface StageScreenProps {
  stage: PipelineStage;
}

export function StageScreen({ stage }: StageScreenProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { taskKeys } = usePipelineTasks();

  const taskFromUrl = searchParams.get('task') ?? '';
  const [inputValue, setInputValue] = useState(taskFromUrl);
  const [activeTask, setActiveTask] = useState(taskFromUrl);

  useEffect(() => {
    setInputValue(taskFromUrl);
    setActiveTask(taskFromUrl);
  }, [taskFromUrl]);

  const meta = STAGE_META[stage];
  const Icon = meta.icon;

  const handleLoad = () => {
    const key = inputValue.trim().toUpperCase();
    if (!key) return;
    router.push(`${pathname}?task=${key}`);
    setActiveTask(key);
  };

  const handleTaskChip = (key: string) => {
    setInputValue(key);
    router.push(`${pathname}?task=${key}`);
    setActiveTask(key);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Stage header */}
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Icon className="w-5 h-5 text-primary" />
          <span>{meta.label}</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">{meta.description}</p>
      </div>

      {/* Task selector */}
      <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl border bg-muted/30">
        <span className="text-sm font-medium shrink-0">Task Key:</span>
        <div className="flex gap-2">
          <Input
            placeholder="EMSPRO2-1234"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLoad()}
            className="font-mono w-44"
          />
          <Button onClick={handleLoad} size="sm" disabled={!inputValue.trim()}>
            Load
          </Button>
        </div>

        {/* Recent tasks */}
        {taskKeys.length > 0 && (
          <div className="flex gap-1.5 flex-wrap items-center">
            <span className="text-xs text-muted-foreground">Recent:</span>
            {taskKeys.slice(0, 6).map((key) => (
              <button
                key={key}
                onClick={() => handleTaskChip(key)}
                className="text-xs font-mono px-2 py-0.5 rounded-full bg-background border hover:bg-muted transition-colors"
              >
                {key}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Panel content */}
      {activeTask ? (
        <div>
          {stage === 'decompose' && <DecomposePanel taskKey={activeTask} />}
          {stage === 'extractor' && <ExtractorPanel taskKey={activeTask} />}
          {stage === 'analyze'   && <AnalyzePanel   taskKey={activeTask} />}
          {stage === 'solution'  && <SolutionPanel  taskKey={activeTask} />}
          {stage === 'execute'   && <ExecutePanel   taskKey={activeTask} />}
        </div>
      ) : (
        <div className="text-center py-16 text-muted-foreground rounded-xl border border-dashed">
          <Icon className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nhập Task Key để bắt đầu</p>
          <p className="text-sm mt-1">
            Ví dụ:{' '}
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">EMSPRO2-1234</code>
          </p>
        </div>
      )}
    </div>
  );
}
