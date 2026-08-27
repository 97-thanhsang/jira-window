export const ISSUE_TYPE_BADGE_CLASSES: Record<string, string> = {
  Story: 'bg-[#36B37E] text-white', 'Sub-task': 'bg-[#0052CC] text-white',
  Bug: 'bg-[#DE350B] text-white', Task: 'bg-[#4BADE8] text-white',
  Epic: 'bg-[#904EE2] text-white', Support: 'bg-[#FF8B00] text-white',
  Enhancement: 'bg-[#008DA6] text-white', Improvement: 'bg-[#6554C0] text-white',
  'New Feature': 'bg-[#E774BB] text-white', 'Build Release': 'bg-[#7A869A] text-white',
  'Bug after release': 'bg-[#BF2600] text-white', WBS: 'bg-[#505F79] text-white',
};

export function getIssueTypeBadgeClass(name: string): string {
  return ISSUE_TYPE_BADGE_CLASSES[name] ?? 'bg-gray-400 text-white';
}

export const STATUS_CATEGORY_BADGE_CLASSES: Record<string, string> = {
  new: 'bg-[#5E6C84] text-white',
  indeterminate: 'bg-[#0052CC] text-white',
  done: 'bg-[#00875A] text-white',
};

export const PRIORITY_HEX_COLORS: Record<string, string> = {
  Highest: '#DE350B', High: '#FF5630', Medium: '#FFAB00',
  Low: '#2684FF', Lowest: '#2684FF', Blocker: '#DE350B', Minor: '#6B778C',
};

export const PROJECT_DOT_COLORS: Record<string, string> = {
  HLU2: '#0052CC',
  HUBONG01: '#36B37E',
  EMSPRO2: '#FF8B00',
};

export function projectDot(key: string): string {
  return PROJECT_DOT_COLORS[key] ?? '#6554C0';
}

export const PROJECT_COLORS: Record<string, string> = {
  HLU2: '#0052CC', HUBONG01: '#36B37E', HUFI: '#DE350B',
  HPMUON2: '#FF8B00', RDDEP: '#6554C0', PSDEP: '#008DA6',
};

export const ISSUE_TYPE_HEX_COLORS: Record<string, string> = {
  Task: '#0052CC', 'Sub-task': '#008DA6', Story: '#36B37E',
  Bug: '#DE350B', Epic: '#6554C0', Improvement: '#FF8B00',
  Support: '#E774BB', Enhancement: '#00B8D9', 'New Feature': '#5243AA',
  'Build Release': '#FF5630', 'Bug after release': '#BF2600', WBS: '#403294',
};

export const ISSUE_COLOR_PALETTE = [
  '#0052CC', '#36B37E', '#DE350B', '#FF8B00', '#6554C0',
  '#008DA6', '#E774BB', '#00B8D9', '#5243AA', '#BF2600',
  '#403294', '#006644', '#FF991F', '#172B4D', '#0747A6',
];
