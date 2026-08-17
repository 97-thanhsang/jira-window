'use client';
import { useState, useCallback, useMemo } from 'react';
import useSWR from 'swr';
import { useMyIssues } from './use-my-issues';
import { moveIssue, moveIssueToAnyStatus } from '@/lib/transitions';
import { api } from '@/lib/api';
import type { JiraIssue, JiraSearchResult } from '@/types/jira';

const BOARD_SEARCH_FIELDS =
  'summary,status,priority,issuetype,project,updated,created,assignee,reporter,labels,duedate,resolution,fixVersions,components,timetracking,sprint,customfield_10020,parent,customfield_10107';

export interface BoardToast {
  message: string;
  type: 'success' | 'error';
}

type OverrideMap = Record<string, string>; // issueId → columnName

export interface DynamicBoardColumn {
  name: string;        // Column name (e.g. "To Do", "In Progress")
  statusIds: string[]; // Status IDs mapped to this column
  wipMin?: number;
  wipMax?: number;
  color: string;
}

/**
 * Info about a column returned by the board config status-to-column mapping.
 */
export interface ColumnMapEntry {
  name: string;
  wipMin?: number;
  wipMax?: number;
  color: string;
}

/**
 * Board state hook — now supports dynamic columns from Jira board config
 * and optional custom JQL for board-specific saved filters.
 *
 * @param statusColumnMap - Record<statusId, ColumnMapEntry> from board config.
 *   When provided, issues are grouped by status.id → column name.
 *   When null, falls back to 3-column mode using statusCategory.key.
 * @param customJql - When provided, fetches issues with this JQL instead of
 *   the default "assignee = currentUser()" query from useMyIssues.
 */
