export interface JiraUser {
  name: string;
  displayName: string;
  emailAddress: string;
  avatarUrls: { '48x48': string; '24x24': string };
}

export interface JiraStatus {
  id: string;
  name: string;
  statusCategory: {
    key: 'new' | 'indeterminate' | 'done';
    colorName: string;
  };
}

export interface JiraPriority {
  name: 'Highest' | 'High' | 'Medium' | 'Low' | 'Lowest' | 'Blocker' | 'Minor';
  iconUrl: string;
}

export interface JiraIssueType {
  name: string;
  subtask: boolean;
  iconUrl: string;
}

export interface JiraAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  created: string;
  content: string;    // full download URL (from Jira, not our proxy)
  thumbnail?: string; // thumbnail URL (only for images)
  author: JiraUser;
}

export interface JiraTimeTracking {
  originalEstimate?: string;
  remainingEstimate?: string;
  timeSpent?: string;
  originalEstimateSeconds?: number;
  remainingEstimateSeconds?: number;
  timeSpentSeconds?: number;
}

export interface JiraSprint {
  id: number;
  name: string;
  state: 'active' | 'closed' | 'future';
  startDate?: string;
  endDate?: string;
}

export interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    description: string | null;
    status: JiraStatus;
    priority: JiraPriority;
    issuetype: JiraIssueType;
    assignee: JiraUser | null;
    reporter: JiraUser;
    project: { key: string; name: string };
    created: string;
    updated: string;
    duedate?: string;
    subtasks?: JiraIssue[];
    parent?: { key: string; fields: { summary: string; status: JiraStatus } };
    labels: string[];
    comment?: { comments: JiraComment[] };
    attachment?: JiraAttachment[];
    timetracking?: JiraTimeTracking;
    fixVersions?: Array<{ id: string; name: string; released: boolean }>;
    components?: Array<{ id: string; name: string }>;
    sprint?: JiraSprint | JiraSprint[] | null;
    customfield_10020?: JiraSprint | JiraSprint[] | null; // Jira Server sprint field alias
  };
}

export interface JiraComment {
  id: string;
  author: JiraUser;
  body: string;
  created: string;
}

export interface JiraTransition {
  id: string;
  name: string;
  to: JiraStatus;
}

export interface JiraSearchResult {
  total: number;
  issues: JiraIssue[];
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
  projectTypeKey?: string;
}

export interface JiraBoard {
  id: number;
  name: string;
  type: 'kanban' | 'scrum';
  self?: string;
}

export interface JiraBoardColumnConfig {
  name: string;
  statuses: Array<{ id: string; self?: string }>;
  min?: number;
  max?: number;
}

export interface JiraBoardConfig {
  id: number;
  name: string;
  type: 'kanban' | 'scrum';
  self: string;
  filter: { id: string; self: string };
  subQuery?: { query: string };
  columnConfig: {
    columns: JiraBoardColumnConfig[];
    constraintType: string;
  };
  ranking: Record<string, unknown>;
}

// ── Worklog Calendar ──

export interface WorklogAuthor {
  accountId?: string;
  name: string;
  displayName: string;
  avatarUrls?: { '24x24': string };
}

export interface WorklogEntry {
  id: string;
  issueId: string;
  issueKey: string;
  issueSummary: string;
  issueTypeName: string;        // "Story", "Task", "Bug", "Sub-task", etc.
  issueTypeIconUrl: string;     // Jira icon URL
  projectKey: string;
  projectName: string;
  author: WorklogAuthor;
  timeSpent: string;           // "2h 30m"
  timeSpentSeconds: number;    // 9000
  started: string;             // "2026-05-06T08:30:00.000+0700"
  comment: string;
  created: string;
  updated: string;
  estSeconds: number;          // original estimate from issue timetracking
  status?: string;             // "Done", "In Progress", "To Do", etc.
  priority?: string;           // "High", "Medium", etc.
  duedate?: string;            // "2026-05-15" or undefined
  parentKey?: string;              // parent issue key (e.g., PROJ-10)
  parentSummary?: string;          // parent issue summary
  parentIssueTypeName?: string;    // "Story", "Task", "Epic", etc.
  parentIssueTypeIconUrl?: string; // parent issue type icon URL
  parentStatus?: string;           // parent status name
  parentStatusCategory?: string;   // 'new' | 'indeterminate' | 'done'
}

