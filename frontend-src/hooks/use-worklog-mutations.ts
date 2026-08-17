'use client';
import { useState, useCallback } from 'react';
import { addWorklog, updateWorklog, deleteWorklog } from '@/lib/worklog-api';
import type { WorklogEntry } from '@/types/jira';

interface WorklogToast {
  message: string;
  type: 'success' | 'error';
}

export function useWorklogMutations(onSuccess: () => void) {
  const [toast, setToast] = useState<WorklogToast | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const add = useCallback(async (payload: {
    issueKey: string; timeSpentSeconds: number; comment: string; started: string;
  }) => {
    try {
      await addWorklog(payload);
      showToast('Worklog added', 'success');
      onSuccess();
    } catch {
      showToast('Failed to add worklog', 'error');
    }
  }, [onSuccess]);

  const update = useCallback(async (entry: WorklogEntry, changes: {
    timeSpentSeconds: number; comment: string; started: string;
  }) => {
    try {
      await updateWorklog(entry.issueKey, entry.id, changes);
      showToast('Worklog updated', 'success');
      onSuccess();
    } catch {
      showToast('Failed to update worklog', 'error');
    }
  }, [onSuccess]);

  const remove = useCallback(async (entry: WorklogEntry) => {
    try {
      await deleteWorklog(entry.issueKey, entry.id);
      showToast('Worklog deleted', 'success');
      onSuccess();
    } catch {
      showToast('Failed to delete worklog', 'error');
    }
  }, [onSuccess]);

  return { add, update, remove, toast };
}
