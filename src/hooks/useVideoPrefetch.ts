import { useEffect, useRef, useState } from 'react';

/**
 * useVideoPrefetch Hook
 * 
 * Provides an "instant-start" playback experience by pre-fetching
 * the first few megabytes of a video when a user hovers over a task card.
 */
export function useVideoPrefetch(videoUrl: string | null) {
  const [isPrefetched, setIsPrefetched] = useState(false);
  const [isPrefetching, setIsPrefetching] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const prefetch = async () => {
    if (!videoUrl || isPrefetched || isPrefetching) return;

    setIsPrefetching(true);
    console.log(`[PREFETCH] Starting prefetch for ${videoUrl.split('/').pop()}`);

    try {
      // Create a hidden video element to trigger the browser's native pre-fetching
      const tempVideo = document.createElement('video');
      tempVideo.preload = 'auto';
      tempVideo.muted = true;
      
      // We only want the first few MBs, but browsers handle 'auto' efficiently 
      // by buffering the start. We can also use a range request if we wanted 
      // to be ultra-aggressive, but native 'preload' is safer across CDNs.
      tempVideo.src = videoUrl;
      
      // Wait for some data to be buffered
      await new Promise((resolve) => {
        tempVideo.oncanplaythrough = resolve;
        // Timeout after 3 seconds to avoid hanging
        setTimeout(resolve, 3000);
      });

      console.log(`[PREFETCH] Successfully buffered start of ${videoUrl.split('/').pop()}`);
      setIsPrefetched(true);
    } catch (error) {
      console.warn(`[PREFETCH] Failed to prefetch ${videoUrl}:`, error);
    } finally {
      setIsPrefetching(false);
    }
  };

  return { prefetch, isPrefetched, isPrefetching };
}
