import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorklogEntry } from '@/types/jira';
import { validateWorklogRules } from './worklog-validation';

const NOW = new Date('2026-03-10T03:00:00.000Z'); // Tuesday

/** The "today" the module computes — UTC date of the mocked clock. */
const TODAY = NOW.toISOString().slice(0, 10);

/**
 * Format a Date as `YYYY-MM-DDTHH:mm:ss.SSS±HHMM` using its LOCAL components,
 * so the module's local-time parsing yields exactly the hour we asked for
 * regardless of the machine timezone.
 */
function toLocalIso(d: Date): string {
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  const offsetMinutes = -d.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}` +
    `${sign}${pad(Math.floor(abs / 60))}${pad(abs % 60)}`
  );
}

/** A worklog on `dateStr` starting at the given local hour, lasting `hours`. */
function worklog(
  issueKey: string,
  startHour: number,
  hours: number,
  dateStr: string = TODAY,
): WorklogEntry {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setHours(Math.floor(startHour), Math.round((startHour % 1) * 60), 0, 0);
  return {
    id: `${issueKey}-${startHour}`,
    issueId: '1',
    issueKey,
    issueSummary: 'summary',
    issueTypeName: 'Sub-task',
    issueTypeIconUrl: '',
    projectKey: 'ABC',
    projectName: 'ABC project',
    author: { name: 'sang', displayName: 'Sang' },
    timeSpent: `${hours}h`,
    timeSpentSeconds: Math.round(hours * 3600),
    started: toLocalIso(d),
    comment: '',
    created: toLocalIso(d),
    updated: toLocalIso(d),
  } as WorklogEntry;
}

/** Shorthand: `validateWorklogRules` with sensible defaults. */
function validate(overrides: {
  issueKey?: string;
  newHoursRequested: number;
  todayWorklogsForIssue?: WorklogEntry[];
  allTodayWorklogs?: WorklogEntry[];
  lifetimeTotalSeconds?: number;
}) {
  return validateWorklogRules({
    issueKey: overrides.issueKey ?? 'ABC-1',
    newHoursRequested: overrides.newHoursRequested,
    todayWorklogsForIssue: overrides.todayWorklogsForIssue ?? [],
    allTodayWorklogs: overrides.allTodayWorklogs ?? [],
    lifetimeTotalSeconds: overrides.lifetimeTotalSeconds ?? 0,
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('rule 1 — sub-task lifetime cap of 8h', () => {
  it('allows a log that lands exactly on the 8h lifetime cap', () => {
    const result = validate({ newHoursRequested: 2, lifetimeTotalSeconds: 6 * 3600 });

    expect(result.valid).toBe(true);
  });

  it('rejects a log that pushes the lifetime past 8h and reports the remaining budget', () => {
    const result = validate({ newHoursRequested: 3, lifetimeTotalSeconds: 6 * 3600 });

    expect(result.valid).toBe(false);
    expect(result.error).toContain('Sub-task ABC-1 lifetime');
    expect(result.error).toContain('đã log 6.0h');
    expect(result.error).toContain('còn 2.0h');
    expect(result.error).toContain('Không thể log 3h');
    expect(result.started).toBeUndefined();
  });

  it("does not double-count today's existing log for the same issue (overwrite model)", () => {
    // 8h lifetime of which 3h was logged today → re-logging 3h today is still 8h.
    const result = validate({
      newHoursRequested: 3,
      lifetimeTotalSeconds: 8 * 3600,
      todayWorklogsForIssue: [worklog('ABC-1', 9, 3)],
      allTodayWorklogs: [worklog('ABC-1', 9, 3)],
    });

    expect(result.valid).toBe(true);
  });

  it('clamps the reported remaining budget at 0 when the lifetime is already over cap', () => {
    const result = validate({ newHoursRequested: 1, lifetimeTotalSeconds: 10 * 3600 });

    expect(result.valid).toBe(false);
    expect(result.error).toContain('còn 0.0h');
  });
});

describe('rule 2 — daily total cap of 8h', () => {
  it('allows a log that fills the day exactly to 8h', () => {
    const result = validate({
      newHoursRequested: 2,
      allTodayWorklogs: [worklog('OTHER-1', 8, 4), worklog('OTHER-2', 13.5, 2)],
    });

    expect(result.valid).toBe(true);
  });

  it('rejects a log that pushes the day past 8h and reports the remaining hours', () => {
    const result = validate({
      newHoursRequested: 3,
      allTodayWorklogs: [worklog('OTHER-1', 8, 4), worklog('OTHER-2', 13.5, 2)],
    });

    expect(result.valid).toBe(false);
    expect(result.error).toContain('Hôm nay đã log 6.0h');
    expect(result.error).toContain('Còn 2.0h');
  });

  it("ignores the issue's own worklogs when totalling the day", () => {
    const own = worklog('ABC-1', 8, 4);
    const result = validate({
      newHoursRequested: 8,
      todayWorklogsForIssue: [own],
      allTodayWorklogs: [own],
      lifetimeTotalSeconds: 4 * 3600,
    });

    expect(result.valid).toBe(true);
  });
});

describe('started time for an issue already logged today', () => {
  it('reuses the earliest existing start time instead of finding a new slot', () => {
    const late = worklog('ABC-1', 14, 1);
    const early = worklog('ABC-1', 9, 1);
    const result = validate({
      newHoursRequested: 2,
      todayWorklogsForIssue: [late, early],
      allTodayWorklogs: [late, early],
      lifetimeTotalSeconds: 2 * 3600,
    });

    expect(result.valid).toBe(true);
    expect(result.started).toBe(early.started);
  });
});

describe('slot finding for a first log of the day', () => {
  it('starts at 08:00 on an empty day', () => {
    const result = validate({ newHoursRequested: 4 });

    expect(result).toEqual({ valid: true, started: `${TODAY}T08:00:00.000+0700` });
  });

  it('fills the gap before the first morning worklog', () => {
    const result = validate({
      newHoursRequested: 1,
      allTodayWorklogs: [worklog('OTHER-1', 9, 1)],
    });

    expect(result.started).toBe(`${TODAY}T08:00:00.000+0700`);
  });

  it('resumes after a worklog that starts at 08:00', () => {
    const result = validate({
      newHoursRequested: 1,
      allTodayWorklogs: [worklog('OTHER-1', 8, 2)],
    });

    expect(result.started).toBe(`${TODAY}T10:00:00.000+0700`);
  });

  it('rolls over to the 13:30 afternoon block when the morning is full', () => {
    const result = validate({
      newHoursRequested: 2,
      allTodayWorklogs: [worklog('OTHER-1', 8, 4)],
    });

    expect(result.started).toBe(`${TODAY}T13:30:00.000+0700`);
  });

  it('handles a half-hour start offset', () => {
    const result = validate({
      newHoursRequested: 1,
      allTodayWorklogs: [worklog('OTHER-1', 8, 1.5)],
    });

    expect(result.started).toBe(`${TODAY}T09:30:00.000+0700`);
  });

  it('allocates the final 30-minute slot before 17:30', () => {
    const result = validate({
      newHoursRequested: 0.5,
      allTodayWorklogs: [worklog('OTHER-1', 8, 4), worklog('OTHER-2', 13.5, 3.5)],
    });

    expect(result.started).toBe(`${TODAY}T17:00:00.000+0700`);
  });

  it('rejects when the requested hours exceed the free slot', () => {
    const result = validate({
      newHoursRequested: 3,
      allTodayWorklogs: [worklog('OTHER-1', 10, 2)],
    });

    // Only 08:00-10:00 free in the morning
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Slot trống còn 2.0h');
  });

  it('rejects when the free morning slot is shorter than requested', () => {
    const result = validate({
      newHoursRequested: 1,
      allTodayWorklogs: [worklog('OTHER-1', 8, 3.5)],
    });

    // Only 11:30-12:00 free before lunch
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Slot trống còn 0.5h');
  });

  it('reports the working day as exhausted when no slot remains', () => {
    const result = validate({
      newHoursRequested: 0,
      allTodayWorklogs: [worklog('OTHER-1', 8, 4), worklog('OTHER-2', 13.5, 4)],
    });

    expect(result.valid).toBe(false);
    expect(result.error).toBe('Hôm nay đã hết giờ làm việc (08:00-12:00, 13:30-17:30).');
  });

  it('ignores worklogs from other days when finding a slot', () => {
    const result = validate({
      newHoursRequested: 4,
      allTodayWorklogs: [worklog('OTHER-1', 8, 4, '2026-03-09')],
    });

    expect(result.started).toBe(`${TODAY}T08:00:00.000+0700`);
  });

  it("excludes the issue's own worklogs from slot calculation", () => {
    // ABC-1 already occupies 08:00-12:00 but is not in todayWorklogsForIssue,
    // so it must not block the slot search.
    const result = validate({
      newHoursRequested: 4,
      allTodayWorklogs: [worklog('ABC-1', 8, 4)],
    });

    expect(result.started).toBe(`${TODAY}T08:00:00.000+0700`);
  });
});
