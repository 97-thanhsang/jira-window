'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePipelineTasks, usePipelineSummary } from '@/hooks/use-pipeline';
import { PipelineProgressBar } from './pipeline-progress-bar';
import { Search, Plus, RefreshCw, Zap } from 'lucide-react';

/* ─── Card component ──────────────────────────────────────────── */

function PipelineCard({ taskKey }: { taskKey: string }) {
  const { summary } = usePipelineSummary(taskKey);
  const router = useRouter();

  const completedCount = summary
    ? Object.values(summary.stages).filter((s) => s.status === 'DONE').length
    : 0;

  return (
    <div
      onClick={() => router.push(`/opencode/${taskKey}`)}
      className="p-4 rounded-xl border bg-card hover:border-primary/30 hover:shadow-sm cursor-pointer transition-all group"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono font-bold text-sm">{taskKey}</span>
        {summary ? (
          <Badge variant={completedCount === 5 ? 'default' : 'secondary'} className="text-[10px]">
            {completedCount}/5
          </Badge>
        ) : (
          <span className="w-6 h-3 bg-muted animate-pulse rounded" />
        )}
      </div>

      {summary ? (
        <PipelineProgressBar
          stages={summary.stages}
          onStageClick={(stage) => {
            router.push(`/opencode/${taskKey}/${stage}`);
          }}
        />
      ) : (
        <div className="h-3 bg-muted/40 animate-pulse rounded-full" />
      )}
    </div>
  );
}

/* ─── Main Hub ─────────────────────────────────────────────────── */

export function PipelineHub() {
  const { taskKeys, isLoading, refresh } = usePipelineTasks();
  const [search, setSearch] = useState('');
  const [manualKey, setManualKey] = useState('');

  const filtered = taskKeys.filter((k) =>
    k.toLowerCase().includes(search.toLowerCase())
  );

  const handleAddKey = () => {
    const key = manualKey.trim().toUpperCase();
    if (key && /^[A-Z]+-\d+$/.test(key)) {
      window.location.href = `/opencode/${key}`;
    }
    setManualKey('');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            Pipeline Hub
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track and manage AI pipeline stages for Jira tasks
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refresh()} className="gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </Button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-muted/30 border text-xs">
        <span className="font-medium text-muted-foreground">Stages:</span>
        {[
          { color: 'bg-emerald-500', label: 'Done' },
          { color: 'bg-blue-400', label: 'Running' },
          { color: 'bg-muted-foreground/30', label: 'Idle' },
          { color: 'bg-red-500', label: 'Failed' },
          { color: 'bg-orange-400', label: 'Blocked' },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${color} ${label === 'Running' ? 'animate-pulse' : ''}`} />
            {label}
          </span>
        ))}
      </div>

      {/* Search + Add */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by task key..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex gap-2 ml-auto">
          <Input
            placeholder="Add task key..."
            value={manualKey}
            onChange={(e) => setManualKey(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddKey()}
            className="w-40"
          />
          <Button onClick={handleAddKey} variant="outline" size="sm" className="gap-1">
            <Plus className="w-3.5 h-3.5" /> Add
          </Button>
        </div>
      </div>

      {/* Cards */}
      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="p-4 rounded-xl bg-muted/30 animate-pulse">
              <div className="h-4 w-24 bg-muted rounded mb-3" />
              <div className="h-3 bg-muted/50 rounded-full" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Zap className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-lg font-medium text-muted-foreground">No pipelines yet</p>
          <p className="text-sm text-muted-foreground/60 mt-1 max-w-sm mx-auto">
            Run <code className="bg-muted px-1.5 py-0.5 rounded text-[12px] font-mono">/analyze-task EMSPRO2-1234</code> in OpenCode CLI to start.
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((key) => (
            <PipelineCard key={key} taskKey={key} />
          ))}
        </div>
      )}
    </div>
  );
}
