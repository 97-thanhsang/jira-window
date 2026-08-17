'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, RotateCcw, Moon, Sun, Sparkles } from 'lucide-react';
import { clearAuth, getStoredUser } from '@/lib/api';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type StoredUser = {
  displayName?: string;
  emailAddress?: string;
  name?: string;
} | null;

const SHORTCUTS_TABLE = [
  { keys: 'G → B', action: 'Go to Board' },
  { keys: 'G → I', action: 'Go to My Issues' },
  { keys: 'G → S', action: 'Go to Settings' },
  { keys: 'C', action: 'Create Issue' },
  { keys: 'L', action: 'Log Work (on issue page)' },
  { keys: '?', action: 'Show Keyboard Shortcuts' },
  { keys: 'Ctrl + K', action: 'Open Command Palette (search)' },
  { keys: 'Esc', action: 'Close modal / overlay' },
] as const;

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredUser>(null);
  const [isDark, setIsDark] = useState(false);
  const [aiKey, setAiKey] = useState('');
  const [aiKeyInput, setAiKeyInput] = useState('');
  const [aiKeySaved, setAiKeySaved] = useState(false);

  // Read user from localStorage — only in useEffect to avoid SSR mismatch
  useEffect(() => {
    setUser(getStoredUser() as StoredUser);
  }, []);

  // Read dark mode state from localStorage on mount
  useEffect(() => {
    const theme = localStorage.getItem('theme');
    setIsDark(theme === 'dark');
  }, []);

  // Read AI key from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('ai_api_key') ?? '';
    setAiKey(stored);
  }, []);

  const initials = user?.displayName
    ? user.displayName
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'U';

  function handleLogout() {
    clearAuth();
    router.replace('/login');
  }

  function handleRelogin() {
    router.replace('/login');
  }

  function handleToggleDark() {
    const root = document.documentElement;
    if (isDark) {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setIsDark(false);
    } else {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setIsDark(true);
    }
  }

  function handleSaveAiKey() {
    const trimmed = aiKeyInput.trim();
    if (!trimmed) return;
    localStorage.setItem('ai_api_key', trimmed);
    setAiKey(trimmed);
    setAiKeyInput('');
    setAiKeySaved(true);
    setTimeout(() => setAiKeySaved(false), 2000);
  }

  function handleRemoveAiKey() {
    localStorage.removeItem('ai_api_key');
    setAiKey('');
    setAiKeyInput('');
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      <h1 className="text-xl font-semibold text-[#172B4D] dark:text-gray-100">Settings</h1>

      {/* ── Account Section ── */}
      <section className="bg-white dark:bg-gray-800 rounded-sm border border-[#DFE1E6] dark:border-gray-700 p-5">
        <h2 className="text-xs font-semibold text-[#5E6C84] dark:text-gray-400 uppercase tracking-wider mb-4">
          Account
        </h2>
        <div className="flex items-center gap-4">
          <Avatar className="w-12 h-12">
            <AvatarFallback className="bg-[#0052CC] text-white text-sm font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#172B4D] dark:text-gray-100 truncate">
              {user?.displayName ?? 'User'}
            </p>
            <p className="text-xs text-[#5E6C84] dark:text-gray-400 truncate">
              {user?.emailAddress ?? '—'}
            </p>
            {user?.name && (
              <p className="text-xs text-[#5E6C84] dark:text-gray-500 truncate mt-0.5">
                @{user.name}
              </p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="flex items-center gap-2 flex-shrink-0"
          >
            <LogOut size={13} />
            Log out
          </Button>
        </div>
      </section>

      {/* ── Connection Section ── */}
      <section className="bg-white dark:bg-gray-800 rounded-sm border border-[#DFE1E6] dark:border-gray-700 p-5">
        <h2 className="text-xs font-semibold text-[#5E6C84] dark:text-gray-400 uppercase tracking-wider mb-4">
          Connection
        </h2>
        <div className="flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <label className="text-xs text-[#5E6C84] dark:text-gray-400 block mb-1">
              Jira Server
            </label>
            <p className="text-sm font-medium text-[#172B4D] dark:text-gray-100 font-mono bg-[#F4F5F7] dark:bg-gray-700 px-3 py-1.5 rounded border border-[#DFE1E6] dark:border-gray-600 truncate">
              https://task.ascvn.com.vn
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRelogin}
            className="flex items-center gap-2 flex-shrink-0 mt-5"
          >
            <RotateCcw size={13} />
            Re-login
          </Button>
        </div>
      </section>

      {/* ── Appearance Section ── */}
      <section className="bg-white dark:bg-gray-800 rounded-sm border border-[#DFE1E6] dark:border-gray-700 p-5">
        <h2 className="text-xs font-semibold text-[#5E6C84] dark:text-gray-400 uppercase tracking-wider mb-4">
          Appearance
        </h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-[#172B4D] dark:text-gray-100">
              Dark Mode
            </p>
            <p className="text-xs text-[#5E6C84] dark:text-gray-400 mt-0.5">
              Toggle between light and dark theme
            </p>
          </div>
          <button
            onClick={handleToggleDark}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-[#DFE1E6] dark:border-gray-600 text-sm font-medium text-[#172B4D] dark:text-gray-100 bg-[#F4F5F7] dark:bg-gray-700 hover:bg-[#DFE1E6] dark:hover:bg-gray-600 transition-colors"
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
            {isDark ? 'Light Mode' : 'Dark Mode'}
          </button>
        </div>
      </section>

      {/* ── AI Assistant Section ── */}
      <section className="bg-white dark:bg-gray-800 rounded-sm border border-[#DFE1E6] dark:border-gray-700 p-5">
        <h2 className="text-xs font-semibold text-[#5E6C84] dark:text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
          <Sparkles size={13} />
          AI Assistant (Gemini)
        </h2>
        <p className="text-xs text-[#5E6C84] dark:text-gray-400 mb-4">
          Enter your Google AI Studio API key to enable AI features.{' '}
          <a
            href="https://aistudio.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#0052CC] hover:underline"
          >
            Get free API key →
          </a>
        </p>

        {/* Status indicator */}
        <div className="mb-3">
          {aiKey ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2.5 py-1 rounded-full border border-green-200 dark:border-green-800">
              ✅ API key saved
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2.5 py-1 rounded-full border border-amber-200 dark:border-amber-800">
              ⚠️ No API key — AI features disabled
            </span>
          )}
        </div>

        {/* Key input + actions */}
        <div className="flex items-center gap-2">
          <Input
            type="password"
            placeholder="AIza..."
            value={aiKeyInput}
            onChange={(e) => setAiKeyInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveAiKey(); }}
            className="flex-1 font-mono text-sm"
          />
          <Button
            size="sm"
            onClick={handleSaveAiKey}
            disabled={!aiKeyInput.trim()}
          >
            {aiKeySaved ? '✓ Saved' : 'Save key'}
          </Button>
          {aiKey && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleRemoveAiKey}
              className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
            >
              Remove
            </Button>
          )}
        </div>
      </section>

      {/* ── Keyboard Shortcuts Reference ── */}
      <section className="bg-white dark:bg-gray-800 rounded-sm border border-[#DFE1E6] dark:border-gray-700 p-5">
        <h2 className="text-xs font-semibold text-[#5E6C84] dark:text-gray-400 uppercase tracking-wider mb-4">
          Keyboard Shortcuts
        </h2>
        <div className="overflow-hidden rounded border border-[#DFE1E6] dark:border-gray-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F4F5F7] dark:bg-gray-700 border-b border-[#DFE1E6] dark:border-gray-600">
                <th className="px-4 py-2 text-left text-xs font-semibold text-[#5E6C84] dark:text-gray-400 uppercase tracking-wide">
                  Keys
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-[#5E6C84] dark:text-gray-400 uppercase tracking-wide">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {SHORTCUTS_TABLE.map(({ keys, action }) => (
                <tr
                  key={keys}
                  className="border-b border-[#DFE1E6] dark:border-gray-700 last:border-b-0 hover:bg-[#F4F5F7] dark:hover:bg-gray-700"
                >
                  <td className="px-4 py-2.5">
                    <kbd className="inline-flex items-center px-2 py-0.5 text-xs font-mono text-[#172B4D] dark:text-gray-100 bg-[#F4F5F7] dark:bg-gray-700 border border-[#DFE1E6] dark:border-gray-600 rounded">
                      {keys}
                    </kbd>
                  </td>
                  <td className="px-4 py-2.5 text-[#172B4D] dark:text-gray-200 text-sm">
                    {action}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
