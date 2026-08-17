'use client';

import { X } from 'lucide-react';

const SHORTCUTS = [
  { keys: 'G → B', action: 'Go to Board' },
  { keys: 'G → I', action: 'Go to My Issues' },
  { keys: 'G → S', action: 'Go to Settings' },
  { keys: 'C', action: 'Create Issue' },
  { keys: 'L', action: 'Log Work (on issue page)' },
  { keys: '?', action: 'Show this overlay' },
  { keys: 'Ctrl + K', action: 'Open Command Palette' },
  { keys: 'Esc', action: 'Close modal / overlay' },
] as const;

interface KeyboardShortcutsOverlayProps {
  onClose: () => void;
}

export function KeyboardShortcutsOverlay({ onClose }: KeyboardShortcutsOverlayProps) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#DFE1E6] dark:border-gray-700">
          <h2 className="text-sm font-semibold text-[#172B4D] dark:text-gray-100">
            Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            className="text-[#5E6C84] dark:text-gray-400 hover:text-[#172B4D] dark:hover:text-gray-100 transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Shortcuts list */}
        <div className="p-4 space-y-1">
          {SHORTCUTS.map(({ keys, action }) => (
            <div
              key={keys}
              className="flex items-center justify-between py-2 px-3 rounded hover:bg-[#F4F5F7] dark:hover:bg-gray-700 transition-colors"
            >
              <span className="text-sm text-[#172B4D] dark:text-gray-200">{action}</span>
              <kbd className="inline-flex items-center px-2 py-0.5 text-xs font-mono text-[#42526E] dark:text-gray-300 bg-[#F4F5F7] dark:bg-gray-700 border border-[#DFE1E6] dark:border-gray-600 rounded whitespace-nowrap">
                {keys}
              </kbd>
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-[#DFE1E6] dark:border-gray-700 bg-[#F4F5F7] dark:bg-gray-900 text-xs text-[#5E6C84] dark:text-gray-400 text-center">
          Shortcuts only work when not focused in a text field
        </div>
      </div>
    </div>
  );
}
