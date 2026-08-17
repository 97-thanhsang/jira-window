import Link from 'next/link';
import Image from 'next/image';
import type { JiraIssue } from '@/types/jira';
import { StatusBadge } from '@/components/shared/status-badge';
import { PriorityIcon } from '@/components/shared/priority-icon';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** Fallback colored badge when no iconUrl is available */
function IssueTypeFallback({ name }: { name: string }) {
  const colors: Record<string, string> = {
    Bug: 'bg-red-500',
    Task: 'bg-blue-500',
    Story: 'bg-green-500',
    Epic: 'bg-purple-500',
    'Sub-task': 'bg-sky-400',
  };
  const bg = colors[name] ?? 'bg-gray-400';
  return (
    <span
      className={`inline-flex items-center justify-center w-4 h-4 rounded-sm ${bg} text-white text-[8px] font-bold flex-shrink-0`}
      title={name}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

interface IssueRowProps {
  issue: JiraIssue;
}

export function IssueRow({ issue }: IssueRowProps) {
  const f = issue.fields;

  return (
    <Link
      href={`/issues/${issue.key}`}
      className="flex items-center gap-3 px-4 py-3 hover:bg-[#F4F5F7] dark:hover:bg-gray-700/50 transition-colors border-b border-[#DFE1E6] dark:border-gray-700 last:border-b-0"
    >
      {/* Key — w-28: type icon + key text */}
      <div className="flex items-center gap-1.5 w-28 flex-shrink-0 min-w-0">
        {f.issuetype.iconUrl ? (
          <Image
            src={f.issuetype.iconUrl}
            alt={f.issuetype.name}
            width={16}
            height={16}
            className="flex-shrink-0"
            unoptimized
          />
        ) : (
          <IssueTypeFallback name={f.issuetype.name} />
        )}
        <span className="text-xs text-[#0052CC] dark:text-blue-400 font-medium truncate">
          {issue.key}
        </span>
      </div>

      {/* Summary */}
      <span className="flex-1 text-sm text-[#172B4D] dark:text-gray-100 truncate min-w-0">
        {f.summary}
      </span>

      {/* Status */}
      <div className="flex-shrink-0 w-28">
        <StatusBadge status={f.status} />
      </div>

      {/* Priority — icon only */}
      <div className="flex items-center flex-shrink-0 w-20">
        <PriorityIcon priority={f.priority} />
      </div>

      {/* Assignee */}
      <div className="flex items-center gap-1.5 flex-shrink-0 w-28 min-w-0">
        {f.assignee ? (
          <>
            {f.assignee.avatarUrls['24x24'] ? (
              <Image
                src={f.assignee.avatarUrls['24x24']}
                alt={f.assignee.displayName}
                width={20}
                height={20}
                className="rounded-full flex-shrink-0"
                unoptimized
              />
            ) : (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#0052CC] text-white text-[9px] font-bold flex-shrink-0">
                {f.assignee.displayName.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="text-xs text-[#5E6C84] dark:text-gray-400 truncate">
              {f.assignee.displayName}
            </span>
          </>
        ) : (
          <span className="text-xs text-[#5E6C84] dark:text-gray-500 italic">
            Unassigned
          </span>
        )}
      </div>

      {/* Project */}
      <span className="text-xs text-[#5E6C84] dark:text-gray-400 flex-shrink-0 w-28 truncate">
        {f.project.name}
      </span>

      {/* Updated */}
      <span className="text-xs text-[#5E6C84] dark:text-gray-400 flex-shrink-0 w-20 text-right">
        {formatDate(f.updated)}
      </span>
    </Link>
  );
}
