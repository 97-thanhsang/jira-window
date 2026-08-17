'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { RefreshCw, ChevronDown } from 'lucide-react';
import { useDashboardData, type DashboardFilters } from '@/hooks/use-dashboard-data';
import { useWorklogs } from '@/hooks/use-worklogs';
import { useDashboardViews } from '@/hooks/use-dashboard-views';
import { DEFAULT_GROUPS } from '@/lib/team-constants';
import {
  DashboardLayout,
  type WidgetConfig,
  type PresetName,
  PRESET_LABELS,
  savePresetToStorage,
  loadPresetFromStorage,
} from '@/components/dashboard/dashboard-layout';
import { LayoutSettings } from '@/components/dashboard/layout-settings';
import { DashboardViews as ViewsUI } from '@/components/dashboard/dashboard-views';
import { DashboardFilters as FiltersUI, type DashboardFiltersState, DEFAULT_FILTERS } from '@/components/dashboard/dashboard-filters';
import { ExportButton } from '@/components/dashboard/export-button';
import { WidgetMyIssues } from '@/components/dashboard/widget-my-issues';
import { WidgetWorklog } from '@/components/dashboard/widget-worklog';
import { WidgetQuickActions } from '@/components/dashboard/widget-quick-actions';
import { WidgetProjectStats } from '@/components/dashboard/widget-project-stats';
import { WidgetRecentActivity } from '@/components/dashboard/widget-recent-activity';
import { WidgetDueSoon } from '@/components/dashboard/widget-due-soon';
import { WidgetTeamOverview } from '@/components/dashboard/widget-team-overview';
import { WidgetSprintProgress } from '@/components/dashboard/widget-sprint-progress';
import { WidgetIssueTypes } from '@/components/dashboard/widget-issue-types';
import { WidgetPriority } from '@/components/dashboard/widget-priority';
import { cn } from '@/lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────

function getWeekRange() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
  const format = (d: Date) => d.toISOString().slice(0, 10);
  return { dateFrom: format(monday), dateTo: format(now) };
}

const PRESET_OPTIONS: PresetName[] = ['executive', 'detailed', 'analytics'];

function resolveTeamMembers(teamId: string): string[] | undefined {
  if (!teamId) return undefined;
  const group = DEFAULT_GROUPS.find(g => g.id === teamId);
  return group?.members;
}

// ─── Page component ──────────────────────────────────────────────────────

