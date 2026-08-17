'use client';

import { useRouter } from 'next/navigation';
import { Plus, Clock, Search, ListTodo } from 'lucide-react';

interface WidgetQuickActionsProps {
  onCreateIssue?: () => void;
}

export function WidgetQuickActions({ onCreateIssue }: WidgetQuickActionsProps) {
  const router = useRouter();

  const actions = [
    {
      icon: Plus,
      label: 'Create Issue',
      onClick: () => onCreateIssue?.() ?? document.dispatchEvent(new CustomEvent('open-create-issue')),
      color: '#0052CC',
    },
    {
      icon: Clock,
      label: 'Log Work',
      onClick: () => router.push('/worklog'),
      color: '#36B37E',
    },
    {
      icon: Search,
      label: 'JQL Search',
      onClick: () => router.push('/search'),
      color: '#6554C0',
    },
    {
      icon: ListTodo,
      label: 'My Issues',
      onClick: () => router.push('/issues'),
      color: '#FF8B00',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {actions.map(action => (
        <button
          key={action.label}
          onClick={action.onClick}
          className="flex items-center gap-2 p-2.5 rounded-lg border border-[#DFE1E6] dark:border-gray-700 hover:bg-[#F4F5F7] dark:hover:bg-gray-800 transition-colors text-left group"
        >
          <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0 transition-colors" style={{ backgroundColor: `${action.color}10` }}>
            <action.icon size={14} style={{ color: action.color }} />
          </div>
          <span className="text-[11px] font-medium text-[#172B4D] dark:text-gray-200 group-hover:text-[#0052CC] dark:group-hover:text-blue-400 transition-colors">{action.label}</span>
        </button>
      ))}
    </div>
  );
}
