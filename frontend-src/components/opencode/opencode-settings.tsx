'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { apiBackend } from '@/lib/api';
import {
  Server, MessageSquare, Bot, Zap, Puzzle, Brain, Plug, FileCode,
  Play, Square, RefreshCw, X, ChevronRight, Copy, Check,
  Clock, HardDrive, Hash, Calendar, ExternalLink, Trash2,
} from 'lucide-react';
import {
  useServiceStatus,
  useOpenCodeConfig,
  useOpenCodeAgents,
  useOpenCodeCommands,
  useOpenCodeSkills,
  useOpenCodeProviders,
  useMcpStatus,
  useOpenCodeSessions,
  updateConfig,
  deleteSession,
} from '@/hooks/use-opencode-settings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

/* ─── Shared Helpers ───────────────────────────────────────────── */

function EmptyState({ icon: Icon, text, sub }: { icon: React.ComponentType<{ className?: string }>; text: string; sub?: string }) {
  return (
    <div className="text-center py-10 text-muted-foreground">
      <Icon className="w-8 h-8 mx-auto mb-2 opacity-40" />
      <p className="text-sm font-medium">{text}</p>
      {sub && <p className="text-xs mt-1 opacity-60 max-w-md mx-auto">{sub}</p>}
    </div>
  );
}

/* ─── Tab Config ───────────────────────────────────────────────── */

interface TabDef {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TABS: TabDef[] = [
  { id: 'service',   label: 'Service',   icon: Server },
  { id: 'sessions',  label: 'Sessions',  icon: MessageSquare },
  { id: 'agents',    label: 'Agents',    icon: Bot },
  { id: 'commands',  label: 'Commands',  icon: Zap },
  { id: 'skills',    label: 'Skills',    icon: Puzzle },
  { id: 'model',     label: 'Model',     icon: Brain },
  { id: 'mcp',       label: 'MCP',       icon: Plug },
  { id: 'config',    label: 'Config',    icon: FileCode },
];

type TabId = typeof TABS[number]['id'];

/* ─── Helper: Status Dot ───────────────────────────────────────── */

function StatusDot({ active, pulse }: { active: boolean; pulse?: boolean }) {
  return (
    <span className={cn(
      'inline-block w-2.5 h-2.5 rounded-full ring-2 ring-offset-1 ring-offset-card transition-all',
      active
        ? 'bg-emerald-400 ring-emerald-300'
        : pulse
        ? 'bg-amber-400 ring-amber-300 animate-pulse'
        : 'bg-muted-foreground/25 ring-muted-foreground/10',
    )} />
  );
}

/* ─── 1. Service Section ───────────────────────────────────────── */

function ServiceSection() {
  const { status, isLoading, refresh } = useServiceStatus();
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState('');

  const running = !!status?.running;

  const toggle = async () => {
    setBusy(true); setErr('');
    try {
      const ep = running ? '/api/opencode/service/stop' : '/api/opencode/service/start';
      await apiBackend.post(ep);
      let n = 0;
      const iv = setInterval(async () => { n++; await refresh(); if (n >= 20) clearInterval(iv); }, 800);
    } catch (e) { setErr(String(e)); }
    finally { setBusy(false); }
  };

  if (isLoading) return <div className="h-32 bg-muted/40 animate-pulse rounded-xl" />;

  const meta: [React.ComponentType<{ className?: string }>, string, string | undefined][] = [
    [Hash,     'Port',    String(status?.port ?? 4096)],
    [HardDrive, 'PID',    status?.pid ? String(status.pid) : undefined],
    [Clock,    'Uptime',  status?.startedAt ? new Date(status.startedAt).toLocaleString() : undefined],
    [Calendar, 'Dir',     status?.directory],
  ].filter(([, , v]) => v !== undefined) as [React.ComponentType<{ className?: string }>, string, string][];

  return (
    <div className="space-y-4">
      {/* Status Banner */}
      <div className={cn(
        'flex items-center justify-between p-4 rounded-xl border transition-colors',
        running ? 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800' : 'bg-muted/30 border-border',
      )}>
        <div className="flex items-center gap-3">
          <span className={cn(
            'w-3 h-3 rounded-full',
            running ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-muted-foreground/30',
          )} />
          <div>
            <p className="text-sm font-semibold">{running ? 'Service Running' : 'Service Stopped'}</p>
            {status?.version && <p className="text-xs text-muted-foreground">v{status.version}</p>}
          </div>
          {status?.managed === false && running && (
            <Badge variant="outline" className="text-xs ml-1">External Process</Badge>
          )}
        </div>
        <Button
          size="sm"
          variant={running ? 'destructive' : 'default'}
          onClick={toggle} disabled={busy}
          className="gap-1.5"
        >
          {busy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            : running ? <><Square className="w-3 h-3" /> Stop</>
            : <><Play className="w-3 h-3" /> Start</>}
        </Button>
      </div>

      {/* Meta Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {meta.map(([Icon, label, value]) => (
          <div key={label} className="p-3 rounded-lg bg-muted/30 border border-border/50">
            <p className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1.5">
              <Icon className="w-3 h-3" /> {label}
            </p>
            <p className="text-sm font-mono truncate">{value}</p>
          </div>
        ))}
      </div>

      {/* Error */}
      {err && <p className="text-xs text-red-600 p-2 bg-red-50 rounded">{err}</p>}

      {/* CLI hint */}
      {!running && (
        <p className="text-xs text-muted-foreground">
          Start with: <code className="bg-muted px-1.5 py-0.5 rounded text-[11px] font-mono">opencode serve --port {status?.port ?? 4096}</code>
        </p>
      )}
    </div>
  );
}

/* ─── 2. Sessions Section ──────────────────────────────────────── */

function SessionsSection() {
  const { sessions, isLoading, refresh } = useOpenCodeSessions();
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this session?')) return;
    setDeleting(id);
    try { await deleteSession(id); await refresh(); }
    catch (e) { alert(String(e)); }
    finally { setDeleting(null); }
  };

