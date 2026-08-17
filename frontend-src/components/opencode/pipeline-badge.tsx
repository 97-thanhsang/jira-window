import { cn } from '@/lib/utils';
import type { PipelineStatus } from '@/types/opencode';

interface PipelineBadgeProps {
  status: PipelineStatus;
  label?: string;
  size?: 'sm' | 'md';
}

const STATUS_CONFIG: Record<PipelineStatus, { label: string; classes: string }> = {
  IDLE:    { label: 'Chưa chạy', classes: 'bg-muted text-muted-foreground' },
  RUNNING: { label: 'Đang chạy', classes: 'bg-blue-100 text-blue-700 animate-pulse' },
  DONE:    { label: 'Hoàn thành', classes: 'bg-emerald-100 text-emerald-700' },
  FAILED:  { label: 'Lỗi',       classes: 'bg-red-100 text-red-700' },
  BLOCKED: { label: 'Blocked',   classes: 'bg-orange-100 text-orange-700' },
};

export function PipelineBadge({ status, label, size = 'sm' }: PipelineBadgeProps) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        cfg.classes
      )}
    >
      {label ?? cfg.label}
    </span>
  );
}
