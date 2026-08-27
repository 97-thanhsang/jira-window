import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addWorklog,
  deleteWorklog,
  fetchIssueWorklogTotal,
  fetchTodayWorklogs,
  fetchWorklogs,
  updateWorklog,
} from './worklog-api';

const get = vi.hoisted(() => vi.fn());
const post = vi.hoisted(() => vi.fn());
const put = vi.hoisted(() => vi.fn());
const del = vi.hoisted(() => vi.fn());

vi.mock('./api', () => ({ api: { get, post, put, delete: del } }));

type RawWorklog = {
  id: string;
  authorName?: string;
  timeSpent?: string;
  timeSpentSeconds: number;
  started: string;
  comment?: string;
};

function issue(key: string, worklogs: RawWorklog[], estimateSeconds?: number) {
  return {
    id: `id-${key}`,
    key,
    fields: {
      summary: `summary of ${key}`,
      issuetype: { name: 'Task', iconUrl: 'https://jira/task.png' },
      project: { key: 'ABC', name: 'ABC project' },
      worklog: {
        worklogs: worklogs.map(wl => ({
          id: wl.id,
          author: { name: wl.authorName ?? 'sang', displayName: 'Sang' },
          timeSpent: wl.timeSpent ?? '1h',
          timeSpentSeconds: wl.timeSpentSeconds,
          started: wl.started,
          comment: wl.comment,
          created: wl.started,
          updated: wl.started,
        })),
      },
      ...(estimateSeconds === undefined
        ? {}
        : { timetracking: { originalEstimateSeconds: estimateSeconds, remainingEstimateSeconds: 0 } }),
    },
  };
}

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  put.mockReset();
  del.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('fetchWorklogs', () => {
  it('builds the worklogDate/worklogAuthor JQL query', async () => {
    get.mockResolvedValue({ data: { total: 0, issues: [] } });

    await fetchWorklogs('sang', '2026-03-01', '2026-03-31');

    expect(get).toHaveBeenCalledWith('/search', {
      params: {
        jql: 'worklogDate >= "2026-03-01" AND worklogDate <= "2026-03-31" AND worklogAuthor = "sang" ORDER BY created DESC',
        maxResults: 500,
        fields: 'summary,issuetype,project,worklog,timetracking',
      },
    });
  });

  it('returns empty totals when no issues match', async () => {
    get.mockResolvedValue({ data: { total: 0, issues: [] } });

    await expect(fetchWorklogs('sang', '2026-03-01', '2026-03-31')).resolves.toEqual({
      entries: [],
      total: 0,
      totalHours: 0,
      dailyHours: {},
    });
  });

  it('flattens worklogs into entries with issue metadata', async () => {
    get.mockResolvedValue({
      data: {
        total: 1,
        issues: [
          issue(
            'ABC-1',
            [{ id: 'w1', timeSpent: '2h', timeSpentSeconds: 7200, started: '2026-03-10T09:00:00.000+0000' }],
            14400,
          ),
        ],
      },
    });

    const result = await fetchWorklogs('sang', '2026-03-01', '2026-03-31');

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({
      id: 'w1',
      issueId: 'id-ABC-1',
      issueKey: 'ABC-1',
      issueSummary: 'summary of ABC-1',
      issueTypeName: 'Task',
      issueTypeIconUrl: 'https://jira/task.png',
      projectKey: 'ABC',
      projectName: 'ABC project',
      timeSpent: '2h',
      timeSpentSeconds: 7200,
      comment: '',
      estSeconds: 14400,
    });
    expect(result.total).toBe(1);
    expect(result.totalHours).toBe(2);
  });

  it('defaults missing issue type and estimate fields', async () => {
    const raw = issue('ABC-1', [
      { id: 'w1', timeSpentSeconds: 3600, started: '2026-03-10T09:00:00.000+0000' },
    ]);
    // @ts-expect-error — exercising the runtime fallbacks for absent Jira fields
    raw.fields.issuetype = undefined;
    get.mockResolvedValue({ data: { total: 1, issues: [raw] } });

    const result = await fetchWorklogs('sang', '2026-03-01', '2026-03-31');

    expect(result.entries[0]).toMatchObject({
      issueTypeName: 'Task',
      issueTypeIconUrl: '',
      estSeconds: 0,
    });
  });

  it('treats an absent worklog field as no worklogs', async () => {
    const raw = issue('ABC-1', []);
    // @ts-expect-error — Jira omits the worklog field when it was not requested
    raw.fields.worklog = undefined;
    get.mockResolvedValue({ data: { total: 1, issues: [raw] } });

    await expect(fetchWorklogs('sang', '2026-03-01', '2026-03-31')).resolves.toMatchObject({
      entries: [],
      total: 0,
    });
  });

  it('drops worklogs authored by someone else', async () => {
    get.mockResolvedValue({
      data: {
        total: 1,
        issues: [
          issue('ABC-1', [
            { id: 'w1', timeSpentSeconds: 3600, started: '2026-03-10T09:00:00.000+0000' },
            {
              id: 'w2',
              authorName: 'other',
              timeSpentSeconds: 3600,
              started: '2026-03-10T09:00:00.000+0000',
            },
          ]),
        ],
      },
    });

    const result = await fetchWorklogs('sang', '2026-03-01', '2026-03-31');

    expect(result.entries.map(e => e.id)).toEqual(['w1']);
  });

  it('drops worklogs started outside the requested range', async () => {
    get.mockResolvedValue({
      data: {
        total: 1,
        issues: [
          issue('ABC-1', [
            { id: 'before', timeSpentSeconds: 3600, started: '2026-02-28T09:00:00.000+0000' },
            { id: 'inside', timeSpentSeconds: 3600, started: '2026-03-10T09:00:00.000+0000' },
            { id: 'after', timeSpentSeconds: 3600, started: '2026-04-01T09:00:00.000+0000' },
          ]),
        ],
      },
    });

    const result = await fetchWorklogs('sang', '2026-03-01', '2026-03-31');

    expect(result.entries.map(e => e.id)).toEqual(['inside']);
  });

  it('sums hours per started day across issues', async () => {
    get.mockResolvedValue({
      data: {
        total: 2,
        issues: [
          issue('ABC-1', [
            { id: 'w1', timeSpentSeconds: 7200, started: '2026-03-10T09:00:00.000+0000' },
            { id: 'w2', timeSpentSeconds: 1800, started: '2026-03-11T09:00:00.000+0000' },
          ]),
          issue('ABC-2', [
            { id: 'w3', timeSpentSeconds: 3600, started: '2026-03-10T13:00:00.000+0000' },
          ]),
        ],
      },
    });

    const result = await fetchWorklogs('sang', '2026-03-01', '2026-03-31');

    expect(result.dailyHours).toEqual({ '2026-03-10': 3, '2026-03-11': 0.5 });
    expect(result.totalHours).toBe(3.5);
    expect(result.total).toBe(3);
  });
});

