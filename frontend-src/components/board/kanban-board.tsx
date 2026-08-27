'use client';
import React, { useState, useEffect, useRef } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  PointerSensor,
  type DragStartEvent,
  type DragEndEvent,
  type CollisionDetection,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { AlertCircle, TrendingDown, ChevronDown, User, ExternalLink } from 'lucide-react';
import Image from 'next/image';

import type { JiraIssue } from '@/types/jira';
import { PriorityIcon } from '@/components/shared/priority-icon';
import { IssueCard } from './issue-card';
import { BoardDetailPanel } from './board-detail-panel';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useBoardEdit } from '@/contexts/board-edit';
import { PRIORITY_HEX_COLORS } from '@/lib/jira-colors';

// ─── Priority / Type / Project color maps ────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  Bug: '#EF4444', 'Bug after release': '#DC2626',
  Task: '#3B82F6', 'Sub-task': '#38BDF8',
  Story: '#22C55E', Epic: '#A855F7',
  Support: '#F59E0B', Enhancement: '#10B981',
  Improvement: '#6366F1', 'New Feature': '#EC4899',
  'Build Release': '#84CC16', WBS: '#78716C',
};

/** Deterministic color from a string (for project keys). */
function projectColor(key: string): string {
  const colors = ['#0052CC', '#DE350B', '#36B37E', '#FF8B00', '#6554C0', '#008DA6', '#E774BB', '#5243AA'];
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = ((hash << 5) - hash) + key.charCodeAt(i);
  return colors[Math.abs(hash) % colors.length];
}

/** Format seconds to hours (1 decimal). */
function formatHours(seconds: number): string {
  if (!seconds) return '0h';
  const h = seconds / 3600;
  return h >= 10 ? `${Math.round(h)}h` : `${h.toFixed(1)}h`;
}

/** Stat badge for swimlane header stats row. */
function StatBadge({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="flex items-center gap-0.5 px-1.5 border-r border-[#DFE1E6] dark:border-gray-600 last:border-r-0">
      <span className="text-[#8993A4] dark:text-gray-500">{label}</span>
      <span className={cn('font-semibold text-[#172B4D] dark:text-gray-200', color)}>{value}</span>
    </div>
  );
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BoardColumn {
  id: string;
  label: string;
  issues: JiraIssue[];
  color: string;
  wipMin?: number;
  wipMax?: number;
  /** Status IDs mapped to this column (from board config). Used for transitions. */
  statusIds: string[];
  /** Sub-groups when KanbanBoard is in flat mode and subGroupBy is active. */
  subGroups?: SubGroup[];
}

/** Column definition metadata (without issues array). */
export interface BoardColumnDef {
  id: string;
  label: string;
  color: string;
  wipMin?: number;
  wipMax?: number;
  statusIds: string[];
}

/** Stats for a swimlane (shown in header when groupBy='assignee'). */
export interface SwimlaneStats {
  taskCount: number;
  totalEstSeconds: number;
  totalLoggedSeconds: number;
  todoCount: number;
  inProgressCount: number;
  doneCount: number;
}

export type MoveCardFn = (
  issueId: string,
  issueKey: string,
  targetColumnName: string,
  targetLabel: string,
  targetStatusIds?: string[],
) => void;

/** Separator for composite droppable IDs in swimlane mode. */
const SWIMLANE_SEP = '|||';
function makeSwimlaneColId(laneKey: string, colId: string): string {
  return `${laneKey}${SWIMLANE_SEP}${colId}`;
}
function parseSwimlaneColId(compositeId: string): {
  laneKey: string;
  colId: string;
} | null {
  const idx = compositeId.indexOf(SWIMLANE_SEP);
  if (idx === -1) return null;
  return {
    laneKey: compositeId.substring(0, idx),
    colId: compositeId.substring(idx + SWIMLANE_SEP.length),
  };
}

// ─── Custom collision detection: pointer-first for kanban ─────────────────────
// pointerWithin detects the droppable under the cursor — most intuitive for
// horizontal movement between columns. Fall back to closestCenter when the
// pointer is outside all droppable zones (e.g. between columns).
const kanbanCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) return pointerCollisions;

  const rectCollisions = rectIntersection(args);
  if (rectCollisions.length > 0) return rectCollisions;

  return closestCenter(args);
};