export function useBoardState(
  statusColumnMap: Record<string, ColumnMapEntry> | null,
  customJql?: string,
) {
  // Default: useMyIssues (assignee = currentUser)
  const { grouped: rawGrouped, total: myIssuesTotal, isLoading: myIssuesLoading, error: myIssuesError, mutate: myIssuesMutate } = useMyIssues();

  // Board-specific JQL: fetch issues via GET /search
  const shouldFetchBoard = !!customJql;
  const {
    data: boardSearchData,
    isLoading: boardLoading,
    error: boardError,
    mutate: boardMutate,
  } = useSWR<JiraSearchResult>(
    shouldFetchBoard ? ['board-search', customJql] : null,
    ([, jql]: [string, string]) =>
      api
        .get<JiraSearchResult>('/search', {
          params: {
            jql,
            maxResults: 500,
            fields: BOARD_SEARCH_FIELDS,
          },
        })
        .then((r) => r.data),
    { revalidateOnFocus: false, dedupingInterval: 30_000 },
  );

  const [overrides, setOverrides] = useState<OverrideMap>({});
  const [toast, setToast] = useState<BoardToast | null>(null);

  // Combine all raw issues from the appropriate source
  const allIssues = useMemo<JiraIssue[]>(() => {
    if (shouldFetchBoard) {
      return boardSearchData?.issues ?? [];
    }
    return [...rawGrouped.todo, ...rawGrouped.inProgress, ...rawGrouped.done];
  }, [shouldFetchBoard, boardSearchData, rawGrouped]);

  // Total count
  const total = shouldFetchBoard
    ? (boardSearchData?.total ?? 0)
    : myIssuesTotal;

  // Loading / error state
  const isLoading = shouldFetchBoard ? boardLoading : myIssuesLoading;
  const error = shouldFetchBoard ? boardError : myIssuesError;

  // Mutate function
  const mutate = useCallback(() => {
    if (shouldFetchBoard) return boardMutate();
    return myIssuesMutate();
  }, [shouldFetchBoard, boardMutate, myIssuesMutate]);

  // Build dynamic columns list from the statusColumnMap
  const dynamicColumns: DynamicBoardColumn[] = useMemo(() => {
    if (!statusColumnMap) return [];

    // Collect unique columns from the map values
    const seen = new Map<string, DynamicBoardColumn>();
    for (const [statusId, entry] of Object.entries(statusColumnMap)) {
      let col = seen.get(entry.name);
      if (!col) {
        col = {
          name: entry.name,
          statusIds: [],
          wipMin: entry.wipMin,
          wipMax: entry.wipMax,
          color: entry.color,
        };
        seen.set(entry.name, col);
      }
      col.statusIds.push(statusId);
    }
    return Array.from(seen.values());
  }, [statusColumnMap]);

  // Build reverse lookup: statusId → column name (for grouping)
  const statusToColumn: Record<string, string> = useMemo(() => {
    const map: Record<string, string> = {};
    if (statusColumnMap) {
      for (const [sid, entry] of Object.entries(statusColumnMap)) {
        map[sid] = entry.name;
      }
    }
    return map;
  }, [statusColumnMap]);

  // Apply overrides on top of SWR data, grouped by dynamic columns or fallback 3
  const grouped = useMemo(() => {
    if (dynamicColumns.length > 0) {
      // Dynamic: group by column name from board config
      const byColumn: Record<string, JiraIssue[]> = {};
      for (const col of dynamicColumns) {
        byColumn[col.name] = [];
      }
      // Add a catch-all for issues not mapped to any column
      for (const issue of allIssues) {
        const override = overrides[issue.id];
        if (override && byColumn[override]) {
          byColumn[override].push(issue);
          continue;
        }
        const colName = statusToColumn[issue.fields.status.id];
        if (colName && byColumn[colName]) {
          byColumn[colName].push(issue);
        } else {
          // Unmapped issue — put in first column
          const firstCol = dynamicColumns[0];
          if (firstCol) byColumn[firstCol.name].push(issue);
        }
      }
      return byColumn;
    }

    // Fallback: old 3-column mode
    const result: Record<string, JiraIssue[]> = {
      'To Do': [],
      'In Progress': [],
      Done: [],
    };

    for (const issue of allIssues) {
      const override = overrides[issue.id];
      if (override && result[override]) {
        result[override].push(issue);
      } else {
        const cat = issue.fields.status.statusCategory.key;
        if (cat === 'new') result['To Do'].push(issue);
        else if (cat === 'indeterminate') result['In Progress'].push(issue);
        else if (cat === 'done') result['Done'].push(issue);
      }
    }

    return result;
  }, [allIssues, overrides, dynamicColumns, statusToColumn]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  /**
   * Optimistically move a card to a new column.
   * With dynamic board: transitions using status IDs from board config.
   * Without: falls back to keyword-based statusCategory matching.
   */
  const moveCard = useCallback(
    async (
      issueId: string,
      issueKey: string,
      targetColumnName: string,
      targetLabel: string,
      targetStatusIds?: string[],
    ) => {
      // Capture current effective column before optimistic update
      let naturalColumn: string | null = null;
      if (dynamicColumns.length > 0) {
        // Dynamic mode: find current column from status.id
        const issue = allIssues.find((i) => i.id === issueId);
        if (issue) {
          naturalColumn = statusToColumn[issue.fields.status.id] ?? null;
        }
      } else {
        // Fallback mode: find from raw grouped
        if (rawGrouped.todo.some((i) => i.id === issueId)) naturalColumn = 'To Do';
        else if (rawGrouped.inProgress.some((i) => i.id === issueId)) naturalColumn = 'In Progress';
        else if (rawGrouped.done.some((i) => i.id === issueId)) naturalColumn = 'Done';
      }

      const prevOverride = overrides[issueId];
      const effectivePrev = prevOverride ?? naturalColumn;
      if (effectivePrev === targetColumnName) return; // already there

      // Optimistic update
      setOverrides((prev) => ({ ...prev, [issueId]: targetColumnName }));

      try {
        if (targetStatusIds && targetStatusIds.length > 0) {
          await moveIssueToAnyStatus(issueKey, targetStatusIds);
        } else {
          // Fallback: map column name to old ColumnId
          const colId =
            targetColumnName === 'To Do' ? 'todo' :
            targetColumnName === 'In Progress' ? 'inProgress' :
            targetColumnName === 'Done' ? 'done' : 'todo';
          await moveIssue(issueKey, colId);
        }
        showToast(`${issueKey} moved to ${targetLabel}`, 'success');
        // Revalidate SWR, then clear override once fresh data arrives
        mutate().then(() => {
          setOverrides((prev) => {
            const next = { ...prev };
            delete next[issueId];
            return next;
          });
        });
      } catch {
        // Revert to previous position
        setOverrides((prev) => {
          const next = { ...prev };
          if (prevOverride) {
            next[issueId] = prevOverride;
          } else {
            delete next[issueId];
          }
          return next;
        });
        showToast(`Failed to move ${issueKey}`, 'error');
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allIssues, rawGrouped, overrides, mutate, dynamicColumns, statusToColumn],
  );

  return { grouped, dynamicColumns, total, isLoading, error, mutate, moveCard, toast };
}
