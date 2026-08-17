'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { JiraIssue } from '@/types/jira';

interface ProjectStat {
  projectKey: string;
  projectName: string;
  totalHours: number;
  issueCount: number;
  estHours: number;
}

interface BoardProjectStatsProps {
  issues: JiraIssue[];
  selectedProject: string | null;
  onSelectProject: (projectKey: string | null) => void;
}

const PROJECT_DOT_COLORS: Record<string, string> = {
  HLU2: '#0052CC',
  HUBONG01: '#36B37E',
  EMSPRO2: '#FF8B00',
};

function projectDot(key: string): string {
  return PROJECT_DOT_COLORS[key] ?? '#6554C0';
}

export function BoardProjectStats({ issues, selectedProject, onSelectProject }: BoardProjectStatsProps) {
  const stats = useMemo(() => {
    const map = new Map<string, ProjectStat>();
    const seenIssues = new Set<string>();

    for (const issue of issues) {
      const pk = issue.fields.project.key;
      const pn = issue.fields.project.name;
      if (!map.has(pk)) {
        map.set(pk, { projectKey: pk, projectName: pn, totalHours: 0, issueCount: 0, estHours: 0 });
      }
      const stat = map.get(pk)!;
      stat.totalHours += (issue.fields.timetracking?.timeSpentSeconds ?? 0) / 3600;
      stat.estHours += (issue.fields.timetracking?.originalEstimateSeconds ?? 0) / 3600;
      if (!seenIssues.has(issue.key)) {
        seenIssues.add(issue.key);
        stat.issueCount++;
      }
    }

    return Array.from(map.values()).sort((a, b) => b.totalHours - a.totalHours);
  }, [issues]);

  const allTotal = useMemo(() => stats.reduce((s, st) => s + st.totalHours, 0), [stats]);
  const allEst = useMemo(() => stats.reduce((s, st) => s + st.estHours, 0), [stats]);
  const allIssueCount = useMemo(() => stats.reduce((s, st) => s + st.issueCount, 0), [stats]);
  const allProgress = allEst > 0 ? Math.min(allTotal / allEst, 1) : 0;

  if (stats.length === 0) return null;

  return (
    <div className="space-y-1">
      {/* Header */}
      <div className="flex items-center justify-between px-1 mb-3">
        <span className="text-[11px] font-bold text-[#172B4D] dark:text-gray-200 uppercase tracking-wider">Projects</span>
        <span className="text-[10px] text-[#5E6C84] dark:text-gray-400 font-medium bg-[#F4F5F7] dark:bg-gray-700 px-1.5 py-0.5 rounded-sm">{stats.length}</span>
      </div>

      {/* All projects entry */}
      <button
        onClick={() => onSelectProject(null)}
        className={cn(
          'w-full flex flex-col gap-1.5 px-3 py-2.5 rounded text-[12px] transition-all text-left border',
          !selectedProject
            ? 'bg-[#0052CC] text-white shadow-sm border-[#0052CC] dark:border-blue-700'
            : 'text-[#172B4D] dark:text-gray-200 hover:bg-[#F4F5F7] dark:hover:bg-gray-700 border-transparent',
        )}
      >
        <div className="flex items-center justify-between w-full">
          <span className="flex items-center gap-2 font-bold">
            <BarChartIcon />
            <span>All Projects</span>
          </span>
          <span className={cn('text-[11px] font-bold', !selectedProject ? 'text-white/90' : 'text-[#172B4D] dark:text-gray-100')}>{allTotal.toFixed(1)}h</span>
        </div>
        <div className="flex items-center justify-between text-[10px]">
          <span className={cn(!selectedProject ? 'text-white/70' : 'text-[#8993A4]')}>{allIssueCount} issues</span>
          <div className="flex items-center gap-2">
            <span className={cn(!selectedProject ? 'text-white/70' : 'text-[#8993A4]')}>Est {allEst.toFixed(1)}h</span>
            {allProgress > 0 && (
              <span className="text-[9px] font-semibold">{Math.round(allProgress * 100)}%</span>
            )}
          </div>
        </div>
        {/* Progress bar */}
        {allEst > 0 && (
          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: !selectedProject ? 'rgba(255,255,255,0.2)' : '#DFE1E6' }}>
            <div className="h-full rounded-full transition-all" style={{
              width: `${Math.min(allProgress * 100, 100)}%`,
              backgroundColor: !selectedProject ? 'rgba(255,255,255,0.6)' : '#0052CC',
            }} />
          </div>
        )}
      </button>

      {/* Divider */}
      <div className="my-2 border-t border-[#DFE1E6] dark:border-gray-700" />

      {/* Individual project entries */}
      {stats.map((stat, index) => {
        const isSelected = selectedProject === stat.projectKey;
        const progress = stat.estHours > 0 ? Math.min(stat.totalHours / stat.estHours, 1) : 0;
        const total = stats.length;

        return (
          <button
            key={stat.projectKey}
            onClick={() => onSelectProject(isSelected ? null : stat.projectKey)}
            className={cn(
              'w-full flex flex-col gap-1 px-3 py-2.5 rounded text-[12px] transition-all text-left border',
              isSelected
                ? 'bg-[#DEEBFF] dark:bg-blue-900/20 border-[#0052CC]/40 dark:border-blue-800 shadow-[inset_2px_0_0_0_#0052CC]'
                : 'text-[#172B4D] dark:text-gray-200 hover:bg-[#F4F5F7] dark:hover:bg-gray-700 border-transparent',
            )}
          >
            <div className="flex items-center justify-between w-full">
              <span className="flex items-center gap-2 font-medium min-w-0">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm" style={{ backgroundColor: projectDot(stat.projectKey) }} />
                <span className={cn('truncate', isSelected ? 'text-[#0052CC] dark:text-blue-400 font-semibold' : '')}>
                  {stat.projectName || stat.projectKey}
                </span>
              </span>
              <span className={cn('text-[11px] font-bold flex-shrink-0 ml-2',
                isSelected ? 'text-[#0052CC] dark:text-blue-400' : 'text-[#172B4D] dark:text-gray-100',
              )}>{stat.totalHours.toFixed(1)}h</span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className={isSelected ? 'text-[#0052CC]/70 dark:text-blue-400/70' : 'text-[#8993A4]'}>
                {stat.issueCount} issue{stat.issueCount !== 1 ? 's' : ''}
              </span>
              <div className="flex items-center gap-2">
                <span className={isSelected ? 'text-[#0052CC]/60' : 'text-[#8993A4]'}>Est {stat.estHours.toFixed(1)}h</span>
                {progress > 0 && (
                  <span className={cn('text-[9px] font-semibold', progress >= 1 ? 'text-[#DE350B]' : 'text-[#36B37E]')}>
                    {Math.round(progress * 100)}%
                  </span>
                )}
              </div>
            </div>
            {/* Progress bar */}
            {stat.estHours > 0 && (
              <div className="w-full h-1 rounded-full overflow-hidden bg-[#DFE1E6] dark:bg-gray-700">
                <div className="h-full rounded-full transition-all" style={{
                  width: `${Math.min(progress * 100, 100)}%`,
                  backgroundColor: progress >= 1 ? '#DE350B' : '#0052CC',
                }} />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

function BarChartIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1" y="8" width="3" height="5" rx="0.5" fill="currentColor" opacity="0.6"/>
      <rect x="5.5" y="4.5" width="3" height="8.5" rx="0.5" fill="currentColor" opacity="0.8"/>
      <rect x="10" y="1" width="3" height="12" rx="0.5" fill="currentColor"/>
    </svg>
  );
}
