'use client';

import { useState, useRef, useEffect } from 'react';
import { Bookmark, ChevronDown, Plus, Trash2, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PresetName } from '@/components/dashboard/dashboard-layout';

interface DashboardViewsProps {
  views: { name: string; savedAt: string }[];
  activeView: string | null;
  onSave: (name: string) => void;
  onLoad: (name: string) => void;
  onDelete: (name: string) => void;
  onRename: (oldName: string, newName: string) => void;
}

export function DashboardViews({
  views, activeView, onSave, onLoad, onDelete, onRename,
}: DashboardViewsProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler, true);
    return () => document.removeEventListener('mousedown', handler, true);
  }, [open]);

  function handleSave() {
    if (!newName.trim()) return;
    onSave(newName.trim());
    setNewName('');
    setSaving(false);
    setTimeout(() => setOpen(false), 200);
  }

  function handleLoad(name: string) {
    onLoad(name);
    setOpen(false);
  }

  function handleDelete(name: string, e: React.MouseEvent) {
    e.stopPropagation();
    onDelete(name);
  }

  function startRename(name: string, e: React.MouseEvent) {
    e.stopPropagation();
    setRenaming(name);
    setRenameValue(name);
    setTimeout(() => inputRef.current?.select(), 50);
  }

  function commitRename() {
    if (renaming && renameValue.trim()) {
      onRename(renaming, renameValue.trim());
    }
    setRenaming(null);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded transition-colors',
          activeView
            ? 'text-[#0052CC] dark:text-blue-400 bg-[#DEEBFF]/60 dark:bg-blue-900/20'
            : 'text-[#5E6C84] dark:text-gray-400 hover:bg-[#F4F5F7] dark:hover:bg-gray-800',
        )}
      >
        <Bookmark size={12} />
        <span className="max-w-[80px] truncate">{activeView ?? 'Views'}</span>
        <ChevronDown size={10} className={cn(open && 'rotate-180', 'transition-transform')} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-60 bg-white dark:bg-gray-900 border border-[#DFE1E6] dark:border-gray-700 rounded-lg shadow-lg z-50 overflow-hidden">
          {/* Header */}
          <div className="px-3 py-2 border-b border-[#DFE1E6] dark:border-gray-700 bg-[#FAFBFC] dark:bg-gray-800/60">
            <span className="text-[10px] font-semibold text-[#5E6C84] dark:text-gray-400 uppercase tracking-wide">
              Saved Views ({views.length})
            </span>
          </div>

          {/* Save new */}
          <div className="px-3 py-2 border-b border-[#F4F5F7] dark:border-gray-800">
            <div className="flex items-center gap-1.5">
              <input
                ref={inputRef}
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') { setSaving(false); setNewName(''); } }}
                placeholder="Save current as..."
                className="flex-1 text-[10px] px-1.5 py-1 border border-[#DFE1E6] dark:border-gray-700 rounded bg-transparent text-[#172B4D] dark:text-gray-200 outline-none focus:border-[#0052CC]"
              />
              <button onClick={handleSave}
                disabled={!newName.trim()}
                className="text-[#0052CC] dark:text-blue-400 hover:bg-[#DEEBFF] dark:hover:bg-blue-900/30 p-1 rounded disabled:opacity-40 transition-colors">
                <Check size={12} />
              </button>
            </div>
          </div>

          {/* View list */}
          <div className="max-h-48 overflow-y-auto">
            {views.length === 0 ? (
              <div className="px-3 py-4 text-[10px] text-[#8993A4] dark:text-gray-500 text-center">
                No saved views yet
              </div>
            ) : (
              views.map(v => (
                <div key={v.name} className="group flex items-center px-2 hover:bg-[#F4F5F7] dark:hover:bg-gray-800 transition-colors">
                  {renaming === v.name ? (
                    <div className="flex-1 flex items-center gap-1 px-1 py-1.5">
                      <input
                        type="text"
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenaming(null); }}
                        className="flex-1 text-[11px] px-1 py-0.5 border border-[#0052CC] rounded bg-transparent text-[#172B4D] dark:text-gray-200 outline-none"
                        autoFocus
                      />
                      <button onClick={commitRename} className="text-[#36B37E] p-0.5"><Check size={10} /></button>
                      <button onClick={() => setRenaming(null)} className="text-[#8993A4] p-0.5"><X size={10} /></button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => handleLoad(v.name)}
                        className={cn('flex-1 text-left px-2 py-2 text-[11px] transition-colors',
                          activeView === v.name
                            ? 'text-[#0052CC] dark:text-blue-400 font-semibold'
                            : 'text-[#172B4D] dark:text-gray-200',
                        )}
                      >
                        <span className="truncate block">{v.name}</span>
                        <span className="text-[8px] text-[#8993A4] font-normal block">
                          {new Date(v.savedAt).toLocaleDateString()}
                        </span>
                      </button>
                      <button onClick={(e) => startRename(v.name, e)}
                        className="opacity-0 group-hover:opacity-100 text-[#8993A4] hover:text-[#0052CC] p-1 rounded transition-all"
                        title="Rename">
                        ✏️
                      </button>
                      <button onClick={(e) => handleDelete(v.name, e)}
                        className="opacity-0 group-hover:opacity-100 text-[#8993A4] hover:text-[#DE350B] p-1 rounded transition-all"
                        title="Delete">
                        <Trash2 size={10} />
                      </button>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
