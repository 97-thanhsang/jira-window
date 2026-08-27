import { describe, expect, it } from 'vitest';
import {
  buildExistingSchedule,
  distributeEstimates,
  type WorkEstLogEntry,
  type WorkEstSubTask,
} from './work-est-api';

// 2026-03-09 is a Monday; 2026-03-14/15 is the weekend.
const MON = '2026-03-09';
const TUE = '2026-03-10';
const WED = '2026-03-11';
const THU = '2026-03-12';
const FRI = '2026-03-13';
const SAT = '2026-03-14';
const SUN = '2026-03-15';

type TaskExtras = {
  logEntries?: Record<string, WorkEstLogEntry[]>;
  worklogDays?: Record<string, number>;
};

function task(
  key: string,
  overrides: Partial<WorkEstSubTask> & TaskExtras = {},
): WorkEstSubTask {
  return {
    key,
    issueId: key,
    summary: `summary of ${key}`,
    issueTypeName: 'Sub-task',
    issueTypeIconUrl: '',
    projectKey: 'ABC',
    projectName: 'ABC project',
    status: 'Open',
    priority: 'Medium',
    assignee: 'sang',
    assigneeDisplayName: 'Sang',
    assigneeAvatarUrl: null,
    reporter: 'sang',
    reporterDisplayName: 'Sang',
    reporterAvatarUrl: null,
    originalEstimateSeconds: 0,
    originalEstimateDisplay: '-',
    loggedSeconds: 0,
    loggedDisplay: '-',
    duedate: null,
    created: null,
    updated: null,
    parentKey: null,
    parentSummary: null,
    parentIssueTypeName: null,
    parentIssueTypeIconUrl: null,
    parentStatus: null,
    manualEstimateHours: null,
    ...overrides,
  } as WorkEstSubTask;
}

function logEntry(issueKey: string, hours: number): WorkEstLogEntry {
  return {
    issueKey,
    summary: `summary of ${issueKey}`,
    projectKey: 'ABC',
    seconds: Math.round(hours * 3600),
    hours,
    issueTypeName: 'Sub-task',
    issueTypeIconUrl: '',
    status: 'Open',
    priority: 'Medium',
    assigneeDisplayName: 'Sang',
  };
}

/** issueKey → allocated seconds, flattened across the whole schedule. */
function allocationsByDay(result: ReturnType<typeof distributeEstimates>) {
  return Object.fromEntries(
    result.schedule.map(d => [d.date, d.allocations.map(a => `${a.issueKey}:${a.hours}`)]),
  );
}

describe('distributeEstimates — working days', () => {
  it('excludes weekends from the working day list', () => {
    const result = distributeEstimates([task('ABC-1')], MON, SUN);

    expect(result.workingDays).toEqual([MON, TUE, WED, THU, FRI]);
    expect(result.totalAvailableSeconds).toBe(5 * 8 * 3600);
  });

  it('returns an empty schedule for a weekend-only range', () => {
    const result = distributeEstimates([task('ABC-1')], SAT, SUN);

    expect(result).toEqual({
      schedule: [],
      workingDays: [],
      totalAvailableSeconds: 0,
      totalAllocatedSeconds: 0,
      totalExistingSeconds: 0,
      errors: [],
    });
  });

  it('returns an empty schedule when the range is inverted', () => {
    expect(distributeEstimates([task('ABC-1')], FRI, MON).workingDays).toEqual([]);
  });
});

