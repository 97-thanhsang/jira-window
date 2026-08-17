'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { X, Search, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface JiraUserResult {
  name: string;
  displayName: string;
  avatarUrls: {
    '48x48': string;
    '24x24': string;
  };
}

interface UserSearchInputProps {
  value: string | undefined;
  onChange: (username: string | undefined, displayName?: string) => void;
  placeholder?: string;
  includeUnassigned?: boolean;
  label?: string;
}

const inputClass =
  'text-xs border border-[#DFE1E6] dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-800 text-[#172B4D] dark:text-gray-100 focus:outline-none focus:border-[#0052CC] dark:focus:border-blue-400 placeholder-[#5E6C84] dark:placeholder-gray-500';

export function UserSearchInput({
  value,
  onChange,
  placeholder = 'User...',
  includeUnassigned = false,
  label,
}: UserSearchInputProps) {
  const [query, setQuery] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [results, setResults] = useState<JiraUserResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch users with debounce
  const searchUsers = useCallback((q: string) => {
    if (q.length < 1) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    api
      .get<JiraUserResult[]>('/user/search', {
        params: { username: q, maxResults: 15 },
      })
      .then((r) => {
        setResults(Array.isArray(r.data) ? r.data : []);
        setIsOpen(true);
        setHighlightIndex(-1);
      })
      .catch(() => {
        setResults([]);
        setIsOpen(false);
      })
      .finally(() => setIsLoading(false));
  }, []);

  function handleInputChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      searchUsers(value);
    }, 300);
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function handleSelect(username: string, displayNameValue: string) {
    onChange(username, displayNameValue);
    setDisplayName(displayNameValue || username);
    setQuery('');
    setResults([]);
    setIsOpen(false);
  }

  function handleSelectCurrentUser() {
    onChange('currentUser()', 'Me');
    setDisplayName('Me');
    setQuery('');
    setResults([]);
    setIsOpen(false);
  }

  function handleSelectUnassigned() {
    onChange('EMPTY', 'Unassigned');
    setDisplayName('Unassigned');
    setQuery('');
    setResults([]);
    setIsOpen(false);
  }

  function handleClear() {
    onChange(undefined);
    setDisplayName('');
    setQuery('');
    setResults([]);
    setIsOpen(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen) {
      if (e.key === 'ArrowDown') {
        setQuery('');
        searchUsers('');
        return;
      }
      return;
    }

    const totalItems = (includeUnassigned ? 2 : 1) + results.length;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((prev) => (prev + 1) % totalItems);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((prev) => (prev - 1 + totalItems) % totalItems);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightIndex === 0) {
        handleSelectCurrentUser();
      } else if (includeUnassigned && highlightIndex === 1) {
        handleSelectUnassigned();
      } else if (highlightIndex >= 2 || (!includeUnassigned && highlightIndex >= 1)) {
        const offset = includeUnassigned ? 2 : 1;
        const result = results[highlightIndex - offset];
        if (result) handleSelect(result.name, result.displayName);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setQuery('');
    }
  }

  // If a value is selected, show it as a chip
  if (value) {
    return (
      <div className="flex items-center gap-1.5" ref={containerRef}>
        {label && (
          <span className="text-xs font-medium text-[#5E6C84] dark:text-gray-400 whitespace-nowrap">
            {label}
          </span>
        )}
        <span className="inline-flex items-center gap-1 text-xs bg-[#E6F0FF] dark:bg-blue-900/40 text-[#0052CC] dark:text-blue-300 border border-[#0052CC]/20 dark:border-blue-600/30 rounded px-2 py-0.5">
          {displayName || (value === 'EMPTY' ? 'Unassigned' : value)}
          <button
            onClick={handleClear}
            className="hover:text-red-500 transition-colors ml-0.5"
            aria-label={`Remove ${label || 'user'} filter`}
          >
            <X size={10} />
          </button>
        </span>
      </div>
    );
  }

  return (
    <div className="relative flex items-center gap-1.5" ref={containerRef}>
      {label && (
        <span className="text-xs font-medium text-[#5E6C84] dark:text-gray-400 whitespace-nowrap">
          {label}
        </span>
      )}
      <div className="relative">
        <Search
          size={12}
          className="absolute left-2 top-1/2 -translate-y-1/2 text-[#5E6C84] dark:text-gray-500 pointer-events-none"
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (query.length >= 1 && results.length > 0) setIsOpen(true);
          }}
          placeholder={placeholder}
          className={cn(inputClass, 'pl-6 w-[140px]')}
          aria-label={label || placeholder}
        />

        {/* Dropdown */}
        {isOpen && (
          <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-gray-800 border border-[#DFE1E6] dark:border-gray-600 rounded shadow-lg z-30 max-h-72 overflow-y-auto">
            {/* Current user — always first */}
            <button
              type="button"
              onClick={handleSelectCurrentUser}
              className={cn(
                'w-full flex items-center gap-2 text-left px-3 py-2 text-xs transition-colors',
                highlightIndex === 0
                  ? 'bg-[#0052CC] text-white'
                  : 'text-[#172B4D] dark:text-gray-200 hover:bg-[#F4F5F7] dark:hover:bg-gray-700'
              )}
            >
              <User size={14} className="flex-shrink-0 text-[#0052CC]" />
              <span className="font-medium">Me (current user)</span>
            </button>

            {/* Unassigned option */}
            {includeUnassigned && (
              <button
                type="button"
                onClick={handleSelectUnassigned}
                className={cn(
                  'w-full flex items-center gap-2 text-left px-3 py-2 text-xs transition-colors',
                  highlightIndex === 1
                    ? 'bg-[#0052CC] text-white'
                    : 'text-[#172B4D] dark:text-gray-200 hover:bg-[#F4F5F7] dark:hover:bg-gray-700'
                )}
              >
                <User size={14} className="flex-shrink-0 text-[#5E6C84]" />
                <span>Unassigned</span>
              </button>
            )}

            {/* Loading */}
            {isLoading && (
              <div className="px-3 py-2 text-xs text-[#5E6C84] dark:text-gray-400">
                Searching...
              </div>
            )}

            {/* API results */}
            {!isLoading &&
              results.map((user, idx) => {
                const itemIdx = includeUnassigned ? idx + 2 : idx + 1;
                return (
                  <button
                    key={user.name}
                    type="button"
                    onClick={() => handleSelect(user.name, user.displayName)}
                    className={cn(
                      'w-full flex items-center gap-2 text-left px-3 py-2 text-xs transition-colors',
                      highlightIndex === itemIdx
                        ? 'bg-[#0052CC] text-white'
                        : 'text-[#172B4D] dark:text-gray-200 hover:bg-[#F4F5F7] dark:hover:bg-gray-700'
                    )}
                  >
                    <img
                      src={user.avatarUrls['24x24']}
                      alt=""
                      className="w-5 h-5 rounded-full flex-shrink-0"
                    />
                    <span>{user.displayName}</span>
                  </button>
                );
              })}

            {/* No results */}
            {!isLoading && query.length >= 1 && results.length === 0 && (
              <div className="px-3 py-2 text-xs text-[#5E6C84] dark:text-gray-400">
                No users found
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
