'use client';
import { useState, useRef, useEffect } from 'react';
import { Download, FileSpreadsheet, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TeamReportData } from '@/types/jira';

interface TeamExportProps {
  data: TeamReportData;
  dayHeaders: Array<{ key: string; dayName: string; dateStr: string }>;
  visibleColumns: Record<string, boolean>;
  showWeekends: boolean;
}

function formatCellHours(seconds: number): string {
  if (seconds === 0) return '-';
  const h = seconds / 3600;
  return `${h % 1 === 0 ? h.toFixed(0) : h.toFixed(1)}h`;
}

function isWeekend(dateStr: string): boolean {
  const d = new Date(dateStr);
  return d.getDay() === 0 || d.getDay() === 6;
}

function getDayBgClass(seconds: number, dateStr: string): string {
  if (isWeekend(dateStr)) return '';
  const today = new Date(new Date().toDateString());
  const date = new Date(dateStr);
  if (seconds >= 28800) return 'bg-green-50';
  if (seconds > 0) return 'bg-amber-50';
  return date < today ? 'bg-red-50' : '';
}

export function TeamExport({ data, dayHeaders, visibleColumns, showWeekends }: TeamExportProps) {
  const [open, setOpen] = useState(false);
  const [colSelectorOpen, setColSelectorOpen] = useState(false);
  const [exportColumns, setExportColumns] = useState<Record<string, boolean>>({
    project: true, key: true, summary: true, status: true, est: true,
  });
  const [exportDailyCols, setExportDailyCols] = useState(true);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
        setColSelectorOpen(false);
      }
    }
    if (open || colSelectorOpen) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open, colSelectorOpen]);

  const dayCols = dayHeaders.filter(d => showWeekends || !isWeekend(d.key));

  async function exportXlsx() {
    try {
      const XLSX = await import('xlsx');

      const rows: Record<string, string>[] = [];
      const dayKeys = dayCols.map(d => d.key);

      for (const user of data.users) {
        // Compute daily totals per user
        const dailyTotals: Record<string, number> = {};
        for (const d of dayKeys) {
          dailyTotals[d] = user.tasks.reduce((s, t) => s + (t.dailySeconds[d] ?? 0), 0);
        }

        // Group tasks by project
        const groups: Array<{ projKey: string; tasks: typeof user.tasks }> = [];
        for (const task of user.tasks) {
          const last = groups[groups.length - 1];
          if (last && last.projKey === task.projectKey) {
            last.tasks.push(task);
          } else {
            groups.push({ projKey: task.projectKey, tasks: [task] });
          }
        }

        for (const group of groups) {
          for (let i = 0; i < group.tasks.length; i++) {
            const task = group.tasks[i];
            const row: Record<string, string> = {};
            if (exportColumns.project && i === 0) row['Project'] = group.projKey;
            if (exportColumns.key) row['Key'] = task.issueKey;
            if (exportColumns.summary) row['Summary'] = task.summary;
            if (exportColumns.est) row['Estimate'] = task.estDisplay;
            if (exportColumns.status) row['Status'] = task.status ?? '-';
            if (exportDailyCols) {
              for (const d of dayKeys) {
                const sec = task.dailySeconds[d] ?? 0;
                row[`${d}`] = formatCellHours(sec);
              }
            }
            rows.push(row);
          }
        }

        // Total row
        const totalRow: Record<string, string> = {};
        if (exportColumns.project) totalRow['Project'] = `${user.displayName} Total`;
        if (exportColumns.key) totalRow['Key'] = '';
        if (exportColumns.summary) totalRow['Summary'] = `${user.tasks.length} tasks`;
        if (exportColumns.est) totalRow['Estimate'] = user.totalEstDisplay;
        if (exportColumns.status) totalRow['Status'] = '';
        if (exportDailyCols) {
          for (const d of dayKeys) {
            const total = dailyTotals[d] ?? 0;
            totalRow[`${d}`] = formatCellHours(total);
          }
        }
        rows.push(totalRow);
      }

      const ws = XLSX.utils.json_to_sheet(rows);

      // Apply styling
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      for (let R = range.s.r; R <= range.e.r; R++) {
        for (let C = range.s.c; C <= range.e.c; C++) {
          const addr = XLSX.utils.encode_cell({ r: R, c: C });
          if (!ws[addr]) continue;
          const cell = ws[addr];

          // Check if this is a total row
          const projectColIdx = ['Project', 'project'].indexOf(Object.keys(rows[0] || {})[0]);
          const isTotalRow = projectColIdx >= 0 && String(ws[XLSX.utils.encode_cell({ r: R, c: projectColIdx })]?.v || '').includes('Total');

          // Style the cell
          if (R === 0) {
            // Header row
            cell.s = { font: { bold: true, color: { rgb: '5E6C84' } }, fill: { fgColor: { rgb: 'F4F5F7' } } };
          } else if (isTotalRow) {
            cell.s = { font: { bold: true }, fill: { fgColor: { rgb: 'F4F5F7' } } };
          } else {
            // Data cells — apply color coding for daily columns
            const colName = Object.keys(rows[0] || {})[C];
            if (colName && /^\d{4}-\d{2}-\d{2}$/.test(colName)) {
              const val = parseFloat(String(cell.v)) || 0;
              const sec = val * 3600;
              const cls = getDayBgClass(sec, colName);
              if (cls.includes('red')) cell.s = { fill: { fgColor: { rgb: 'FEF2F2' } } };
              else if (cls.includes('amber')) cell.s = { fill: { fgColor: { rgb: 'FFFBEB' } } };
              else if (cls.includes('green')) cell.s = { fill: { fgColor: { rgb: 'F0FDF4' } } };
            }
          }
        }
      }

      // Auto-size columns
      ws['!cols'] = Object.keys(rows[0] || {}).map(k => ({ wch: Math.max(k.length + 4, 12) }));

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Team Plan');
      XLSX.writeFile(wb, `team-plan_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e) {
      console.error('XLSX export failed:', e);
      alert('XLSX export failed. Falling back to CSV.');
      exportCsv();
    } finally {
      setOpen(false);
    }
  }

  function exportCsv() {
    try {
      const dayKeys = dayCols.map(d => d.key);
      const headers: string[] = [];
      if (exportColumns.project) headers.push('User');
      if (exportColumns.key) headers.push('Key');
      if (exportColumns.summary) headers.push('Summary');
      if (exportColumns.est) headers.push('Estimate');
      if (exportColumns.status) headers.push('Status');
      if (exportDailyCols) {
        for (const d of dayCols) headers.push(`${d.dayName} ${d.dateStr}`);
      }

      const lines: string[] = [headers.join(',')];

      for (const user of data.users) {
        const dailyTotals: Record<string, number> = {};
        for (const d of dayKeys) dailyTotals[d] = user.tasks.reduce((s, t) => s + (t.dailySeconds[d] ?? 0), 0);

        const groups: Array<{ projKey: string; tasks: typeof user.tasks }> = [];
        for (const task of user.tasks) {
          const last = groups[groups.length - 1];
          if (last && last.projKey === task.projectKey) last.tasks.push(task);
          else groups.push({ projKey: task.projectKey, tasks: [task] });
        }

        for (let gi = 0; gi < groups.length; gi++) {
          const group = groups[gi];
          for (let i = 0; i < group.tasks.length; i++) {
            const task = group.tasks[i];
            const cols: string[] = [];
            if (exportColumns.project) cols.push(i === 0 ? `${user.displayName} (${group.projKey})` : '');
            if (exportColumns.key) cols.push(task.issueKey);
            if (exportColumns.summary) cols.push(escapeCsv(task.summary));
            if (exportColumns.est) cols.push(task.estDisplay);
            if (exportColumns.status) cols.push(task.status ?? '-');
            if (exportDailyCols) {
              for (const d of dayKeys) cols.push(formatCellHours(task.dailySeconds[d] ?? 0));
            }
            lines.push(cols.join(','));
          }
        }

        // Total row
        const totalCols: string[] = [];
        if (exportColumns.project) totalCols.push(`${user.displayName} Total`);
        if (exportColumns.key) totalCols.push('');
        if (exportColumns.summary) totalCols.push(`${user.tasks.length} tasks`);
        if (exportColumns.est) totalCols.push(user.totalEstDisplay);
        if (exportColumns.status) totalCols.push('');
        if (exportDailyCols) {
          for (const d of dayKeys) totalCols.push(formatCellHours(dailyTotals[d] ?? 0));
        }
        lines.push(totalCols.join(','));
      }

      const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `team-plan_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('CSV export failed:', e);
    } finally {
      setOpen(false);
    }
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'text-xs px-2 py-1 rounded border transition-colors flex items-center gap-1',
          open
            ? 'bg-[#0052CC] text-white border-[#0052CC]'
            : 'border-[#DFE1E6] dark:border-gray-600 text-[#5E6C84] dark:text-gray-400 hover:bg-[#F4F5F7] dark:hover:bg-gray-800',
        )}
      >
        <Download size={12} />
        Export
        <ChevronDown size={10} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute top-full right-0 mt-1 w-48 bg-white dark:bg-gray-800 border border-[#DFE1E6] dark:border-gray-600 rounded shadow-lg z-40 py-1">
            <button
              onClick={() => { setColSelectorOpen(true); setOpen(false); }}
              className="w-full text-left px-3 py-1.5 text-[11px] text-[#5E6C84] dark:text-gray-400 hover:bg-[#F4F5F7] dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <FileSpreadsheet size={12} />
              Customize columns...
            </button>
            <div className="border-t border-[#DFE1E6] dark:border-gray-700 my-0.5" />
            <button
              onClick={exportXlsx}
              className="w-full text-left px-3 py-1.5 text-xs text-[#172B4D] dark:text-gray-200 hover:bg-[#F4F5F7] dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <Download size={12} className="text-[#36B37E]" />
              Export Excel (.xlsx)
            </button>
            <button
              onClick={exportCsv}
              className="w-full text-left px-3 py-1.5 text-xs text-[#172B4D] dark:text-gray-200 hover:bg-[#F4F5F7] dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <Download size={12} className="text-[#5E6C84]" />
              Export CSV
            </button>
          </div>
        </>
      )}

      {/* Column selector modal */}
      {colSelectorOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setColSelectorOpen(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-800 border border-[#DFE1E6] dark:border-gray-600 rounded-lg shadow-xl z-50 p-4 w-72">
            <h3 className="text-sm font-semibold text-[#172B4D] dark:text-gray-100 mb-3">Export Columns</h3>
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-[#5E6C84] dark:text-gray-400 uppercase tracking-wider">Info Columns</p>
              {(['project', 'key', 'summary', 'status', 'est'] as const).map(col => (
                <label key={col} className="flex items-center gap-2 py-1 px-1 rounded hover:bg-[#F4F5F7] dark:hover:bg-gray-700 cursor-pointer text-xs text-[#172B4D] dark:text-gray-200">
                  <input
                    type="checkbox"
                    checked={exportColumns[col]}
                    onChange={() => setExportColumns(prev => ({ ...prev, [col]: !prev[col] }))}
                    className="w-3 h-3 accent-[#0052CC]"
                  />
                  {col === 'project' && 'Project / User'}
                  {col === 'key' && 'Task Key'}
                  {col === 'summary' && 'Summary'}
                  {col === 'status' && 'Status'}
                  {col === 'est' && 'Estimate'}
                </label>
              ))}
              <div className="border-t border-[#DFE1E6] dark:border-gray-700 my-1.5" />
              <label className="flex items-center gap-2 py-1 px-1 rounded hover:bg-[#F4F5F7] dark:hover:bg-gray-700 cursor-pointer text-xs text-[#172B4D] dark:text-gray-200">
                <input
                  type="checkbox"
                  checked={exportDailyCols}
                  onChange={() => setExportDailyCols(prev => !prev)}
                  className="w-3 h-3 accent-[#0052CC]"
                />
                Daily hour columns ({dayCols.length} days)
              </label>
            </div>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setColSelectorOpen(false)}
                className="text-xs px-3 py-1.5 rounded bg-[#0052CC] text-white hover:bg-[#0747A6]"
              >
                Done
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function escapeCsv(s: string): string {
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
