'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { api } from '@/lib/api';
import { WikiRenderer } from '@/components/issue/wiki-renderer';
import { CommentSection } from '@/components/issue/comment-section';
import { AttachmentGallery } from '@/components/issue/attachment-gallery';
import type { JiraIssue, JiraTransition, JiraAttachment } from '@/types/jira';
import { StatusBadge } from '@/components/shared/status-badge';
import { PriorityIcon } from '@/components/shared/priority-icon';
import {
  X, ExternalLink, Edit2, Check, Loader2, ChevronDown,
  AlertTriangle, Calendar, Tag, User, Clock, Activity,
  Link2, GitBranch, Layers, History, Paperclip, MessageSquare,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── helpers ─────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function isOverdue(duedate: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return new Date(duedate) < today;
}

function useProxiedAvatarUrl(avatarUrl?: string) {
  const [proxiedUrl, setProxiedUrl] = useState<string>('');

  useEffect(() => {
    if (!avatarUrl) {
      setProxiedUrl('');
      return;
    }

    let active = true;
    let objectUrl = '';

    void api.get('/avatar', {
      params: { url: avatarUrl },
      responseType: 'blob',
    }).then((response) => {
      if (!active) return;
      objectUrl = URL.createObjectURL(response.data);
      setProxiedUrl(objectUrl);
    }).catch(() => {
      if (active) {
        setProxiedUrl('');
      }
    });

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [avatarUrl]);

  return proxiedUrl;
}

const PRIORITY_OPTIONS = ['Highest', 'High', 'Medium', 'Low', 'Lowest', 'Blocker', 'Minor'];

// ─── small UI bits ────────────────────────────────────────────────

function Avatar({ user, size = 24 }: {
  user: { displayName: string; avatarUrls: { '24x24': string; '48x48': string } };
  size?: number;
}) {
  const avatarSrc = useProxiedAvatarUrl(user.avatarUrls['24x24']);

  return avatarSrc
    ? <Image src={avatarSrc} alt={user.displayName} width={size} height={size} className="rounded-full flex-shrink-0" unoptimized />
    : <span
        style={{ width: size, height: size, fontSize: size * 0.4 }}
        className="inline-flex items-center justify-center rounded-full bg-[#0052CC] text-white font-bold flex-shrink-0"
      >
        {user.displayName.charAt(0)}
      </span>;
}

function SideField({ icon, label, children }: { icon?: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-1 items-start py-1.5 border-b border-[#F4F5F7] dark:border-gray-700/60 last:border-b-0">
      <div className="flex items-center gap-1.5 pt-0.5">
        {icon && <span className="text-[#5E6C84] dark:text-gray-500 flex-shrink-0">{icon}</span>}
        <span className="text-xs font-medium text-[#5E6C84] dark:text-gray-400 truncate">{label}</span>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

// ─── inline edit widgets ──────────────────────────────────────────

interface EditSelectProps {
  value: string;
  options: { value: string; label: string }[];
  onSave: (v: string) => void;
  onCancel: () => void;
  loading?: boolean;
}

function EditSelect({ value, options, onSave, onCancel, loading }: EditSelectProps) {
  return (
    <div className="flex items-center gap-1.5">
      <select
        autoFocus
        defaultValue={value}
        onChange={e => onSave(e.target.value)}
        onBlur={() => onCancel()}
        disabled={loading}
        className="text-xs border border-[#0052CC] rounded px-2 py-1 bg-white dark:bg-gray-800 text-[#172B4D] dark:text-gray-100 focus:outline-none"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {loading && <Loader2 size={12} className="animate-spin text-[#0052CC]" />}
    </div>
  );
}

interface EditTextProps {
  value: string;
  onSave: (v: string) => void;
  onCancel: () => void;
  loading?: boolean;
  multiline?: boolean;
  placeholder?: string;
  rows?: number;
}

function EditText({ value, onSave, onCancel, loading, multiline, placeholder, rows = 3 }: EditTextProps) {
  const [draft, setDraft] = useState(value);
  const Tag = multiline ? 'textarea' : 'input';
  function commit() { if (draft.trim() !== value) onSave(draft.trim()); else onCancel(); }
  return (
    <div className="flex items-start gap-1.5 w-full">
      <Tag
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => {
          if (!multiline && e.key === 'Enter') { e.preventDefault(); commit(); }
          if (e.key === 'Escape') onCancel();
        }}
        placeholder={placeholder}
        disabled={loading}
        rows={multiline ? rows : undefined}
        className={cn(
          'flex-1 text-xs border border-[#0052CC] rounded px-2 py-1 bg-white dark:bg-gray-800 text-[#172B4D] dark:text-gray-100 focus:outline-none resize-none w-full',
          multiline && 'min-h-[72px]',
        )}
      />
      <div className="flex flex-col gap-1 mt-0.5 flex-shrink-0">
        <button
          onMouseDown={e => { e.preventDefault(); commit(); }}
          disabled={loading}
          className="p-1 rounded bg-[#0052CC] text-white hover:bg-[#0747A6] disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
        </button>
        <button
          onMouseDown={e => { e.preventDefault(); onCancel(); }}
          className="p-1 rounded border border-[#DFE1E6] text-[#5E6C84] hover:border-red-400 hover:text-red-500 transition-colors"
        >
          <X size={10} />
        </button>
      </div>
    </div>
  );
}

interface EditDateProps {
  value: string | undefined;
  onSave: (v: string | null) => void;
  onCancel: () => void;
  loading?: boolean;
}

function EditDate({ value, onSave, onCancel, loading }: EditDateProps) {
  const [draft, setDraft] = useState(value ?? '');
  return (
    <div className="flex items-center gap-1.5">
      <input
        autoFocus
        type="date"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') onSave(draft || null);
          if (e.key === 'Escape') onCancel();
        }}
        disabled={loading}
        className="text-xs border border-[#0052CC] rounded px-2 py-1 bg-white dark:bg-gray-800 text-[#172B4D] dark:text-gray-100 focus:outline-none"
      />
      <button
        onMouseDown={() => onSave(draft || null)}
        disabled={loading}
        className="p-1 rounded bg-[#0052CC] text-white hover:bg-[#0747A6] disabled:opacity-50"
      >
        {loading ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
      </button>
      <button onMouseDown={onCancel} className="p-1 rounded border border-[#DFE1E6] text-[#5E6C84] hover:text-red-500">
        <X size={10} />
      </button>
    </div>
  );
}

// ─── transition picker ────────────────────────────────────────────

function TransitionPicker({ issueKey, currentStatus, transitions, onDone, onCancel, onError }: {
  issueKey: string;
  currentStatus: string;
  transitions: JiraTransition[];
  onDone: () => void;
  onCancel: () => void;
  onError?: () => void;
}) {
  const [applying, setApplying] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onCancel();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onCancel]);

  async function apply(t: JiraTransition) {
    setApplying(t.id);
    try {
      await api.post(`/issue/${issueKey}/transitions`, { transition: { id: t.id } });
      onDone();
    } catch {
      setApplying(null);
      onError?.();
    }
  }

  return (
    <div ref={ref} className="absolute left-0 top-0 bg-white dark:bg-gray-800 border border-[#DFE1E6] dark:border-gray-600 rounded shadow-lg z-50 min-w-[180px] py-1">
      <div className="px-3 py-1.5 text-[10px] text-[#5E6C84] font-semibold uppercase border-b border-[#DFE1E6] dark:border-gray-700">
        From: {currentStatus}
      </div>
      {transitions.length === 0 ? (
        <div className="px-3 py-2 text-xs text-[#5E6C84]">No transitions available</div>
      ) : transitions.map(t => (
        <button
          key={t.id}
          onClick={() => apply(t)}
          disabled={applying !== null}
          className="w-full flex items-center gap-2 text-left text-xs px-3 py-2 hover:bg-[#F4F5F7] dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          {applying === t.id ? <Loader2 size={12} className="animate-spin" /> : <ChevronDown size={12} className="text-[#5E6C84]" />}
          {t.to?.name ?? t.name}
        </button>
      ))}
      <div className="border-t border-[#DFE1E6] dark:border-gray-700 mt-1 pt-1">
        <button onClick={onCancel} className="w-full text-left text-xs px-3 py-1.5 text-[#5E6C84] hover:text-[#172B4D] transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Toast ───────────────────────────────────────────────────────

function PanelToast({ toast }: { toast: { msg: string; type: 'success' | 'error' } | null }) {
  if (!toast) return null;
  return (
    <div className={cn(
      'absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 text-xs px-4 py-2 rounded-full shadow-lg text-white font-medium z-50 pointer-events-none whitespace-nowrap',
      toast.type === 'success' ? 'bg-green-500' : 'bg-red-500',
    )}>
      {toast.type === 'success' ? <Check size={13} /> : <AlertTriangle size={13} />}
      {toast.msg}
    </div>
  );
}

// ─── Wiki Editor ─────────────────────────────────────────────────

interface WikiEditorProps {
  value: string;
  attachments?: JiraAttachment[];
  onSave: (v: string) => void;
  onCancel: () => void;
  loading?: boolean;
}

function ToolBtn({ title, onMD, children }: { title: string; onMD: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={e => { e.preventDefault(); onMD(); }}
      className="px-1.5 py-0.5 min-w-[22px] rounded hover:bg-[#EBECF0] dark:hover:bg-gray-700 text-[#42526E] dark:text-gray-300 hover:text-[#172B4D] dark:hover:text-gray-100 transition-colors text-[11px] font-medium leading-none select-none"
    >
      {children}
    </button>
  );
}

function ToolSep() {
  return <div className="w-px h-4 bg-[#DFE1E6] dark:bg-gray-600 mx-0.5 flex-shrink-0" />;
}

function WikiEditor({ value, attachments, onSave, onCancel, loading }: WikiEditorProps) {
  const [draft, setDraft] = useState(value);
  const [showPreview, setShowPreview] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  function wrapSelection(before: string, after: string) {
    const ta = taRef.current;
    if (!ta) return;
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    const selected = draft.slice(s, e);
    const next = draft.slice(0, s) + before + selected + after + draft.slice(e);
    setDraft(next);
    requestAnimationFrame(() => {
      if (!taRef.current) return;
      taRef.current.focus();
      const newPos = s + before.length + selected.length + after.length;
      taRef.current.setSelectionRange(newPos, newPos);
    });
  }

  function prependLine(prefix: string) {
    const ta = taRef.current;
    if (!ta) return;
    const s = ta.selectionStart;
    const text = draft;
    const lineStart = text.lastIndexOf('\n', s - 1) + 1;
    const next = text.slice(0, lineStart) + prefix + text.slice(lineStart);
    setDraft(next);
    requestAnimationFrame(() => {
      if (!taRef.current) return;
      taRef.current.focus();
      const newPos = s + prefix.length;
      taRef.current.setSelectionRange(newPos, newPos);
    });
  }

  return (
    <div className="border border-[#0052CC] rounded overflow-hidden">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 bg-[#F4F5F7] dark:bg-gray-800 border-b border-[#DFE1E6] dark:border-gray-600">
        <ToolBtn title="Bold (*text*)" onMD={() => wrapSelection('*', '*')}>
          <strong>B</strong>
        </ToolBtn>
        <ToolBtn title="Italic (_text_)" onMD={() => wrapSelection('_', '_')}>
          <em>I</em>
        </ToolBtn>
        <ToolBtn title="Strikethrough (-text-)" onMD={() => wrapSelection('-', '-')}>
          <s>S</s>
        </ToolBtn>
        <ToolBtn title="Underline (+text+)" onMD={() => wrapSelection('+', '+')}>
          <u>U</u>
        </ToolBtn>
        <ToolSep />
        <ToolBtn title="Heading 1 (h1. )" onMD={() => prependLine('h1. ')}>H1</ToolBtn>
        <ToolBtn title="Heading 2 (h2. )" onMD={() => prependLine('h2. ')}>H2</ToolBtn>
        <ToolBtn title="Heading 3 (h3. )" onMD={() => prependLine('h3. ')}>H3</ToolBtn>
        <ToolSep />
        <ToolBtn title="Bullet list (* item)" onMD={() => prependLine('* ')}>•</ToolBtn>
        <ToolBtn title="Numbered list (# item)" onMD={() => prependLine('# ')}>1.</ToolBtn>
        <ToolSep />
        <ToolBtn title="Inline code ({{text}})" onMD={() => wrapSelection('{{', '}}')}>{`{}`}</ToolBtn>
        <ToolBtn title="Code block ({code}...{code})" onMD={() => wrapSelection('{code}\n', '\n{code}')}>≺/≻</ToolBtn>
        <ToolBtn title="Blockquote (bq. )" onMD={() => prependLine('bq. ')}>❝</ToolBtn>
        <ToolSep />
        <ToolBtn title="Link [text|url]" onMD={() => wrapSelection('[', '|url]')}>🔗</ToolBtn>
        <ToolBtn title="Color {color:red}text{color}" onMD={() => wrapSelection('{color:red}', '{color}')}>A</ToolBtn>
        <div className="flex-1" />
        <button
          type="button"
          onMouseDown={e => { e.preventDefault(); setShowPreview(p => !p); }}
          className={cn(
            'flex items-center gap-1 px-2 py-0.5 rounded text-[11px] border transition-colors',
            showPreview
              ? 'bg-[#0052CC] text-white border-[#0052CC]'
              : 'border-[#DFE1E6] dark:border-gray-600 text-[#5E6C84] hover:bg-[#EBECF0] dark:hover:bg-gray-700',
          )}
        >
          {showPreview ? 'Edit' : 'Preview'}
        </button>
      </div>

      {/* ── Content area ── */}
      {showPreview ? (
        <div className="px-4 py-3 min-h-[220px] bg-white dark:bg-gray-900">
          {draft.trim()
            ? <WikiRenderer content={draft} attachments={attachments} />
            : <p className="text-[#5E6C84] dark:text-gray-500 text-sm italic">No content to preview.</p>
          }
        </div>
      ) : (
        <textarea
          ref={taRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') onCancel(); }}
          placeholder="Enter content using Jira Wiki Markup…"
          disabled={loading}
          rows={10}
          className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-900 text-[#172B4D] dark:text-gray-200 font-mono focus:outline-none resize-y border-0 block leading-relaxed"
          style={{ minHeight: 220 }}
        />
      )}

      {/* ── Footer ── */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[#F4F5F7] dark:bg-gray-800 border-t border-[#DFE1E6] dark:border-gray-600">
        <button
          type="button"
          onClick={() => onSave(draft)}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1 rounded bg-[#0052CC] text-white text-xs font-medium hover:bg-[#0747A6] disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="px-3 py-1 rounded border border-[#DFE1E6] dark:border-gray-600 text-[#5E6C84] text-xs hover:text-red-500 hover:border-red-400 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <span className="text-[10px] text-[#5E6C84] dark:text-gray-500 ml-auto">Jira Wiki Markup</span>
      </div>
    </div>
  );
}

// ─── Changelog / History section ──────────────────────────────────

interface ChangelogHistory {
  id: string;
  author: { displayName: string; avatarUrls?: { '24x24': string } };
  created: string;
  items: Array<{
    field: string;
    fieldtype: string;
    fromString: string | null;
    toString: string | null;
  }>; 
}

function HistoryAvatar({ author }: { author: ChangelogHistory['author'] }) {
  const avatarSrc = useProxiedAvatarUrl(author.avatarUrls?.['24x24']);

  return avatarSrc ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={avatarSrc}
      alt={author.displayName}
      className="w-6 h-6 rounded-full flex-shrink-0 mt-0.5"
      width={24}
      height={24}
    />
  ) : (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#0052CC] text-white text-[9px] font-bold flex-shrink-0 mt-0.5">
      {author.displayName.charAt(0)}
    </span>
  );
}

function HistorySection({
  histories,
  loading,
}: {
  histories: ChangelogHistory[] | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={22} className="animate-spin text-[#0052CC]" />
      </div>
    );
  }
  if (!histories || histories.length === 0) {
    return (
      <div className="text-center py-10">
        <History size={28} className="text-[#C1C7D0] dark:text-gray-600 mx-auto mb-2" />
        <p className="text-xs text-[#5E6C84] dark:text-gray-500">No history recorded</p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {histories.map(h => (
        <div key={h.id} className="flex gap-2.5">
          <HistoryAvatar author={h.author} />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 mb-1.5">
              <span className="text-xs font-semibold text-[#172B4D] dark:text-gray-100">{h.author.displayName}</span>
              <span className="text-[10px] text-[#5E6C84] dark:text-gray-500">{fmtDateTime(h.created)}</span>
            </div>
            <div className="space-y-1.5">
              {h.items.map((item, i) => (
                <div key={i} className="text-xs flex items-center gap-1.5 flex-wrap">
                  <span className="font-medium text-[#172B4D] dark:text-gray-200 capitalize">{item.field}</span>
                  {item.fromString && (
                    <>
                      <span className="text-[#5E6C84] dark:text-gray-500">from</span>
                      <span className="bg-[#FFEBE5] dark:bg-red-900/20 text-red-700 dark:text-red-400 px-1.5 py-0.5 rounded text-[10px] max-w-[160px] truncate">
                        {item.fromString}
                      </span>
                    </>
                  )}
                  {item.toString && (
                    <>
                      <span className="text-[#5E6C84] dark:text-gray-500">→</span>
                      <span className="bg-[#E3FCEF] dark:bg-green-900/20 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded text-[10px] max-w-[160px] truncate">
                        {item.toString}
                      </span>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Tab type ─────────────────────────────────────────────────────

type PanelTab = 'description' | 'comments' | 'attachments' | 'history';

// ─── Main panel ───────────────────────────────────────────────────

interface IssueDetailPanelProps {
  issueKey: string | null;
  onClose: () => void;
  onUpdated: () => void;
}

type EditingField =
  | 'summary' | 'description' | 'status' | 'priority' | 'assignee'
  | 'duedate' | 'labels' | 'timeEstimate' | null;

const FIELDS_TO_FETCH = [
  'summary', 'description', 'status', 'priority', 'issuetype',
  'assignee', 'reporter', 'project', 'created', 'updated',
  'duedate', 'labels', 'comment', 'timetracking', 'sprint', 'customfield_10020',
  'fixVersions', 'components', 'subtasks', 'parent', 'attachment',
].join(',');

export function IssueDetailPanel({ issueKey, onClose, onUpdated }: IssueDetailPanelProps) {
  const [issue, setIssue]               = useState<JiraIssue | null>(null);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [editingField, setEditingField] = useState<EditingField>(null);
  const [fieldSaving, setFieldSaving]   = useState(false);
  const [transitions, setTransitions]   = useState<JiraTransition[]>([]);
  const [transitionsLoading, setTransLoading] = useState(false);
  const [showTransitions, setShowTransitions] = useState(false);
  const [activeTab, setActiveTab]       = useState<PanelTab>('description');
  const [changelog, setChangelog]       = useState<ChangelogHistory[] | null>(null);
  const [changelogLoading, setChangelogLoading] = useState(false);
  const [toast, setToastState]          = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToastState({ msg, type });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastState(null), 3000);
  }

  // Reset state when issueKey changes
  useEffect(() => {
    setIssue(null);
    setError(null);
    setEditingField(null);
    setShowTransitions(false);
    setActiveTab('description');
    setChangelog(null);
  }, [issueKey]);

  // Fetch issue
  const fetchIssue = useCallback(async () => {
    if (!issueKey) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<JiraIssue>(`/issue/${issueKey}?fields=${FIELDS_TO_FETCH}`);
      setIssue(res.data);
    } catch {
      setError('Failed to load issue');
    } finally {
      setLoading(false);
    }
  }, [issueKey]);

  useEffect(() => { fetchIssue(); }, [fetchIssue]);

  // Fetch transitions when status picker opens
  useEffect(() => {
    if (!issueKey || !showTransitions) return;
    setTransLoading(true);
    api.get<{ transitions: JiraTransition[] }>(`/issue/${issueKey}/transitions`)
      .then(r => setTransitions(r.data.transitions ?? []))
      .catch(() => setTransitions([]))
      .finally(() => setTransLoading(false));
  }, [issueKey, showTransitions]);

  // Lazy-load changelog when History tab is first opened
  useEffect(() => {
    if (activeTab !== 'history' || !issueKey || changelog !== null) return;
    setChangelogLoading(true);
    api.get<{ changelog?: { histories: ChangelogHistory[] } }>(`/issue/${issueKey}?expand=changelog&fields=summary`)
      .then(r => {
        const histories = r.data.changelog?.histories ?? [];
        setChangelog([...histories].reverse()); // newest first
      })
      .catch(() => setChangelog([]))
      .finally(() => setChangelogLoading(false));
  }, [activeTab, issueKey, changelog]);

  // Keyboard close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (editingField) { setEditingField(null); return; }
        if (showTransitions) { setShowTransitions(false); return; }
        onClose();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [editingField, showTransitions, onClose]);

  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);

  // Generic field save
  async function saveField(fields: Record<string, unknown>, successMsg = 'Saved') {
    if (!issueKey) return;
    setFieldSaving(true);
    try {
      await api.put(`/issue/${issueKey}`, { fields });
      await fetchIssue();
      setEditingField(null);
      showToast(successMsg);
      onUpdated();
    } catch {
      showToast('Save failed — try again', 'error');
    } finally {
      setFieldSaving(false);
    }
  }

  // Sprint name resolver
  function getSprintName(): string | null {
    if (!issue) return null;
    const f = issue.fields;
    const raw = f.sprint ?? f.customfield_10020;
    if (!raw) return null;
    if (Array.isArray(raw)) {
      const active = raw.find(s => s.state === 'active') ?? raw[raw.length - 1];
      return active?.name ?? null;
    }
    return raw.name ?? null;
  }

  if (!issueKey) return null;

  const f = issue?.fields;
  const attachments = f?.attachment ?? [];
  const comments = f?.comment?.comments ?? [];

  // Tab config
  const tabs: { key: PanelTab; icon: React.ReactNode; label: string; badge?: number }[] = [
    { key: 'description', icon: <FileText size={12} />, label: 'Description' },
    { key: 'comments',    icon: <MessageSquare size={12} />, label: 'Comments', badge: comments.length || undefined },
    { key: 'attachments', icon: <Paperclip size={12} />, label: 'Attachments', badge: attachments.length || undefined },
    { key: 'history',     icon: <History size={12} />, label: 'History' },
  ];

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40" onClick={onClose} />

      {/* Panel */}
      <div
        className="fixed right-0 top-0 h-full w-[1100px] max-w-[95vw] bg-white dark:bg-gray-900 shadow-2xl z-50 flex flex-col"
        style={{ animation: 'slideInRight 0.2s ease-out' }}
      >
        {/* ── Header ── */}
        <div className="flex items-center gap-2.5 px-5 py-3 border-b border-[#DFE1E6] dark:border-gray-700 flex-shrink-0 bg-[#F4F5F7] dark:bg-gray-800">
          {issue && f ? (
            <>
              {f.issuetype.iconUrl && (
                <Image src={f.issuetype.iconUrl} alt={f.issuetype.name} width={16} height={16} unoptimized className="flex-shrink-0" />
              )}
              <a
                href={`/issues/${issue.key}`}
                className="text-xs font-mono font-semibold text-[#0052CC] dark:text-blue-400 bg-[#E6F0FF] dark:bg-blue-900/30 px-2 py-0.5 rounded hover:underline flex-shrink-0"
              >
                {issue.key}
              </a>
              <a href={`/issues/${issue.key}`} className="text-[#5E6C84] hover:text-[#0052CC] transition-colors flex-shrink-0" title="Open full issue page">
                <ExternalLink size={13} />
              </a>
              <span className="text-xs text-[#5E6C84] dark:text-gray-400 flex-shrink-0">{f.issuetype.name}</span>
              {/* Status — clickable */}
              <div className="relative flex-shrink-0">
                {showTransitions ? (
                  transitionsLoading ? (
                    <div className="flex items-center gap-1 text-xs text-[#5E6C84]"><Loader2 size={11} className="animate-spin" /> Loading…</div>
                  ) : (
                    <TransitionPicker
                      issueKey={issue.key}
                      currentStatus={f.status.name}
                      transitions={transitions}
                      onDone={() => { setShowTransitions(false); fetchIssue(); onUpdated(); showToast('Status updated'); }}
                      onCancel={() => setShowTransitions(false)}
                      onError={() => showToast('Failed to transition', 'error')}
                    />
                  )
                ) : (
                  <button
                    onClick={() => setShowTransitions(true)}
                    className="group flex items-center gap-1 hover:opacity-80 transition-opacity"
                    title="Change status"
                  >
                    <StatusBadge status={f.status} />
                    <ChevronDown size={11} className="text-[#5E6C84] opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                )}
              </div>
              <PriorityIcon priority={f.priority} />
            </>
          ) : (
            <span className="text-xs text-[#5E6C84]">{issueKey}</span>
          )}
          <button
            onClick={onClose}
            className="ml-auto text-[#5E6C84] hover:text-[#172B4D] dark:hover:text-gray-200 transition-colors flex-shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-hidden flex min-h-0">
          {loading && (
            <div className="flex items-center justify-center flex-1">
              <Loader2 size={28} className="animate-spin text-[#0052CC]" />
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center flex-1 gap-3 text-red-500">
              <AlertTriangle size={24} />
              <p className="text-sm">{error}</p>
              <button onClick={fetchIssue} className="text-xs text-[#0052CC] hover:underline">Retry</button>
            </div>
          )}

          {!loading && !error && issue && f && (
            <div className="flex flex-1 min-h-0 min-w-0">

              {/* ── Left sidebar: metadata ── */}
              <div className="w-[300px] flex-shrink-0 border-r border-[#DFE1E6] dark:border-gray-700 overflow-y-auto">
                <div className="px-4 py-3">
                  <p className="text-[10px] font-semibold text-[#5E6C84] dark:text-gray-500 uppercase tracking-wider mb-2">Details</p>

                  {/* Status */}
                  <SideField icon={<Activity size={12} />} label="Status">
                    <div className="relative">
                      {!showTransitions && (
                        <button
                          onClick={() => setShowTransitions(true)}
                          className="group flex items-center gap-1 hover:opacity-80 transition-opacity"
                          title="Change status"
                        >
                          <StatusBadge status={f.status} />
                          <ChevronDown size={10} className="text-[#5E6C84] opacity-0 group-hover:opacity-60 transition-opacity" />
                        </button>
                      )}
                    </div>
                  </SideField>

                  {/* Priority */}
                  <SideField icon={<Activity size={12} />} label="Priority">
                    {editingField === 'priority' ? (
                      <EditSelect
                        value={f.priority?.name ?? 'Medium'}
                        options={PRIORITY_OPTIONS.map(p => ({ value: p, label: p }))}
                        onSave={v => saveField({ priority: { name: v } }, `Priority → ${v}`)}
                        onCancel={() => setEditingField(null)}
                        loading={fieldSaving}
                      />
                    ) : (
                      <button
                        onClick={() => setEditingField('priority')}
                        className="group flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                      >
                        <PriorityIcon priority={f.priority} />
                        <span className="text-xs text-[#5E6C84] dark:text-gray-400">{f.priority?.name ?? '—'}</span>
                        <Edit2 size={10} className="opacity-0 group-hover:opacity-60 text-[#5E6C84] transition-opacity flex-shrink-0" />
                      </button>
                    )}
                  </SideField>

                  {/* Assignee */}
                  <SideField icon={<User size={12} />} label="Assignee">
                    {editingField === 'assignee' ? (
                      <EditText
                        value={f.assignee?.name ?? ''}
                        onSave={v => saveField({ assignee: v ? { name: v } : null }, 'Assignee updated')}
                        onCancel={() => setEditingField(null)}
                        loading={fieldSaving}
                        placeholder="Username (blank=unassign)"
                      />
                    ) : (
                      <button
                        onClick={() => setEditingField('assignee')}
                        className="group flex items-center gap-1.5 text-left hover:opacity-80 transition-opacity w-full"
                      >
                        {f.assignee ? (
                          <>
                            <Avatar user={f.assignee} size={18} />
                            <span className="text-xs text-[#172B4D] dark:text-gray-200 truncate">{f.assignee.displayName}</span>
                          </>
                        ) : (
                          <span className="text-xs text-[#5E6C84] dark:text-gray-500 italic">Unassigned</span>
                        )}
                        <Edit2 size={10} className="opacity-0 group-hover:opacity-60 text-[#5E6C84] transition-opacity flex-shrink-0 ml-auto" />
                      </button>
                    )}
                  </SideField>

                  {/* Reporter */}
                  <SideField icon={<User size={12} />} label="Reporter">
                    <div className="flex items-center gap-1.5">
                      <Avatar user={f.reporter} size={18} />
                      <span className="text-xs text-[#172B4D] dark:text-gray-200 truncate">{f.reporter.displayName}</span>
                    </div>
                  </SideField>

                  {/* Due date */}
                  <SideField icon={<Calendar size={12} />} label="Due date">
                    {editingField === 'duedate' ? (
                      <EditDate
                        value={f.duedate}
                        onSave={v => saveField({ duedate: v }, v ? `Due date → ${fmtDate(v)}` : 'Due date cleared')}
                        onCancel={() => setEditingField(null)}
                        loading={fieldSaving}
                      />
                    ) : (
                      <button
                        onClick={() => setEditingField('duedate')}
                        className="group flex items-center gap-1.5 text-left hover:opacity-80 transition-opacity"
                      >
                        <span className={cn(
                          'text-xs',
                          f.duedate
                            ? isOverdue(f.duedate)
                              ? 'text-red-500 dark:text-red-400 font-medium'
                              : 'text-[#172B4D] dark:text-gray-200'
                            : 'text-[#5E6C84] dark:text-gray-500 italic',
                        )}>
                          {f.duedate ? fmtDate(f.duedate) : 'None'}
                        </span>
                        <Edit2 size={10} className="opacity-0 group-hover:opacity-60 text-[#5E6C84] transition-opacity flex-shrink-0" />
                      </button>
                    )}
                  </SideField>

                  {/* Labels */}
                  <SideField icon={<Tag size={12} />} label="Labels">
                    {editingField === 'labels' ? (
                      <EditText
                        value={(f.labels ?? []).join(', ')}
                        onSave={v => saveField({ labels: v.split(',').map(s => s.trim()).filter(Boolean) }, 'Labels updated')}
                        onCancel={() => setEditingField(null)}
                        loading={fieldSaving}
                        placeholder="label1, label2"
                      />
                    ) : (
                      <button
                        onClick={() => setEditingField('labels')}
                        className="group flex items-start gap-1 flex-wrap text-left hover:opacity-80 transition-opacity w-full"
                      >
                        {(f.labels ?? []).length > 0
                          ? f.labels.map(l => (
                              <span key={l} className="text-[10px] px-1.5 py-0.5 bg-[#DFE1E6] dark:bg-gray-600 text-[#42526E] dark:text-gray-300 rounded">
                                {l}
                              </span>
                            ))
                          : <span className="text-xs text-[#5E6C84] dark:text-gray-500 italic">None</span>
                        }
                        <Edit2 size={10} className="opacity-0 group-hover:opacity-60 text-[#5E6C84] transition-opacity flex-shrink-0 mt-0.5" />
                      </button>
                    )}
                  </SideField>

                  {/* Sprint */}
                  <SideField icon={<GitBranch size={12} />} label="Sprint">
                    <span className="text-xs text-[#172B4D] dark:text-gray-200">
                      {getSprintName() ?? <span className="italic text-[#5E6C84]">None</span>}
                    </span>
                  </SideField>

                  {/* Components */}
                  {(f.components?.length ?? 0) > 0 && (
                    <SideField icon={<Layers size={12} />} label="Components">
                      <div className="flex flex-wrap gap-1">
                        {f.components!.map(c => (
                          <span key={c.id} className="text-[10px] px-1.5 py-0.5 bg-[#DFE1E6] dark:bg-gray-600 text-[#42526E] dark:text-gray-300 rounded">
                            {c.name}
                          </span>
                        ))}
                      </div>
                    </SideField>
                  )}

                  {/* Fix Versions */}
                  {(f.fixVersions?.length ?? 0) > 0 && (
                    <SideField icon={<Tag size={12} />} label="Fix versions">
                      <div className="flex flex-wrap gap-1">
                        {f.fixVersions!.map(v => (
                          <span key={v.id} className={cn(
                            'text-[10px] px-1.5 py-0.5 rounded',
                            v.released
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                              : 'bg-[#DFE1E6] dark:bg-gray-600 text-[#42526E] dark:text-gray-300',
                          )}>
                            {v.name}
                          </span>
                        ))}
                      </div>
                    </SideField>
                  )}

                  {/* Parent */}
                  {f.parent && (
                    <SideField icon={<Link2 size={12} />} label="Parent">
                      <a
                        href={`/issues/${f.parent.key}`}
                        className="text-xs text-[#0052CC] dark:text-blue-400 hover:underline truncate block"
                        title={f.parent.fields.summary}
                      >
                        {f.parent.key}
                        {f.parent.fields.summary && (
                          <span className="text-[#5E6C84] dark:text-gray-500 ml-1 text-[10px]">— {f.parent.fields.summary}</span>
                        )}
                      </a>
                    </SideField>
                  )}

                  {/* Time tracking */}
                  {f.timetracking && (
                    <SideField icon={<Clock size={12} />} label="Time">
                      <div className="space-y-0.5">
                        {f.timetracking.originalEstimate && (
                          <div className="text-xs text-[#5E6C84] dark:text-gray-400">
                            Est: <span className="text-[#172B4D] dark:text-gray-200">{f.timetracking.originalEstimate}</span>
                          </div>
                        )}
                        {f.timetracking.timeSpent && (
                          <div className="text-xs text-[#5E6C84] dark:text-gray-400">
                            Logged: <span className="text-[#172B4D] dark:text-gray-200">{f.timetracking.timeSpent}</span>
                          </div>
                        )}
                        {f.timetracking.remainingEstimate && (
                          <div className="text-xs text-[#5E6C84] dark:text-gray-400">
                            Remaining: <span className="text-[#172B4D] dark:text-gray-200">{f.timetracking.remainingEstimate}</span>
                          </div>
                        )}
                      </div>
                    </SideField>
                  )}

                  <SideField icon={<Calendar size={12} />} label="Created">
                    <span className="text-xs text-[#5E6C84] dark:text-gray-400">{fmtDateTime(f.created)}</span>
                  </SideField>
                  <SideField icon={<Calendar size={12} />} label="Updated">
                    <span className="text-xs text-[#5E6C84] dark:text-gray-400">{fmtDateTime(f.updated)}</span>
                  </SideField>
                </div>
              </div>

              {/* ── Right pane: summary + tabs ── */}
              <div className="flex-1 min-w-0 flex flex-col min-h-0">
                {/* Summary */}
                <div className="px-5 pt-4 pb-3 border-b border-[#DFE1E6] dark:border-gray-700 flex-shrink-0">
                  {editingField === 'summary' ? (
                    <EditText
                      value={f.summary}
                      onSave={v => saveField({ summary: v }, 'Summary updated')}
                      onCancel={() => setEditingField(null)}
                      loading={fieldSaving}
                      placeholder="Issue summary"
                    />
                  ) : (
                    <div className="group flex items-start gap-2">
                      <h2 className="text-base font-semibold text-[#172B4D] dark:text-gray-100 leading-snug flex-1">
                        {f.summary}
                      </h2>
                      <button
                        onClick={() => setEditingField('summary')}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[#F4F5F7] dark:hover:bg-gray-700 text-[#5E6C84] flex-shrink-0 transition-all"
                        title="Edit summary"
                      >
                        <Edit2 size={12} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Tabs */}
                <div className="flex items-center border-b border-[#DFE1E6] dark:border-gray-700 px-5 flex-shrink-0 bg-white dark:bg-gray-900">
                  {tabs.map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors',
                        activeTab === tab.key
                          ? 'border-[#0052CC] text-[#0052CC] dark:text-blue-400 dark:border-blue-400'
                          : 'border-transparent text-[#5E6C84] dark:text-gray-400 hover:text-[#172B4D] dark:hover:text-gray-200 hover:border-[#DFE1E6]',
                      )}
                    >
                      {tab.icon}
                      {tab.label}
                      {tab.badge !== undefined && tab.badge > 0 && (
                        <span className={cn(
                          'text-[9px] px-1.5 py-0.5 rounded-full font-semibold',
                          activeTab === tab.key
                            ? 'bg-[#0052CC] text-white dark:bg-blue-600'
                            : 'bg-[#DFE1E6] dark:bg-gray-600 text-[#5E6C84] dark:text-gray-400',
                        )}>
                          {tab.badge}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Tab content */}
                <div className="flex-1 overflow-y-auto">
                  <div className="px-5 py-4">

                    {/* ── Description tab ── */}
                    {activeTab === 'description' && (
                      <div className="space-y-4">
                        {editingField === 'description' ? (
                          <WikiEditor
                            value={f.description ?? ''}
                            attachments={attachments}
                            onSave={v => saveField({ description: v || null }, 'Description updated')}
                            onCancel={() => setEditingField(null)}
                            loading={fieldSaving}
                          />
                        ) : (
                          <div
                            onClick={() => setEditingField('description')}
                            className="group cursor-pointer relative rounded border border-transparent hover:border-[#DFE1E6] dark:hover:border-gray-700 transition-colors p-3 -mx-3"
                          >
                            {f.description ? (
                              <WikiRenderer content={f.description} attachments={attachments} />
                            ) : (
                              <p className="text-xs text-[#5E6C84] dark:text-gray-500 italic">
                                Click to add description…
                              </p>
                            )}
                            <button
                              onClick={e => { e.stopPropagation(); setEditingField('description'); }}
                              className="absolute top-2 right-2 opacity-0 group-hover:opacity-60 p-1 rounded hover:bg-[#F4F5F7] dark:hover:bg-gray-700 text-[#5E6C84] transition-all"
                              title="Edit description"
                            >
                              <Edit2 size={12} />
                            </button>
                          </div>
                        )}

                        {/* Sub-tasks inline in description tab */}
                        {(f.subtasks?.length ?? 0) > 0 && (
                          <div>
                            <h3 className="text-[10px] font-semibold text-[#5E6C84] dark:text-gray-400 uppercase tracking-wider mb-2">
                              Sub-tasks ({f.subtasks!.length})
                            </h3>
                            <div className="divide-y divide-[#DFE1E6] dark:divide-gray-700 border border-[#DFE1E6] dark:border-gray-700 rounded">
                              {f.subtasks!.map(sub => (
                                <div key={sub.id} className="flex items-center gap-2 px-3 py-2 hover:bg-[#F4F5F7] dark:hover:bg-gray-800 transition-colors">
                                  <StatusBadge status={sub.fields.status} />
                                  <a
                                    href={`/issues/${sub.key}`}
                                    className="text-xs text-[#0052CC] dark:text-blue-400 hover:underline font-medium flex-shrink-0"
                                  >
                                    {sub.key}
                                  </a>
                                  <span className="text-xs text-[#172B4D] dark:text-gray-200 truncate flex-1">
                                    {sub.fields.summary}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── Comments tab ── */}
                    {activeTab === 'comments' && (
                      <CommentSection
                        issueKey={issue.key}
                        issueSummary={f.summary}
                        comments={comments}
                        onCommentAdded={fetchIssue}
                      />
                    )}

                    {/* ── Attachments tab ── */}
                    {activeTab === 'attachments' && (
                      attachments.length > 0 ? (
                        <AttachmentGallery attachments={attachments} />
                      ) : (
                        <div className="text-center py-10">
                          <Paperclip size={28} className="text-[#C1C7D0] dark:text-gray-600 mx-auto mb-2" />
                          <p className="text-xs text-[#5E6C84] dark:text-gray-500">No attachments</p>
                        </div>
                      )
                    )}

                    {/* ── History tab ── */}
                    {activeTab === 'history' && (
                      <HistorySection histories={changelog} loading={changelogLoading} />
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Toast ── */}
        <PanelToast toast={toast} />
      </div>

      {/* Slide-in animation */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}
