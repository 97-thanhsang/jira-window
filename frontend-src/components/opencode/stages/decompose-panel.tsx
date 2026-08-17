'use client';

import { useStageOutput } from '@/hooks/use-pipeline';
import { PipelineBadge } from '../pipeline-badge';
import { StageRunButton } from '../stage-run-button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search } from 'lucide-react';

interface DecomposePanelProps {
  taskKey: string;
  onRunComplete?: () => void;
}

export function DecomposePanel({ taskKey, onRunComplete }: DecomposePanelProps) {
  const { output, isLoading, refresh } = useStageOutput(taskKey, 'decompose');

  const handleComplete = () => {
    refresh();
    onRunComplete?.();
  };

  if (isLoading) {
    return <div className="h-32 bg-muted animate-pulse rounded" />;
  }

  const subTasks = extractSubTasks(output?.content ?? '');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Search className="w-5 h-5 text-primary" />
            Decompose Stage
          </h2>
          <PipelineBadge status={output?.status ?? 'IDLE'} size="md" />
        </div>
        <StageRunButton
          taskKey={taskKey}
          stage="decompose"
          currentStatus={output?.status}
          onComplete={handleComplete}
        />
      </div>

      <p className="text-sm text-muted-foreground">
        Phân tích Jira task và tạo sub-tasks trong Jira. OpenCode CLI chạy lệnh{' '}
        <code className="text-xs bg-muted px-1 py-0.5 rounded">/decompose {taskKey}</code>
      </p>

      {output?.status === 'IDLE' && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-muted-foreground">
            <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="font-medium">Chưa chạy Decompose</p>
            <p className="text-sm mt-1">Nhấn "▶ Chạy Decompose" để phân tích task và tạo sub-tasks.</p>
          </CardContent>
        </Card>
      )}

      {output?.status !== 'IDLE' && subTasks.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Sub-tasks đã tạo ({subTasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {subTasks.map((key, i) => (
              <div
                key={key}
                className="flex items-center gap-3 p-2 rounded-md bg-muted/50 font-mono text-sm"
              >
                <span className="text-muted-foreground text-xs w-5 text-right">{i + 1}.</span>
                <span className="font-medium text-primary">{key}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {output?.status !== 'IDLE' && subTasks.length === 0 && output?.content && (
        <Card>
          <CardContent className="py-4">
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap overflow-auto max-h-48">
              {output.content.slice(0, 800)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function extractSubTasks(content: string): string[] {
  const pattern = /([A-Z]+-\d+)(?:\s*[:·\-])/g;
  const found = new Set<string>();
  let match;
  while ((match = pattern.exec(content)) !== null) {
    found.add(match[1]);
  }
  return Array.from(found);
}