describe('fetchTodayWorklogs', () => {
  it('queries only today and returns the entries', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-10T12:00:00.000Z'));
    get.mockResolvedValue({
      data: {
        total: 1,
        issues: [
          issue('ABC-1', [
            { id: 'w1', timeSpentSeconds: 3600, started: '2026-03-10T09:00:00.000+0000' },
          ]),
        ],
      },
    });

    const entries = await fetchTodayWorklogs('sang');

    expect(entries.map(e => e.id)).toEqual(['w1']);
    expect(get.mock.calls[0][1].params.jql).toContain(
      'worklogDate >= "2026-03-10" AND worklogDate <= "2026-03-10"',
    );
  });
});

describe('worklog mutations', () => {
  it('posts a new worklog to the issue endpoint', async () => {
    post.mockResolvedValue({ data: {} });

    await addWorklog({
      issueKey: 'ABC-1',
      timeSpentSeconds: 3600,
      comment: 'done',
      started: '2026-03-10T09:00:00.000+0000',
    });

    expect(post).toHaveBeenCalledWith('/issue/ABC-1/worklog', {
      timeSpentSeconds: 3600,
      comment: 'done',
      started: '2026-03-10T09:00:00.000+0000',
    });
  });

  it('puts an updated worklog', async () => {
    put.mockResolvedValue({ data: {} });
    const payload = {
      timeSpentSeconds: 1800,
      comment: 'edit',
      started: '2026-03-10T09:00:00.000+0000',
    };

    await updateWorklog('ABC-1', 'w1', payload);

    expect(put).toHaveBeenCalledWith('/issue/ABC-1/worklog/w1', payload);
  });

  it('deletes a worklog', async () => {
    del.mockResolvedValue({ data: {} });

    await deleteWorklog('ABC-1', 'w1');

    expect(del).toHaveBeenCalledWith('/issue/ABC-1/worklog/w1');
  });
});

describe('fetchIssueWorklogTotal', () => {
  it('sums the lifetime logged seconds of an issue', async () => {
    get.mockResolvedValue({
      data: { worklogs: [{ timeSpentSeconds: 3600 }, { timeSpentSeconds: 1800 }] },
    });

    await expect(fetchIssueWorklogTotal('ABC-1')).resolves.toBe(5400);
    expect(get).toHaveBeenCalledWith('/issue/ABC-1/worklog');
  });

  it('returns 0 when the issue has no worklogs', async () => {
    get.mockResolvedValue({ data: { worklogs: [] } });

    await expect(fetchIssueWorklogTotal('ABC-1')).resolves.toBe(0);
  });
});
