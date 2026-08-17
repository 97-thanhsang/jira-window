'use client';
import type { WorklogEntry } from '@/types/jira';

const PROJECT_COLORS: Record<string, string> = {
  HLU2: '#0052CC', HUBONG01: '#36B37E', HUFI: '#DE350B',
  HPMUON2: '#FF8B00', RDDEP: '#6554C0', PSDEP: '#008DA6',
};

export function WorklogEntryCard({
  entry,
  onClick,
  dragHandleProps,
  isDragging,
}: {
  entry: WorklogEntry;
  onClick?: (entry: WorklogEntry) => void;
  dragHandleProps?: Record<string, unknown>;
  isDragging?: boolean;
}) {
  const color = PROJECT_COLORS[entry.projectKey] ?? '#5E6C84';

  return (
    <div
      className={`px-1.5 py-1 rounded-sm text-[11px] cursor-grab active:cursor-grabbing
        bg-white dark:bg-gray-800 border border-[#DFE1E6] dark:border-gray-700
        hover:shadow-sm transition-all ${isDragging ? 'opacity-50 shadow-lg' : ''}`}
      style={{
        borderLeftColor: color,
        borderLeftWidth: '3px',
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(entry);
      }}
      {...(dragHandleProps as Record<string, unknown>)}
    >
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1 min-w-0">
          {entry.issueTypeIconUrl ? (
            <img src={entry.issueTypeIconUrl} alt={entry.issueTypeName} className="w-3.5 h-3.5 flex-shrink-0" />
          ) : (
            <span className="text-[8px] font-bold px-1 py-0.5 rounded-sm flex-shrink-0 bg-gray-400 text-white">
              {entry.issueTypeName.slice(0, 3).toUpperCase()}
            </span>
          )}
          <span className="font-medium text-[#172B4D] dark:text-gray-100 truncate">
            {entry.issueKey}
          </span>
        </div>
        <span className="text-[#5E6C84] dark:text-gray-400 flex-shrink-0 font-medium">
          {(entry.timeSpentSeconds / 3600).toFixed(1)}h
        </span>
      </div>
    </div>
  );
}
