'use client';
import { cn } from '@/lib/utils';

export interface GroupByControlsProps {
  groupBy: string;
  subGroupBy: string;
  subSubGroupBy: string;
  onGroupByChange: (value: string) => void;
  onSubGroupByChange: (value: string) => void;
  onSubSubGroupByChange: (value: string) => void;
  groupByOptions?: readonly string[];
  subGroupByOptions?: readonly string[];
  subSubGroupByOptions?: readonly string[];
  /** How many levels to show. Default: 3 (all) */
  levels?: 1 | 2 | 3;
}

const DEFAULT_OPTIONS = ['none', 'project', 'assignee', 'priority', 'type', 'parent'] as const;
const DEFAULT_SUB_SUB_OPTIONS = ['none', 'priority', 'type', 'parent'] as const;
const NONE_VALUE = 'none';

function parseOptions(allOptions: readonly string[], exclude: string[]): string[] {
  return allOptions.filter(o => !exclude.includes(o));
}

function formatLabel(value: string): string {
  if (value === NONE_VALUE) return 'None';
  if (value === 'type' || value === 'issuetype') return 'Type';
  if (value === 'statusCategory') return 'Status Category';
  return value;
}

export function GroupByControls({
  groupBy,
  subGroupBy,
  subSubGroupBy,
  onGroupByChange,
  onSubGroupByChange,
  onSubSubGroupByChange,
  groupByOptions = DEFAULT_OPTIONS,
  subGroupByOptions,
  subSubGroupByOptions = DEFAULT_SUB_SUB_OPTIONS,
  levels = 3,
}: GroupByControlsProps) {

  const resolvedSubOptions = subGroupByOptions ?? parseOptions(groupByOptions, [groupBy]);
  const resolvedSubSubOptions = subSubGroupByOptions ?? parseOptions(DEFAULT_SUB_SUB_OPTIONS, [groupBy, subGroupBy]);

  const showSub = levels >= 2 && groupBy !== NONE_VALUE;
  const showSubSub = levels >= 3 && subGroupBy !== NONE_VALUE && showSub;

  return (
    <div className="mb-4 rounded-sm border border-[#DFE1E6] dark:border-gray-700 bg-[#F4F5F7] dark:bg-gray-800/60">
      <div className="px-4 pb-3 pt-2">
        {/* Row 1: Group by */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-[#5E6C84] dark:text-gray-400 w-16">Group by</span>
          {groupByOptions.map((g) => (
            <button
              key={g}
              onClick={() => { onGroupByChange(g); onSubGroupByChange(NONE_VALUE); onSubSubGroupByChange(NONE_VALUE); }}
              className={cn(
                'text-xs px-2 py-0.5 rounded border transition-colors capitalize',
                groupBy === g
                  ? 'bg-[#0052CC] text-white border-[#0052CC]'
                  : 'border-[#DFE1E6] dark:border-gray-600 text-[#5E6C84] dark:text-gray-400 hover:bg-white dark:hover:bg-gray-700',
              )}
            >
              {formatLabel(g)}
            </button>
          ))}
        </div>

        {/* Row 2: Sub group */}
        {showSub && (
          <div className="flex items-center gap-2 flex-wrap mt-2.5 pt-2.5 ml-4 border-t border-[#DFE1E6] dark:border-gray-600">
            <span className="text-xs font-medium text-[#6554C0] dark:text-purple-400 w-16">Sub group</span>
            {resolvedSubOptions.map((g) => (
              <button
                key={g}
                onClick={() => { onSubGroupByChange(g); onSubSubGroupByChange(NONE_VALUE); }}
                className={cn(
                  'text-xs px-2 py-0.5 rounded border transition-colors capitalize',
                  subGroupBy === g
                    ? 'bg-[#6554C0] text-white border-[#6554C0]'
                    : 'border-[#DFE1E6] dark:border-gray-600 text-[#5E6C84] dark:text-gray-400 hover:bg-white dark:hover:bg-gray-700',
                )}
              >
                {formatLabel(g)}
              </button>
            ))}
          </div>
        )}

        {/* Row 3: Sub sub */}
        {showSubSub && (
          <div className="flex items-center gap-2 flex-wrap mt-2.5 pt-2.5 ml-8 border-t border-[#DFE1E6] dark:border-gray-600">
            <span className="text-xs font-medium text-[#998DD9] dark:text-purple-300 w-16">Sub sub</span>
            {resolvedSubSubOptions.map((g) => (
              <button
                key={g}
                onClick={() => onSubSubGroupByChange(g)}
                className={cn(
                  'text-xs px-2 py-0.5 rounded border transition-colors capitalize',
                  subSubGroupBy === g
                    ? 'bg-[#998DD9] text-white border-[#998DD9]'
                    : 'border-[#DFE1E6] dark:border-gray-600 text-[#5E6C84] dark:text-gray-400 hover:bg-white dark:hover:bg-gray-700',
                )}
              >
                {formatLabel(g)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
