'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { JiraIssue } from '@/types/jira';
import { projectDot } from '@/lib/jira-colors';

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatHours(seconds: number): string {
  const h = seconds / 3600;
  return h >= 10 ? `${Math.round(h)}h` : `${h.toFixed(1)}h`;
}

// ─── Component ────────────────────────────────────────────────────────────

interface WidgetProjectStatsProps {
  issues?: JiraIssue[];
  isLoading?: boolean;
}

export function WidgetProjectStats({ issues, isLoading }: WidgetProjectStatsProps) {
  const chartData = useMemo(() => {
    if (!issues || issues.length === 0) return [];
    const map = new Map<string, { projectKey: string; projectName: string; estHours: number; logHours: number; issueCount: number }>();
    const seenIssues = new Set<string>();

    for (const issue of issues) {
      const pk = issue.fields.project.key;
      if (!map.has(pk)) {
        map.set(pk, { projectKey: pk, projectName: issue.fields.project.name, estHours: 0, logHours: 0, issueCount: 0 });
      }
      const stat = map.get(pk)!;
      stat.estHours += (issue.fields.timetracking?.originalEstimateSeconds ?? 0) / 3600;
      stat.logHours += (issue.fields.timetracking?.timeSpentSeconds ?? 0) / 3600;
      if (!seenIssues.has(issue.key)) {
        seenIssues.add(issue.key);
        stat.issueCount++;
      }
    }

    return Array.from(map.values())
      .map(s => ({
        ...s,
        name: s.projectKey,
        pct: s.estHours > 0 ? Math.min(Math.round((s.logHours / s.estHours) * 100), 100) : 0,
      }))
      .sort((a, b) => b.logHours - a.logHours)
      .slice(0, 8);
  }, [issues]);

  const maxHours = chartData.length > 0 ? Math.max(...chartData.map(d => Math.max(d.estHours, d.logHours))) : 0;

  if (isLoading) {
    return (
      <div className="space-y-2 animate-pulse">
        <div className="h-4 bg-[#F4F5F7] dark:bg-gray-700 rounded w-32" />
        <div className="h-48 bg-[#F4F5F7] dark:bg-gray-700 rounded" />
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 text-[11px] text-[#8993A4] dark:text-gray-500">
        No project data available
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Bar Chart */}
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 20, left: 10, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#F4F5F7" />
            <XAxis
              type="number"
              tick={{ fontSize: 10, fill: '#8993A4' }}
              tickLine={false}
              axisLine={false}
              domain={[0, Math.ceil(maxHours * 1.15) || 1]}
              tickFormatter={(v: number) => `${v}h`}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 10, fill: '#5E6C84', fontWeight: 600 }}
              tickLine={false}
              axisLine={false}
              width={70}
            />
            <Tooltip
              contentStyle={{ fontSize: 11, borderRadius: 6, border: '1px solid #DFE1E6' }}
            />
            <Legend
              wrapperStyle={{ fontSize: 10, color: '#5E6C84' }}
              iconType="rect"
              iconSize={8}
            />
            <Bar dataKey="estHours" name="Estimated" fill="#A5ADBA" radius={[0, 2, 2, 0]} barSize={14} />
            <Bar dataKey="logHours" name="Logged" fill="#0052CC" radius={[0, 2, 2, 0]} barSize={14} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Progress list */}
      <div className="space-y-1.5">
        {chartData.map(d => (
          <div key={d.projectKey} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: projectDot(d.projectKey) }} />
            <span className="text-[10px] text-[#5E6C84] dark:text-gray-400 min-w-[60px] truncate font-medium">{d.projectName || d.projectKey}</span>
            <span className="text-[9px] text-[#8993A4] ml-auto">{d.issueCount} issue{d.issueCount !== 1 ? 's' : ''}</span>
            <div className="flex-1 max-w-[120px] h-1.5 bg-[#DFE1E6] dark:bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{
                width: `${d.pct}%`,
                backgroundColor: d.pct >= 100 ? '#36B37E' : '#0052CC',
              }} />
            </div>
            <span className="text-[9px] font-bold text-[#172B4D] dark:text-gray-200 w-8 text-right">{d.pct}%</span>
            <span className="text-[9px] text-[#8993A4] w-16 text-right">{formatHours(d.logHours * 3600)} / {formatHours(d.estHours * 3600)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
