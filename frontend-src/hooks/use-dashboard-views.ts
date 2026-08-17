'use client';

import { useState, useCallback, useEffect } from 'react';
import type { PresetName } from '@/components/dashboard/dashboard-layout';

// ─── Types ────────────────────────────────────────────────────────────────

export interface SavedView {
  name: string;
  preset: PresetName;
  hiddenWidgets: string[];
  savedAt: string;
}

interface UseDashboardViewsReturn {
  views: SavedView[];
  activeView: string | null;
  saveView: (name: string, preset: PresetName, hiddenWidgets: string[]) => void;
  loadView: (name: string) => SavedView | null;
  deleteView: (name: string) => void;
  renameView: (oldName: string, newName: string) => void;
}

const STORAGE_KEY = 'dashboard_views';

function loadViews(): SavedView[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveViews(views: SavedView[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
  } catch { /* noop */ }
}

// ─── Hook ─────────────────────────────────────────────────────────────────

export function useDashboardViews(): UseDashboardViewsReturn {
  const [views, setViews] = useState<SavedView[]>([]);
  const [activeView, setActiveView] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setViews(loadViews());
    setLoaded(true);
  }, []);

  const saveView = useCallback((name: string, preset: PresetName, hiddenWidgets: string[]) => {
    setViews(prev => {
      const existing = prev.findIndex(v => v.name === name);
      const entry: SavedView = { name, preset, hiddenWidgets, savedAt: new Date().toISOString() };

      let next: SavedView[];
      if (existing >= 0) {
        next = [...prev];
        next[existing] = entry;
      } else {
        next = [...prev, entry];
      }
      saveViews(next);
      return next;
    });
    setActiveView(name);
  }, []);

  const loadView = useCallback((name: string): SavedView | null => {
    const view = views.find(v => v.name === name) ?? null;
    if (view) setActiveView(name);
    return view;
  }, [views]);

  const deleteView = useCallback((name: string) => {
    setViews(prev => {
      const next = prev.filter(v => v.name !== name);
      saveViews(next);
      return next;
    });
    setActiveView(prev => prev === name ? null : prev);
  }, []);

  const renameView = useCallback((oldName: string, newName: string) => {
    setViews(prev => {
      const next = prev.map(v => v.name === oldName ? { ...v, name: newName } : v);
      saveViews(next);
      return next;
    });
    setActiveView(newName);
  }, []);

  return { views, activeView, saveView, loadView, deleteView, renameView };
}
