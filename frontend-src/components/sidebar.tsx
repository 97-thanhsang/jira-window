'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  ListTodo,
  Settings,
  ExternalLink,
  LogOut,
  Bell,
  Clock,
  Users,
  Calendar,
  CalendarDays,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  BarChart3,
  Bot,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { clearAuth, getStoredUser } from '@/lib/api';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { TooltipProvider } from '@/components/ui/tooltip';

// ─── Menu structure (2-level) ──────────────────────────────────────

interface NavSection {
  label: string;
  items: NavItem[];
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  external?: boolean;
}

const navSections: NavSection[] = [
  {
    label: 'My Workspace',
    items: [
      { href: '/board', label: 'My Board', icon: LayoutDashboard },
      { href: '/dashboard', label: 'Dashboard', icon: BarChart3 },
      { href: '/issues', label: 'My Issues', icon: ListTodo },
      { href: '/worklog', label: 'Worklog', icon: Clock },
      { href: '/opencode', label: 'OpenCode', icon: Bot },
    ],
  },
  {
    label: 'Team',
    items: [
      { href: '/team', label: 'Team Dashboard', icon: Users },
      { href: '/team-plan', label: 'Team Plan', icon: Calendar },
      { href: '/work-est', label: 'Work Est', icon: CalendarDays },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/settings', label: 'Settings', icon: Settings },
      { href: 'https://task.ascvn.com.vn', label: 'Open Jira', icon: ExternalLink, external: true },
    ],
  },
];

// ─── Types ────────────────────────────────────────────────────────

type StoredUser = { displayName?: string; emailAddress?: string; name?: string } | null;

interface Notification {
  key: string;
  summary: string;
  updated: string;
}

