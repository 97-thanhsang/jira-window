'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { usePipelineStream } from '@/hooks/use-pipeline-stream';
import { StreamLog } from './stream-log';
import type { PipelineStage } from '@/types/opencode';
import { STAGE_CONFIG } from '@/types/opencode';

interface StageRunButtonProps {
  taskKey: string;
  stage: PipelineStage;
  currentStatus?: string;
  onComplete?: () => void;
}

export function StageRunButton({
  taskKey,
  stage,
  currentStatus,
  onComplete,
}: StageRunButtonProps) {
  const [open, setOpen] = useState(false);
  const cfg = STAGE_CONFIG[stage];

  const { lines, isRunning, trigger, stop } = usePipelineStream({
    onDone: () => {
      onComplete?.();
    },
    onError: (msg) => {
      console.error('[StageRunButton] error:', msg);
    },
  });

  const handleRun = () => {
    setOpen(true);
    trigger(taskKey, stage);
  };

  const handleClose = () => {
    if (isRunning) stop();
    setOpen(false);
  };

  const isRerun = currentStatus === 'DONE' || currentStatus === 'FAILED';

  return (
    <>
      <Button
        variant={isRerun ? 'outline' : 'default'}
        size="sm"
        onClick={handleRun}
        disabled={currentStatus === 'RUNNING'}
      >
        {currentStatus === 'RUNNING' ? (
          <span className="animate-pulse">⏳ Đang chạy...</span>
        ) : isRerun ? (
          `🔄 Chạy lại ${cfg.label}`
        ) : (
          `▶ Chạy ${cfg.label}`
        )}
      </Button>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {cfg.icon} {cfg.label} — {taskKey}
            </DialogTitle>
            <DialogDescription>
              Lệnh: <code className="text-xs">{cfg.command.replace('{KEY}', taskKey)}</code>
            </DialogDescription>
          </DialogHeader>

          <StreamLog lines={lines} isRunning={isRunning} />

          {!isRunning && lines.length > 0 && (
            <p className="text-sm text-emerald-600 mt-2">✅ Hoàn thành. Đóng để xem kết quả.</p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={handleClose} disabled={isRunning}>
              {isRunning ? 'Đang chạy…' : 'Đóng'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
