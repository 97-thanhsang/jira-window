import type { WorklogEntry } from '@/types/jira';

export const WORK_START = 8;
export const MORNING_END = 12;
export const AFTERNOON_START = 13.5;
export const WORK_END = 17.5;

export function parseTimeToHours(isoString: string): number {
  const d = new Date(isoString);
  return d.getHours() + d.getMinutes() / 60;
}

export function formatHour(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export interface TimeInterval {
  startH: number;
  endH: number;
  label: string;
  key: string;
  summary: string;
  hours: number;
}

export function buildOccupied(worklogs: WorklogEntry[], excludeId?: string): TimeInterval[] {
  return worklogs
    .filter(w => w.id !== excludeId)
    .map(w => ({
      startH: parseTimeToHours(w.started),
      endH: parseTimeToHours(w.started) + w.timeSpentSeconds / 3600,
      label: `${w.issueKey} (${(w.timeSpentSeconds / 3600).toFixed(1)}h)`,
      key: w.issueKey,
      summary: w.issueSummary,
      hours: w.timeSpentSeconds / 3600,
    }))
    .sort((a, b) => a.startH - b.startH);
}

export function findNextStart(occupied: TimeInterval[], afterH?: number): number | null {
  const cursor = afterH ?? WORK_START;

  let t = Math.max(cursor, WORK_START);
  if (t < MORNING_END) {
    for (const iv of occupied) {
      if (iv.startH >= MORNING_END) break;
      if (t < iv.startH - 0.001) return t;
      t = Math.max(t, iv.endH);
    }
    if (t < MORNING_END - 0.001) return t;
  }

  t = Math.max(cursor, AFTERNOON_START, t);
  if (t < WORK_END) {
    for (const iv of occupied) {
      if (iv.startH >= WORK_END) break;
      if (iv.startH < AFTERNOON_START) continue;
      if (t < iv.startH - 0.001) return t;
      t = Math.max(t, iv.endH);
    }
    if (t < WORK_END - 0.001) return t;
  }

  return null;
}
