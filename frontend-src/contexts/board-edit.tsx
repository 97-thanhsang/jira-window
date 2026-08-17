'use client';
import { createContext, useContext } from 'react';

export interface BoardEditContextType {
  editMode: boolean;
  editingCards: Set<string>;
  drafts: Record<string, Record<string, unknown>>;
  onToggleEditing: (issueKey: string) => void;
  onFieldDraft: (issueKey: string, field: string, value: unknown) => void;
  onFieldRevert: (issueKey: string, field: string) => void;
}

export const BoardEditContext = createContext<BoardEditContextType | null>(null);

export function useBoardEdit() {
  const ctx = useContext(BoardEditContext);
  if (!ctx) return null;
  return ctx;
}