export interface WorklogFilters {
  username: string;
  dateFrom: string;            // "2026-05-01"
  dateTo: string;              // "2026-05-31"
  project?: string;
}

export interface WorklogCreatePayload {
  issueKey: string;
  timeSpentSeconds: number;
  comment: string;
  started: string;
}

export interface WorklogSearchResult {
  entries: WorklogEntry[];
  total: number;
  totalHours: number;
  dailyHours: Record<string, number>; // "2026-05-06" → 8
}

// ── Team Dashboard ──

export interface TeamMemberSummary {
  username: string;
  displayName: string;
  avatarUrl: string;
  dailyHours: Record<string, number>;    // "2026-05-06" → 7.5
  totalHours: number;
  averageHours: number;
  dueTasks: Record<string, DueTaskInfo[]>; // "2026-05-06" → tasks
}

export interface DueTaskInfo {
  issueKey: string;
  summary: string;
  duedate: string;
  status: string;
  priority: string;
  assignee: string;
}

export interface TeamDashboardData {
  members: TeamMemberSummary[];
  dateRange: { from: string; to: string };
  allWorklogEntries: WorklogEntry[];
  allDueTasks: DueTaskInfo[];
  totalHours: number;
  memberCount: number;
}

// ── Task-Centric Team Report ──

export interface TaskReport {
  issueKey: string;
  issueId: string;
  summary: string;
  issueTypeName: string;
  issueTypeIconUrl: string;
  projectKey: string;
  estSeconds: number;            // original estimate
  estDisplay: string;            // "8h" or "2d" etc.
  totalLoggedSeconds: number;    // total logged in date range
  totalLoggedDisplay: string;    // "15.5h"
  dailySeconds: Record<string, number>; // "2026-05-06" → seconds
  status: string;                // "Done", "In Progress", "To Do", etc.
  priority: string;              // "High", "Medium", etc.
  duedate?: string;              // "2026-05-15" or undefined
  parentKey?: string;              // parent issue key (e.g., PROJ-10)
  parentSummary?: string;          // parent issue summary
  parentIssueTypeName?: string;    // "Epic", "Story", "Task", etc.
  parentIssueTypeIconUrl?: string; // parent issue type icon URL
  parentStatus?: string;           // parent status name e.g. "In Progress"
  parentStatusCategory?: string;   // 'new' | 'indeterminate' | 'done'
  parentDuedate?: string;          // parent due date "2026-05-15"
  parentEstSeconds?: number;       // parent original estimate in seconds
  parentEstDisplay?: string;       // parent estimate display "8h"
}

export interface UserReport {
  username: string;
  displayName: string;
  avatarUrl: string;
  tasks: TaskReport[];
  totalEstSeconds: number;
  totalEstDisplay: string;
  totalLoggedSeconds: number;
  totalLoggedDisplay: string;
}

export interface TeamReportData {
  users: UserReport[];
  dateRange: { from: string; to: string };
  totalEstSeconds: number;
  totalLoggedSeconds: number;
  userCount: number;
  taskCount: number;
}

export interface TeamGroup {
  id: string;
  name: string;
  members: string[];  // usernames
}

export interface TeamDashboardFilters {
  groups: TeamGroup[];
  selectedGroupId: string | null;
  project: string;
  dateFrom: string;
  dateTo: string;
  period: 'week' | 'month' | 'custom';
  searchText: string;
  quickFilter: 'all' | 'under-8h' | 'overdue' | 'off';
}