interface KanbanBoardProps {
  columns: BoardColumn[];
  isLoading: boolean;
  moveCard?: MoveCardFn;
  /** When provided, called instead of moveCard on drop (for confirmation popup). */
  onMoveRequest?: (issueId: string, issueKey: string, targetColumnName: string, targetLabel: string) => void;
  onCardClick?: (key: string) => void;
  /** Called after any inline edit (assignee, priority, labels) — parent revalidates */
  onIssueUpdate?: () => void;
  /** Swimlane data: each lane has a key, columns map, and optional stats. */
  swimlanes?: {
    key: string;
    columns: Record<string, ColumnData>;
    stats?: SwimlaneStats;
  }[];
  /** Column definitions (metadata only) — required when swimlanes are used. */
  columnDefs?: BoardColumnDef[];
  /** Group-by field (for styled swimlane headers: icons, colors, avatars). */
  groupBy?: string;
  /** Sub-group-by field (for styled sub-group headers). */
  subGroupBy?: string;
  /** Sub-sub-group-by field (for styled sub-sub-group headers). */
  subSubGroupBy?: string;
}

/** Sub-group data within a column. */
export interface SubGroup {
  label: string;
  issues: JiraIssue[];
  subSubGroups?: SubSubGroup[];
}

/** Sub-sub-group data nested within a sub-group. */
export interface SubSubGroup {
  label: string;
  issues: JiraIssue[];
}

/** Column data — flat issues or sub-grouped. */
export type ColumnData = JiraIssue[] | { subGroups: SubGroup[] };

// ─── Skeleton ────────────────────────────────────────────────────────────────

function ColumnSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-24 w-full rounded-sm" />
      ))}
    </div>
  );
}

// ─── Sortable card wrapper ───────────────────────────────────────────────────

