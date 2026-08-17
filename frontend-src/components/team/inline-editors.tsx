'use client';
import { useState, useEffect, useRef } from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';

interface Transition {
  id: string;
  name: string;
}

// ── Status Editor (dropdown with transitions) ────────────────────────────

export function StatusEditor({
  issueKey,
  currentStatus,
  onSave,
  onCancel,
}: {
  issueKey: string;
  currentStatus: string;
  onSave: (newStatus: string, transitionId: string) => void;
  onCancel: () => void;
}) {
  const [transitions, setTransitions] = useState<Transition[]>([]);
  const [loading, setLoading] = useState(true);
  const selectedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ transitions: Transition[] }>(`/issue/${issueKey}/transitions`)
      .then((r) => {
        if (!cancelled) setTransitions(r.data.transitions ?? []);
      })
      .catch(() => {
        if (!cancelled) setTransitions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [issueKey]);

  if (loading)
    return <span className="text-[10px] text-[#5E6C84] dark:text-gray-400 italic px-1">...</span>;

  if (transitions.length === 0) {
    return (
      <span
        onClick={onCancel}
        className="text-[10px] text-[#5E6C84] dark:text-gray-400 italic px-1 cursor-pointer"
      >
        No transitions
      </span>
    );
  }

  return (
    <Select
      defaultOpen
      onOpenChange={(open: boolean) => {
        if (!open && !selectedRef.current) onCancel();
        selectedRef.current = false;
      }}
      onValueChange={(transitionId: unknown) => {
        const t = transitions.find((t) => t.id === String(transitionId));
        if (t) {
          selectedRef.current = true;
          onSave(t.name, t.id);
        }
      }}
    >
      <SelectTrigger className="text-[10px] border-[#0052CC] bg-white dark:bg-gray-800 text-[#172B4D] dark:text-gray-100 max-w-[110px] h-auto py-0.5 px-1">
        <SelectValue placeholder={currentStatus} />
      </SelectTrigger>
      <SelectContent>
        {transitions.map((t) => (
          <SelectItem key={t.id} value={t.id} className="text-xs">
            {t.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ── Inline Text Editor ───────────────────────────────────────────────────

export function InlineTextEditor({
  currentValue,
  onSave,
  onCancel,
  className,
}: {
  currentValue: string;
  onSave: (newValue: string) => void;
  onCancel: () => void;
  className?: string;
}) {
  const [value, setValue] = useState(currentValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <div className="flex items-center gap-1">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (value !== currentValue) onSave(value);
            else onCancel();
          }
          if (e.key === 'Escape') onCancel();
        }}
        className={cn(
          'text-xs border border-[#0052CC] rounded px-1.5 py-0.5 bg-white dark:bg-gray-800 text-[#172B4D] dark:text-gray-100 focus:outline-none flex-1 min-w-0',
          className,
        )}
      />
      <button
        onClick={() => onSave(value)}
        className="text-[#36B37E] hover:text-green-600 flex-shrink-0"
        title="Save"
      >
        <Check size={12} />
      </button>
      <button
        onClick={onCancel}
        className="text-[#DE350B] hover:text-red-600 flex-shrink-0"
        title="Cancel"
      >
        <X size={12} />
      </button>
    </div>
  );
}

// ── Date Editor ──────────────────────────────────────────────────────────

export function DateEditor({
  currentValue,
  onSave,
  onCancel,
}: {
  currentValue: string;
  onSave: (newValue: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(currentValue || '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <input
      ref={inputRef}
      type="date"
      value={value}
      onChange={(e) => {
        setValue(e.target.value);
        onSave(e.target.value);
      }}
      onBlur={onCancel}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onCancel();
      }}
      className="text-[10px] border border-[#0052CC] rounded px-1 py-0.5 bg-white dark:bg-gray-800 text-[#172B4D] dark:text-gray-100 focus:outline-none"
    />
  );
}

// ── Estimate Editor ──────────────────────────────────────────────────────

export function EstEditor({
  currentValue,
  onSave,
  onCancel,
}: {
  currentValue: string;
  onSave: (newValue: string) => void;
  onCancel: () => void;
}) {
  const initial = currentValue === '-' || currentValue === '—' ? '' : currentValue;
  const [value, setValue] = useState(initial);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <div className="flex items-center gap-1">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="e.g. 2d 4h"
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (value !== initial) onSave(value);
            else onCancel();
          }
          if (e.key === 'Escape') onCancel();
        }}
        className="text-xs border border-[#0052CC] rounded px-1.5 py-0.5 bg-white dark:bg-gray-800 text-[#172B4D] dark:text-gray-100 focus:outline-none w-24"
      />
      <button
        onClick={() => onSave(value)}
        className="text-[#36B37E] hover:text-green-600 flex-shrink-0"
        title="Save"
      >
        <Check size={12} />
      </button>
      <button
        onClick={onCancel}
        className="text-[#DE350B] hover:text-red-600 flex-shrink-0"
        title="Cancel"
      >
        <X size={12} />
      </button>
    </div>
  );
}
