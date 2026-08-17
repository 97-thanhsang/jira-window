'use client';

import { Loader2, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  canDistribute: boolean;
  onDistribute: () => void;
  distributing: boolean;
}

export function EstDistributeButton({ canDistribute, onDistribute, distributing }: Props) {
  return (
    <button
      onClick={onDistribute}
      disabled={!canDistribute || distributing}
      className={cn(
        'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors',
        canDistribute
          ? 'bg-[#0052CC] text-white hover:bg-[#0065FF]'
          : 'bg-[#DFE1E6] dark:bg-gray-700 text-[#5E6C84] dark:text-gray-400',
        'disabled:opacity-50 disabled:cursor-not-allowed',
      )}
    >
      {distributing ? (
        <><Loader2 size={14} className="animate-spin" /> Đang phân bổ...</>
      ) : (
        <><ArrowDown size={14} /> Phân bổ lịch</>
      )}
    </button>
  );
}
