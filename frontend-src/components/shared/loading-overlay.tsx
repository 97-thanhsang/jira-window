'use client';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingOverlayProps {
  loading: boolean;
  message?: string;
}

export function LoadingOverlay({ loading, message = 'Loading…' }: LoadingOverlayProps) {
  if (!loading) return null;

  return (
    <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-[1px] flex items-center justify-center z-50 rounded-sm transition-all duration-200">
      <div className="flex flex-col items-center gap-2.5">
        <div className="relative">
          <div className="w-10 h-10 rounded-full border-[3px] border-[#DFE1E6] dark:border-gray-600" />
          <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-[#0052CC] animate-spin" />
        </div>
        <span className="text-sm font-medium text-[#5E6C84] dark:text-gray-400 animate-pulse">
          {message}
        </span>
      </div>
    </div>
  );
}
