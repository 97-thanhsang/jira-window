'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Download, ChevronLeft, ChevronRight, Paperclip, Image as ImageIcon } from 'lucide-react';
import type { JiraAttachment } from '@/types/jira';
import { api } from '@/lib/api';

interface AttachmentGalleryProps {
  attachments: JiraAttachment[];
}

// ─── Blob URL hook (handles auth headers for image loading) ──────────────────

interface UseBlobResult {
  blobUrl: string | null;
  loading: boolean;
}

function useAttachmentBlob(attachmentId: string, isImage: boolean, contentUrl: string): UseBlobResult {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const currentUrl = useRef<string | null>(null);

  useEffect(() => {
    if (!isImage || !attachmentId) return;

    let cancelled = false;
    setLoading(true);

    api
      .get(`/attachment-content/${attachmentId}`, {
        responseType: 'blob',
        params: { url: contentUrl },
      })
      .then((r) => {
        if (cancelled) return;
        const url = URL.createObjectURL(r.data as Blob);
        currentUrl.current = url;
        setBlobUrl(url);
      })
      .catch(() => {
        if (!cancelled) setBlobUrl(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (currentUrl.current) {
        URL.revokeObjectURL(currentUrl.current);
        currentUrl.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachmentId, isImage, contentUrl]);

  return { blobUrl, loading };
}

// ─── Individual thumbnail card ───────────────────────────────────────────────

interface AttachmentCardProps {
  attachment: JiraAttachment;
  onClick: () => void;
}

function AttachmentCard({ attachment, onClick }: AttachmentCardProps) {
  const isImage = attachment.mimeType.startsWith('image/');
  const { blobUrl, loading } = useAttachmentBlob(attachment.id, isImage, attachment.content);

  return (
    <div
      className="flex flex-col items-center cursor-pointer group"
      style={{ width: 96 }}
      onClick={onClick}
      title={attachment.filename}
    >
      {/* Thumbnail box */}
      <div
        className="relative border border-[#DFE1E6] rounded-sm overflow-hidden w-full group-hover:border-[#0052CC] transition-colors dark:border-gray-600 dark:hover:border-[#0052CC]"
        style={{ height: 96 }}
      >
        {isImage ? (
          loading ? (
            <div className="w-full h-full bg-[#F4F5F7] dark:bg-gray-800 flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-[#0052CC] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : blobUrl ? (
            <img
              src={blobUrl}
              alt={attachment.filename}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-[#F4F5F7] dark:bg-gray-800 flex items-center justify-center">
              <ImageIcon size={24} className="text-[#5E6C84]" />
            </div>
          )
        ) : (
          <div className="w-full h-full bg-[#F4F5F7] dark:bg-gray-800 flex flex-col items-center justify-center p-2">
            <Paperclip size={20} className="text-[#5E6C84] mb-1" />
          </div>
        )}
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
      </div>
      {/* Filename label */}
      <span className="mt-1 text-[10px] text-[#5E6C84] text-center line-clamp-2 break-all w-full leading-tight group-hover:text-[#0052CC] transition-colors">
        {attachment.filename}
      </span>
    </div>
  );
}

// ─── Lightbox ────────────────────────────────────────────────────────────────

interface LightboxProps {
  attachments: JiraAttachment[];
  initialIndex: number;
  onClose: () => void;
}

function Lightbox({ attachments, initialIndex, onClose }: LightboxProps) {
  const [index, setIndex] = useState(initialIndex);
  const current = attachments[index];
  const isImage = current.mimeType.startsWith('image/');
  const { blobUrl, loading } = useAttachmentBlob(current.id, isImage, current.content);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(attachments.length - 1, i + 1));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [attachments.length, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl w-full mx-4 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between bg-[#172B4D] text-white px-4 py-2 rounded-t">
          <span className="text-sm font-medium truncate flex-1 mr-4">
            {current.filename}
          </span>
          <div className="flex items-center gap-3 flex-shrink-0">
            <a
              href={current.content}
              download={current.filename}
              className="text-white/70 hover:text-white transition-colors"
              title="Download"
              onClick={(e) => e.stopPropagation()}
            >
              <Download size={16} />
            </a>
            <button
              onClick={onClose}
              className="text-white/70 hover:text-white transition-colors"
              title="Close (Esc)"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="bg-[#1D2125] flex items-center justify-center min-h-[400px] max-h-[75vh] overflow-auto rounded-b">
          {isImage ? (
            loading ? (
              <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : blobUrl ? (
              <img
                src={blobUrl}
                alt={current.filename}
                className="max-w-full max-h-[75vh] object-contain"
              />
            ) : (
              <span className="text-white/50 text-sm">Failed to load image</span>
            )
          ) : (
            <div className="text-white/70 text-center p-8">
              <Paperclip size={40} className="mx-auto mb-3" />
              <p className="text-sm">{current.filename}</p>
              <p className="text-xs text-white/50 mt-1">
                {(current.size / 1024).toFixed(1)} KB
              </p>
              <a
                href={current.content}
                download={current.filename}
                className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 bg-[#0052CC] text-white text-xs rounded hover:bg-[#0747A6] transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <Download size={13} />
                Download
              </a>
            </div>
          )}
        </div>

        {/* Navigation arrows */}
        {attachments.length > 1 && (
          <>
            <button
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 disabled:opacity-30 transition-colors"
              title="Previous (←)"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={() => setIndex((i) => Math.min(attachments.length - 1, i + 1))}
              disabled={index === attachments.length - 1}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 disabled:opacity-30 transition-colors"
              title="Next (→)"
            >
              <ChevronRight size={20} />
            </button>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/50 text-white/80 text-xs px-2 py-0.5 rounded-full">
              {index + 1} / {attachments.length}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────

export function AttachmentGallery({ attachments }: AttachmentGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (!attachments || attachments.length === 0) return null;

  return (
    <section>
      <h2 className="text-xs font-semibold text-[#5E6C84] uppercase tracking-wider mb-3">
        Attachments ({attachments.length})
      </h2>
      <div className="flex flex-wrap gap-2">
        {attachments.map((att, i) => (
          <AttachmentCard
            key={att.id}
            attachment={att}
            onClick={() => setLightboxIndex(i)}
          />
        ))}
      </div>

      {lightboxIndex !== null && (
        <Lightbox
          attachments={attachments}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </section>
  );
}
