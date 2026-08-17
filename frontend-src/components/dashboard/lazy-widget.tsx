'use client';

import { useRef, useEffect, useState, type ReactNode } from 'react';

interface LazyWidgetProps {
  children: ReactNode;
  index: number;
  /** How many widgets to load immediately (above fold) */
  aboveFold?: number;
}

/** Wraps widget content with IntersectionObserver-based lazy loading.
 *  Widgets at index < aboveFold load immediately.
 *  Others load when they scroll into view, then stay rendered. */
export function LazyWidget({ children, index, aboveFold = 3 }: LazyWidgetProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(index < aboveFold);

  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin: '200px' },
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [visible]);

  if (visible) return <>{children}</>;

  return (
    <div ref={ref} className="space-y-2 animate-pulse p-4">
      <div className="h-3 bg-[#F4F5F7] dark:bg-gray-700 rounded w-24" />
      <div className="h-20 bg-[#F4F5F7] dark:bg-gray-700 rounded" />
    </div>
  );
}
