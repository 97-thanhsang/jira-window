import type { TeamGroup } from '@/types/jira';

export type { TeamGroup };

export const DEFAULT_GROUPS: TeamGroup[] = [
  { id: 'rdx', name: 'R&D-X', members: ['SangNT', 'PhatNH', 'HieuDT', 'NghiaDT', 'TriHD', 'ThinhTPQ'] },
  { id: 'frontend', name: 'Team Frontend', members: ['SangNT', 'PhatNH', 'HieuDT'] },
  { id: 'backend', name: 'Team Backend', members: ['NghiaDT', 'ThinhTPQ', 'TriHD'] },
];

export const MEMBER_DISPLAY_NAMES: Record<string, string> = {
  SangNT: 'Sang Nguyen Thanh',
  PhatNH: 'Phat Nguyen Hong',
  HieuDT: 'Hieu Dao Tao',
  NghiaDT: 'Nghia Doan Trong',
  TriHD: 'Tri Ho Dang',
  ThinhTPQ: 'Thinh Tran Pham Quan',
  HuyNQ: 'Huy Nguyen Quoc',
  LinhPT: 'Linh Pham Thi',
  MinhNV: 'Minh Nguyen Van',
  DucLM: 'Duc Le Minh',
  AnhNT: 'Anh Nguyen Tuan',
  TuanNA: 'Tuan Nguyen Anh',
};
