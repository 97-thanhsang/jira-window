'use client';

import { useState } from 'react';
import { X, Search, Plus } from 'lucide-react';

interface Props {
  parentKeys: string[];
  onAddParent: (key: string) => void;
  onRemoveParent: (key: string) => void;
}

function extractKey(input: string): string | null {
  // Handle full URL: https://task.ascvn.com.vn/browse/HLU2-2275
  const urlMatch = input.match(/\/browse\/([A-Z][A-Z0-9]+-\d+)/);
  if (urlMatch) return urlMatch[1];
  // Handle direct key: HLU2-2275
  const keyMatch = input.trim().match(/^[A-Z][A-Z0-9]+-\d+$/);
  if (keyMatch) return keyMatch[0];
  return null;
}

export function EstTaskSelector({ parentKeys, onAddParent, onRemoveParent }: Props) {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  const handleAdd = () => {
    const key = extractKey(input);
    if (!key) {
      setError('Nhập issue key hợp lệ (vd: EMSPRO2-7288)');
      return;
    }
    if (parentKeys.includes(key)) {
      setError('Đã có trong danh sách');
      return;
    }
    onAddParent(key);
    setInput('');
    setError('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 border border-[#DFE1E6] dark:border-gray-700 rounded-lg p-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#C1C7D0]" />
          <input
            type="text"
            value={input}
            onChange={e => { setInput(e.target.value); setError(''); }}
            onKeyDown={handleKeyDown}
            placeholder="Nhập issue key hoặc URL Jira..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-[#DFE1E6] dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-[#172B4D] dark:text-gray-200 placeholder:text-[#C1C7D0] focus:outline-none focus:ring-2 focus:ring-[#0052CC] focus:border-transparent"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleAdd}
            disabled={!input.trim()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md bg-[#DEEBFF] dark:bg-blue-900/30 text-[#0052CC] dark:text-blue-300 hover:bg-[#C1D8FF] dark:hover:bg-blue-900/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Plus size={14} /> Thêm
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
      {parentKeys.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {parentKeys.map(key => (
            <span
              key={key}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-[#DEEBFF] dark:bg-blue-900/30 text-[#0052CC] dark:text-blue-300 rounded-full"
            >
              {key}
              <button
                onClick={() => onRemoveParent(key)}
                className="hover:text-red-500 transition-colors"
                aria-label={`Xóa ${key}`}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