  return (
    <div className="space-y-3">
      {isLoading ? (
        <div className="h-20 bg-muted animate-pulse rounded-xl" />
      ) : sessions.length === 0 ? (
        <EmptyState icon={MessageSquare} text="No sessions yet"
          sub="Sessions are created when you run a prompt in OpenCode." />
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {sessions.map((s) => (
            <div key={s.id}
              className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors group">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{s.title ?? '(untitled)'}</p>
                <p className="text-xs text-muted-foreground font-mono truncate">{s.id}</p>
                {s.time?.updated && (
                  <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                    Updated {new Date(s.time.updated).toLocaleString()}
                  </p>
                )}
              </div>
              <Button
                size="sm" variant="ghost"
                className="text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                onClick={() => handleDelete(s.id)}
                disabled={deleting === s.id}
              >
                {deleting === s.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── 3. Agents Section ────────────────────────────────────────── */

const MODE_COLORS: Record<string, string> = {
  primary:  'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800',
  subagent: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/50 dark:text-purple-300 dark:border-purple-800',
};

function modelDisplay(m: unknown): string {
  if (typeof m === 'string') return m;
  if (m && typeof m === 'object') {
    const obj = m as Record<string, string>;
    return obj.providerID && obj.modelID ? `${obj.providerID}/${obj.modelID}` : JSON.stringify(m);
  }
  return String(m);
}

function AgentsSection() {
  const { agents, isLoading } = useOpenCodeAgents();
  const { config, refresh: refreshConfig } = useOpenCodeConfig();
  const [saving, setSaving] = useState(false);

  const currentDefault = (config?.merged?.default_agent as string) ?? 'build';
  const visibleAgents = agents.filter((a) => !a.hidden);

  const setDefault = async (name: string) => {
    if (name === currentDefault) return;
    setSaving(true);
    try { await updateConfig({ default_agent: name }); await refreshConfig(); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-3">
      {isLoading ? (
        <div className="h-20 bg-muted animate-pulse rounded-xl" />
      ) : visibleAgents.length === 0 ? (
        <EmptyState icon={Bot} text="Server offline"
          sub="Start the OpenCode service to see live agents." />
      ) : (
        <>
          <div className="grid gap-2">
            {visibleAgents.map((a) => {
              const id = a.id ?? a.name ?? '';
              const isDefault = id === currentDefault;
              const mode = a.mode ?? 'subagent';
              return (
                <div key={id}
                  onClick={() => !saving && setDefault(id)}
                  className={cn(
                    'flex items-center justify-between gap-3 p-3 rounded-lg border cursor-pointer transition-all group',
                    isDefault
                      ? 'border-primary/50 bg-primary/5 shadow-sm'
                      : 'border-transparent bg-muted/20 hover:bg-muted/40 hover:border-border',
                  )}>
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Color dot */}
                    <span className="w-3 h-3 rounded-full shrink-0 border"
                      style={{ background: a.color ?? '#94a3b8' }} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-mono font-semibold">{id}</span>
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-medium', MODE_COLORS[mode] ?? 'bg-muted')}>
                          {mode}
                        </span>
                        {isDefault && <span className="text-[11px] text-primary font-semibold">Default</span>}
                      </div>
                      {a.description && <p className="text-xs text-muted-foreground mt-0.5">{a.description}</p>}
                      {a.model && <p className="text-[11px] font-mono text-muted-foreground/60 mt-0.5">{modelDisplay(a.model)}</p>}
                    </div>
                  </div>
                  {isDefault ? (
                    <Check className="w-4 h-4 text-primary shrink-0" />
                  ) : (
                    <span className="text-[11px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      Set default
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">Click an agent to set it as the default for new sessions.</p>
        </>
      )}
    </div>
  );
}

/* ─── 4. Commands Section ──────────────────────────────────────── */

function CommandsSection() {
  const { commands, isLoading } = useOpenCodeCommands();

  return (
    <div className="space-y-3">
      {isLoading ? (
        <div className="h-20 bg-muted animate-pulse rounded-xl" />
      ) : commands.length === 0 ? (
        <EmptyState icon={Zap} text="No commands found"
          sub="Add commands in .opencode/commands/<name>.md or ~/.config/opencode/commands/" />
      ) : (
        <div className="grid gap-2">
          {commands.map((c, i) => (
            <div key={c.name ?? i}
              className="flex items-start gap-3 p-3 rounded-lg bg-muted/20 border border-border/50 hover:border-border transition-colors">
              <code className="text-sm font-mono text-primary font-semibold shrink-0 bg-primary/5 px-2 py-0.5 rounded">
                /{c.name}
              </code>
              <div className="min-w-0 flex-1">
                {c.description && <p className="text-xs text-muted-foreground mb-1">{c.description}</p>}
                <div className="flex gap-2 flex-wrap">
                  {c.agent && <span className="text-[10px] text-muted-foreground/60">Agent: {c.agent}</span>}
                  {c.model && <span className="text-[10px] text-muted-foreground/60">Model: {c.model}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── 5. Skills Section ────────────────────────────────────────── */

function SkillsSection() {
  const { skills, isLoading } = useOpenCodeSkills();

  return (
    <div className="space-y-3">
      {isLoading ? (
        <div className="h-20 bg-muted animate-pulse rounded-xl" />
      ) : skills.length === 0 ? (
        <EmptyState icon={Puzzle} text="No skills found"
          sub="Add skills in .opencode/skills/<name>/SKILL.md or ~/.config/opencode/skills/" />
      ) : (
        <div className="grid sm:grid-cols-2 gap-2">
          {skills.map((s, i) => (
            <div key={s.name ?? i}
              className="p-3 rounded-lg bg-muted/20 border border-border/50 hover:border-border transition-colors">
              <p className="text-sm font-mono font-semibold text-primary">{s.name}</p>
              {s.description && <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>}
              {s.location && <p className="text-[10px] text-muted-foreground/50 font-mono mt-1 truncate">{s.location}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── 6. Model Section ─────────────────────────────────────────── */

function ModelSection() {
  const { config, refresh: refreshConfig } = useOpenCodeConfig();
  const { providers, isLoading, error } = useOpenCodeProviders();
  const [selected, setSelected] = useState('');
  const [saving, setSaving]   = useState(false);
  const [searchModel, setSearchModel] = useState('');

  const current = (config?.merged?.model as string) ?? '';

  const save = async () => {
    if (!selected || selected === current) return;
    setSaving(true);
    try { await updateConfig({ model: selected }); await refreshConfig(); setSelected(''); }
    finally { setSaving(false); }
  };

  if (isLoading) return <div className="h-32 bg-muted/40 animate-pulse rounded-xl" />;
  if (error) return <EmptyState icon={Brain} text="Failed to load models" sub={`${error}`} />;
  if (providers.length === 0) return <EmptyState icon={Brain} text="No providers connected" sub="Start OpenCode to see available models." />;

  return (
    <div className="space-y-4">
      {/* Current model indicator */}
      <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
        <Brain className="w-4 h-4 text-primary/60" />
        <span className="text-xs text-muted-foreground">Current model:</span>
        <code className="text-xs font-mono font-medium">{current || 'not set'}</code>
      </div>

      {/* Simple model search filter */}
      <input
        type="text"
        placeholder="Filter models..."
        value={searchModel}
        onChange={(e) => setSearchModel(e.target.value)}
        className="w-full rounded-lg border bg-muted/30 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
      />

      {/* Providers accordion */}
      <div className="space-y-1 max-h-96 overflow-y-auto pr-1">
        {providers
          .filter(p => searchModel === '' || p.name?.toLowerCase().includes(searchModel.toLowerCase())
            || p.models.some(m => m.toLowerCase().includes(searchModel.toLowerCase())))
          .map((p) => (
            <details key={p.id} className="group border border-border/50 rounded-lg overflow-hidden">
              <summary className="flex items-center gap-2 cursor-pointer select-none px-3 py-2.5 bg-muted/20 hover:bg-muted/40 transition-colors list-none">
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-open:rotate-90 transition-transform" />
                <span className="text-sm font-medium">{p.name ?? p.label ?? p.id}</span>
                <Badge variant="secondary" className="text-[10px] ml-auto">{p.models.length}</Badge>
              </summary>
              <div className="px-2 pb-2 pt-1 space-y-0.5 bg-card">
                {p.models
                  .filter(m => searchModel === '' || m.toLowerCase().includes(searchModel.toLowerCase()))
                  .map((m) => {
                    const modelId = typeof m === 'string' ? m : (m as Record<string, string>).id ?? String(m);
                    const display = typeof m === 'string' ? m : (m as Record<string, string>).name ?? modelId;
                    const isActive = modelId === (selected || current);
                    return (
                      <button key={modelId} onClick={() => setSelected(modelId)}
                        className={cn(
                          'w-full text-left px-3 py-1.5 rounded-md text-xs font-mono transition-all flex items-center gap-2',
                          isActive
                            ? 'bg-primary/10 text-primary font-semibold'
                            : 'hover:bg-muted text-muted-foreground hover:text-foreground',
                        )}>
                        {isActive && <Check className="w-3 h-3 shrink-0" />}
                        {display}
                      </button>
                    );
                  })}
              </div>
            </details>
          ))}
      </div>

      {/* Apply bar */}
      {selected && selected !== current && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-primary/20 bg-primary/5">
          <span className="text-xs text-muted-foreground flex-1 truncate">Set model to: <code className="font-mono">{selected}</code></span>
          <Button size="sm" onClick={save} disabled={saving} className="gap-1.5">
            {saving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
            Apply
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected('')}>
            <X className="w-3 h-3" />
          </Button>
        </div>
      )}
    </div>
  );
}

/* ─── 7. MCP Section ───────────────────────────────────────────── */

const MCP_STATE: Record<string, { color: string; label: string }> = {
  connected: { color: 'bg-emerald-500', label: 'connected' },
  running:   { color: 'bg-emerald-500', label: 'running' },
  error:     { color: 'bg-red-500',     label: 'error' },
  stopped:   { color: 'bg-muted-foreground/30', label: 'stopped' },
  unknown:   { color: 'bg-muted-foreground/30', label: 'unknown' },
};

function McpSection() {
  const { servers, isLoading, refresh } = useMcpStatus();
  const [busy, setBusy] = useState<string | null>(null);

  const toggle = async (name: string, connected: boolean) => {
    setBusy(name);
    try {
      const ep = connected ? `/api/opencode/mcp/${encodeURIComponent(name)}/disconnect`
                           : `/api/opencode/mcp/${encodeURIComponent(name)}/connect`;
      await apiBackend.post(ep);
      await refresh();
    } catch { /* offline */ }
    finally { setBusy(null); }
  };

  return (
    <div className="space-y-3">
      {isLoading ? (
        <div className="h-20 bg-muted animate-pulse rounded-xl" />
      ) : servers.length === 0 ? (
        <EmptyState icon={Plug} text="No MCP servers"
          sub='Add servers in opencode.json under the "mcp" key.' />
      ) : (
        <div className="space-y-2">
          {servers.map((srv) => {
            const stateKey = (srv.state ?? srv.status ?? 'unknown').toLowerCase();
            const stateDef = MCP_STATE[stateKey] ?? MCP_STATE.unknown;
            const isConnected = stateKey === 'connected' || stateKey === 'running';

            return (
              <div key={srv.name}
                className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card hover:border-border/80 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', stateDef.color,
                    stateKey === 'running' && 'animate-pulse')} />
                  <div className="min-w-0">
                    <p className="text-sm font-mono font-medium">{srv.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                      {srv.type === 'local'  ? `local — ${(srv.command ?? []).join(' ')}` :
                       srv.type === 'remote' ? `remote — ${srv.url ?? ''}` : srv.type ?? ''}
                    </p>
                    {srv.error && <p className="text-[11px] text-red-500 truncate mt-0.5">{srv.error}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium',
                    isConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground')}>
                    {srv.enabled === false ? 'disabled' : stateDef.label}
                  </span>
                  <Button size="sm" variant="ghost" className="text-xs h-7 px-2"
                    onClick={() => toggle(srv.name, isConnected)}
                    disabled={busy === srv.name}
                  >
                    {busy === srv.name ? <RefreshCw className="w-3 h-3 animate-spin" />
                      : isConnected ? 'Disconnect' : 'Connect'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── 8. Config Section ────────────────────────────────────────── */

function ConfigSection() {
  const { config, isLoading, refresh, error } = useOpenCodeConfig();
  const [open, setOpen]     = useState(false);
  const [draft, setDraft]   = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg]       = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const openEditor = useCallback(() => {
    setDraft(JSON.stringify(config?.project ?? {}, null, 2));
    setMsg(null); setOpen(true);
  }, [config]);

  const save = async () => {
    setSaving(true); setMsg(null);
    try {
      const parsed = JSON.parse(draft) as Record<string, unknown>;
      await apiBackend.patch('/api/opencode/config', parsed);
      await refresh();
      setMsg({ ok: true, text: 'Config saved successfully' });
      setTimeout(() => setMsg(null), 2000);
    } catch (e) {
      setMsg({ ok: false, text: e instanceof SyntaxError ? `JSON error: ${e.message}` : String(e) });
    } finally { setSaving(false); }
  };

  const copyFilepath = () => {
    if (config?.filePath) {
      navigator.clipboard.writeText(config.filePath);
      setCopied(true); setTimeout(() => setCopied(false), 1500);
    }
  };

  if (isLoading) return <div className="h-20 bg-muted animate-pulse rounded-xl" />;
  if (error) return <EmptyState icon={FileCode} text="Failed to load config" sub={String(error)} />;

  return (
    <div className="space-y-4">
      {/* File path indicator */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/50">
        <div className="flex items-center gap-2 min-w-0">
          <FileCode className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          {config?.filePath ? (
            <p className="text-xs font-mono text-muted-foreground truncate">{config.filePath}</p>
          ) : (
            <p className="text-xs text-muted-foreground">No <code className="bg-muted px-1 rounded">.opencode/opencode.json</code> exists</p>
          )}
        </div>
        {config?.filePath && (
          <Button variant="ghost" size="sm" className="shrink-0" onClick={copyFilepath}>
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          </Button>
        )}
      </div>

      {/* Editor or open button */}
      {!open ? (
        <Button variant="outline" size="sm" onClick={openEditor} className="gap-2">
          <FileCode className="w-3.5 h-3.5" />
          Edit project config
        </Button>
      ) : (
        <div className="space-y-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={18}
            spellCheck={false}
            className="w-full rounded-lg border bg-muted/10 p-3 font-mono text-xs resize-y focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
          />
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={save} disabled={saving} className="gap-1.5">
              {saving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            {msg && <span className={cn('text-xs ml-auto', msg.ok ? 'text-emerald-600' : 'text-red-600')}>{msg.text}</span>}
          </div>
        </div>
      )}

      {/* Schema reference */}
      <details className="text-xs text-muted-foreground group">
        <summary className="cursor-pointer hover:text-foreground select-none py-1 flex items-center gap-1">
          <ChevronRight className="w-3 h-3 group-open:rotate-90 transition-transform" />
          Config schema reference
        </summary>
        <pre className="mt-2 p-3 bg-muted/30 rounded-lg text-[11px] overflow-auto max-h-72 leading-relaxed whitespace-pre-wrap border">
{`{
  "$schema": "https://opencode.ai/config.json",
  "model": "anthropic/claude-sonnet-4-5",
  "small_model": "anthropic/claude-haiku-4-5",
  "default_agent": "build",
  "server": { "port": 4096, "hostname": "127.0.0.1" },
  "shell": "pwsh",
  "permission": {
    "bash": { "*": "allow", "git push *": "ask", "rm *": "ask" },
    "edit": "ask",
    "webfetch": "allow"
  },
  "tools": { "bash": true, "edit": true, "write": true },
  "mcp": {
    "my-server": { "type": "local", "command": ["npx", "-y", "@scope/server"], "enabled": true }
  },
  "compaction": { "auto": true, "reserved": 10000 },
  "instructions": ["AGENTS.md"],
  "agent": { "my-agent": { "mode": "primary", "model": "...", "description": "..." } },
  "command": { "deploy": { "description": "...", "template": "..." } },
  "skills": { "paths": [".opencode/skills"] },
  "autoupdate": true
}`}</pre>
      </details>
    </div>
  );
}

/* ─── Main Settings Container ───────────────────────────────────── */

export function OpenCodeSettings() {
  const [tab, setTab] = useState<TabId>('service');

  const TabIcon = TABS.find(t => t.id === tab)?.icon ?? Server;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">OpenCode Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage the OpenCode service, sessions, agents, commands, skills, model, MCP servers, and configuration.
        </p>
      </div>

      {/* Tab Navigation — Segmented control with icons */}
      <div className="flex flex-wrap gap-1 p-1 bg-muted/40 rounded-xl border">
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all shrink-0',
                isActive
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
              )}
            >
              <Icon className={cn('w-4 h-4', isActive && 'text-primary')} />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content Card */}
      <Card className="shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <TabIcon className="w-4 h-4 text-primary" />
            {TABS.find(t => t.id === tab)?.label}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tab === 'service'  && <ServiceSection />}
          {tab === 'sessions' && <SessionsSection />}
          {tab === 'agents'   && <AgentsSection />}
          {tab === 'commands' && <CommandsSection />}
          {tab === 'skills'   && <SkillsSection />}
          {tab === 'model'    && <ModelSection />}
          {tab === 'mcp'      && <McpSection />}
          {tab === 'config'   && <ConfigSection />}
        </CardContent>
      </Card>
    </div>
  );
}
