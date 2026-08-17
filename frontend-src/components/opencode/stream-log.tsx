'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface StreamLogProps {
  lines: string[];
  isRunning: boolean;
  className?: string;
}

export function StreamLog({ lines, isRunning, className }: StreamLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  if (lines.length === 0 && !isRunning) return null;

  return (
    <div
      className={cn(
        'mt-4 rounded-lg border bg-zinc-950 text-zinc-100 font-mono text-xs',
        'max-h-64 overflow-y-auto p-4 space-y-0.5',
        className
      )}
    >
      {isRunning && lines.length === 0 && (
        <p className="text-zinc-500 animate-pulse">Đang khởi động...</p>
      )}
      {lines.map((line, i) => {
        const isWire    = line.includes('[') && line.includes('_DONE]');
        const isError   = line.toLowerCase().startsWith('error') || line.includes('FAILED');
        const isSuccess = isWire;

        return (
          <p
            key={i}
            className={cn(
              'whitespace-pre-wrap leading-5',
              isSuccess && 'text-emerald-400 font-semibold',
              isError   && 'text-red-400',
            )}
          >
            {line}
          </p>
        );
      })}
      {isRunning && <p className="text-blue-400 animate-pulse">▋</p>}
      <div ref={bottomRef} />
    </div>
  );
}
