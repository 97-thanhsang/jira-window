'use client';

import { useEffect, useState } from 'react';

export interface WorklogEntry {
  issueKey: string;
  summary: string;
  timeSpent: string;
  date: string;
  comment: string;
}

const STORAGE_KEY = 'recent_worklogs';
const MAX_ENTRIES = 20;

export function saveWorklog(entry: WorklogEntry): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const existing: WorklogEntry[] = raw ? JSON.parse(raw) : [];
    const updated = [entry, ...existing].slice(0, MAX_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // localStorage not available
  }
}

export function getWorklogs(): WorklogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Hook to read worklogs from localStorage (SSR-safe) */
export function useWorklogs() {
  const [worklogs, setWorklogs] = useState<WorklogEntry[]>([]);

  useEffect(() => {
    setWorklogs(getWorklogs());
  }, []);

  function refresh() {
    setWorklogs(getWorklogs());
  }

  return { worklogs, refresh };
}