describe('distributeEstimates — allocation', () => {
  it('gives a single task the full 8h day', () => {
    const result = distributeEstimates([task('ABC-1')], MON, MON);

    expect(allocationsByDay(result)).toEqual({ [MON]: ['ABC-1:8'] });
    expect(result.totalAllocatedSeconds).toBe(8 * 3600);
    expect(result.errors).toBeUndefined();
  });

  it('splits a day evenly between two tasks', () => {
    const result = distributeEstimates([task('ABC-1'), task('ABC-2')], MON, MON);

    expect(allocationsByDay(result)).toEqual({ [MON]: ['ABC-1:4', 'ABC-2:4'] });
  });

  it('rounds down to 0.5h slots and gives the remainder to the last task of the day', () => {
    const result = distributeEstimates(
      [task('ABC-1'), task('ABC-2'), task('ABC-3')],
      MON,
      MON,
    );

    // 8h / 3 → 2.5h base, last task absorbs the remaining 3h
    expect(allocationsByDay(result)).toEqual({ [MON]: ['ABC-1:2.5', 'ABC-2:2.5', 'ABC-3:3'] });
    expect(result.totalAllocatedSeconds).toBe(8 * 3600);
  });

  it('spreads tasks across days, one per day when there is room', () => {
    const result = distributeEstimates([task('ABC-1'), task('ABC-2')], MON, TUE);

    expect(allocationsByDay(result)).toEqual({ [MON]: ['ABC-1:8'], [TUE]: ['ABC-2:8'] });
  });

  it('skips tasks that already logged 8h or more', () => {
    const result = distributeEstimates(
      [task('ABC-1', { loggedSeconds: 8 * 3600 }), task('ABC-2')],
      MON,
      MON,
    );

    expect(allocationsByDay(result)).toEqual({ [MON]: ['ABC-2:8'] });
  });

  it('reports an error when every task already logged 8h', () => {
    const result = distributeEstimates([task('ABC-1', { loggedSeconds: 9 * 3600 })], MON, MON);

    expect(result.errors).toContain(
      'Tất cả sub-task đã chọn đều đã log >= 8h. Không có task nào để phân rã.',
    );
    expect(result.totalAllocatedSeconds).toBe(0);
  });

  it('reports leftover capacity when there are not enough tasks', () => {
    const result = distributeEstimates([task('ABC-1')], MON, TUE);

    expect(result.errors).toEqual(['Còn 8h trống. Cần thêm sub-task.']);
  });

  it('reports how many tasks could not be placed', () => {
    const tasks = Array.from({ length: 20 }, (_, i) => task(`ABC-${String(i).padStart(2, '0')}`));

    const result = distributeEstimates(tasks, MON, MON);

    expect(result.errors).toEqual([
      'Không đủ ngày cho 19 sub-task. 1 ngày chỉ đủ cho 1 sub-task.',
    ]);
  });

  it('copies task metadata onto each allocation', () => {
    const result = distributeEstimates(
      [task('ABC-1', { parentKey: 'ABC-100', parentSummary: 'Story', priority: 'High' })],
      MON,
      MON,
    );

    expect(result.schedule[0].allocations[0]).toMatchObject({
      issueKey: 'ABC-1',
      summary: 'summary of ABC-1',
      projectKey: 'ABC',
      seconds: 8 * 3600,
      hours: 8,
      status: 'Open',
      priority: 'High',
      assigneeDisplayName: 'Sang',
      parentKey: 'ABC-100',
      parentSummary: 'Story',
    });
  });
});

describe('distributeEstimates — ordering', () => {
  it('places higher-priority tasks on earlier days', () => {
    const result = distributeEstimates(
      [
        task('ABC-low', { priority: 'Low' }),
        task('ABC-blocker', { priority: 'Blocker' }),
        task('ABC-high', { priority: 'High' }),
      ],
      MON,
      WED,
    );

    expect(allocationsByDay(result)).toEqual({
      [MON]: ['ABC-blocker:8'],
      [TUE]: ['ABC-high:8'],
      [WED]: ['ABC-low:8'],
    });
  });

  it('keeps sub-tasks of the same parent adjacent, groups ordered by top priority', () => {
    const result = distributeEstimates(
      [
        task('ABC-a1', { parentKey: 'P-A', priority: 'Low' }),
        task('ABC-b1', { parentKey: 'P-B', priority: 'Highest' }),
        task('ABC-a2', { parentKey: 'P-A', priority: 'Low' }),
        task('ABC-b2', { parentKey: 'P-B', priority: 'Low' }),
      ],
      MON,
      TUE,
    );

    const order = result.schedule.flatMap(d => d.allocations.map(a => a.issueKey));
    expect(order).toEqual(['ABC-b1', 'ABC-b2', 'ABC-a1', 'ABC-a2']);
  });

  it('breaks priority ties within a parent group by duedate, then by key', () => {
    const result = distributeEstimates(
      [
        task('ABC-3', { parentKey: 'P-A' }),
        task('ABC-1', { parentKey: 'P-A' }),
        task('ABC-2', { parentKey: 'P-A', duedate: MON }),
      ],
      MON,
      WED,
    );

    const order = result.schedule.flatMap(d => d.allocations.map(a => a.issueKey));
    expect(order).toEqual(['ABC-2', 'ABC-1', 'ABC-3']);
  });

  it('keeps the input order for parentless tasks of equal priority', () => {
    const result = distributeEstimates(
      [task('ABC-3'), task('ABC-1'), task('ABC-2', { duedate: MON })],
      MON,
      WED,
    );

    // Each parentless task forms its own group, so the duedate tie-break never applies.
    const order = result.schedule.flatMap(d => d.allocations.map(a => a.issueKey));
    expect(order).toEqual(['ABC-3', 'ABC-1', 'ABC-2']);
  });
});