export default function DashboardPage() {
  const [preset, setPreset] = useState<PresetName>('executive');
  const [hiddenWidgets, setHiddenWidgets] = useState<string[]>([]);
  const [presetOpen, setPresetOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { views, activeView, saveView, loadView, deleteView, renameView } = useDashboardViews();

  const [filterState, setFilterState] = useState<DashboardFiltersState>({
    ...DEFAULT_FILTERS,
    ...getWeekRange(),
  });

  useEffect(() => {
    setPreset(loadPresetFromStorage());
  }, []);

  const hookFilters = useMemo<DashboardFilters>(() => ({
    teamMembers: resolveTeamMembers(filterState.team),
    project: filterState.project || undefined,
    dateFrom: filterState.dateFrom || undefined,
    dateTo: filterState.dateTo || undefined,
  }), [filterState.team, filterState.project, filterState.dateFrom, filterState.dateTo]);

  const { myIssues: issuesData, recentActivity, dueSoon, isLoading: issuesLoading, refresh } = useDashboardData(hookFilters);

  const { data: wlData, isLoading: wlsLoading } = useWorklogs({
    dateFrom: filterState.dateFrom,
    dateTo: filterState.dateTo,
    project: filterState.project || undefined,
  });

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    refresh();
    setTimeout(() => setIsRefreshing(false), 800);
  }, [refresh]);

  const handlePresetChange = useCallback((newPreset: PresetName) => {
    setPreset(newPreset);
    savePresetToStorage(newPreset);
  }, []);

  const handleToggleWidget = useCallback((id: string) => {
    setHiddenWidgets(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      localStorage.setItem('dashboard_hidden_widgets', JSON.stringify(next));
      return next;
    });
  }, []);

  const handleReset = useCallback(() => {
    setPreset('executive');
    setHiddenWidgets([]);
    savePresetToStorage('executive');
    localStorage.setItem('dashboard_hidden_widgets', '[]');
  }, []);

  // ── Saved Views handlers ───────────────────────────────────────────

  const handleSaveView = useCallback((name: string) => {
    saveView(name, preset, hiddenWidgets);
  }, [saveView, preset, hiddenWidgets]);

  const handleLoadView = useCallback((name: string) => {
    const view = loadView(name);
    if (view) {
      setPreset(view.preset);
      setHiddenWidgets(view.hiddenWidgets);
      savePresetToStorage(view.preset);
      localStorage.setItem('dashboard_hidden_widgets', JSON.stringify(view.hiddenWidgets));
    }
  }, [loadView]);

  // ── Widget configs ──────────────────────────────────────────────────

  const allWidgets = useMemo<WidgetConfig[]>(() => [
    { id: 'my-issues', title: 'My Issues', span: 1, component: <WidgetMyIssues data={issuesData} isLoading={issuesLoading} /> },
    { id: 'worklog', title: 'Worklog', span: 1, component: <WidgetWorklog entries={wlData?.entries ?? []} isLoading={wlsLoading} /> },
    { id: 'quick-actions', title: 'Quick Actions', span: 1, component: <WidgetQuickActions /> },
    { id: 'project-stats', title: 'Project Stats', span: 3, component: <WidgetProjectStats issues={issuesData?.issues} isLoading={issuesLoading} /> },
    { id: 'issue-types', title: 'Issue Types', span: 1, component: <WidgetIssueTypes issues={issuesData?.issues} isLoading={issuesLoading} /> },
    { id: 'priority', title: 'Priority', span: 1, component: <WidgetPriority issues={issuesData?.issues} isLoading={issuesLoading} /> },
    { id: 'recent-activity', title: 'Recent Activity', span: 1, component: <WidgetRecentActivity items={recentActivity} isLoading={issuesLoading} /> },
    { id: 'due-soon', title: 'Due Soon', span: 1, component: <WidgetDueSoon items={dueSoon} isLoading={issuesLoading} /> },
    { id: 'team-overview', title: 'Team Overview', span: 1, component: <WidgetTeamOverview issues={issuesData?.issues} isLoading={issuesLoading} /> },
    { id: 'sprint-progress', title: 'Sprint Progress', span: 1, component: <WidgetSprintProgress issues={issuesData?.issues} isLoading={issuesLoading} /> },
  ], [issuesData, issuesLoading, wlData, wlsLoading, recentActivity, dueSoon]);

  const totalIssues = issuesData?.total ?? 0;
  const overdueCount = dueSoon?.filter(d => d.overdue).length ?? 0;
  const presetLabel = PRESET_LABELS[preset];

  return (
    <>
      <style>{`
        @media print {
          .dashboard-toolbar { display: none !important; }
          .dashboard-content { padding: 0 !important; background: white !important; }
          body { background: white !important; }
          .no-print { display: none !important; }
        }
      `}</style>
      <div className="flex flex-col h-full">
        <div className="dashboard-toolbar flex items-center gap-3 px-6 py-3 border-b border-[#DFE1E6] dark:border-gray-700 bg-white dark:bg-gray-900 flex-shrink-0">
          <h1 className="text-lg font-bold text-[#172B4D] dark:text-gray-100">Dashboard</h1>

          <div className="ml-6 no-print">
            <FiltersUI filters={filterState} onChange={setFilterState} />
          </div>

          <div className="ml-auto flex items-center gap-2 no-print">
            {!issuesLoading && (
              <span className="text-[11px] text-[#5E6C84] dark:text-gray-400 font-medium bg-[#F4F5F7] dark:bg-gray-800 px-2 py-1 rounded">
                {totalIssues} issue{totalIssues !== 1 ? 's' : ''}
              </span>
            )}
            {!issuesLoading && overdueCount > 0 && (
              <span className="text-[11px] text-[#DE350B] font-medium bg-[#FFEBE6] dark:bg-red-900/30 px-2 py-1 rounded">
                {overdueCount} overdue
              </span>
            )}

            <div className="relative">
              <button onClick={() => setPresetOpen(!presetOpen)}
                className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded transition-colors text-[#0052CC] dark:text-blue-400 hover:bg-[#DEEBFF] dark:hover:bg-blue-900/30"
              >
                <span>{presetLabel}</span>
                <ChevronDown size={10} className={cn('transition-transform', presetOpen && 'rotate-180')} />
              </button>
              {presetOpen && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-gray-900 border border-[#DFE1E6] dark:border-gray-700 rounded-lg shadow-lg z-50 overflow-hidden"
                  onMouseLeave={() => setPresetOpen(false)}>
                  {PRESET_OPTIONS.map(opt => (
                    <button key={opt} onClick={() => { handlePresetChange(opt); setPresetOpen(false); }}
                      className={cn('w-full text-left px-3 py-2 text-[11px] transition-colors',
                        preset === opt
                          ? 'text-[#0052CC] dark:text-blue-400 font-semibold bg-[#DEEBFF] dark:bg-blue-900/20'
                          : 'text-[#172B4D] dark:text-gray-200 hover:bg-[#F4F5F7] dark:hover:bg-gray-800'
                      )}>{PRESET_LABELS[opt]}</button>
                  ))}
                </div>
              )}
            </div>

            <LayoutSettings hiddenWidgets={hiddenWidgets} onToggleWidget={handleToggleWidget} onReset={handleReset} />
            <ViewsUI
              views={views}
              activeView={activeView}
              onSave={handleSaveView}
              onLoad={handleLoadView}
              onDelete={deleteView}
              onRename={renameView}
            />
            <ExportButton />

            <button onClick={handleRefresh} disabled={isRefreshing}
              className={cn('flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded transition-colors',
                isRefreshing
                  ? 'text-[#8993A4] bg-[#F4F5F7] dark:bg-gray-800 cursor-not-allowed'
                  : 'text-[#0052CC] dark:text-blue-400 hover:bg-[#DEEBFF] dark:hover:bg-blue-900/30',
              )}>
              <RefreshCw size={12} className={cn(isRefreshing && 'animate-spin')} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        <div className="dashboard-content flex-1 overflow-y-auto px-6 py-4 bg-[#F4F5F7] dark:bg-gray-950">
          <DashboardLayout
            widgets={allWidgets}
            preset={preset}
            onPresetChange={handlePresetChange}
          />
        </div>
      </div>
    </>
  );
}
