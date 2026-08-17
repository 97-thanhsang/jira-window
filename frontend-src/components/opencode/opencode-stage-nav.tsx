'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useServiceStatus } from '@/hooks/use-opencode-settings';
import { Search, Package, BrainCircuit, Hammer, Play, Settings } from 'lucide-react';
import type { PipelineStage } from '@/types/opencode';

/* ─── Stage Icons (lucide, not emoji) ────────────────────────── */

const STAGE_ICON: Record<PipelineStage, React.ComponentType<{ className?: string }>> = {
  decompose: Search,
  extractor: Package,
  analyze:   BrainCircuit,
  solution:  Hammer,
  execute:   Play,
};

const STAGE_LABEL: Record<PipelineStage, string> = {
  decompose: 'Decompose',
  extractor: 'Extractor',
  analyze:   'Analyze',
  solution:  'Solution',
  execute:   'Execute',
};

const STAGE_ORDER: PipelineStage[] = ['decompose', 'extractor', 'analyze', 'solution', 'execute'];

/* ─── Component ───────────────────────────────────────────────── */

export function OpenCodeStageNav() {
  const pathname = usePathname();
  const { status } = useServiceStatus();

  const isSettings = pathname === '/opencode/settings' || pathname.startsWith('/opencode/settings/');

  return (
    <div className="border-b bg-card">
      <div className="container mx-auto max-w-5xl px-4 flex items-center justify-between h-12">
        {/* Pipeline stage tabs */}
        <nav className="flex items-center h-full overflow-x-auto">
          {STAGE_ORDER.map((stage) => {
            const Icon = STAGE_ICON[stage];
            const label = STAGE_LABEL[stage];
            const isActive =
              pathname === `/opencode/${stage}` ||
              pathname.startsWith(`/opencode/${stage}/`);

            return (
              <Link
                key={stage}
                href={`/opencode/${stage}`}
                className={cn(
                  'relative flex items-center gap-2 px-4 h-full text-sm font-medium whitespace-nowrap transition-colors shrink-0',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{label}</span>
                {/* Active indicator bar */}
                {isActive && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right side: status dot + settings */}
        <div className="flex items-center gap-3 shrink-0 ml-2">
          {/* Service status dot */}
          <div
            title={status ? `OpenCode ${status.running ? 'running' : 'stopped'} — v${status.version ?? '?'}` : 'Checking…'}
            className={cn(
              'w-2 h-2 rounded-full transition-colors',
              status?.running
                ? 'bg-emerald-500 shadow-[0_0_5px_#10b981]'
                : status
                ? 'bg-muted-foreground/30'
                : 'bg-muted-foreground/20 animate-pulse',
            )}
          />

          {/* Settings gear */}
          <Link
            href="/opencode/settings"
            title="OpenCode Settings"
            className={cn(
              'p-1.5 rounded-md transition-colors',
              isSettings
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
            )}
          >
            <Settings className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
