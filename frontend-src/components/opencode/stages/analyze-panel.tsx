'use client';

import { useState } from 'react';
import { useStageOutput } from '@/hooks/use-pipeline';
import { PipelineBadge } from '../pipeline-badge';
import { StageRunButton } from '../stage-run-button';
import { MarkdownViewer } from '../markdown-viewer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { BrainCircuit, CheckCircle, XCircle, AlertTriangle, HelpCircle } from 'lucide-react';

interface AnalyzePanelProps {
  taskKey: string;
  onRunComplete?: () => void;
}

const VERDICT_CONFIG: Record<string, { label: string; classes: string; icon: React.ComponentType<{ className?: string }> }> = {
  IMPLEMENT: { label: 'IMPLEMENT', classes: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: CheckCircle },
  REJECT:    { label: 'REJECT',    classes: 'bg-red-100 text-red-800 border-red-300',             icon: XCircle },
  CLARIFY:   { label: 'CLARIFY',   classes: 'bg-amber-100 text-amber-800 border-amber-300',       icon: AlertTriangle },
  UNKNOWN:   { label: 'UNKNOWN',   classes: 'bg-muted text-muted-foreground border-muted',        icon: HelpCircle },
};

export function AnalyzePanel({ taskKey, onRunComplete }: AnalyzePanelProps) {
  const { output, isLoading, refresh } = useStageOutput(taskKey, 'analyze');
  const [showReport, setShowReport] = useState(false);

  const handleComplete = () => {
    refresh();
    onRunComplete?.();
  };

  if (isLoading) {
    return <div className="h-32 bg-muted animate-pulse rounded" />;
  }

  const status = output?.status ?? 'IDLE';
  const verdict = ((output?.frontmatter?.verdict as string) ?? 'UNKNOWN').toUpperCase();
  const verdictCfg = VERDICT_CONFIG[verdict] ?? VERDICT_CONFIG.UNKNOWN;
  const VerdictIcon = verdictCfg.icon;
  const qualityScore = output?.frontmatter?.['quality-score'] as string | undefined;
  const outputFile = output?.outputFile;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <BrainCircuit className="w-5 h-5 text-primary" />
            Analyze Stage
          </h2>
          <PipelineBadge status={status} size="md" />
        </div>
        <StageRunButton
          taskKey={taskKey}
          stage="analyze"
          currentStatus={status}
          onComplete={handleComplete}
        />
      </div>

      <p className="text-sm text-muted-foreground">
        Phân tích kỹ thuật → tạo analysis report với verdict IMPLEMENT / REJECT / CLARIFY.
        Lệnh:{' '}
        <code className="text-xs bg-muted px-1 py-0.5 rounded">/analyze-task {taskKey}</code>
      </p>

      {status === 'IDLE' && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-muted-foreground">
            <BrainCircuit className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="font-medium">Chưa có analysis report</p>
            <p className="text-sm mt-1">Nhấn "▶ Chạy Analyze" để tạo analysis report.</p>
          </CardContent>
        </Card>
      )}

      {status === 'RUNNING' && (
        <Card>
          <CardContent className="py-6 text-center">
            <p className="text-blue-600 animate-pulse font-medium">⏳ Đang phân tích kỹ thuật...</p>
            <p className="text-sm text-muted-foreground mt-1">Quá trình này có thể mất 2–5 phút.</p>
          </CardContent>
        </Card>
      )}

      {(status === 'DONE' || status === 'FAILED' || status === 'BLOCKED') && (
        <div className="space-y-4">
          <Card className={cn('border', verdictCfg.classes)}>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <VerdictIcon className="w-6 h-6" />
                <div>
                  <p className="font-bold text-lg">VERDICT: {verdictCfg.label}</p>
                  {qualityScore && (
                    <p className="text-sm opacity-80">Quality Score: {qualityScore}/100</p>
                  )}
                  {outputFile && (
                    <p className="text-xs opacity-60 font-mono mt-0.5">{outputFile}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {output?.content && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">📄 Analysis Report</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setShowReport((v) => !v)}>
                    {showReport ? '▲ Thu gọn' : '▼ Xem report'}
                  </Button>
                </div>
              </CardHeader>
              {showReport && (
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
