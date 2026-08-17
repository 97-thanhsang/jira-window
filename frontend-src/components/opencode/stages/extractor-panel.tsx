'use client';

import { useStageOutput } from '@/hooks/use-pipeline';
import { PipelineBadge } from '../pipeline-badge';
import { StageRunButton } from '../stage-run-button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, Loader2 } from 'lucide-react';

interface ExtractorPanelProps {
  taskKey: string;
  onRunComplete?: () => void;
}

export function ExtractorPanel({ taskKey, onRunComplete }: ExtractorPanelProps) {
  const { output, isLoading, refresh } = useStageOutput(taskKey, 'extractor');

  const handleComplete = () => {
    refresh();
    onRunComplete?.();
  };

  if (isLoading) {
    return <div className="h-32 bg-muted animate-pulse rounded" />;
  }

  const status = output?.status ?? 'IDLE';
  const items = parseExtractorOutput(output?.content ?? '');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            Extractor Stage
          </h2>
          <PipelineBadge status={status} size="md" />
        </div>
        <StageRunButton
          taskKey={taskKey}
          stage="extractor"
          currentStatus={status}
          onComplete={handleComplete}
        />
      </div>

      <p className="text-sm text-muted-foreground">
        Trích xuất BA knowledge từ Jira attachments, description, và comments.
        Lệnh:{' '}
        <code className="text-xs bg-muted px-1 py-0.5 rounded">/extractor {taskKey}</code>
      </p>

      {status === 'IDLE' && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-muted-foreground">
            <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="font-medium">Chưa chạy Extractor</p>
            <p className="text-sm mt-1">
              Extractor sẽ tải attachments từ Jira và ghi BA knowledge vào module-wisdom.
            </p>
          </CardContent>
        </Card>
      )}

      {status === 'RUNNING' && (
        <Card>
          <CardContent className="py-6 text-center">
            <p className="text-blue-600 font-medium flex items-center gap-2 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Đang extract knowledge...
            </p>
          </CardContent>
        </Card>
      )}

      {(status === 'DONE' || status === 'FAILED') && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Kết quả Extraction</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <CheckItem done={status === 'DONE'} label="BA Knowledge extracted và ghi vào module-wisdom" />
              <CheckItem done={items.visuals > 0} label={`Visual assets: ${items.visuals > 0 ? `${items.visuals} files` : 'Không có'}`} />
              <CheckItem done={status === 'DONE'} label="Wire signal [EXTRACTOR_DONE] nhận được" />
            </CardContent>
          </Card>

          {items.files.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Knowledge Files ({items.files.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {items.files.map((file, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm font-mono bg-muted/50 rounded px-3 py-1.5">
                    <span>{file.endsWith('.md') ? '📄' : '🖼'}</span>
                    <span className="flex-1 truncate text-muted-foreground">{file}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {items.files.length === 0 && output?.content && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Output Log</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap overflow-auto max-h-48">
                  {output.content.slice(0, 1000)}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function CheckItem({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={done ? 'text-emerald-600' : 'text-muted-foreground'}>
        {done ? '✅' : '○'}
      </span>
      <span className={done ? '' : 'text-muted-foreground'}>{label}</span>
    </div>
  );
}

function parseExtractorOutput(content: string): { files: string[]; visuals: number } {
  const filePattern = /[\w\-./]+(\.md|\.png|\.jpg|\.jpeg|\.pdf|\.xlsx)/gi;
  const files = [...new Set((content.match(filePattern) ?? []))];
  const visuals = files.filter((f) => /\.(png|jpg|jpeg|pdf|xlsx)$/i.test(f)).length;
  return { files, visuals };
}
