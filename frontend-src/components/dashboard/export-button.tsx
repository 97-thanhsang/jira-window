'use client';

import { useState, useRef, useEffect } from 'react';
import { Download, Printer } from 'lucide-react';

export function ExportButton() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler, true);
    return () => document.removeEventListener('mousedown', handler, true);
  }, [open]);

  function handlePrint() {
    setOpen(false);
    window.print();
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded transition-colors text-[#5E6C84] dark:text-gray-400 hover:bg-[#F4F5F7] dark:hover:bg-gray-800"
        title="Export"
      >
        <Download size={12} />
        <span>Export</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-gray-900 border border-[#DFE1E6] dark:border-gray-700 rounded-lg shadow-lg z-50 overflow-hidden">
          <button
            onClick={handlePrint}
            className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-[#172B4D] dark:text-gray-200 hover:bg-[#F4F5F7] dark:hover:bg-gray-800 transition-colors"
          >
            <Printer size={12} className="text-[#5E6C84]" />
            <span>Print / PDF</span>
          </button>
        </div>
      )}
    </div>
  );
}
