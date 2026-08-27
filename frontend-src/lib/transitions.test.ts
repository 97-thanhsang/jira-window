import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JiraTransition } from '@/types/jira';

const get = vi.hoisted(() => vi.fn());
const post = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', () => ({ api: { get, post } }));

import { moveIssue, moveIssueToAnyStatus, moveIssueToStatus } from './transitions';

const transition = (
  id: string,
  name: string,
  toId: string,
  categoryKey: string,
): JiraTransition =>
  ({
    id,
    name,
    to: { id: toId, name, statusCategory: { key: categoryKey } },
  } as JiraTransition);

function respondWith(transitions: JiraTransition[]) {
  get.mockResolvedValue({ data: { transitions } });
}

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  post.mockResolvedValue({ data: {} });
});

describe('moveIssue', () => {
  it.each([
    ['todo', 'new'],
    ['inProgress', 'indeterminate'],
    ['done', 'done'],
  ] as const)('picks the transition whose target category is %s → %s', async (column, category) => {
    respondWith([
      transition('11', 'Reopen', '1', 'new'),
      transition('21', 'Start', '3', 'indeterminate'),
      transition('31', 'Close', '6', 'done'),
    ]);

    await moveIssue('ABC-1', column);

    const expectedId = { new: '11', indeterminate: '21', done: '31' }[category];
    expect(get).toHaveBeenCalledExactlyOnceWith('/issue/ABC-1/transitions');
    expect(post).toHaveBeenCalledExactlyOnceWith('/issue/ABC-1/transitions', {
      transition: { id: expectedId },
    });
  });

  it('falls back to a keyword match on the transition name', async () => {
    respondWith([transition('41', 'Resolve Issue', '9', 'unknown-category')]);

    await moveIssue('ABC-1', 'done');

    expect(post).toHaveBeenCalledExactlyOnceWith('/issue/ABC-1/transitions', {
      transition: { id: '41' },
    });
  });

  it('matches keywords case-insensitively', async () => {
    respondWith([transition('42', 'BACKLOG', '9', 'unknown-category')]);

    await moveIssue('ABC-1', 'todo');

    expect(post).toHaveBeenCalledExactlyOnceWith('/issue/ABC-1/transitions', {
      transition: { id: '42' },
    });
  });

  it('prefers the status category over a keyword match', async () => {
    respondWith([
      transition('51', 'Close', '9', 'unknown-category'),
      transition('52', 'Anything', '6', 'done'),
    ]);

    await moveIssue('ABC-1', 'done');

    expect(post).toHaveBeenCalledExactlyOnceWith('/issue/ABC-1/transitions', {
      transition: { id: '52' },
    });
  });

  it('throws and does not POST when nothing matches', async () => {
    respondWith([transition('61', 'Escalate', '9', 'unknown-category')]);

    await expect(moveIssue('ABC-1', 'done')).rejects.toThrowError(
      'No transition found for column "done" on issue ABC-1',
    );
    expect(post).not.toHaveBeenCalled();
  });

  it('throws when the issue has no transitions at all', async () => {
    respondWith([]);

    await expect(moveIssue('ABC-1', 'todo')).rejects.toThrowError(/No transition found/);
  });
});

describe('moveIssueToStatus', () => {
  it('posts the transition that targets the requested status id', async () => {
    respondWith([transition('11', 'Reopen', '1', 'new'), transition('21', 'Start', '3', 'indeterminate')]);

    await moveIssueToStatus('ABC-2', '3');

    expect(post).toHaveBeenCalledExactlyOnceWith('/issue/ABC-2/transitions', {
      transition: { id: '21' },
    });
  });

  it('throws when no transition targets the status id', async () => {
    respondWith([transition('11', 'Reopen', '1', 'new')]);

    await expect(moveIssueToStatus('ABC-2', '999')).rejects.toThrowError(
      'No transition found to status "999" for issue ABC-2',
    );
    expect(post).not.toHaveBeenCalled();
  });
});

describe('moveIssueToAnyStatus', () => {
  it('uses the first available transition matching any candidate status', async () => {
    respondWith([
      transition('11', 'Reopen', '1', 'new'),
      transition('21', 'Start', '3', 'indeterminate'),
    ]);

    await moveIssueToAnyStatus('ABC-3', ['999', '3', '1']);

    expect(post).toHaveBeenCalledExactlyOnceWith('/issue/ABC-3/transitions', {
      transition: { id: '11' },
    });
  });

  it('throws listing the candidate statuses when none match', async () => {
    respondWith([transition('11', 'Reopen', '1', 'new')]);

    await expect(moveIssueToAnyStatus('ABC-3', ['7', '8'])).rejects.toThrowError(
      'No transition found for ABC-3 to any of [7, 8]',
    );
    expect(post).not.toHaveBeenCalled();
  });
});
