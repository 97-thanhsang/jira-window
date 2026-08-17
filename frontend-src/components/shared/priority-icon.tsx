import { JiraPriority } from '@/types/jira';

const priorityColors: Record<string, string> = {
  Highest: '#DE350B',
  High:    '#FF5630',
  Medium:  '#FFAB00',
  Low:     '#2684FF',
  Lowest:  '#2684FF',
  Blocker: '#DE350B',
  Minor:   '#6B778C',
};

export function PriorityIcon({ priority }: { priority: JiraPriority | null }) {
  if (!priority) {
    return <div className="w-3 h-3 rounded-full flex-shrink-0 bg-[#DFE1E6] dark:bg-gray-600" title="No priority" />;
  }
  const color = priorityColors[priority.name] ?? '#6B778C';
  return (
    <div
      className="w-3 h-3 rounded-full flex-shrink-0"
      style={{ backgroundColor: color }}
      title={priority.name}
    />
  );
}
