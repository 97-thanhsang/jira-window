'use client';
import { useState, useEffect, useCallback } from 'react';
import useSWR from 'swr';
import { X, Trash2, AlertTriangle, Loader2, Minus, Plus, Clock, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { api } from '@/lib/api';
import type { WorklogEntry, JiraIssue } from '@/types/jira';
import { PriorityIcon } from '@/components/shared/priority-icon';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const QUICK_TIMES = [
  { label: '15m', seconds: 15 * 60 },
  { label: '30m', seconds: 30 * 60 },
  { label: '1h', seconds: 3600 },
  { label: '2h', seconds: 7200 },
  { label: '4h', seconds: 14400 },
  { label: '8h', seconds: 28800 },
];

const TYPE_COLORS: Record<string, string> = {
  Story: '#36B37E', 'Sub-task': '#0052CC', Bug: '#DE350B', Task: '#4BADE8',
  Epic: '#904EE2', Support: '#FF8B00', Enhancement: '#008DA6',
};

interface WorklogDrawerProps {
  entry: WorklogEntry | null;
  onClose: () => void;
  onSave: (changes: { timeSpentSeconds: number; comment: string; started: string }) => void;
  onDelete: () => void;
  issueDailyHours?: number;
}

export function WorklogDrawer({ entry, onClose, onSave, onDelete, issueDailyHours = 0 }: WorklogDrawerProps) {
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [comment, setComment] = useState('');
  const [startedDate, setStartedDate] = useState('');
  const [startedTime, setStartedTime] = useState('');
  const [dirty, setDirty] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [workHoursWarning, setWorkHoursWarning] = useState<string | null>(null);

  const { data: issue } = useSWR<JiraIssue>(
    entry ? `/issue/${entry.issueKey}` : null,
    (url: string) => api.get<JiraIssue>(url).then(r => r.data),
    { revalidateOnFocus: false },
  );

  useEffect(() => {
    if (entry) {
      const h = Math.floor(entry.timeSpentSeconds / 3600);
      const m = Math.floor((entry.timeSpentSeconds % 3600) / 60);
      setHours(h); setMinutes(m);
      setComment(entry.comment ?? '');
      const started = new Date(entry.started);
      setStartedDate(format(started, 'yyyy-MM-dd'));
      setStartedTime(format(started, 'HH:mm'));
      setDirty(false);
      setConfirmDelete(false);
    }
  }, [entry]);

  useEffect(() => {
    if (!startedTime) return;
    const [h, m] = startedTime.split(':').map(Number);
    const totalMinutes = h * 60 + m;
    if (totalMinutes < 480 || (totalMinutes >= 720 && totalMinutes < 810) || totalMinutes > 1050) {
      setWorkHoursWarning('Outside working hours (8:00-12:00, 13:30-17:30)');
    } else {
      setWorkHoursWarning(null);
    }
  }, [startedTime]);

  const adjustMinutes = useCallback((delta: number) => {
    let total = hours * 60 + minutes + delta;
    if (total < 0) total = 0;
    const newH = Math.floor(total / 60);
    const newM = total % 60;
    setHours(newH);
    setMinutes(newM);
    setDirty(true);
  }, [hours, minutes]);

  const applyQuickTime = useCallback((seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    setHours(h);
    setMinutes(m);
    setDirty(true);
  }, []);

  if (!entry) return null;

  const totalSeconds = hours * 3600 + minutes * 60;
  const capExceeded = issueDailyHours > 0 && (totalSeconds + issueDailyHours * 3600 > 8 * 3600);

  const handleSave = () => {
    if (totalSeconds <= 0) return;
    const started = `${startedDate}T${startedTime}:00.000+0700`;
    onSave({ timeSpentSeconds: totalSeconds, comment, started });
    setDirty(false);
    onClose();
  };

  const typeColor = TYPE_COLORS[entry.issueTypeName] ?? '#5E6C84';

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-80 bg-white dark:bg-gray-800 border-l border-[#DFE1E6] dark:border-gray-700 shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[#DFE1E6] dark:border-gray-700 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              {entry.issueTypeIconUrl ? (
                <img src={entry.issueTypeIconUrl} alt="" className="w-4 h-4 flex-shrink-0" />
              ) : (
                <span className="text-[9px] font-bold px-1 py-0.5 rounded-sm text-white flex-shrink-0" style={{ backgroundColor: typeColor }}>
                  {entry.issueTypeName.slice(0, 3).toUpperCase()}
                </span>
              )}
              <a href={`/issues/${entry.issueKey}`} className="text-sm font-semibold text-[#0052CC] dark:text-blue-400 hover:underline truncate">
                {entry.issueKey}
              </a>
            </div>
            <button onClick={onClose} className="flex-shrink-0 hover:text-[#0052CC] p-0.5">
              <X size={16} className="text-[#5E6C84] dark:text-gray-400" />
            </button>
          </div>
          <p className="text-xs text-[#172B4D] dark:text-gray-200 leading-snug line-clamp-2">
            {entry.issueSummary}
          </p>

          {/* Quick info badges */}
          {issue && (
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium',
                issue.fields.status.statusCategory.key === 'done' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                issue.fields.status.statusCategory.key === 'indeterminate' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
              )}>
                {issue.fields.status.name}
              </span>
              <div className="flex items-center gap-1">
                <PriorityIcon priority={issue.fields.priority} />
                <span className="text-[10px] text-[#5E6C84] dark:text-gray-400">{issue.fields.priority?.name || 'None'}</span>
              </div>
              <span className="text-[10px] text-[#5E6C84] dark:text-gray-400">
                {issue.fields.assignee?.displayName || 'Unassigned'}
              </span>
            </div>
          )}
          {!issue && (
            <div className="flex items-center gap-1.5 text-[#5E6C84] py-1">
              <Loader2 size={12} className="animate-spin" />
              <span className="text-[10px]">Loading details...</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Time Spent */}
          <div>
            <label className="text-[10px] font-semibold text-[#5E6C84] dark:text-gray-400 uppercase tracking-wider block mb-2">
              <Clock size={11} className="inline mr-1" /> Time Spent
            </label>
            <div className="flex items-center gap-1.5 mb-2">
              <button onClick={() => adjustMinutes(-15)} className="w-6 h-6 rounded border border-[#DFE1E6] dark:border-gray-600 flex items-center justify-center hover:bg-[#F4F5F7] dark:hover:bg-gray-700 text-[#5E6C84] transition-colors">
                <Minus size={10} />
              </button>
              <div className="flex items-center gap-1 bg-[#F4F5F7] dark:bg-gray-700/50 rounded px-2 py-1">
                <input type="number" min={0} max={24}
                  className="w-10 text-xs text-center bg-transparent text-[#172B4D] dark:text-gray-100 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  value={hours} onChange={(e) => { setHours(Number(e.target.value)); setDirty(true); }} />
                <span className="text-xs text-[#5E6C84] font-medium">h</span>
                <input type="number" min={0} max={59}
                  className="w-8 text-xs text-center bg-transparent text-[#172B4D] dark:text-gray-100 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  value={minutes} onChange={(e) => { setMinutes(Number(e.target.value)); setDirty(true); }} />
                <span className="text-xs text-[#5E6C84] font-medium">m</span>
              </div>
              <button onClick={() => adjustMinutes(15)} className="w-6 h-6 rounded border border-[#DFE1E6] dark:border-gray-600 flex items-center justify-center hover:bg-[#F4F5F7] dark:hover:bg-gray-700 text-[#5E6C84] transition-colors">
                <Plus size={10} />
              </button>
            </div>
            {/* Quick time presets */}
            <div className="flex flex-wrap gap-1">
              {QUICK_TIMES.map(qt => (
                <button key={qt.label}
                  onClick={() => applyQuickTime(qt.seconds)}
                  className="text-[10px] px-2 py-0.5 rounded border border-[#DFE1E6] dark:border-gray-600 text-[#5E6C84] dark:text-gray-400 hover:bg-[#F4F5F7] dark:hover:bg-gray-700 hover:border-[#0052CC] dark:hover:border-blue-500 transition-colors"
                >
                  {qt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Started */}
          <div>
            <label className="text-[10px] font-semibold text-[#5E6C84] dark:text-gray-400 uppercase tracking-wider block mb-2">
              <Calendar size={11} className="inline mr-1" /> Started
            </label>
            <div className="flex items-center gap-1.5">
              <input type="date"
                className="flex-1 text-xs border border-[#DFE1E6] dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-800 text-[#172B4D] dark:text-gray-100 focus:outline-none focus:border-[#0052CC]"
                value={startedDate} onChange={(e) => { setStartedDate(e.target.value); setDirty(true); }} />
              <input type="time"
                className="text-xs border border-[#DFE1E6] dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-800 text-[#172B4D] dark:text-gray-100 focus:outline-none focus:border-[#0052CC]"
                value={startedTime} onChange={(e) => { setStartedTime(e.target.value); setDirty(true); }} />
            </div>
            {workHoursWarning && (
              <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1.5 flex items-center gap-1">
                <AlertTriangle size={10} /> {workHoursWarning}
              </p>
            )}
            {capExceeded && (
              <p className="text-[10px] text-red-500 dark:text-red-400 mt-1.5 flex items-center gap-1">
                <AlertTriangle size={10} />
                Issue exceeds 8h/day cap ({((totalSeconds + issueDailyHours * 3600) / 3600).toFixed(1)}h)
              </p>
            )}
          </div>

          {/* Comment */}
          <div>
            <label className="text-[10px] font-semibold text-[#5E6C84] dark:text-gray-400 uppercase tracking-wider block mb-2">
              Comment
            </label>
            <textarea
              className="w-full text-xs border border-[#DFE1E6] dark:border-gray-600 rounded px-2.5 py-2 bg-white dark:bg-gray-800 text-[#172B4D] dark:text-gray-100 focus:outline-none focus:border-[#0052CC] resize-none h-24 placeholder:text-[#8993A4]"
              value={comment} onChange={(e) => { setComment(e.target.value); setDirty(true); }}
              placeholder="What did you work on?" />
          </div>

          {/* Labels */}
          {issue?.fields.labels && issue.fields.labels.length > 0 && (
            <div>
              <label className="text-[10px] font-semibold text-[#5E6C84] dark:text-gray-400 uppercase tracking-wider block mb-2">Labels</label>
              <div className="flex flex-wrap gap-1">
                {issue.fields.labels.map((l: string) => (
                  <span key={l} className="text-[10px] px-1.5 py-0.5 rounded-sm bg-[#0052CC]/10 text-[#0052CC] dark:bg-blue-900/30 dark:text-blue-300">{l}</span>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          {issue?.fields.description && (
            <div>
              <label className="text-[10px] font-semibold text-[#5E6C84] dark:text-gray-400 uppercase tracking-wider block mb-2">Description</label>
              <p className="text-xs text-[#5E6C84] dark:text-gray-400 leading-relaxed bg-[#F4F5F7] dark:bg-gray-700/50 rounded p-2 max-h-24 overflow-y-auto">
                {typeof issue.fields.description === 'string'
                  ? issue.fields.description.replace(/<[^>]*>/g, '').slice(0, 400)
                  : 'No description'}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#DFE1E6] dark:border-gray-700 space-y-2">
          {dirty && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Unsaved changes
            </p>
          )}
          <div className="flex items-center justify-between">
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-500">Delete worklog?</span>
                <Button size="sm" onClick={() => { onDelete(); setConfirmDelete(false); onClose(); }}
                  className="text-xs bg-red-500 text-white hover:bg-red-600 h-7">Yes</Button>
                <Button size="sm" onClick={() => setConfirmDelete(false)}
                  className="text-xs border-[#DFE1E6] text-[#5E6C84] h-7">No</Button>
              </div>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}
                className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 text-xs">
                <Trash2 size={14} className="mr-1" /> Delete
              </Button>
            )}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onClose}
                className="text-xs border-[#DFE1E6] dark:border-gray-700 text-[#5E6C84] dark:text-gray-400 h-7">Cancel</Button>
              <Button size="sm" onClick={handleSave} disabled={!dirty || totalSeconds <= 0}
                className="text-xs bg-[#0052CC] text-white hover:bg-[#0747A6] disabled:opacity-50 h-7">Save</Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
