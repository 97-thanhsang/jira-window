'use client';
import { useState, useEffect, useRef } from 'react';
import { Users, ChevronDown, ChevronUp, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import type { TeamGroup } from '@/types/jira';

interface JiraUserResult {
  name: string;
  displayName: string;
}

export interface GroupSelectorProps {
  groups: TeamGroup[];
  selectedMembers: string[];
  memberDisplayNames: Record<string, string>;
  onAddMember: (username: string, displayName: string) => void;
  onRemoveMember: (username: string) => void;
  onSelectGroup: (group: TeamGroup) => void;
  onSelectAllMembers: () => void;
  defaultExpanded?: boolean;
  /** Rendered below member chips, inside the expanded card */
  children?: React.ReactNode;
}

export function GroupSelector({
  groups,
  selectedMembers,
  memberDisplayNames,
  onAddMember,
  onRemoveMember,
  onSelectGroup,
  onSelectAllMembers,
  defaultExpanded = true,
  children,
}: GroupSelectorProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberResults, setMemberResults] = useState<JiraUserResult[]>([]);
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);
  const memberRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isAllMembers = selectedMembers.length === 0;

  // Detect which group is currently selected (exact match)
  const activeGroup = groups.find(
    g => g.members.length === selectedMembers.length && g.members.every(m => selectedMembers.includes(m)),
  );

  // Debounced member search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (memberSearch.length < 1) {
      setMemberResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await api.get<JiraUserResult[]>('/user/search', {
          params: { username: memberSearch, maxResults: 12 },
        });
        setMemberResults(Array.isArray(r.data) ? r.data : []);
      } catch {
        setMemberResults([]);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [memberSearch]);

  // Click outside closes dropdowns
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (memberRef.current && !memberRef.current.contains(e.target as Node))
        setShowMemberDropdown(false);
      if (groupRef.current && !groupRef.current.contains(e.target as Node))
        setShowGroupDropdown(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleAddMember(username: string, displayName: string) {
    onAddMember(username, displayName);
    setMemberSearch('');
    setShowMemberDropdown(false);
  }

  function handleSelectGroup(group: TeamGroup) {
    onSelectGroup(group);
    setShowGroupDropdown(false);
  }

  function handleSelectAllMembers() {
    onSelectAllMembers();
    setShowGroupDropdown(false);
  }

  return (
    <div className="mb-4 rounded-sm border border-[#DFE1E6] dark:border-gray-700 bg-[#F4F5F7] dark:bg-gray-800/60">
      {/* Header */}
      <div
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#EBECF0] dark:hover:bg-gray-800 transition-colors cursor-pointer"
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter') setExpanded(!expanded); }}
      >
        <div className="flex items-center gap-2">
          <Users size={16} className="text-[#0052CC]" />
          <span className="text-sm font-semibold text-[#172B4D] dark:text-gray-100">
            {!isAllMembers
              ? activeGroup?.name ?? `${selectedMembers.length} members`
              : 'All Members'}
          </span>
          {!isAllMembers && (
            <span className="text-xs bg-[#0052CC] text-white px-2 py-0.5 rounded-full font-medium">
              {selectedMembers.length}
            </span>
          )}
        </div>
        {expanded ? <ChevronUp size={14} className="text-[#5E6C84]" /> : <ChevronDown size={14} className="text-[#5E6C84]" />}
      </div>

      {expanded && (
        <>
          {/* Member chips */}
          <div className="flex items-center gap-3 px-4 pb-3 flex-wrap">
            <div className="relative" ref={memberRef}>
              <div className="flex items-center gap-1.5">
                <div
                  className="flex items-center flex-wrap gap-1 border border-[#DFE1E6] dark:border-gray-600 rounded bg-white dark:bg-gray-800 min-w-[200px] px-2 py-1 min-h-[30px] cursor-text"
                  onClick={() => setShowMemberDropdown(true)}
                >
                  {isAllMembers ? (
                    <span className="text-xs text-[#5E6C84] dark:text-gray-400">All Members</span>
                  ) : (
                    <>
                      {selectedMembers.slice(0, 5).map(m => (
                        <span key={m} className="inline-flex items-center gap-0.5 text-[10px] bg-[#E6F0FF] dark:bg-blue-900/40 text-[#0052CC] dark:text-blue-300 border border-[#0052CC]/20 rounded px-1.5 py-0.5">
                          {memberDisplayNames[m] || m}
                          <button onClick={e => { e.stopPropagation(); onRemoveMember(m); }} className="hover:text-red-500">
                            <X size={9} />
                          </button>
                        </span>
                      ))}
                      {selectedMembers.length > 5 && (
                        <span className="text-[10px] text-[#5E6C84]">+{selectedMembers.length - 5} more</span>
                      )}
                      <button onClick={e => { e.stopPropagation(); onSelectAllMembers(); }} className="text-[10px] text-[#5E6C84] hover:text-red-500 ml-auto">
                        clear
                      </button>
                    </>
                  )}
                </div>
              </div>

              {showMemberDropdown && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-gray-800 border border-[#DFE1E6] dark:border-gray-600 rounded shadow-lg z-40 max-h-64 overflow-y-auto">
                  <div className="p-1.5 border-b border-[#DFE1E6] dark:border-gray-700">
                    <input type="text" autoFocus value={memberSearch}
                      onChange={e => setMemberSearch(e.target.value)}
                      placeholder="Search member..."
                      className="w-full text-xs border border-[#DFE1E6] dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-[#172B4D] dark:text-gray-100 focus:outline-none focus:border-[#0052CC]" />
                  </div>
                  {memberSearch.length > 0 ? (
                    memberResults.map(u => (
                      <button key={u.name} type="button"
                        onClick={() => handleAddMember(u.name, u.displayName)}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-[#F4F5F7] dark:hover:bg-gray-700 text-[#172B4D] dark:text-gray-200 flex items-center justify-between">
                        <span>{u.displayName}</span>
                        {selectedMembers.includes(u.name) && <span className="text-[#0052CC]">✓</span>}
                      </button>
                    ))
                  ) : (
                    <p className="text-xs text-[#5E6C84] px-3 py-4 text-center">Type to search members</p>
                  )}
                </div>
              )}
            </div>

            {/* Group shortcut */}
            <div className="relative" ref={groupRef}>
              <button
                onClick={() => setShowGroupDropdown(!showGroupDropdown)}
                className="text-xs border border-[#DFE1E6] dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-800 text-[#5E6C84] dark:text-gray-400 hover:bg-[#F4F5F7] dark:hover:bg-gray-700 flex items-center gap-1"
              >
                <Users size={11} />
                Groups
                <ChevronDown size={10} />
              </button>
              {showGroupDropdown && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-gray-800 border border-[#DFE1E6] dark:border-gray-600 rounded shadow-lg z-40">
                  <button onClick={handleSelectAllMembers} className="w-full text-left px-3 py-2 text-xs hover:bg-[#F4F5F7] dark:hover:bg-gray-700 text-[#172B4D] dark:text-gray-200 border-b border-[#DFE1E6] dark:border-gray-700">
                    🌐 All Members
                  </button>
                  {groups.map(g => (
                    <button key={g.id} onClick={() => handleSelectGroup(g)} className="w-full text-left px-3 py-2 text-xs hover:bg-[#F4F5F7] dark:hover:bg-gray-700 text-[#172B4D] dark:text-gray-200 flex items-center justify-between">
                      <span>{g.name}</span>
                      <span className="text-[10px] text-[#5E6C84]">{g.members.length}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {children && (
            <div className="border-t border-[#DFE1E6] dark:border-gray-600">
              {children}
            </div>
          )}
        </>
      )}
    </div>
  );
}
