'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { isAuthenticated } from '@/lib/api';
import { Sidebar } from '@/components/sidebar';
import { CommandPalette } from '@/components/search/command-palette';
import { CreateIssueModal } from '@/components/create-issue-modal';
import { KeyboardShortcutsOverlay } from '@/components/keyboard-shortcuts-overlay';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [createOpen, setCreateOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
    }
  }, [router]);

  // Global keyboard shortcuts
  useEffect(() => {
    let gPressed = false;
    let gTimer: ReturnType<typeof setTimeout> | null = null;

    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const tag = target.tagName.toLowerCase();
      const isEditable =
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        target.isContentEditable;

      // Skip shortcuts when user is typing in a form field
      if (isEditable) return;

      // Skip Ctrl/Meta modified shortcuts (those are handled by CommandPalette)
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const key = e.key.toLowerCase();

      // G-sequence: press G then B/I/S within 1500ms
      if (key === 'g') {
        gPressed = true;
        if (gTimer) clearTimeout(gTimer);
        gTimer = setTimeout(() => {
          gPressed = false;
          gTimer = null;
        }, 1500);
        return;
      }

      if (gPressed) {
        gPressed = false;
        if (gTimer) {
          clearTimeout(gTimer);
          gTimer = null;
        }
        if (key === 'b') {
          e.preventDefault();
          router.push('/board');
          return;
        }
        if (key === 'i') {
          e.preventDefault();
          router.push('/issues');
          return;
        }
        if (key === 's') {
          e.preventDefault();
          router.push('/settings');
          return;
        }
        return;
      }

      // C → open Create Issue modal
      if (key === 'c') {
        e.preventDefault();
        setCreateOpen(true);
        return;
      }

      // L → open Log Work (only on /issues/[key] pages)
      if (key === 'l') {
        const onIssuePage = /^\/issues\/[^/]+$/.test(pathname);
        if (onIssuePage) {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('open-log-work'));
        }
        return;
      }

      // ? → open shortcuts overlay
      if (e.key === '?') {
        e.preventDefault();
        setShortcutsOpen((prev) => !prev);
        return;
      }

      // Escape → close overlays
      if (e.key === 'Escape') {
        setCreateOpen(false);
        setShortcutsOpen(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (gTimer) clearTimeout(gTimer);
    };
  }, [router, pathname]);

  return (
    <div className="flex min-h-screen bg-[#F4F5F7] dark:bg-gray-900">
      <Sidebar />
      <main className="flex-1 overflow-auto min-w-0">{children}</main>
      <CommandPalette />

      {/* Create Issue Modal — state lives at layout level so C shortcut and sidebar button both work */}
      {createOpen && (
        <CreateIssueModal
          onClose={() => setCreateOpen(false)}
          onSuccess={() => setCreateOpen(false)}
        />
      )}

      {/* Keyboard Shortcuts overlay */}
      {shortcutsOpen && (
        <KeyboardShortcutsOverlay onClose={() => setShortcutsOpen(false)} />
      )}
    </div>
  );
}
