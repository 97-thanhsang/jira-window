import { JiraStatus } from '@/types/jira';
import { cn } from '@/lib/utils';

const categoryColors: Record<string, string> = {
  new: 'bg-[#DFE1E6] text-[#42526E]',
  indeterminate: 'bg-[#DEEBFF] text-[#0052CC]',
  done: 'bg-[#E3FCEF] text-[#006644]',
};

export function StatusBadge({ status }: { status: JiraStatus }) {
  const colorClass = categoryColors[status.statusCategory.key] ?? categoryColors['new'];
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium uppercase tracking-wide',
        colorClass
      )}
    >
      {status.name}
    </span>
  );
}
