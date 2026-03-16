"use client";

import { useCallback, useRef } from 'react';

export function useVideoPrefetch() {
  const prefetchedUrls = useRef<Set<string>>(new Set());

  const prefetch = useCallback((url: string) => {
    if (!url || prefetchedUrls.current.has(url)) return;

    // Standard prefetch using <link rel="prefetch">
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.as = 'video';
    link.href = url;
    document.head.appendChild(link);

    prefetchedUrls.current.add(url);
    console.log(`[Prefetch] Queued: ${url.split('?')[0].split('/').pop()}`);
  }, []);

  return { prefetch };
}
