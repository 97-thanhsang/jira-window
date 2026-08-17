'use client';

import { useEffect, useRef } from 'react';
import { jiraWikiToHtml } from '@/lib/jira-wiki';
import type { JiraAttachment } from '@/types/jira';
import { api } from '@/lib/api';

interface WikiRendererProps {
  content: string | null;
  attachments?: JiraAttachment[];
}

// Build a map of id → attachment for quick lookup
function buildAttachMap(attachments?: JiraAttachment[]): Map<string, JiraAttachment> {
  const map = new Map<string, JiraAttachment>();
  attachments?.forEach((a) => map.set(a.id, a));
  return map;
}

export function WikiRenderer({ content, attachments }: WikiRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // After HTML is injected, find all image placeholder spans and replace with real <img>
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !attachments?.length) return;

    const attachMap = buildAttachMap(attachments);
    const spans = container.querySelectorAll<HTMLSpanElement>('span[data-attachment-id]');
    if (!spans.length) return;

    const blobUrls: string[] = [];

    spans.forEach((span) => {
      const id = span.getAttribute('data-attachment-id');
      const filename = span.getAttribute('data-filename') || '';
      if (!id) return;

      const attachment = attachMap.get(id);
      if (!attachment) return;

      // Replace span with loading placeholder img
      const wrapper = document.createElement('span');
      wrapper.className = 'inline-block my-2';

      const img = document.createElement('img');
      img.alt = filename;
      img.className = 'max-w-full rounded border border-[#DFE1E6] cursor-pointer hover:opacity-90 transition-opacity';
      img.style.maxHeight = '400px';
      img.title = filename;

      // Show spinner while loading
      const spinner = document.createElement('span');
      spinner.className = 'inline-flex items-center gap-1 text-xs text-[#5E6C84] bg-[#F4F5F7] px-2 py-1 rounded border border-[#DFE1E6]';
      spinner.textContent = `⏳ ${filename}`;
      wrapper.appendChild(spinner);
      span.replaceWith(wrapper);

      // Fetch blob via our authenticated proxy
      api
        .get(`/attachment-content/${id}`, {
          responseType: 'blob',
          params: { url: attachment.content },
        })
        .then((r) => {
          const blobUrl = URL.createObjectURL(r.data as Blob);
          blobUrls.push(blobUrl);
          img.src = blobUrl;
          wrapper.innerHTML = '';
          wrapper.appendChild(img);
        })
        .catch(() => {
          // Fallback: show filename chip
          spinner.textContent = `📎 ${filename}`;
        });
    });

    // Cleanup blob URLs when component unmounts or content changes
    return () => {
      blobUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [content, attachments]);

  if (!content) {
    return (
      <p className="text-[#5E6C84] text-sm italic">No description provided.</p>
    );
  }

  return (
    <div
      ref={containerRef}
      className="text-sm text-[#172B4D] leading-relaxed"
      dangerouslySetInnerHTML={{ __html: jiraWikiToHtml(content, attachments) }}
    />
  );
}