// ─── Component ────────────────────────────────────────────────────

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<StoredUser>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [lastSeen, setLastSeen] = useState<string>('');

  // ── Collapse state (persisted to localStorage) ──
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('sidebar_collapsed');
    if (saved !== null) setCollapsed(saved === '1');
    setMounted(true);
  }, []);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('sidebar_collapsed', next ? '1' : '0');
  }

  // ── Sections collapse state (persisted) ──
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  function toggleSection(label: string) {
    setCollapsedSections((prev) => ({ ...prev, [label]: !prev[label] }));
  }

  // ── User ──
  useEffect(() => {
    setUser(getStoredUser() as StoredUser);
  }, []);

  // Load last-seen timestamp for notifications
  useEffect(() => {
    const ts = localStorage.getItem('notif_last_seen') ?? new Date(0).toISOString();
    setLastSeen(ts);
  }, []);

  // Poll for recent updates every 60 seconds
  useEffect(() => {
    let mountedFlag = true;

    async function fetchNotifications() {
      try {
        const { api } = await import('@/lib/api');
        const since = localStorage.getItem('notif_last_seen') ?? '-15m';
        const jql = `assignee = currentUser() AND updated >= -15m AND resolution = Unresolved`;
        const res = await api.get<{ issues: Array<{ key: string; fields: { summary: string; updated: string } }> }>(
          '/search',
          { params: { jql, maxResults: 10, fields: 'summary,updated' } }
        );
        if (mountedFlag) {
          const items = (res.data.issues ?? []).map((i) => ({
            key: i.key,
            summary: i.fields.summary,
            updated: i.fields.updated,
          }));
          setNotifications(items);
        }
      } catch {
        // Silently fail — notifications are non-critical
      }
    }

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60_000);
    return () => {
      mountedFlag = false;
      clearInterval(interval);
    };
  }, []);

  const initials = user?.displayName
    ? user.displayName
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'U';

  const unreadCount = notifications.filter((n) => n.updated > lastSeen).length;

  function handleLogout() {
    clearAuth();
    router.replace('/login');
  }

  function handleBellClick() {
    setNotifOpen((prev) => !prev);
    const now = new Date().toISOString();
    localStorage.setItem('notif_last_seen', now);
    setLastSeen(now);
  }

  if (!mounted) return null;

  return (
    <TooltipProvider delay={300}>
      <aside
        className={cn(
          'sticky top-0 h-screen bg-[#0052CC] flex flex-col text-white flex-shrink-0 transition-all duration-200',
          'shadow-[2px_0_12px_rgba(0,0,0,0.2)] z-10',
          collapsed ? 'w-[56px]' : 'w-[220px]',
        )}
      >
        {/* Logo + Toggle */}
        <div className="flex items-center justify-between px-3 py-4 border-b border-blue-700">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-white rounded flex items-center justify-center flex-shrink-0">
                <span className="text-[#0052CC] font-bold text-xs">J</span>
              </div>
              <span className="font-semibold text-xs">Jira Power UI</span>
            </div>
          )}
          {collapsed && (
            <div className="w-6 h-6 bg-white rounded flex items-center justify-center mx-auto">
              <span className="text-[#0052CC] font-bold text-xs">J</span>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={toggleCollapsed}
              className="p-1 rounded hover:bg-white/10 transition-colors flex-shrink-0"
              title="Collapse sidebar"
            >
              <PanelLeftClose size={14} />
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-2 overflow-y-auto">
          {navSections.map((section) => {
            const isSectionCollapsed = collapsedSections[section.label] ?? false;

            return (
              <div key={section.label} className="mb-1">
                {/* Section header */}
                {!collapsed && (
                  <button
                    onClick={() => toggleSection(section.label)}
                    className="flex items-center gap-2 w-full px-4 py-1.5 text-[10px] font-semibold text-blue-200 hover:text-white transition-colors uppercase tracking-wider"
                  >
                    <ChevronDown
                      size={10}
                      className={cn(
                        'transition-transform',
                        isSectionCollapsed && '-rotate-90',
                      )}
                    />
                    {section.label}
                  </button>
                )}

                {/* Section items */}
                {(!collapsed ? !isSectionCollapsed : true) &&
                  section.items.map(({ href, label, icon: Icon, external }) => {
                    const isActive = !external && pathname.startsWith(href);
                    const linkContent = (
                      <>
                        <Icon size={16} className="flex-shrink-0" />
                        {!collapsed && <span className="truncate">{label}</span>}
                      </>
                    );

                    const linkClass = cn(
                      'flex items-center gap-3 text-sm font-medium transition-colors',
                      collapsed ? 'px-0 py-2.5 justify-center' : 'px-4 py-2.5',
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'text-blue-100 hover:bg-white/10 hover:text-white',
                    );

                    if (external) {
                      return (
                        <a
                          key={href}
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={linkClass}
                          title={collapsed ? label : undefined}
                        >
                          {linkContent}
                        </a>
                      );
                    }

                    return (
                      <Link
                        key={href}
                        href={href}
                        className={linkClass}
                        title={collapsed ? label : undefined}
                      >
                        {linkContent}
                      </Link>
                    );
                  })}
              </div>
            );
          })}
        </nav>

        {/* Expand button (when collapsed) */}
        {collapsed && (
          <div className="px-2 pb-2">
            <button
              onClick={toggleCollapsed}
              className="w-full flex items-center justify-center p-2 rounded hover:bg-white/10 transition-colors"
              title="Expand sidebar"
            >
              <PanelLeftOpen size={14} />
            </button>
          </div>
        )}

        {/* User */}
        {!collapsed && (
          <div className="px-4 py-3 border-t border-blue-700">
            {/* Notifications */}
            <div className="relative mb-2">
              <button
                onClick={handleBellClick}
                className="flex items-center gap-2 text-blue-100 hover:text-white transition-colors text-xs w-full"
                title="Notifications"
              >
                <div className="relative">
                  <Bell size={14} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center leading-none">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </div>
                Notifications
                {notifications.length > 0 && (
                  <span className="ml-auto text-[10px] text-blue-300">
                    {notifications.length} recent
                  </span>
                )}
              </button>

              {/* Notifications dropdown */}
              {notifOpen && (
                <div className="absolute bottom-full left-0 right-0 mb-1 bg-white rounded-lg shadow-xl border border-[#DFE1E6] z-50 max-h-64 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-5 text-center text-xs text-[#5E6C84]">
                      No recent updates
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <Link
                        key={notif.key}
                        href={`/issues/${notif.key}`}
                        onClick={() => setNotifOpen(false)}
                        className="flex items-start gap-2 px-3 py-2.5 hover:bg-[#F4F5F7] border-b border-[#DFE1E6] last:border-b-0 transition-colors"
                      >
                        <span className="text-xs text-[#0052CC] font-medium flex-shrink-0 mt-0.5">
                          {notif.key}
                        </span>
                        <span className="text-xs text-[#172B4D] truncate flex-1">
                          {notif.summary}
                        </span>
                      </Link>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 mb-2">
              <Avatar className="w-7 h-7">
                <AvatarFallback className="bg-white/20 text-white text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">
                  {user?.displayName ?? 'User'}
                </p>
                <p className="text-xs text-blue-200 truncate">
                  {user?.emailAddress ?? ''}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-xs text-blue-200 hover:text-white transition-colors"
            >
              <LogOut size={12} />
              Log out
            </button>
          </div>
        )}

        {/* Collapsed user: avatar + logout only */}
        {collapsed && (
          <div className="border-t border-blue-700 pt-2 pb-3">
            <div className="flex flex-col items-center gap-2">
              {/* Notifications bell */}
              <div className="relative">
                <button
                  onClick={handleBellClick}
                  className="p-1.5 rounded hover:bg-white/10 transition-colors"
                  title="Notifications"
                >
                  <div className="relative">
                    <Bell size={14} />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[8px] font-bold w-3 h-3 rounded-full flex items-center justify-center leading-none">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </div>
                </button>
              </div>

              <Avatar className="w-7 h-7">
                <AvatarFallback className="bg-white/20 text-white text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>

              <button
                onClick={handleLogout}
                className="p-1 rounded hover:bg-white/10 transition-colors"
                title="Log out"
              >
                <LogOut size={12} />
              </button>
            </div>
          </div>
        )}
      </aside>
    </TooltipProvider>
  );
}
