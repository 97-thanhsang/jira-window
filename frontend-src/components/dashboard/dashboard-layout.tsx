'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LazyWidget } from '@/components/dashboard/lazy-widget';

// ─── Types ────────────────────────────────────────────────────────────────

export type PresetName = 'executive' | 'detailed' | 'analytics' | 'custom';

export interface WidgetConfig {
  id: string;
  title: string;
  span?: 1 | 2 | 3;
  component: React.ReactNode;
}

interface DashboardLayoutProps {
  widgets: WidgetConfig[];
  preset?: PresetName;
  onPresetChange?: (preset: PresetName) => void;
  onOrderChange?: (order: string[]) => void;
}

// ─── Preset Definitions ───────────────────────────────────────────────────

interface PresetDef {
  order: string[];
  spans: Record<string, 1 | 2 | 3>;
}

const PRESETS: Record<PresetName, PresetDef | null> = {
  executive: {
    order: ['my-issues', 'worklog', 'quick-actions', 'project-stats', 'recent-activity', 'due-soon', 'team-overview', 'sprint-progress'],
    spans: { 'project-stats': 3 },
  },
  detailed: {
    order: ['my-issues', 'worklog', 'project-stats', 'recent-activity', 'due-soon', 'team-overview', 'sprint-progress', 'quick-actions'],
    spans: { 'my-issues': 2, 'project-stats': 3, 'recent-activity': 2, 'team-overview': 2, 'quick-actions': 3 },
  },
  analytics: {
    order: ['project-stats', 'sprint-progress', 'my-issues', 'worklog', 'recent-activity', 'due-soon', 'team-overview', 'quick-actions'],
    spans: { 'project-stats': 3, 'recent-activity': 2, 'quick-actions': 2 },
  },
  custom: null,
};

const STORAGE_ORDER_KEY = 'dashboard_layout_order';
const STORAGE_PRESET_KEY = 'dashboard_preset';
const STORAGE_HIDDEN_KEY = 'dashboard_hidden_widgets';

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function saveToStorage(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* noop */ }
}

// ─── Apply preset spans to widgets ───────────────────────────────────────

function applyPreset(widgets: WidgetConfig[], preset: PresetName): WidgetConfig[] {
  if (preset === 'custom') return widgets;
  const def = PRESETS[preset];
  if (!def) return widgets;

  // Reorder widgets per preset
  const ordered: WidgetConfig[] = [];
  const widgetMap = new Map(widgets.map(w => [w.id, w]));
  for (const id of def.order) {
    const w = widgetMap.get(id);
    if (w) ordered.push({ ...w, span: def.spans[id] ?? 1 });
  }
  // Append any remaining (extras)
  for (const w of widgets) {
    if (!ordered.find(o => o.id === w.id)) ordered.push(w);
  }
  return ordered;
}

// ─── Sortable Widget Card ─────────────────────────────────────────────────

function SortableWidget({ widget, index }: { widget: WidgetConfig; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: widget.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const span = widget.span ?? 1;

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, gridColumn: `span ${span}` }}
      className={cn(
        'bg-white dark:bg-gray-900 border border-[#DFE1E6] dark:border-gray-700 rounded-lg overflow-hidden shadow-sm',
        isDragging && 'opacity-50 ring-2 ring-[#0052CC] z-50',
      )}
    >
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#F4F5F7] dark:border-gray-800 bg-[#FAFBFC] dark:bg-gray-800/60">
        <button
          {...attributes}
          {...listeners}
          className="text-[#C1C7D0] hover:text-[#5E6C84] dark:hover:text-gray-400 cursor-grab active:cursor-grabbing p-0.5 rounded transition-colors"
          aria-label="Drag to reorder"
        >
          <GripVertical size={14} />
        </button>
        <span className="text-[11px] font-semibold text-[#5E6C84] dark:text-gray-400 uppercase tracking-wide">{widget.title}</span>
      </div>
      <div className="p-4">
        <LazyWidget index={index} aboveFold={3}>{widget.component}</LazyWidget>
      </div>
    </div>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────

