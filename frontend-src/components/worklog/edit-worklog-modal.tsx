'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Loader2, Clock, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { getStoredUser } from '@/lib/api';
import { fetchWorklogs } from '@/lib/worklog-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { WorklogEntry } from '@/types/jira';

interface EditWorklogModalProps {
  entry: WorklogEntry;
  onSaveDraft: (changes: { timeSpentSeconds: number; comment: string; started: string }) => void;
  onDeleteDraft: () => void;
  onClose: () => void;
}

const WORK_START = 8;
const MORNING_END = 12;
const AFTERNOON_START = 13.5;
const WORK_END = 17.5;

function parseTimeToHours(isoString: string): number {
  const d = new Date(isoString);
  return d.getHours() + d.getMinutes() / 60;
}

function formatHour(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

interface TimeInterval {
  startH: number;
  endH: number;
  label: string;
  key: string;
  summary: string;
  hours: number;
}

function buildOccupied(worklogs: WorklogEntry[], excludeId?: string): TimeInterval[] {
  return worklogs
    .filter(w => w.id !== excludeId)
    .map(w => ({
      startH: parseTimeToHours(w.started),
      endH: parseTimeToHours(w.started) + w.timeSpentSeconds / 3600,
      label: `${w.issueKey} (${(w.timeSpentSeconds / 3600).toFixed(1)}h)`,
      key: w.issueKey,
      summary: w.issueSummary,
      hours: w.timeSpentSeconds / 3600,
    }))
    .sort((a, b) => a.startH - b.startH);
}

function findNextStart(occupied: TimeInterval[], afterH?: number): number | null {
  let cursor = afterH ?? WORK_START;
  let t = Math.max(cursor, WORK_START);
  if (t < MORNING_END) {
    for (const iv of occupied) {
      if (iv.startH >= MORNING_END) break;
      if (t < iv.startH - 0.001) return t;
      t = Math.max(t, iv.endH);
    }
    if (t < MORNING_END - 0.001) return t;
  }
  t = Math.max(cursor, AFTERNOON_START, t);
  if (t < WORK_END) {
    for (const iv of occupied) {
      if (iv.startH >= WORK_END) break;
      if (iv.startH < AFTERNOON_START) continue;
      if (t < iv.startH - 0.001) return t;
      t = Math.max(t, iv.endH);
    }
    if (t < WORK_END - 0.001) return t;
  }
  return null;
}

export function EditWorklogModal({ entry, onSaveDraft, onDeleteDraft, onClose }: EditWorklogModalProps) {
  const startedDate = new Date(entry.started);
  const [logDate, setLogDate] = useState(format(startedDate, 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState(format(startedDate, 'HH:mm'));
  const [timeSpent, setTimeSpent] = useState((entry.timeSpentSeconds / 3600).toFixed(1));
  const [comment, setComment] = useState(entry.comment ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [existingWorklogs, setExistingWorklogs] = useState<WorklogEntry[]>([]);
  const [existingLoading, setExistingLoading] = useState(false);
  const [occupied, setOccupied] = useState<TimeInterval[]>([]);
  const [isDragging, setIsDragging] = useState<'move' | 'resize' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);

  function yToTime(clientY: number): string {
    if (!timelineRef.current) return startTime;
    const rect = timelineRef.current.getBoundingClientRect();
    const y = clientY - rect.top;
    const pct = Math.max(0, Math.min(1, y / rect.height));
    const totalMinutes = pct * 570;
    const rounded = Math.round(totalMinutes / 5) * 5;
    const hh = Math.floor(rounded / 60) + 8;
    const mm = rounded % 60;
    const clampedH = Math.max(8, Math.min(17, hh));
    const clampedM = hh >= 17 ? 30 : mm;
    return `${String(clampedH).padStart(2, '0')}:${String(clampedM).padStart(2, '0')}`;
  }

  function handleTimelineMouseDown(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    const isResize = target.closest('[data-resize-handle]');
    if (isResize) { setIsDragging('resize'); return; }
    setIsDragging('move');
    setStartTime(yToTime(e.clientY));
  }

  useEffect(() => {
    if (!isDragging) return;
    function onMove(e: MouseEvent) {
      if (!timelineRef.current) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
      const pct = y / rect.height;
      const totalMinutes = pct * 570;
      const rounded = Math.round(totalMinutes / 5) * 5;
      let hh = Math.floor(rounded / 60) + 8;
      let mm = rounded % 60;
      hh = Math.max(8, Math.min(17, hh));
      if (hh >= 17) mm = Math.min(mm, 30);
      const timeStr = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
      if (isDragging === 'move') setStartTime(timeStr);
      else if (isDragging === 'resize') {
        const [sh, sm] = startTime.split(':').map(Number);
        const startMinutes = (sh - 8) * 60 + sm;
        const dragMinutes = pct * 570;
        const diffMinutes = Math.max(15, dragMinutes - startMinutes);
        setTimeSpent((diffMinutes / 60).toFixed(1));
      }
    }
    function onUp() { setIsDragging(null); }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [isDragging, startTime]);

  useEffect(() => {
    const u = getStoredUser();
    setUsername(u?.name ?? null);
  }, []);

  const loadWorklogs = async (date: string) => {
    if (!username) return;
    setExistingLoading(true);
    try {
      const result = await fetchWorklogs(username, date, date);
      setExistingWorklogs(result.entries);
      const intervals = buildOccupied(result.entries, entry.id);
      setOccupied(intervals);
    } catch {
      setExistingWorklogs([]);
      setOccupied([]);
    } finally {
      setExistingLoading(false);
    }
  };

  useEffect(() => {
    if (logDate) loadWorklogs(logDate);
  }, [logDate, username]); // eslint-disable-line react-hooks/exhaustive-deps

  // End time display
  const endDisplay = (() => {
    const hs = parseFloat(timeSpent);
    if (!startTime || isNaN(hs) || hs <= 0) return '';
    const [hh, mm] = startTime.split(':').map(Number);
    const endH = hh + mm / 60 + hs;
    if (endH > WORK_END) return `⚠ Beyond ${formatHour(WORK_END)}`;
    const startH = hh + mm / 60;
    if (startH < MORNING_END && endH > MORNING_END && endH <= AFTERNOON_START) return '⛔ Crosses lunch break (12:00-13:30)';
    return `→ ${formatHour(endH)}`;
  })();

  function validateSlot(startH: number, hours: number): string | null {
    const endH = startH + hours;
    for (const iv of occupied) {
      if (startH < iv.endH - 0.001 && endH > iv.startH + 0.001) {
        return `Overlaps ${iv.label} (${formatHour(iv.startH)}-${formatHour(iv.endH)})`;
      }
    }
    if (startH < WORK_START - 0.001) return `Before ${formatHour(WORK_START)}`;
    if (endH > WORK_END + 0.001) return `Past ${formatHour(WORK_END)}`;
    if (startH < MORNING_END && endH > MORNING_END && endH <= AFTERNOON_START + 0.001) return 'Crosses lunch (12:00-13:30)';
    return null;
  }

  function handleSave() {
    const hs = parseFloat(timeSpent);
    if (isNaN(hs) || hs <= 0) { setError('Please enter valid hours'); return; }
    if (!startTime) { setError('Please select a start time'); return; }
    const [hh, mm] = startTime.split(':').map(Number);
    const startH = hh + mm / 60;
    const slotErr = validateSlot(startH, hs);
    if (slotErr) { setError(slotErr); return; }
    const started = `${logDate}T${startTime}:00.000+0700`;
    onSaveDraft({ timeSpentSeconds: Math.round(hs * 3600), comment, started });
    onClose();
  }

  function handleDelete() {
    onDeleteDraft();
    onClose();
  }

  const [sh, sm] = startTime ? startTime.split(':').map(Number) : [0, 0];
  const startH = startTime ? sh + sm / 60 : 0;
  const hs = parseFloat(timeSpent);
  const hasHours = !isNaN(hs) && hs > 0;
  const previewEndH = startH + (hasHours ? hs : 0.5);
  const previewTopPct = ((startH - 8) / 9.5) * 100;
  const previewHeightPct = ((previewEndH - startH) / 9.5) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-3xl mx-4 flex flex-col" style={{ minHeight: '620px' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-[#DFE1E6] flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#E6F0FF] flex items-center justify-center flex-shrink-0">
              <Clock size={16} className="text-[#0052CC]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-[#172B4D] dark:text-gray-100">Edit Worklog</h2>
              <div className="flex items-center gap-1.5 text-[11px] text-[#5E6C84] truncate">
                <span className="font-medium text-[#0052CC] flex-shrink-0">{entry.issueKey}</span>
                <span className="text-[#8993A4] flex-shrink-0">·</span>
                <span className="truncate">{entry.issueSummary}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#F4F5F7] text-[#5E6C84] hover:text-[#172B4D] transition-colors" aria-label="Close">
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 flex flex-col px-6 py-4 min-h-0">
          <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
            {/* Date */}
            <div>
              <label className="block text-[11px] font-semibold text-[#5E6C84] uppercase tracking-wide mb-1.5">Date</label>
              <Input type="date" value={logDate} onChange={e => setLogDate(e.target.value)} className="w-full" />
            </div>

            {/* Timeline */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-semibold text-[#5E6C84] uppercase tracking-wide">Timeline</label>
                {!existingLoading && (
                  <span className="text-[10px] text-[#5E6C84]">
                    {occupied.reduce((s, iv) => s + iv.hours, 0).toFixed(1)}h / 8h
                    {occupied.length > 0 && ` · ${occupied.length} other worklog(s)`}
                  </span>
                )}
              </div>

              {existingLoading ? (
                <div className="flex items-center gap-2 text-xs text-[#5E6C84] py-4"><Loader2 size={12} className="animate-spin" /> Loading…</div>
              ) : (
                <div className="border border-[#DFE1E6] rounded-lg overflow-hidden bg-white dark:bg-gray-800">
                  {/* Progress bar */}
                  <div className="h-2 bg-[#F4F5F7] dark:bg-gray-700 border-b border-[#DFE1E6] dark:border-gray-600">
                    <div className="h-full transition-all duration-300 rounded-r-sm" style={{
                      width: `${Math.min((occupied.reduce((s, iv) => s + iv.hours, 0) / 8) * 100, 100)}%`,
                      backgroundColor: occupied.reduce((s, iv) => s + iv.hours, 0) >= 8 ? '#36B37E' : '#0052CC',
                      minWidth: occupied.length > 0 ? '2px' : '0',
                    }} />
                  </div>

                  <div className="flex select-none cursor-crosshair" style={{ height: 400 }} ref={timelineRef} onMouseDown={handleTimelineMouseDown}>
                    {/* Hour labels */}
                    <div className="w-10 flex-shrink-0 border-r border-[#DFE1E6] bg-[#FAFBFC] dark:bg-gray-700/50 relative">
                      {Array.from({ length: 10 }).map((_, i) => {
                        const h = 8 + i;
                        if (h > 17) return null;
                        return (
                          <div key={h} className="absolute left-0 right-0" style={{ top: `${((h - 8) / 9.5) * 100}%` }}>
                            <span className="block text-[9px] text-[#8993A4] text-center leading-none pt-0.5 select-none">{String(h).padStart(2, '0')}:00</span>
                          </div>
                        );
                      })}
                      <div className="absolute left-0 right-0" style={{ top: `${((13.5 - 8) / 9.5) * 100}%` }}>
                        <span className="block text-[9px] text-[#8993A4] text-center leading-none pt-0.5 select-none">13:30</span>
                      </div>
                    </div>

                    {/* Timeline area */}
                    <div className="flex-1 relative">
                      {Array.from({ length: 10 }).map((_, i) => {
                        const h = 8 + i;
                        if (h > 17) return null;
                        return <div key={h} className="absolute left-0 right-0 border-t border-[#F4F5F7] dark:border-gray-700" style={{ top: `${((h - 8) / 9.5) * 100}%` }} />;
                      })}
                      {[8.5, 9.5, 10.5, 11.5, 13.5, 14.5, 15.5, 16.5].map(h => (
                        <div key={`half-${h}`} className="absolute left-0 right-0 border-t border-dashed border-[#F4F5F7] dark:border-gray-700" style={{ top: `${((h - 8) / 9.5) * 100}%` }} />
                      ))}

                      {/* Lunch break */}
                      <div className="absolute left-0 right-0 bg-[#FFF7E6] dark:bg-amber-900/10 border-y border-[#FFE8B6] dark:border-amber-800/30 flex items-center justify-center"
                        style={{ top: `${((12 - 8) / 9.5) * 100}%`, height: `${((13.5 - 12) / 9.5) * 100}%` }}>
                        <span className="text-[9px] text-[#A54800] font-medium">Lunch 12:00–13:30</span>
                      </div>

                      {/* Occupied worklog blocks */}
                      {occupied.map((iv, i) => {
                        const topPct = ((iv.startH - 8) / 9.5) * 100;
                        const heightPct = ((iv.endH - iv.startH) / 9.5) * 100;
                        return (
                          <div key={i}
                            className="absolute left-1 right-1 rounded-sm border z-10 flex flex-col justify-center px-2 overflow-hidden cursor-default transition-shadow hover:shadow-md bg-[#FF8B00] border-[#FF8B00]/60 text-white"
                            style={{ top: `${topPct}%`, height: `${Math.max(heightPct, 3)}%`, minHeight: '18px' }}
                            title={`${iv.key}: ${iv.summary} (${iv.hours.toFixed(1)}h)`}>
                            <div className="flex items-center gap-1 leading-tight">
                              <span className="font-semibold text-[10px] whitespace-nowrap">{iv.key}</span>
                              {heightPct > 6 && iv.summary && <span className="text-[9px] opacity-90 truncate">{iv.summary}</span>}
                              <span className="text-[9px] opacity-80 ml-auto whitespace-nowrap">{iv.hours.toFixed(1)}h</span>
                            </div>
                            {heightPct > 8 && <div className="text-[8px] opacity-70 leading-tight">{formatHour(iv.startH)}–{formatHour(iv.endH)}</div>}
                          </div>
                        );
                      })}

                      {/* Current edit block */}
                      {startTime && (() => {
                        const overlapsExisting = occupied.some(iv => startH < iv.endH && previewEndH > iv.startH);
                        const pastWorkEnd = previewEndH > WORK_END + 0.001;
                        const crossesLunch = startH < MORNING_END && previewEndH > MORNING_END && previewEndH <= AFTERNOON_START + 0.001;
                        const beforeWorkStart = startH < WORK_START - 0.001;
                        const hasError = overlapsExisting || pastWorkEnd || crossesLunch || beforeWorkStart;

                        if (!hasHours) {
                          return (
                            <div className="absolute left-1 right-1 z-20 pointer-events-none" style={{ top: `${previewTopPct}%`, height: '0' }}>
                              <div className="absolute left-0 right-0 border-t-2 border-[#36B37E] -mt-px" />
                              <div className="absolute -top-2.5 left-2 bg-[#36B37E] text-white text-[9px] font-semibold px-1.5 py-0.5 rounded-sm whitespace-nowrap shadow-sm">▶ {formatHour(startH)}</div>
                            </div>
                          );
                        }

                        return (
                          <div className={cn(
                            'absolute left-1 right-1 rounded-sm border-2 z-20 flex flex-col items-center justify-center overflow-hidden',
                            hasError ? 'border-red-400 bg-red-100/60' : 'border-[#36B37E] bg-[#36B37E]/15',
                            isDragging === 'move' ? 'opacity-80 ring-2 ring-[#36B37E] cursor-grabbing' : 'cursor-grab',
                          )} style={{ top: `${previewTopPct}%`, height: `${Math.max(previewHeightPct, 4)}%`, minHeight: '22px' }}>
                            <div className="flex items-center gap-1.5 leading-tight px-1 pointer-events-none">
                              <span className={cn('text-[10px] font-bold', hasError ? 'text-red-600' : 'text-[#1B7C44]')}>+{hs.toFixed(1)}h</span>
                              <span className={cn('text-[9px] font-mono', hasError ? 'text-red-500' : 'text-[#1B7C44]')}>{formatHour(startH)}–{formatHour(previewEndH)}</span>
                            </div>
                            {hasError && <div className="text-[8px] text-red-500 font-medium leading-tight pointer-events-none">
                              {overlapsExisting ? '⚠ Overlaps' : pastWorkEnd ? '⚠ Past 17:30' : crossesLunch ? '⚠ Crosses lunch' : '⚠ Before 08:00'}
                            </div>}
                            <div data-resize-handle className="absolute bottom-0 left-0 right-0 h-3 cursor-s-resize flex items-center justify-center pointer-events-auto hover:bg-black/10 rounded-b-sm">
                              <div className={cn('w-6 h-0.5 rounded-full', hasError ? 'bg-red-400' : 'bg-[#36B37E]')} />
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Time fields */}
            <div className="grid grid-cols-5 gap-3">
              <div className="col-span-2">
                <label className="block text-[11px] font-semibold text-[#5E6C84] uppercase tracking-wide mb-1.5">Start time</label>
                <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} step="300" className="w-full" />
              </div>
              <div className="col-span-2">
                <label className="block text-[11px] font-semibold text-[#5E6C84] uppercase tracking-wide mb-1.5">Hours</label>
                <Input placeholder="e.g. 1.5" value={timeSpent} onChange={e => setTimeSpent(e.target.value)} type="number" min="0" step="0.25" className="w-full" />
              </div>
              <div className="col-span-1 flex flex-col justify-end">
                {endDisplay ? (
                  <div className={cn('h-8 flex items-center justify-center rounded-lg text-xs font-semibold font-mono',
                    endDisplay.includes('⚠') || endDisplay.includes('⛔')
                      ? 'bg-red-50 text-red-600 border border-red-200'
                      : 'bg-green-50 text-[#36B37E] border border-green-200')}>
                    {endDisplay.replace('→ ', '')}
                  </div>
                ) : (
                  <div className="h-8 flex items-center justify-center rounded-lg text-[10px] text-[#8993A4] border border-dashed border-[#DFE1E6]">End</div>
                )}
              </div>
            </div>

            {/* Comment */}
            <div>
              <label className="block text-[11px] font-semibold text-[#5E6C84] uppercase tracking-wide mb-1.5">Comment</label>
              <textarea
                className="w-full text-xs border border-[#DFE1E6] dark:border-gray-600 rounded px-2.5 py-2 bg-white dark:bg-gray-800 text-[#172B4D] dark:text-gray-100 focus:outline-none focus:border-[#0052CC] resize-none h-20 placeholder:text-[#8993A4]"
                value={comment} onChange={e => setComment(e.target.value)}
                placeholder="What did you work on?" />
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <span>⚠</span><span>{error}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between gap-2 pt-3 mt-auto border-t border-[#DFE1E6] dark:border-gray-700">
            <div>
              {confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-500">Delete this worklog?</span>
                  <Button size="sm" onClick={handleDelete} className="text-xs bg-red-500 text-white hover:bg-red-600 h-7">Yes</Button>
                  <Button size="sm" onClick={() => setConfirmDelete(false)} className="text-xs border-[#DFE1E6] text-[#5E6C84] h-7">No</Button>
                </div>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}
                  className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 text-xs">
                  <Trash2 size={14} className="mr-1" /> Delete
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onClose} className="text-xs border-[#DFE1E6] dark:border-gray-700 text-[#5E6C84] dark:text-gray-400 h-7">Cancel</Button>
              <Button size="sm" onClick={handleSave} disabled={isSubmitting} className="text-xs bg-[#0052CC] text-white hover:bg-[#0747A6] disabled:opacity-50 h-7">
                {isSubmitting ? <><Loader2 size={12} className="animate-spin" /> Saving…</> : 'Save to Draft'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
