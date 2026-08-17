'use client';
import { useState } from 'react';
import { Save, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';

export interface EditEntry {
  issueKey: string;
  field: 'status' | 'summary' | 'est' | 'duedate' | 'parentStatus';
  oldValue: string;
  newValue: string;
  transitionId?: string;
  parentKey?: string;
}

const FIELD_LABELS: Record<EditEntry['field'], string> = {
  status: 'Status',
  summary: 'Summary',
  est: 'Estimate',
  duedate: 'Due Date',
  parentStatus: 'Parent Status',
};

interface SaveConfirmModalProps {
  edits: EditEntry[];
  onClose: () => void;
  onSaved: () => void;
}

export function SaveConfirmModal({ edits, onClose, onSaved }: SaveConfirmModalProps) {
  const [checked, setChecked] = useState<Set<number>>(
    () => new Set(edits.map((_, i) => i)),
  );
  const [saving, setSaving] = useState(false);
  const [results, setResults] = useState<Map<number, 'success' | 'error'>>(
    new Map(),
  );

  const toggleAll = () => {
    if (checked.size === edits.length) setChecked(new Set());
    else setChecked(new Set(edits.map((_, i) => i)));
  };

  const toggle = (i: number) => {
    const next = new Set(checked);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setChecked(next);
  };

  async function handleSave() {
    setSaving(true);
    const selected = edits.filter((_, i) => checked.has(i));
    let allOk = true;

    for (let s = 0; s < selected.length; s++) {
      const edit = selected[s];
      const idx = edits.indexOf(edit);
      try {
        const targetKey =
          edit.field === 'parentStatus' ? edit.parentKey! : edit.issueKey;

        if (edit.field === 'status' || edit.field === 'parentStatus') {
          // Transition
          await api.post(`/issue/${targetKey}/transitions`, {
            transition: { id: edit.transitionId },
          });
        } else {
          // Update fields
          const fields: Record<string, unknown> = {};
          if (edit.field === 'summary') fields.summary = edit.newValue;
          if (edit.field === 'duedate') fields.duedate = edit.newValue;
          if (edit.field === 'est') {
            fields.timetracking = { originalEstimate: edit.newValue };
          }
          await api.put(`/issue/${targetKey}`, { fields });
        }
        setResults((prev) => new Map(prev).set(idx, 'success'));
      } catch {
        setResults((prev) => new Map(prev).set(idx, 'error'));
        allOk = false;
      }
    }

    setSaving(false);
    if (allOk) setTimeout(() => onSaved(), 600);
  }

  const selectedCount = checked.size;
  const successCount = Array.from(results.values()).filter(
    (r) => r === 'success',
  ).length;
  const errorCount = Array.from(results.values()).filter(
    (r) => r === 'error',
  ).length;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-800 border border-[#DFE1E6] dark:border-gray-600 rounded-lg shadow-xl z-50 w-[680px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#DFE1E6] dark:border-gray-700 flex-shrink-0">
          <h3 className="text-sm font-semibold text-[#172B4D] dark:text-gray-100 flex items-center gap-2">
            <Save size={14} className="text-[#0052CC]" />
            Save Changes
          </h3>
          <button
            onClick={onClose}
            className="text-[#5E6C84] hover:text-[#172B4D] dark:hover:text-gray-200"
          >
            <X size={16} />
          </button>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto min-h-0">
          <table className="w-full text-xs">
            <thead className="bg-[#F4F5F7] dark:bg-gray-800 sticky top-0">
              <tr>
                <th className="w-8 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={checked.size === edits.length}
                    onChange={toggleAll}
                    className="w-3 h-3 accent-[#0052CC]"
                  />
                </th>
                <th className="px-3 py-2 text-left text-[#5E6C84] dark:text-gray-400 font-semibold text-[10px] uppercase tracking-wider">
                  Issue
                </th>
                <th className="px-3 py-2 text-left text-[#5E6C84] dark:text-gray-400 font-semibold text-[10px] uppercase tracking-wider">
                  Field
                </th>
                <th className="px-3 py-2 text-left text-[#5E6C84] dark:text-gray-400 font-semibold text-[10px] uppercase tracking-wider">
                  Old
                </th>
                <th className="px-3 py-2 text-left text-[#5E6C84] dark:text-gray-400 font-semibold text-[10px] uppercase tracking-wider">
                  New
                </th>
                <th className="w-10 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {edits.map((edit, i) => {
                const res = results.get(i);
                return (
                  <tr
                    key={`${edit.issueKey}-${edit.field}`}
                    className={cn(
                      'border-t border-[#DFE1E6] dark:border-gray-700 transition-colors',
                      res === 'success' && 'bg-green-50 dark:bg-green-900/20',
                      res === 'error' && 'bg-red-50 dark:bg-red-900/20',
                    )}
                  >
                    <td className="px-3 py-2">
                      {!res && (
                        <input
                          type="checkbox"
                          checked={checked.has(i)}
                          onChange={() => toggle(i)}
                          className="w-3 h-3 accent-[#0052CC]"
                        />
                      )}
                    </td>
                    <td className="px-3 py-2 font-medium text-[#0052CC] dark:text-blue-400">
                      {edit.field === 'parentStatus'
                        ? edit.parentKey
                        : edit.issueKey}
                    </td>
                    <td className="px-3 py-2 text-[#5E6C84] dark:text-gray-400">
                      {FIELD_LABELS[edit.field]}
                    </td>
                    <td className="px-3 py-2 text-[#5E6C84] dark:text-gray-400">
                      {edit.oldValue || '—'}
                    </td>
                    <td className="px-3 py-2 font-medium text-[#172B4D] dark:text-gray-100">
                      {edit.newValue || '—'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {res === 'success' && (
                        <span className="text-[#36B37E] text-sm">✓</span>
                      )}
                      {res === 'error' && (
                        <span className="text-[#DE350B] text-sm">✗</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-[#DFE1E6] dark:border-gray-700 flex-shrink-0">
          <span className="text-[11px] text-[#5E6C84] dark:text-gray-400">
            {saving ? (
              <span className="flex items-center gap-1">
                <Loader2 size={10} className="animate-spin" />
                {successCount} / {edits.length} saved
                {errorCount > 0 && ` (${errorCount} failed)`}
              </span>
            ) : (
              `${selectedCount} of ${edits.length} selected`
            )}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="text-xs px-3 py-1.5 rounded border border-[#DFE1E6] dark:border-gray-600 text-[#5E6C84] dark:text-gray-400 hover:bg-[#F4F5F7] dark:hover:bg-gray-700"
            >
              {saving ? 'Close' : 'Cancel'}
            </button>
            {!saving && (
              <button
                onClick={handleSave}
                disabled={selectedCount === 0}
                className={cn(
                  'text-xs px-3 py-1.5 rounded text-white flex items-center gap-1.5 transition-colors',
                  selectedCount === 0
                    ? 'bg-[#C1C7D0] cursor-not-allowed'
                    : 'bg-[#36B37E] hover:bg-green-600',
                )}
              >
                <Save size={12} />
                Save {selectedCount} change{selectedCount !== 1 ? 's' : ''}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