describe('distributeEstimates — existing worklogs from unchecked tasks', () => {
  it('surfaces existing log entries per day without consuming allocation capacity', () => {
    const unchecked = task('ABC-9', {
      loggedSeconds: 2 * 3600,
      logEntries: { [MON]: [logEntry('ABC-9', 2)] },
      worklogDays: { [MON]: 2 * 3600 },
    });

    const result = distributeEstimates([task('ABC-1')], MON, MON, undefined, [unchecked]);

    const day = result.schedule[0];
    expect(day.existingLogEntries).toEqual([logEntry('ABC-9', 2)]);
    expect(day.existingSeconds).toBe(2 * 3600);
    expect(day.existingHours).toBe(2);
    expect(day.existingTasks.map(t => t.key)).toEqual(['ABC-9']);
    expect(day.totalHours).toBe(8);
    expect(result.totalExistingSeconds).toBe(2 * 3600);
  });

  it('ignores unchecked tasks with no logged time and log days outside the range', () => {
    const result = distributeEstimates([task('ABC-1')], MON, MON, undefined, [
      task('ABC-8'),
      task('ABC-9', {
        loggedSeconds: 3600,
        logEntries: { [FRI]: [logEntry('ABC-9', 1)] },
        worklogDays: { [FRI]: 3600 },
      }),
    ]);

    expect(result.schedule[0].existingLogEntries).toEqual([]);
    expect(result.schedule[0].existingTasks).toEqual([]);
    expect(result.totalExistingSeconds).toBe(0);
  });
});

describe('buildExistingSchedule', () => {
  it('lists working days and zero totals when there are no tasks', () => {
    const result = buildExistingSchedule([], MON, FRI);

    expect(result.workingDays).toEqual([MON, TUE, WED, THU, FRI]);
    expect(result.totalAvailableSeconds).toBe(5 * 8 * 3600);
    expect(result.totalAllocatedSeconds).toBe(0);
    expect(result.totalExistingSeconds).toBe(0);
  });

  it('returns an empty schedule for a weekend-only range', () => {
    expect(buildExistingSchedule([task('ABC-1')], SAT, SUN)).toEqual({
      schedule: [],
      workingDays: [],
      totalAvailableSeconds: 0,
      totalAllocatedSeconds: 0,
      totalExistingSeconds: 0,
    });
  });

  it('places existing log entries on their day', () => {
    const result = buildExistingSchedule(
      [task('ABC-1', { logEntries: { [TUE]: [logEntry('ABC-1', 3)] } })],
      MON,
      WED,
    );

    expect(result.schedule[1]).toMatchObject({
      date: TUE,
      existingSeconds: 3 * 3600,
      existingHours: 3,
      existingLogEntries: [logEntry('ABC-1', 3)],
    });
    expect(result.totalExistingSeconds).toBe(3 * 3600);
  });

  it('ignores log entries outside the requested range', () => {
    const result = buildExistingSchedule(
      [task('ABC-1', { logEntries: { [FRI]: [logEntry('ABC-1', 3)] } })],
      MON,
      WED,
    );

    expect(result.totalExistingSeconds).toBe(0);
    expect(result.schedule.every(d => d.existingLogEntries.length === 0)).toBe(true);
  });

  it('plans an unlogged estimate on the task duedate', () => {
    const result = buildExistingSchedule(
      [task('ABC-1', { originalEstimateSeconds: 4 * 3600, duedate: WED })],
      MON,
      WED,
    );

    expect(result.schedule.map(d => d.allocations.map(a => `${a.issueKey}:${a.hours}`))).toEqual([
      [],
      [],
      ['ABC-1:4'],
    ]);
    expect(result.totalAllocatedSeconds).toBe(4 * 3600);
  });

  it('falls back to the first working day when the duedate is out of range', () => {
    const result = buildExistingSchedule(
      [task('ABC-1', { originalEstimateSeconds: 4 * 3600, duedate: FRI })],
      MON,
      WED,
    );

    expect(result.schedule[0].allocations.map(a => a.issueKey)).toEqual(['ABC-1']);
  });

  it('falls back to the first working day when there is no duedate', () => {
    const result = buildExistingSchedule(
      [task('ABC-1', { originalEstimateSeconds: 4 * 3600 })],
      MON,
      WED,
    );

    expect(result.schedule[0].allocations.map(a => a.hours)).toEqual([4]);
  });

  it('spreads the estimate over the logged days, remainder on the last one', () => {
    const result = buildExistingSchedule(
      [
        task('ABC-1', {
          originalEstimateSeconds: 4 * 3600,
          logEntries: {
            [MON]: [logEntry('ABC-1', 1)],
            [TUE]: [logEntry('ABC-1', 1)],
            [WED]: [logEntry('ABC-1', 1)],
          },
        }),
      ],
      MON,
      WED,
    );

    // 4h / 3 days → 1h per day (rounded down to 0.5h slots), last day takes the 1h remainder
    expect(result.schedule.map(d => d.allocations.map(a => a.hours))).toEqual([[1], [1], [2]]);
    expect(result.totalAllocatedSeconds).toBe(4 * 3600);
    expect(result.totalExistingSeconds).toBe(3 * 3600);
  });

  it('skips tasks without an estimate', () => {
    const result = buildExistingSchedule([task('ABC-1')], MON, WED);

    expect(result.totalAllocatedSeconds).toBe(0);
    expect(result.schedule.every(d => d.allocations.length === 0)).toBe(true);
  });
});
