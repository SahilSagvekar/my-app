'use client';

// src/components/review/YoutubePlayer.tsx
//
// Wraps YouTube's real IFrame Player API (documented, postMessage-based —
// unlike Google Drive's preview embed, which has no API at all). Exposes
// an imperative handle shaped like the subset of HTMLVideoElement the
// review screen already uses, so the parent's existing play/pause/seek
// logic barely has to branch.
//
// YouTube's API doesn't push continuous time updates the way <video>'s
// `timeupdate` event does — so, same as the resilient poller built for the
// native-video path, this polls player.getCurrentTime() on an interval
// while playing.

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

let apiLoadPromise: Promise<void> | null = null;

function loadYoutubeIframeApi(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if ((window as any).YT?.Player) return Promise.resolve();
  if (apiLoadPromise) return apiLoadPromise;

  apiLoadPromise = new Promise((resolve) => {
    const existingCallback = (window as any).onYouTubeIframeAPIReady;
    (window as any).onYouTubeIframeAPIReady = () => {
      existingCallback?.();
      resolve();
    };
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }
  });
  return apiLoadPromise;
}

export interface YoutubePlayerHandle {
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  setMuted: (muted: boolean) => void;
  setPlaybackRate: (rate: number) => void;
}

interface YoutubePlayerProps {
  videoId: string;
  className?: string;
  onReady?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onError?: () => void;
  onTimeUpdate?: (currentTime: number) => void;
  onDurationChange?: (duration: number) => void;
}

export const YoutubePlayer = forwardRef<YoutubePlayerHandle, YoutubePlayerProps>(
  function YoutubePlayer(
    { videoId, className, onReady, onPlay, onPause, onEnded, onError, onTimeUpdate, onDurationChange },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<any>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [containerId] = useState(() => `yt-player-${Math.random().toString(36).slice(2)}`);

    useImperativeHandle(ref, () => ({
      play: () => playerRef.current?.playVideo?.(),
      pause: () => playerRef.current?.pauseVideo?.(),
      seekTo: (seconds: number) => playerRef.current?.seekTo?.(seconds, true),
      getCurrentTime: () => playerRef.current?.getCurrentTime?.() ?? 0,
      getDuration: () => playerRef.current?.getDuration?.() ?? 0,
      setMuted: (muted: boolean) => {
        if (muted) playerRef.current?.mute?.();
        else playerRef.current?.unMute?.();
      },
      setPlaybackRate: (rate: number) => playerRef.current?.setPlaybackRate?.(rate),
    }), []);

    useEffect(() => {
      let cancelled = false;

      loadYoutubeIframeApi().then(() => {
        if (cancelled || !containerRef.current) return;

        const YT = (window as any).YT;
        playerRef.current = new YT.Player(containerId, {
          videoId,
          playerVars: {
            playsinline: 1,
            rel: 0,
            modestbranding: 1,
            controls: 0, // we render our own controls, same as the native-video path
          },
          events: {
            onReady: () => {
              onReady?.();
              const duration = playerRef.current?.getDuration?.();
              if (Number.isFinite(duration) && duration > 0) onDurationChange?.(duration);
            },
            onStateChange: (e: any) => {
              const YTState = YT.PlayerState;
              if (e.data === YTState.PLAYING) {
                onPlay?.();
                const duration = playerRef.current?.getDuration?.();
                if (Number.isFinite(duration) && duration > 0) onDurationChange?.(duration);

                if (pollRef.current) clearInterval(pollRef.current);
                pollRef.current = setInterval(() => {
                  const t = playerRef.current?.getCurrentTime?.();
                  if (Number.isFinite(t)) onTimeUpdate?.(t);
                }, 200);
              } else {
                if (pollRef.current) {
                  clearInterval(pollRef.current);
                  pollRef.current = null;
                }
                if (e.data === YTState.PAUSED) onPause?.();
                if (e.data === YTState.ENDED) onEnded?.();
              }
            },
            onError: () => onError?.(),
          },
        });
      });

      return () => {
        cancelled = true;
        if (pollRef.current) clearInterval(pollRef.current);
        try { playerRef.current?.destroy?.(); } catch { /* already gone */ }
        playerRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [videoId, containerId]);

    return <div ref={containerRef} className={className}><div id={containerId} className="w-full h-full" /></div>;
  }
);