function SortableCard({
  issue,
  onCardClick,
  onIssueUpdate,
}: {
  issue: JiraIssue;
  onCardClick?: (key: string) => void;
  onIssueUpdate?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: issue.id, data: { key: issue.key } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(isDragging && 'opacity-40')}
    >
      <IssueCard
        issue={issue}
        onCardClick={onCardClick}
        onIssueUpdate={onIssueUpdate}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

// ─── Droppable column ────────────────────────────────────────────────────────

interface DroppableColumnProps {
  colId: string;
  label: string;
  color: string;
  wipMin?: number;
  wipMax?: number;
  issues: JiraIssue[];
  isLoading: boolean;
  onCardClick?: (key: string) => void;
  onIssueUpdate?: () => void;
  subGroups?: SubGroup[];
  subGroupBy?: string;
  subSubGroupBy?: string;
  collapsedSubGroups?: Set<string>;
  onToggleSubGroup?: (key: string) => void;
}

function DroppableColumn({
  colId,
  label,
  color,
  wipMin,
  wipMax,
  issues,
  isLoading,
  onCardClick,
  onIssueUpdate,
  subGroups,
  subGroupBy,
  subSubGroupBy,
  collapsedSubGroups,
  onToggleSubGroup,
}: DroppableColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: colId });
  const issueIds = issues.map((i) => i.id);

  const count = issues.length;
  const overMax = wipMax != null && count > wipMax;
  const underMin = wipMin != null && count < wipMin;

  return (
    <div className="flex flex-col min-h-0">
      {/* Column header */}
      <div
        className="flex items-center gap-2 mb-3 px-3 py-2 rounded-sm flex-shrink-0"
        style={{ backgroundColor: `${color}15`, borderLeft: `3px solid ${color}` }}
      >
        <h3
          className="text-sm font-bold uppercase tracking-wide"
          style={{ color }}
        >
          {label}
        </h3>
        <span
          className={cn(
            'ml-auto text-xs px-2 py-0.5 rounded-full font-semibold',
            overMax
              ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
              : underMin
                ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                : 'bg-white dark:bg-gray-800 text-[#5E6C84] dark:text-gray-400 border border-[#DFE1E6] dark:border-gray-600',
          )}
        >
          {overMax && <AlertCircle size={10} className="mr-0.5" />}
          {underMin && <TrendingDown size={10} className="mr-0.5" />}
          {count}
          {wipMax != null ? `/${wipMax}` : ''}
        </span>
      </div>

      {/* Cards area — droppable zone */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 space-y-2 overflow-y-auto pr-1 rounded transition-colors min-h-[80px] col-scroll',
          isOver &&
            'bg-[#DEEBFF] dark:bg-blue-900/20 outline outline-2 outline-dashed outline-[#0052CC] dark:outline-blue-500',
        )}
      >
        {isLoading ? (
          <ColumnSkeleton />
        ) : subGroups ? (
          // Sub-grouped: render each sub-group with a header
          subGroups.length === 0 ? (
            <div className="text-center py-8 text-xs text-[#5E6C84] dark:text-gray-500">
              No issues
            </div>
          ) : (
            subGroups.map((sg) => {
              const sgKey = sg.label;
              const isSgCollapsed = collapsedSubGroups?.has(sgKey) ?? false;
              const sgFirstIssue = sg.issues[0];
              let sgAccentColor: string | undefined;
              if (sgFirstIssue && subGroupBy) {
                switch (subGroupBy) {
                  case 'project':
                    sgAccentColor = projectColor(sgFirstIssue.fields.project.key);
                    break;
                  case 'priority':
                    sgAccentColor = sgFirstIssue.fields.priority
                      ? (PRIORITY_HEX_COLORS[sgFirstIssue.fields.priority.name] ?? '#DFE1E6')
                      : '#DFE1E6';
                    break;
                  case 'type':
                    sgAccentColor = TYPE_COLORS[sgFirstIssue.fields.issuetype.name] ?? '#6B7280';
                    break;
                  case 'assignee':
                    sgAccentColor = '#0052CC';
                    break;
                  case 'reporter':
                    sgAccentColor = '#6554C0';
                    break;
                }
              }
              return (
              <div key={sg.label} className="border border-[#DFE1E6] dark:border-gray-700 rounded-sm mb-2 overflow-hidden bg-[#FAFBFC] dark:bg-gray-800/50">
                <button
                  onClick={() => onToggleSubGroup?.(sgKey)}
                  className="w-full flex items-center gap-1.5 py-1.5 px-2 hover:bg-[#F4F5F7] dark:hover:bg-gray-700/50 transition-colors text-left"
                  style={sgAccentColor ? { borderLeft: `3px solid ${sgAccentColor}` } : undefined}
                >
                  <ChevronDown
                    size={10}
                    className={cn(
                      'text-[#5E6C84] dark:text-gray-400 flex-shrink-0 transition-transform',
                      isSgCollapsed && '-rotate-90',
                    )}
                  />

                  {/* Icon / avatar based on subGroupBy */}
                  {sgFirstIssue && subGroupBy === 'priority' && (
                    <PriorityIcon priority={sgFirstIssue.fields.priority} />
                  )}
                  {sgFirstIssue && subGroupBy === 'type' && (
                    sgFirstIssue.fields.issuetype.iconUrl
                      ? <Image src={sgFirstIssue.fields.issuetype.iconUrl} alt={sgFirstIssue.fields.issuetype.name} width={14} height={14} className="flex-shrink-0" unoptimized />
                      : <span className="text-[10px] font-bold text-[#5E6C84] w-3.5 h-3.5 flex items-center justify-center">{sgFirstIssue.fields.issuetype.name.charAt(0)}</span>
                  )}
                  {sgFirstIssue && subGroupBy === 'assignee' && (
                    sgFirstIssue.fields.assignee?.avatarUrls?.['24x24']
                      ? <Image src={sgFirstIssue.fields.assignee.avatarUrls['24x24']} alt={sgFirstIssue.fields.assignee.displayName} width={20} height={20} className="rounded-full flex-shrink-0" unoptimized />
                      : <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#0052CC] text-white text-[8px] font-bold flex-shrink-0">
                          {sgFirstIssue.fields.assignee?.displayName?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) ?? '?'}
                        </span>
                  )}
                  {sgFirstIssue && subGroupBy === 'project' && (
                    <span
                      className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-sm text-[7px] font-bold text-white flex-shrink-0"
                      style={{ backgroundColor: sgAccentColor }}
                    >
                      {sgFirstIssue.fields.project.key.charAt(0)}
                    </span>
                  )}
                  {sgFirstIssue && subGroupBy === 'reporter' && (
                    sgFirstIssue.fields.reporter?.avatarUrls?.['24x24']
                      ? <Image src={sgFirstIssue.fields.reporter.avatarUrls['24x24']} alt={sgFirstIssue.fields.reporter.displayName} width={20} height={20} className="rounded-full flex-shrink-0" unoptimized />
                      : <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#6554C0] text-white text-[8px] font-bold flex-shrink-0">
                          {sgFirstIssue.fields.reporter?.displayName?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) ?? '?'}
                        </span>
                  )}

                  <span className="text-[11px] font-semibold text-[#172B4D] dark:text-gray-200 uppercase tracking-wide flex-1">
                    {sg.label}
                  </span>
                  <span className="text-[10px] font-medium text-[#0052CC] dark:text-blue-400 bg-[#E6F0FF] dark:bg-blue-900/30 px-1.5 py-0.5 rounded-full">
                    {sg.issues.length}
                  </span>
                </button>
                {!isSgCollapsed && (
                  sg.subSubGroups && sg.subSubGroups.length > 0 ? (
                    // Sub-sub groups nested within this sub-group
                    sg.subSubGroups.map((ssg) => {
                      const ssgKey = ssg.label;
                      const isSsgCollapsed = collapsedSubGroups?.has(ssgKey) ?? false;
                      const ssgFirstIssue = ssg.issues[0];
                      let ssgAccentColor: string | undefined;
                      if (ssgFirstIssue && subSubGroupBy) {
                        switch (subSubGroupBy) {
                          case 'priority':
                            ssgAccentColor = ssgFirstIssue.fields.priority
                              ? (PRIORITY_HEX_COLORS[ssgFirstIssue.fields.priority.name] ?? '#DFE1E6')
                              : '#DFE1E6';
                            break;
                          case 'type':
                            ssgAccentColor = TYPE_COLORS[ssgFirstIssue.fields.issuetype.name] ?? '#6B7280';
                            break;
                        }
                      }
                      return (
                        <div key={ssg.label} className="border border-[#DFE1E6] dark:border-gray-600 rounded-sm mb-1 ml-3 overflow-hidden bg-[#F4F5F7] dark:bg-gray-800/30">
                          <button
                            onClick={() => onToggleSubGroup?.(ssgKey)}
                            className="w-full flex items-center gap-1.5 py-1.5 px-2 hover:bg-[#EBECF0] dark:hover:bg-gray-700/50 transition-colors text-left"
                            style={ssgAccentColor ? { borderLeft: `3px solid ${ssgAccentColor}` } : undefined}
                          >
                            <ChevronDown size={8}
                              className={cn('text-[#5E6C84] flex-shrink-0 transition-transform', isSsgCollapsed && '-rotate-90')}
                            />
                            {ssgFirstIssue && subSubGroupBy === 'priority' && (
                              <PriorityIcon priority={ssgFirstIssue.fields.priority} />
                            )}
                            {ssgFirstIssue && subSubGroupBy === 'type' && (
                              ssgFirstIssue.fields.issuetype.iconUrl
                                ? <Image src={ssgFirstIssue.fields.issuetype.iconUrl} alt={ssgFirstIssue.fields.issuetype.name} width={12} height={12} className="flex-shrink-0" unoptimized />
                                : <span className="text-[9px] font-bold text-[#5E6C84] w-3 h-3 flex items-center justify-center">{ssgFirstIssue.fields.issuetype.name.charAt(0)}</span>
                            )}
                            <span className="text-[11px] font-semibold text-[#172B4D] dark:text-gray-200">{ssg.label}</span>
                            <span className="text-[10px] font-medium text-[#0052CC] dark:text-blue-400 bg-[#E6F0FF] dark:bg-blue-900/30 px-1.5 py-0.5 rounded-full ml-auto">{ssg.issues.length}</span>
                          </button>
                          {!isSsgCollapsed && (
                            <SortableContext items={ssg.issues.map(i => i.id)} strategy={verticalListSortingStrategy}>
                              {ssg.issues.map(issue => (
                        <SortableCard key={issue.id} issue={issue} onCardClick={onCardClick} onIssueUpdate={onIssueUpdate} />
                              ))}
                            </SortableContext>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <SortableContext items={sg.issues.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                      {sg.issues.map((issue) => (
                                <SortableCard key={issue.id} issue={issue} onCardClick={onCardClick} onIssueUpdate={onIssueUpdate} />
                      ))}
                    </SortableContext>
                  )
                )}
              </div>
            );
          })
          )
        ) : issues.length === 0 ? (
          <div className="text-center py-8 text-xs text-[#5E6C84] dark:text-gray-500">
            No issues
          </div>
        ) : (
          <SortableContext
            items={issueIds}
            strategy={verticalListSortingStrategy}
          >
            {issues.map((issue) => (
              <SortableCard
                key={issue.id}
                issue={issue}
                onCardClick={onCardClick}
                onIssueUpdate={onIssueUpdate}
              />
            ))}
          </SortableContext>
        )}
      </div>
    </div>
  );
}

// ─── Helpers for drag resolution ─────────────────────────────────────────────

/** Walk all columns to find an issue — used in flat (no-swimlane) mode. */
function findIssueAndCol(
  columns: BoardColumn[],
  issueId: string,
): { issue: JiraIssue; col: BoardColumn } | null {
  for (const col of columns) {
    const issue = col.issues.find((i) => i.id === issueId);
    if (issue) return { issue, col };
  }
  return null;
}

/** Walk all swimlanes to find an issue and its column label. */
function findIssueInSwimlanes(
  swimlanes: NonNullable<KanbanBoardProps['swimlanes']>,
  issueId: string,
): {
  issue: JiraIssue;
  colLabel: string;
  colId: string;
  colDef: BoardColumnDef;
} | null {
  for (const lane of swimlanes) {
    for (const [colLabel, colData] of Object.entries(lane.columns)) {
      const flatIssues = colData && 'subGroups' in colData
        ? colData.subGroups.flatMap(sg => sg.issues)
        : (colData as JiraIssue[]) || [];
      const issue = flatIssues.find((i) => i.id === issueId);
      if (issue) {
        return {
          issue,
          colLabel,
          colId: makeSwimlaneColId(lane.key, colLabel.toLowerCase().replace(/\s+/g, '-')),
          colDef: null as unknown as BoardColumnDef,
        };
      }
    }
  }
  return null;
}

// ─── Main board ──────────────────────────────────────────────────────────────

export const KanbanBoard = React.memo(function KanbanBoard({
  columns,
  isLoading,
  moveCard,
  onMoveRequest,
  onCardClick,
  onIssueUpdate,
  swimlanes,
  columnDefs,
  groupBy,
  subGroupBy,
  subSubGroupBy,
}: KanbanBoardProps) {
  const [activeIssue, setActiveIssue] = useState<JiraIssue | null>(null);
  const [collapsedLanes, setCollapsedLanes] = useState<Set<string>>(new Set());
  const [collapsedSubGroups, setCollapsedSubGroups] = useState<Set<string>>(new Set());
  const hasSwimlanes = !!swimlanes && swimlanes.length > 0;
  const boardEditCtx = useBoardEdit();

  // Drag sensors: require 5px movement before activating drag (avoids accidental drags on click)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  );

  // Track last known lane keys to avoid resetting collapse on same data
  const prevLaneKeysRef = useRef<string[]>([]);

  // Collapse all lanes and sub-groups by default when swimlane keys actually change
  useEffect(() => {
    if (!swimlanes) return;
    const currentKeys = swimlanes.map(l => l.key).sort();
    const prevKeys = prevLaneKeysRef.current;
    const keysChanged = currentKeys.length !== prevKeys.length || !currentKeys.every((k, i) => k === prevKeys[i]);
    if (!keysChanged) return; // same lanes — keep user's collapse state
    prevLaneKeysRef.current = currentKeys;
    setCollapsedLanes(new Set(swimlanes.map(l => l.key)));
    const sgKeys = new Set<string>();
    for (const lane of swimlanes) {
      for (const [colLabel, colData] of Object.entries(lane.columns)) {
        if (colData && 'subGroups' in colData) {
          for (const sg of colData.subGroups) {
            sgKeys.add(sg.label);
            if (sg.subSubGroups) {
              for (const ssg of sg.subSubGroups) sgKeys.add(ssg.label);
            }
          }
        }
      }
    }
    setCollapsedSubGroups(sgKeys);
  }, [swimlanes]);

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id);

    if (hasSwimlanes) {
      for (const lane of swimlanes!) {
        for (const colData of Object.values(lane.columns)) {
          const flatIssues: JiraIssue[] = colData && 'subGroups' in colData
            ? colData.subGroups.flatMap(sg => sg.issues)
            : (colData as JiraIssue[]) || [];
          const found = flatIssues.find((i) => i.id === id);
          if (found) {
            setActiveIssue(found);
            return;
          }
        }
      }
    } else {
      for (const col of columns) {
        const found = col.issues.find((i) => i.id === id);
        if (found) {
          setActiveIssue(found);
          return;
        }
      }
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveIssue(null);
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    if (hasSwimlanes) {
      // Swimlane mode: over.id is composite "laneKey|||colId"
      let parsed = parseSwimlaneColId(overId);

      // Fallback: over.id may be a card ID (dropped onto another card)
      // Search all lanes/columns to find which one contains this card
      if (!parsed) {
        for (const lane of swimlanes!) {
          for (const [colLabel, colData] of Object.entries(lane.columns)) {
            const flatIssues: JiraIssue[] = colData && 'subGroups' in colData
              ? colData.subGroups.flatMap(sg => sg.issues)
              : (colData as JiraIssue[]) || [];
            if (flatIssues.some((i) => i.id === overId)) {
              const colId = colLabel.toLowerCase().replace(/\s+/g, '-');
              parsed = { laneKey: lane.key, colId };
              break;
            }
          }
          if (parsed) break;
        }
      }
      if (!parsed) return;
      const targetColDef = columnDefs?.find((d) => d.id === parsed.colId);
      if (!targetColDef) return;

      // Find source issue + column
      let sourceIssue: JiraIssue | undefined;
      let sourceColLabel: string | undefined;
      for (const lane of swimlanes!) {
        for (const [colLabel, colData] of Object.entries(lane.columns)) {
          const flatIssues: JiraIssue[] = colData && 'subGroups' in colData
            ? colData.subGroups.flatMap(sg => sg.issues)
            : (colData as JiraIssue[]) || [];
          const issue = flatIssues.find((i) => i.id === activeId);
          if (issue) {
            sourceIssue = issue;
            sourceColLabel = colLabel;
            break;
          }
        }
        if (sourceIssue) break;
      }
      if (!sourceIssue) return;

      // If same column (same lane + same column), skip
      // sourceColLabel === targetColDef.label compares logical column name
      if (sourceColLabel === targetColDef.label) return;

      if (onMoveRequest) {
        onMoveRequest(activeId, sourceIssue.key, targetColDef.label, targetColDef.label);
      } else {
        moveCard?.(
          activeId,
          sourceIssue.key,
          targetColDef.label,
          targetColDef.label,
          targetColDef.statusIds.length > 0
            ? targetColDef.statusIds
            : undefined,
        );
      }
      return;
    }

    // ── Flat mode (no swimlanes) — original logic ──────────────────────

    // Resolve target column: over might be a column id OR a card id
    let targetCol = columns.find((c) => c.id === overId);
    if (!targetCol) {
      for (const col of columns) {
        if (col.issues.some((i) => i.id === overId)) {
          targetCol = col;
          break;
        }
      }
    }
    if (!targetCol) return;

    // Find source issue + column
    let sourceIssue: JiraIssue | undefined;
    let sourceColId: string | undefined;
    for (const col of columns) {
      const issue = col.issues.find((i) => i.id === activeId);
      if (issue) {
        sourceIssue = issue;
        sourceColId = col.id;
        break;
      }
    }
    if (!sourceIssue || sourceColId === targetCol.id) return;

    if (onMoveRequest) {
      onMoveRequest(activeId, sourceIssue.key, targetCol.label, targetCol.label);
    } else {
      moveCard?.(
        activeId,
        sourceIssue.key,
        targetCol.label,
        targetCol.label,
        targetCol.statusIds.length > 0 ? targetCol.statusIds : undefined,
      );
    }
  }

  function handleDragCancel() {
    setActiveIssue(null);
  }

  // ─── Swimlane render ──────────────────────────────────────────────────

  if (hasSwimlanes) {
    return (
      <DndContext
        collisionDetection={kanbanCollisionDetection}
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="flex flex-col gap-6 overflow-y-auto h-full pr-2">
          {swimlanes!.map((lane) => {
            const flatFrom = (cd: ColumnData): JiraIssue[] =>
              cd && 'subGroups' in cd ? cd.subGroups.flatMap(sg => sg.issues) : (cd as JiraIssue[]) || [];
            const totalIssues = Object.values(lane.columns).reduce((sum, col) => sum + flatFrom(col).length, 0);
            const isCollapsed = collapsedLanes.has(lane.key);
            const firstIssue = (() => {
              for (const col of Object.values(lane.columns)) {
                const arr = flatFrom(col);
                if (arr.length > 0) return arr[0];
              }
              return null;
            })();

            // Determine border-left accent color
            let accentColor = '#0052CC'; // default blue
            if (firstIssue && groupBy) {
              switch (groupBy) {
                case 'project':
                  accentColor = projectColor(firstIssue.fields.project.key);
                  break;
                case 'priority':
                  accentColor = firstIssue.fields.priority
                    ? (PRIORITY_HEX_COLORS[firstIssue.fields.priority.name] ?? '#DFE1E6')
                    : '#DFE1E6';
                  break;
                case 'type':
                  accentColor = TYPE_COLORS[firstIssue.fields.issuetype.name] ?? '#6B7280';
                  break;
                case 'assignee':
                  accentColor = '#0052CC'; // blue for users
                  break;
                case 'parent':
                  accentColor = '#FF8B00'; // amber/orange for parent tasks
                  break;
                case 'reporter':
                  accentColor = '#6554C0';
                  break;
              }
            }

            function toggleCollapse() {
              setCollapsedLanes(prev => {
                const next = new Set(prev);
                if (next.has(lane.key)) next.delete(lane.key);
                else next.add(lane.key);
                return next;
              });
            }

            function toggleSubGroup(key: string) {
              setCollapsedSubGroups(prev => {
                const next = new Set(prev);
                if (next.has(key)) next.delete(key);
                else next.add(key);
                return next;
              });
            }

            return (
              <div key={lane.key} className="flex-shrink-0 mb-6">
                {/* Card wrapper (team dashboard style) */}
                <div className="border border-[#DFE1E6] dark:border-gray-700 rounded-sm bg-white dark:bg-gray-900 overflow-hidden">
                  {/* Row 1: Header — avatar/icon + name + collapse + count */}
                  <button
                    onClick={toggleCollapse}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#F4F5F7] dark:hover:bg-gray-800 transition-colors text-left"
                    style={{ borderLeft: `4px solid ${accentColor}` }}
                  >
                    <ChevronDown
                      size={14}
                      className={cn(
                        'text-[#5E6C84] dark:text-gray-400 flex-shrink-0 transition-transform',
                        isCollapsed && '-rotate-90',
                      )}
                    />

                    {/* Icon / avatar based on groupBy */}
                    {firstIssue && groupBy === 'priority' && (
                      <PriorityIcon priority={firstIssue.fields.priority} />
                    )}
                    {firstIssue && groupBy === 'type' && (
                      firstIssue.fields.issuetype.iconUrl
                        ? <Image src={firstIssue.fields.issuetype.iconUrl} alt={firstIssue.fields.issuetype.name} width={16} height={16} className="flex-shrink-0" unoptimized />
                        : <span className="text-xs font-bold text-[#5E6C84] w-4 h-4 flex items-center justify-center">{firstIssue.fields.issuetype.name.charAt(0)}</span>
                    )}
                    {firstIssue && groupBy === 'assignee' && (
                      firstIssue.fields.assignee?.avatarUrls?.['24x24']
                        ? <Image src={firstIssue.fields.assignee.avatarUrls['24x24']} alt={firstIssue.fields.assignee.displayName} width={28} height={28} className="rounded-full flex-shrink-0" unoptimized />
                        : <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#0052CC] text-white text-[10px] font-bold flex-shrink-0">
                            {firstIssue.fields.assignee?.displayName?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) ?? <User size={10} />}
                          </span>
                    )}
                    {firstIssue && groupBy === 'project' && (
                      <span
                        className="inline-flex items-center justify-center w-4 h-4 rounded-sm text-[8px] font-bold text-white flex-shrink-0"
                        style={{ backgroundColor: accentColor }}
                      >
                        {firstIssue.fields.project.key.charAt(0)}
                      </span>
                    )}
                    {firstIssue && groupBy === 'parent' && (
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-sm bg-[#FFF3E0] dark:bg-orange-900/30 text-[#FF8B00] flex-shrink-0">
                        <ExternalLink size={11} />
                      </span>
                    )}
                    {firstIssue && groupBy === 'reporter' && (
                      firstIssue.fields.reporter?.avatarUrls?.['24x24']
                        ? <Image src={firstIssue.fields.reporter.avatarUrls['24x24']} alt={firstIssue.fields.reporter.displayName} width={28} height={28} className="rounded-full flex-shrink-0" unoptimized />
                        : <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#6554C0] text-white text-[10px] font-bold flex-shrink-0">
                            {firstIssue.fields.reporter?.displayName?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) ?? <User size={10} />}
                          </span>
                    )}

                    <h4 className="text-sm font-semibold text-[#172B4D] dark:text-gray-200 flex-1">
                      {lane.key}
                    </h4>
                    <span className="text-xs font-medium text-[#0052CC] dark:text-blue-400 bg-[#E6F0FF] dark:bg-blue-900/30 px-2.5 py-0.5 rounded-full">
                      {totalIssues}
                    </span>
                  </button>

                  {/* Row 2: Stats grid (team dashboard style) */}
                  {lane.stats && (
                    <div className="flex items-stretch border-t border-[#DFE1E6] dark:border-gray-700">
                      {(groupBy === 'assignee'
                        ? ([
                            { key: 'taskCount', label: 'Tasks', value: lane.stats.taskCount, color: '#5E6C84' },
                            { key: 'totalEst', label: 'Est', value: formatHours(lane.stats.totalEstSeconds), color: '#172B4D' },
                            { key: 'totalLogged', label: 'Logged', value: formatHours(lane.stats.totalLoggedSeconds), color: '#36B37E' },
                            { key: 'todo', label: 'Todo', value: lane.stats.todoCount, color: '#5E6C84' },
                            { key: 'inProgress', label: 'WIP', value: lane.stats.inProgressCount, color: '#0052CC' },
                            { key: 'done', label: 'Done', value: lane.stats.doneCount, color: '#36B37E' },
                          ] as const)
                        : ([
                            { key: 'taskCount', label: 'Tasks', value: lane.stats.taskCount, color: '#5E6C84' },
                            { key: 'todo', label: 'Todo', value: lane.stats.todoCount, color: '#5E6C84' },
                            { key: 'inProgress', label: 'WIP', value: lane.stats.inProgressCount, color: '#0052CC' },
                            { key: 'done', label: 'Done', value: lane.stats.doneCount, color: '#36B37E' },
                          ] as const)
                      ).map((col, i, arr) => (
                        <div
                          key={col.key}
                          className={cn(
                            'flex-1 flex flex-col items-center justify-center py-1.5 px-1',
                            i < arr.length - 1 && 'border-r border-[#DFE1E6] dark:border-gray-700',
                          )}
                        >
                          <span className="text-[9px] text-[#5E6C84] dark:text-gray-500 uppercase tracking-wider leading-none mb-0.5">
                            {col.label}
                          </span>
                          <span
                            className="text-xs font-semibold leading-none"
                            style={{ color: col.color }}
                          >
                            {col.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Column grid (collapsed when toggled) */}
                {!isCollapsed && (
                  <>
                  {/* Detail panel */}
                  <BoardDetailPanel
                    issues={(() => {
                      const result: JiraIssue[] = [];
                      for (const colData of Object.values(lane.columns)) {
                        if (colData && 'subGroups' in colData) {
                          for (const sg of colData.subGroups) {
                            result.push(...sg.issues);
                            if (sg.subSubGroups) {
                              for (const ssg of sg.subSubGroups) result.push(...ssg.issues);
                            }
                          }
                        } else {
                          result.push(...(colData as JiraIssue[] || []));
                        }
                      }
                      return result;
                    })()}
                    editMode={boardEditCtx?.editMode ?? false}
                    onIssueClick={onCardClick}
                  />
                  <div
                    className="grid gap-4 mt-3"
                    style={{
                      gridTemplateColumns: `repeat(${columnDefs?.length ?? 3}, minmax(0, 1fr))`,
                    }}
                  >
                    {(columnDefs ?? []).map((colDef) => {
                      const colData = lane.columns[colDef.label];
                      const flatIssues = colData && 'subGroups' in colData
                        ? colData.subGroups.flatMap(sg => sg.issues)
                        : (colData as JiraIssue[]) || [];

                      // Check for sub-groups
                      const subGroups = colData && 'subGroups' in colData ? colData.subGroups : null;

                      if (subGroups) {
                        return (
                          <div key={`${lane.key}-${colDef.id}`} className="flex flex-col gap-3">
                            <DroppableColumn
                              colId={makeSwimlaneColId(lane.key, colDef.id)}
                              label={colDef.label}
                              color={colDef.color}
                              wipMin={colDef.wipMin}
                              wipMax={colDef.wipMax}
                              issues={flatIssues}
                              isLoading={isLoading}
                              onCardClick={onCardClick}
                              onIssueUpdate={onIssueUpdate}
                              subGroups={subGroups}
                              subGroupBy={subGroupBy}
                              subSubGroupBy={subSubGroupBy}
                              collapsedSubGroups={collapsedSubGroups}
                              onToggleSubGroup={toggleSubGroup}
                            />
                          </div>
                        );
                      }

                      return (
                        <DroppableColumn
                          key={`${lane.key}-${colDef.id}`}
                          colId={makeSwimlaneColId(lane.key, colDef.id)}
                          label={colDef.label}
                          color={colDef.color}
                          wipMin={colDef.wipMin}
                          wipMax={colDef.wipMax}
                          issues={flatIssues}
                          isLoading={isLoading}
                          onCardClick={onCardClick}
                          onIssueUpdate={onIssueUpdate}
                        />
                      );
                    })}
                  </div>
                </>
                )}
              </div>
            );
          })}
        </div>

        {/* Drag overlay */}
        <DragOverlay>
          {activeIssue && (
            <div className="rotate-1 opacity-90 shadow-2xl">
              <IssueCard issue={activeIssue} />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    );
  }

  // ─── Flat render (no swimlanes) ───────────────────────────────────────

  // Use fixed min column width when many columns (e.g. status mode) to enable horizontal scroll
  const manyColumns = columns.length > 5;
  const gridStyle = {
    gridTemplateColumns: `repeat(${columns.length}, minmax(${manyColumns ? '600px' : '0px'}, 1fr))`,
    gridTemplateRows: '1fr',
  };

  return (
    <DndContext
      collisionDetection={kanbanCollisionDetection}
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {(manyColumns || true) && (
        <style>{`
          .board-scroll::-webkit-scrollbar { height: 6px; }
          .board-scroll::-webkit-scrollbar-track { background: transparent; }
          .board-scroll::-webkit-scrollbar-thumb { background: #c1c7d0; border-radius: 3px; }
          .board-scroll::-webkit-scrollbar-thumb:hover { background: #a5adba; }
          .col-scroll::-webkit-scrollbar { width: 4px; }
          .col-scroll::-webkit-scrollbar-track { background: transparent; }
          .col-scroll::-webkit-scrollbar-thumb { background: #c1c7d0; border-radius: 2px; }
        `}</style>
      )}
      <div className={cn('flex-1 min-h-0 flex flex-col', manyColumns && 'board-scroll overflow-x-auto pb-2')}>
        <div className="grid gap-4 flex-1 min-h-0" style={gridStyle}>
        {columns.map((col) => {
          const flatSubGroups = col.subGroups && col.subGroups.length > 0 ? col.subGroups : undefined;
          return (
          <DroppableColumn
            key={col.id}
            colId={col.id}
            label={col.label}
            color={col.color}
            wipMin={col.wipMin}
            wipMax={col.wipMax}
            issues={col.issues}
            isLoading={isLoading}
            onCardClick={onCardClick}
            onIssueUpdate={onIssueUpdate}
            subGroups={flatSubGroups}
            subGroupBy={subGroupBy}
            subSubGroupBy={subSubGroupBy}
            collapsedSubGroups={collapsedSubGroups}
            onToggleSubGroup={(key) => {
              setCollapsedSubGroups(prev => {
                const next = new Set(prev);
                if (next.has(key)) next.delete(key);
                else next.add(key);
                return next;
              });
            }}
          />
          );
        })}
      </div>
      </div>

      {/* Drag overlay — ghost card following the cursor */}
      <DragOverlay>
        {activeIssue && (
          <div className="rotate-1 opacity-90 shadow-2xl">
            <IssueCard issue={activeIssue} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
});
