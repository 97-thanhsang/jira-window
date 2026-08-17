import { api } from '@/lib/api';
import type { JiraTransition } from '@/types/jira';

export type ColumnId = 'todo' | 'inProgress' | 'done';

const COLUMN_STATUS_CATEGORY: Record<ColumnId, string> = {
  todo:       'new',
  inProgress: 'indeterminate',
  done:       'done',
};

const COLUMN_KEYWORDS: Record<ColumnId, string[]> = {
  todo:       ['to do', 'todo', 'open', 'backlog'],
  inProgress: ['progress', 'start', 'active', 'in review'],
  done:       ['done', 'close', 'resolve', 'complete', 'finish'],
};

interface TransitionsResponse {
  transitions: JiraTransition[];
}

/**
 * Fetches available transitions for an issue, picks the best match for
 * the target column, then POSTs the transition.
 */
export async function moveIssue(key: string, targetColumnId: ColumnId): Promise<void> {
  const targetCategory = COLUMN_STATUS_CATEGORY[targetColumnId];
  const keywords       = COLUMN_KEYWORDS[targetColumnId];

  const { data } = await api.get<TransitionsResponse>(`/issue/${key}/transitions`);
  const transitions = data.transitions;

  // 1. Prefer exact statusCategory match
  let transition = transitions.find(
    (t) => t.to.statusCategory.key === targetCategory,
  );

  // 2. Fallback: keyword match on transition name
  if (!transition) {
    transition = transitions.find((t) => {
      const name = t.name.toLowerCase();
      return keywords.some((kw) => name.includes(kw));
    });
  }

  if (!transition) {
    throw new Error(`No transition found for column "${targetColumnId}" on issue ${key}`);
  }

  await api.post(`/issue/${key}/transitions`, { transition: { id: transition.id } });
}

/**
 * Moves an issue to a specific target status (by status ID).
 * Used for dynamic board columns that map to status IDs from board config.
 */
export async function moveIssueToStatus(key: string, targetStatusId: string): Promise<void> {
  const { data } = await api.get<TransitionsResponse>(`/issue/${key}/transitions`);
  const transitions = data.transitions;

  const transition = transitions.find((t) => t.to.id === targetStatusId);
  if (!transition) {
    throw new Error(`No transition found to status "${targetStatusId}" for issue ${key}`);
  }

  await api.post(`/issue/${key}/transitions`, { transition: { id: transition.id } });
}

/**
 * Moves an issue to any of the given target status IDs (from board config columns).
 * Fetches available transitions once, then picks the first match.
 */
export async function moveIssueToAnyStatus(key: string, targetStatusIds: string[]): Promise<void> {
  const { data } = await api.get<TransitionsResponse>(`/issue/${key}/transitions`);
  const transitions = data.transitions;

  const transition = transitions.find((t) => targetStatusIds.includes(t.to.id));
  if (!transition) {
    throw new Error(
      `No transition found for ${key} to any of [${targetStatusIds.join(', ')}]`,
    );
  }

  await api.post(`/issue/${key}/transitions`, { transition: { id: transition.id } });
}
