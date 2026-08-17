import { useCallback, useEffect, useRef, useState } from 'react';
import type { PipelineStage } from '@/types/opencode';

export interface StreamEvent {
  type: 'start' | 'progress' | 'done' | 'complete' | 'error' | 'stderr';
  data: Record<string, unknown>;
}

interface UsePipelineStreamOptions {
  onDone?: (wireLine: string) => void;
  onError?: (message: string) => void;
}

/**
 * Hook để trigger một pipeline stage và stream progress via SSE
 */
export function usePipelineStream(opts?: UsePipelineStreamOptions) {
  const [lines, setLines] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [lastEvent, setLastEvent] = useState<StreamEvent | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);

  const stop = useCallback(() => {
    readerRef.current?.cancel();
    readerRef.current = null;
    setIsRunning(false);
  }, []);

  const trigger = useCallback(
    (taskKey: string, stage: PipelineStage, mode?: string) => {
      // Fix #5: Cancel any in-flight reader before starting a new one
      if (readerRef.current) {
        readerRef.current.cancel();
        readerRef.current = null;
      }

      // Fix #6: Set isRunning BEFORE fetch so the button is disabled immediately
      setIsRunning(true);
      setLines([]);

      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

      // Read auth from localStorage for the backend request
      const auth = typeof window !== 'undefined' ? localStorage.getItem('jira_auth') : null;

      fetch(`${API_URL}/api/opencode/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(auth ? { 'X-Jira-Auth': auth } : {}),
        },
        body: JSON.stringify({ taskKey, stage, mode }),
      }).then(async (res) => {
        // Fix #7: Surface HTTP errors (e.g. 400, 401) via onError
        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          opts?.onError?.(`Server error ${res.status}: ${errText}`);
          setIsRunning(false);
          return;
        }

        if (!res.body) {
          opts?.onError?.('No response body from server');
          setIsRunning(false);
          return;
        }

        const reader = res.body.getReader();
        readerRef.current = reader;
        const decoder = new TextDecoder();
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const parts = buffer.split('\n\n');
            buffer = parts.pop() ?? '';

            for (const part of parts) {
              const lines = part.split('\n');
              let eventType = '';
              let dataStr = '';

              for (const line of lines) {
                if (line.startsWith('event: ')) eventType = line.slice(7);
                if (line.startsWith('data: ')) dataStr = line.slice(6);
              }

              if (eventType && dataStr) {
                try {
                  const data = JSON.parse(dataStr) as Record<string, unknown>;
                  const event: StreamEvent = { type: eventType as StreamEvent['type'], data };
                  setLastEvent(event);

                  if (eventType === 'progress' && data.line) {
                    setLines((prev) => [...prev, String(data.line)]);
                  }
                  if (eventType === 'done' && data.wireLine) {
                    opts?.onDone?.(String(data.wireLine));
                  }
                  if (eventType === 'error' && data.message) {
                    opts?.onError?.(String(data.message));
                  }
                  if (eventType === 'complete') {
                    setIsRunning(false);
                  }
                } catch { /* ignore parse errors */ }
              }
            }
          }
        } catch {
          // Stream cancelled or ended — not an error if we initiated the cancel
        }

        setIsRunning(false);
      }).catch((err) => {
        opts?.onError?.(String(err));
        setIsRunning(false);
      });
    },
    [opts]
  );

  useEffect(() => () => stop(), [stop]);

  return { lines, isRunning, lastEvent, trigger, stop };
}
