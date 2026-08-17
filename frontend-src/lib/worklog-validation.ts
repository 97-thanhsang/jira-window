import type { WorklogEntry } from '@/types/jira';

const MORNING_START = 8;
const MORNING_END = 12;
const AFTERNOON_START = 13.5;
const AFTERNOON_END = 17.5;
const MAX_HOURS_PER_DAY = 8;
const MAX_HOURS_PER_TASK_LIFETIME = 8;

interface TimeInterval {
  startHour: number;
  endHour: number;
}

function parseTimeToHours(isoString: string): number {
  const d = new Date(isoString);
  return d.getHours() + d.getMinutes() / 60;
}

function hoursToStartISO(dateStr: string, hourDecimal: number): string {
  const hours = Math.floor(hourDecimal);
  const minutes = Math.round((hourDecimal - hours) * 60);
  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  return `${dateStr}T${hh}:${mm}:00.000+0700`;
}

export interface WorklogValidationParams {
  issueKey: string;
  newHoursRequested: number;
  todayWorklogsForIssue: WorklogEntry[];
  allTodayWorklogs: WorklogEntry[];
  lifetimeTotalSeconds: number;
}

export interface WorklogValidationResult {
  valid: boolean;
  error?: string;
  started?: string;
}

function buildIntervals(todayStr: string, worklogs: WorklogEntry[]): TimeInterval[] {
  return worklogs
    .filter(e => e.started.startsWith(todayStr))
    .map(e => ({
      startHour: parseTimeToHours(e.started),
      endHour: parseTimeToHours(e.started) + e.timeSpentSeconds / 3600,
    }))
    .sort((a, b) => a.startHour - b.startHour);
}

function findNextSlot(todayStr: string, allTodayWorklogs: WorklogEntry[]): { started: string; maxDurationSeconds: number } | null {
  const intervals = buildIntervals(todayStr, allTodayWorklogs);

  let cursor = MORNING_START;
  for (const iv of intervals) {
    if (iv.startHour >= MORNING_END) break;
    if (cursor < iv.startHour - 0.001) {
      return {
        started: hoursToStartISO(todayStr, cursor),
        maxDurationSeconds: Math.round((Math.min(iv.startHour, MORNING_END) - cursor) * 3600),
      };
    }
    cursor = Math.max(cursor, iv.endHour);
  }
  if (cursor < MORNING_END - 0.001) {
    return {
      started: hoursToStartISO(todayStr, cursor),
      maxDurationSeconds: Math.round((MORNING_END - cursor) * 3600),
    };
  }

  cursor = Math.max(AFTERNOON_START, cursor);
  for (const iv of intervals) {
    if (iv.startHour >= AFTERNOON_END) break;
    if (iv.startHour < AFTERNOON_START) continue;
    if (cursor < iv.startHour - 0.001) {
      return {
        started: hoursToStartISO(todayStr, cursor),
        maxDurationSeconds: Math.round((Math.min(iv.startHour, AFTERNOON_END) - cursor) * 3600),
      };
    }
    cursor = Math.max(cursor, iv.endHour);
  }
  if (cursor < AFTERNOON_END - 0.001) {
    return {
      started: hoursToStartISO(todayStr, cursor),
      maxDurationSeconds: Math.round((AFTERNOON_END - cursor) * 3600),
    };
  }

  return null;
}

export function validateWorklogRules(params: WorklogValidationParams): WorklogValidationResult {
  const { issueKey, newHoursRequested, todayWorklogsForIssue, allTodayWorklogs, lifetimeTotalSeconds } = params;
  const newSeconds = Math.round(newHoursRequested * 3600);
  const todayStr = new Date().toISOString().slice(0, 10);

  const existingTodaySeconds = todayWorklogsForIssue.reduce((s, e) => s + e.timeSpentSeconds, 0);

  // ── Rule 1: Sub-task lifetime ≤ 8h ─────────────────────────────────────────
  const newLifetime = lifetimeTotalSeconds - existingTodaySeconds + newSeconds;
  if (newLifetime > MAX_HOURS_PER_TASK_LIFETIME * 3600) {
    const remaining = (MAX_HOURS_PER_TASK_LIFETIME * 3600 - lifetimeTotalSeconds) / 3600;
    return {
      valid: false,
      error: `Sub-task ${issueKey} lifetime: đã log ${(lifetimeTotalSeconds / 3600).toFixed(1)}h, còn ${Math.max(0, remaining).toFixed(1)}h. Không thể log ${newHoursRequested}h.`,
    };
  }

  // ── Rule 2: Daily total ≤ 8h (exclude today's own worklogs, add new) ───────
  const otherTodaySeconds = allTodayWorklogs
    .filter(e => e.issueKey !== issueKey)
    .reduce((s, e) => s + e.timeSpentSeconds, 0);
  const newDailyTotal = otherTodaySeconds + newSeconds;
  if (newDailyTotal > MAX_HOURS_PER_DAY * 3600) {
    const remaining = MAX_HOURS_PER_DAY - otherTodaySeconds / 3600;
    return {
      valid: false,
      error: `Hôm nay đã log ${(otherTodaySeconds / 3600).toFixed(1)}h (các task khác). Còn ${remaining.toFixed(1)}h. Không thể log ${newHoursRequested}h.`,
    };
  }

  // ── Existing today worklog → keep its started time (overwrite model) ────────
  if (todayWorklogsForIssue.length > 0) {
    const earliest = todayWorklogsForIssue.reduce((a, b) =>
      new Date(a.started) < new Date(b.started) ? a : b,
    );
    return { valid: true, started: earliest.started };
  }

  // ── No existing → calculate next available slot ────────────────────────────
  // Exclude this issue's own worklogs from slot calculation (will be deleted)
  const otherWorklogs = allTodayWorklogs.filter(e => e.issueKey !== issueKey);
  const slot = findNextSlot(todayStr, otherWorklogs);
  if (!slot) {
    return { valid: false, error: 'Hôm nay đã hết giờ làm việc (08:00-12:00, 13:30-17:30).' };
  }
  if (newSeconds > slot.maxDurationSeconds) {
    return {
      valid: false,
      error: `Slot trống còn ${(slot.maxDurationSeconds / 3600).toFixed(1)}h. Không thể log ${newHoursRequested}h.`,
    };
  }

  return { valid: true, started: slot.started };
}
