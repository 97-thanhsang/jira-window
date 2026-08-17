'use client';

import { useState } from 'react';
import { useStageOutput } from '@/hooks/use-pipeline';
import { PipelineBadge } from '../pipeline-badge';
import { StageRunButton } from '../stage-run-button';
import { MarkdownViewer } from '../markdown-viewer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Hammer } from 'lucide-react';

interface SolutionPanelProps {
  taskKey: string;
  onRunComplete?: () => void;
}

const RISK_CONFIG: Record<string, { label: string; classes: string; dotColor: string }> = {
  LOW:    { label: 'LOW',    classes: 'bg-emerald-100 text-emerald-800', dotColor: 'bg-emerald-500' },
  MEDIUM: { label: 'MEDIUM', classes: 'bg-amber-100 text-amber-800',     dotColor: 'bg-amber-500' },
  HIGH:   { label: 'HIGH',   classes: 'bg-red-100 text-red-800',         dotColor: 'bg-red-500' },
};

export function SolutionPanel({ taskKey, onRunComplete }: SolutionPanelProps) {
  const { output, isLoading, refresh } = useStageOutput(taskKey, 'solution');
  const [showBlueprint, setShowBlueprint] = useState(false);

  const handleComplete = () => {
    refresh();
    onRunComplete?.();
  };

  if (isLoading) {
    return <div className="h-32 bg-muted animate-pulse rounded" />;
  }

  const status = output?.status ?? 'IDLE';
  const fm = output?.frontmatter ?? {};
  const approach = fm.approach as string | undefined;
  const risk = ((fm.risk as string) ?? '').toUpperCase();
  const riskCfg = RISK_CONFIG[risk] ?? null;
  const effort = fm['estimated-effort'] as string | undefined;
  const modulesRaw = fm['impacted-modules'] as string | undefined;
  const modules = modulesRaw ? modulesRaw.split(',').map((m) => m.trim()).filter(Boolean) : [];
  const outputFile = output?.outputFile;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Hammer className="w-5 h-5 text-primary" />
            Solution Stage
          </h2>
          <PipelineBadge status={status} size="md" />
        </div>
        <StageRunButton
          taskKey={taskKey}
          stage="solution"
          currentStatus={status}
          onComplete={handleComplete}
        />
      </div>

      <p className="text-sm text-muted-foreground">
        Thiết kế giải pháp kỹ thuật dựa trên analysis report → tạo solution blueprint.
        Lệnh:{' '}
        <code className="text-xs bg-muted px-1 py-0.5 rounded">/solution-task {taskKey}</code>
      </p>

      {status === 'IDLE' && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-muted-foreground">
            <Hammer className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="font-medium">Chưa có solution blueprint</p>
            <p className="text-sm mt-1">Cần Analyze với verdict IMPLEMENT trước, rồi nhấn "▶ Chạy Solution".</p>
          </CardContent>
        </Card>
      )}

      {status === 'RUNNING' && (
        <Card>
          <CardContent className="py-6 text-center">
            <p className="text-blue-600 animate-pulse font-medium">⏳ Đang thiết kế giải pháp...</p>
            <p className="text-sm text-muted-foreground mt-1">Quá trình này có thể mất 2–5 phút.</p>
          </CardContent>
        </Card>
      )}

      {(status === 'DONE' || status === 'FAILED' || status === 'BLOCKED') && (
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-4 space-y-3">
              {approach && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Approach</p>
                  <p className="text-sm">{approach}</p>
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                {riskCfg && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Risk</p>
                    <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1', riskCfg.classes)}>
                      <span className={cn('w-2 h-2 rounded-full', riskCfg.dotColor)} /> {riskCfg.label}
                    </span>
                  </div>
                )}
                {effort && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Est. Effort</p>
                    <span className="text-sm font-medium">⏱ {effort}</span>
                  </div>
                )}
              </div>

              {modules.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Impacted Modules ({modules.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {modules.map((m) => (
                      <Badge key={m} variant="secondary" className="font-mono text-xs">
                        {m}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {outputFile && (
                <p className="text-xs text-muted-foreground font-mono">{outputFile}</p>
              )}
            </CardContent>
          </Card>

          {output?.content && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">📄 Solution Blueprint</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setShowBlueprint((v) => !v)}>
                    {showBlueprint ? '▲ Thu gọn' : '▼ Xem blueprint'}
                  </Button>
                </div>
              </CardHeader>
              {showBlueprint && (
                <CardContent className="pt-0">
                  <MarkdownViewer content={output.content} />
                </CardContent>
              )}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