export function DashboardLayout({
  widgets,
  preset: externalPreset,
  onPresetChange,
  onOrderChange,
}: DashboardLayoutProps) {
  const [mounted, setMounted] = useState(false);
  const [innerPreset, setInnerPreset] = useState<PresetName>('executive');
  const [widgetOrder, setWidgetOrder] = useState<string[]>([]);
  const [hiddenWidgets, setHiddenWidgets] = useState<string[]>([]);

  const preset = externalPreset ?? innerPreset;

  // Load saved state on mount
  useEffect(() => {
    const savedPreset = loadFromStorage<PresetName>(STORAGE_PRESET_KEY, 'executive');
    setInnerPreset(savedPreset);

    const savedHidden = loadFromStorage<string[]>(STORAGE_HIDDEN_KEY, []);
    setHiddenWidgets(savedHidden);

    // Load saved order; if no saved order, use current preset's order
    if (savedPreset === 'custom') {
      const saved = loadFromStorage<string[]>(STORAGE_ORDER_KEY, []);
      setWidgetOrder(saved.length > 0 ? saved : widgets.map(w => w.id));
    }
    setMounted(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // When switching from built-in preset to 'custom', populate widgetOrder
  useEffect(() => {
    if (preset === 'custom' && widgetOrder.length === 0) {
      const prevOrder = widgets.map(w => w.id);
      setWidgetOrder(prevOrder);
    }
  }, [preset, widgetOrder.length, widgets]);

  // Compute displayed widgets: apply preset spans + filter hidden
  const displayWidgets = useMemo(() => {
    const ordered = preset === 'custom'
      ? widgetOrder
          .map(id => widgets.find(w => w.id === id))
          .filter((w): w is WidgetConfig => w != null)
      : applyPreset(widgets, preset);

    return ordered.filter(w => !hiddenWidgets.includes(w.id));
  }, [widgets, preset, widgetOrder, hiddenWidgets]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // Switch to custom preset on manual reorder
    if (preset !== 'custom') {
      if (onPresetChange) onPresetChange('custom');
      else setInnerPreset('custom');
      saveToStorage(STORAGE_PRESET_KEY, 'custom');
    }

    setWidgetOrder(prev => {
      const ids = prev.length > 0 ? prev : widgets.map(w => w.id);
      const oldIdx = ids.indexOf(String(active.id));
      const newIdx = ids.indexOf(String(over.id));
      if (oldIdx === -1 || newIdx === -1) return prev;
      const next = [...ids];
      next.splice(oldIdx, 1);
      next.splice(newIdx, 0, String(active.id));
      saveToStorage(STORAGE_ORDER_KEY, next);
      onOrderChange?.(next);
      return next;
    });
  }, [preset, onPresetChange, onOrderChange, widgets]);

  // When external preset changes, save it
  const handlePresetSwitch = useCallback((newPreset: PresetName) => {
    if (onPresetChange) onPresetChange(newPreset);
    else setInnerPreset(newPreset);
    saveToStorage(STORAGE_PRESET_KEY, newPreset);

    if (newPreset !== 'custom') {
      // Clear manual order when switching to a built-in preset
      const def = PRESETS[newPreset];
      if (def) setWidgetOrder([...def.order]);
    }
  }, [onPresetChange]);

  if (!mounted) {
    const defaultWidgets = applyPreset(widgets, preset).filter(w => !hiddenWidgets.includes(w.id));
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 auto-rows-min">
        {defaultWidgets.map(w => (
          <div key={w.id} style={{ gridColumn: `span ${w.span ?? 1}` }}
            className="bg-white dark:bg-gray-900 border border-[#DFE1E6] dark:border-gray-700 rounded-lg overflow-hidden shadow-sm"
          >
            <div className="px-4 py-2.5 border-b bg-[#FAFBFC] dark:bg-gray-800/60">
              <span className="text-[11px] font-semibold text-[#5E6C84] dark:text-gray-400 uppercase tracking-wide">{w.title}</span>
            </div>
            <div className="p-4">{w.component}</div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <DndContext
      collisionDetection={closestCenter}
      sensors={sensors}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={displayWidgets.map(w => w.id)} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 auto-rows-min">
          {displayWidgets.map((w, idx) => (
            <SortableWidget key={w.id} widget={w} index={idx} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

// ─── Re-export storage helpers for use by page/layout-settings ────────────

export function saveHiddenWidgets(ids: string[]) {
  saveToStorage(STORAGE_HIDDEN_KEY, ids);
}

export function loadHiddenWidgets(): string[] {
  return loadFromStorage<string[]>(STORAGE_HIDDEN_KEY, []);
}

export function savePresetToStorage(preset: PresetName) {
  saveToStorage(STORAGE_PRESET_KEY, preset);
}

export function loadPresetFromStorage(): PresetName {
  return loadFromStorage<PresetName>(STORAGE_PRESET_KEY, 'executive');
}

export const PRESET_LABELS: Record<PresetName, string> = {
  executive: 'Executive',
  detailed: 'Detailed View',
  analytics: 'Analytics',
  custom: 'Custom',
};
