'use client';

import { useState } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import type { JiraStatus, JiraTransition } from '@/types/jira';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const categoryStyles: Record<string, string> = {
  new: 'bg-[#DFE1E6] text-[#42526E] border-[#C1C7D0]',
  indeterminate: 'bg-[#DEEBFF] text-[#0052CC] border-[#B3D4FF]',
  done: 'bg-[#E3FCEF] text-[#006644] border-[#ABF5D1]',
};

const categoryDotColors: Record<string, string> = {
  new: 'bg-[#42526E]',
  indeterminate: 'bg-[#0052CC]',
  done: 'bg-[#006644]',
};

interface TransitionButtonProps {
  issueKey: string;
  currentStatus: JiraStatus;
  onTransitioned: () => void;
}

export function TransitionButton({
  issueKey,
  currentStatus,
  onTransitioned,
}: TransitionButtonProps) {
  const [transitions, setTransitions] = useState<JiraTransition[]>([]);
  const [loading, setLoading] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [open, setOpen] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);

  const catKey = currentStatus.statusCategory.key;
  const statusStyle = categoryStyles[catKey] ?? categoryStyles['new'];

  async function loadTransitions() {
    if (transitions.length > 0) return;
    setLoading(true);
    try {
      const res = await api.get<{ transitions: JiraTransition[] }>(
        `/issue/${issueKey}/transitions`
      );
      setTransitions(res.data.transitions);
    } finally {
      setLoading(false);
    }
  }

  async function doTransition(transition: JiraTransition) {
    setTransitioning(true);
    setTransitionError(null);
    setOpen(false);
    try {
      await api.post(`/issue/${issueKey}/transitions`, {
        transition: { id: transition.id },
      });
      // Reset cached transitions so they reload after status change
      setTransitions([]);
      onTransitioned();
    } catch {
      setTransitionError('Failed to transition. Please try again.');
    } finally {
      setTransitioning(false);
    }
  }

  return (
    <>
      <DropdownMenu
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (v) loadTransitions();
        }}
      >
        <DropdownMenuTrigger
          disabled={transitioning}
          className={cn(
            'inline-flex w-full items-center justify-between rounded-md border px-2 text-xs h-8 transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
            statusStyle
          )}
        >
          {transitioning ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <div className="flex items-center gap-1.5 truncate">
              <span
                className={cn(
                  'w-2 h-2 rounded-full flex-shrink-0',
                  categoryDotColors[catKey] ?? categoryDotColors['new']
                )}
              />
              <span className="truncate font-medium">
                {currentStatus.name}
              </span>
            </div>
          )}
          <ChevronDown size={12} className="ml-1 flex-shrink-0 opacity-70" />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-52">
          {loading ? (
            <DropdownMenuItem disabled>
              <Loader2 size={12} className="animate-spin mr-1" />
              Loading transitions…
            </DropdownMenuItem>
          ) : transitions.length === 0 ? (
            <DropdownMenuItem disabled>
              No transitions available
            </DropdownMenuItem>
          ) : (
            transitions.map((t) => {
              const tCatKey = t.to.statusCategory.key;
              const tStyle = categoryStyles[tCatKey] ?? categoryStyles['new'];
              const tDot =
                categoryDotColors[tCatKey] ?? categoryDotColors['new'];
              return (
                <DropdownMenuItem
                  key={t.id}
                  onClick={() => doTransition(t)}
                  className="text-sm gap-2"
                >
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium border',
                      tStyle
                    )}
                  >
                    <span className={cn('w-1.5 h-1.5 rounded-full', tDot)} />
                    {t.to.name}
                  </span>
                  <span className="text-[#5E6C84]">{t.name}</span>
                </DropdownMenuItem>
              );
            })
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {transitionError && (
        <p className="text-xs text-red-600 mt-1">{transitionError}</p>
      )}
    </>
  );
}
