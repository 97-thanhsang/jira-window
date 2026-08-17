'use client';

import { useState } from 'react';
import { useStageOutput } from '@/hooks/use-pipeline';
import { PipelineBadge } from '../pipeline-badge';
import { StageRunButton } from '../stage-run-button';
import { MarkdownViewer } from '../markdown-viewer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { Play, CheckCircle2, XCircle } from 'lucide-react';

interface ExecutePanelProps {
  taskKey: string;
  onRunComplete?: () => void;
}

export function ExecutePanel({ taskKey, onRunComplete }: ExecutePanelProps) {
  const { output, isLoading, refresh } = useStageOutput(taskKey, 'execute');
  const [showReport, setShowReport] = useState(false);

  const handleComplete = () => {
    refresh();
    onRunComplete?.();
  };

  if (isLoading) {
    return <div className="h-32 bg-muted animate-pulse rounded" />;
  }

  const status = output?.status ?? 'IDLE';
  const fm = output?.frontmatter ?? {};

  const qualityGates  = ((fm['quality-gates'] as string) ?? '').toUpperCase();
  const buildStatus   = ((fm['build-status'] as string) ?? '').toUpperCase();
  const filesChanged  = fm['files-changed'] as string | undefined;
  const testCoverage  = fm['test-coverage'] as string | undefined;
  const wireLine      = fm['wire-line'] as string | undefined;
  const outputFile    = output?.outputFile;

  const gatesPassed  = qualityGates === 'PASS';
  // Only treat build as passing when explicitly PASS — empty/absent = not checked (neutral)
  const buildPassed  = buildStatus === 'PASS';
  const buildAbsent  = buildStatus === '';
  const hasFailed    = status === 'FAILED' || qualityGates === 'FAIL';

  const changedFiles = parseChangedFiles(output?.content ?? '');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Play className="w-5 h-5 text-primary" />
            Execute Stage
          </h2>
          <PipelineBadge status={status} size="md" />
        </div>
        <StageRunButton
          taskKey={taskKey}
          stage="execute"
          currentStatus={status}
          onComplete={handleComplete}
        />
      </div>

      <p className="text-sm text-muted-foreground">
        Implement code theo solution blueprint — tạo execution report với quality gates.
        Lệnh:{' '}
        <code className="text-xs bg-muted px-1 py-0.5 rounded">/execute-task {taskKey}</code>
      </p>

      {status === 'IDLE' && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-muted-foreground">
            <Play className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="font-medium">Chưa có execution report</p>
            <p className="text-sm mt-1">Cần có solution blueprint trước, rồi nhấn "▶ Chạy Execute".</p>
          </CardContent>
        </Card>
      )}

      {status === 'RUNNING' && (
        <Card>
          <CardContent className="py-6 text-center">
            <p className="text-blue-600 animate-pulse font-medium">⏳ Đang implement code...</p>
            <p className="text-sm text-muted-foreground mt-1">Quá trình này có thể mất 5–15 phút.</p>
          </CardContent>
        </Card>
      )}

      {(status === 'DONE' || status === 'FAILED' || status === 'BLOCKED') && (
        <div className="space-y-4">
          {hasFailed && (
            <Alert variant="destructive">
              <AlertDescription>
                            <strong>Quality Gates FAILED.</strong> Review execution report before continuing.
              </AlertDescription>
            </Alert>
          )}

          {/* Gates summary */}
          <Card className={cn('border', gatesPassed && buildPassed ? 'border-emerald-300' : 'border-red-300')}>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <GateItem label="Quality Gates" value={qualityGates || '—'} pass={gatesPassed} />
                <GateItem
                  label="Build"
                  value={buildAbsent ? 'N/A' : buildStatus}
                  pass={buildPassed}
                  neutral={buildAbsent}
                />
                {testCoverage && (
                  <GateItem label="Test Coverage" value={`${testCoverage}%`} pass={parseInt(testCoverage, 10) >= 80} />
                )}
                {filesChanged && (
                  <GateItem label="Files Changed" value={filesChanged} pass={true} neutral />
                )}
              </div>
              {outputFile && (
                <p className="text-xs text-muted-foreground font-mono mt-3">{outputFile}</p>
              )}
            </CardContent>
          </Card>

          {wireLine && (
            <div className="rounded-md bg-zinc-950 px-4 py-2 font-mono text-xs text-emerald-400">
              {wireLine}
            </div>
          )}

          {changedFiles.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  📁 Files Changed ({changedFiles.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {changedFiles.map((file, i) => (
                  <div key={i} className="flex items-center gap-3 font-mono text-xs bg-muted/50 rounded px-3 py-1.5">
                    <span className={cn(
                      'w-4 font-bold shrink-0',
                      file.type === 'A' && 'text-emerald-600',
                      file.type === 'M' && 'text-blue-600',
                      file.type === 'D' && 'text-red-600',
                    )}>
                      {file.type}
                    </span>
                    <span className="text-muted-foreground truncate">{file.path}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {output?.content && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">📄 Execution Report</CardTitle>
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

          {status === 'DONE' && gatesPassed && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-medium text-emerald-800">🎉 Pipeline hoàn thành!</p>
              <p className="text-sm text-emerald-700 mt-1">
                ▶ Next step:{' '}
                <code className="text-xs bg-emerald-100 px-1 py-0.5 rounded">/review-code {taskKey}</code>
                {' '}— Review code trước khi tạo Pull Request.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GateItem({ label, value, pass, neutral = false }: {
  label: string; value: string; pass: boolean; neutral?: boolean;
}) {
  return (
    <div className="text-center">
      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
      <p className={cn(
        'font-bold text-sm',
        neutral ? 'text-foreground' : pass ? 'text-emerald-700' : 'text-red-700',
      )}>
        {!neutral && (
          pass
            ? <CheckCircle2 className="w-4 h-4 text-emerald-500 inline mr-1" />
            : <XCircle className="w-4 h-4 text-red-500 inline mr-1" />
        )}{value}
      </p>
    </div>
  );
}

interface FileChange { type: 'A' | 'M' | 'D'; path: string }

function parseChangedFiles(content: string): FileChange[] {
  const results: FileChange[] = [];

  const diffPattern = /^([AMD])\s{1,3}(.+)$/gm;
  let match;
  while ((match = diffPattern.exec(content)) !== null) {
    results.push({ type: match[1] as 'A' | 'M' | 'D', path: match[2].trim() });
  }
  if (results.length > 0) return results;

  const listPattern = /[-*]\s*(Modified|Added|Deleted):\s*(.+)$/gim;
  while ((match = listPattern.exec(content)) !== null) {
    const typeMap: Record<string, 'A' | 'M' | 'D'> = { modified: 'M', added: 'A', deleted: 'D' };
    results.push({ type: typeMap[match[1].toLowerCase()] ?? 'M', path: match[2].trim() });
  }
  return results;
}
