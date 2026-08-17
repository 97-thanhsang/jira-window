// ─── Shared filter constants — single source of truth for all filter bars ────

export const ISSUE_TYPES = [
  { id: '10100', name: 'Task' },
  { id: '10101', name: 'Sub-task' },
  { id: '10001', name: 'Story' },
  { id: '10000', name: 'Epic' },
  { id: '10102', name: 'Bug' },
  { id: '10203', name: 'Support' },
  { id: '10400', name: 'Enhancement' },
  { id: '10500', name: 'Improvement' },
  { id: '10501', name: 'New Feature' },
  { id: '10201', name: 'Build Release' },
  { id: '10202', name: 'Bug after release' },
  { id: '10200', name: 'WBS' },
] as const;

export const PRIORITY_OPTIONS = [
  { id: '1', name: 'Highest' },
  { id: '2', name: 'High' },
  { id: '3', name: 'Medium' },
  { id: '4', name: 'Low' },
  { id: '5', name: 'Lowest' },
  { id: '10000', name: 'Blocker' },
  { id: '10001', name: 'Minor' },
] as const;

export const USER_PRESETS = [
  { value: 'currentUser()', label: 'Me' },
  { value: 'EMPTY', label: 'Unassigned' },
] as const;

// ─── Unified filter state type ────────────────────────────────────────────────

export interface UnifiedFilters {
  searchText: string;
  projectIn?: string[];
  projectExclude?: boolean;
  issuetypeIn?: string[];
  issuetypeExclude?: boolean;
  statusIn?: string[];
  statusExclude?: boolean;
  priorityIn?: string[];
  priorityExclude?: boolean;
  assigneeIn?: string[];
  assigneeExclude?: boolean;
  sprintIn?: string[];
  sprintExclude?: boolean;
  reporterIn?: string[];
  reporterExclude?: boolean;
  epicIn?: string[];
  epicExclude?: boolean;
  dateRangeMode?: 'current' | 'old';
}

export const EMPTY_UNIFIED_FILTERS: UnifiedFilters = {
  searchText: '',
};
