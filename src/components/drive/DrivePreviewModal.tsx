"use client";
// src/components/drive/DrivePreviewModal.tsx
//
// In-app preview for Drive files (Google-Drive style) instead of opening a
// raw R2 link in a new tab.
//
// Videos: plays the 720p HLS rendition when one exists — starts instantly
// and scrubs smoothly even for 4K/HEVC/ProRes originals that Chrome can't
// play at all — with sprite-sheet thumbnails on the seek bar. Until a
// rendition exists it plays the original (streamed same-origin with Range
// support, so seeking works) and asks the server to prepare one.
// Images and audio preview inline; everything else opens in a new tab.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Loader2,
  Maximize,
  Pause,
  Play,
  Volume2,
  VolumeX,
  Sparkles,
  AlertTriangle,
  X,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PreviewableItem {
  name: string;
  s3Key?: string;
  url?: string;
  size?: number;
  mimeType?: string | null;
}

interface PreviewInfo {
  status: "none" | "queued" | "processing" | "ready" | "failed" | "unknown";
  enabled: boolean;
  playlist?: string;
  sprites?: string;
  progress?: number;
  durationSeconds?: number | null;
  error?: string | null;
}

interface SpriteCue {
  start: number;
  end: number;
  url: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const VIDEO_RE = /\.(mp4|mov|m4v|webm|mkv|avi|wmv|mts|m2ts|mxf)$/i;
const IMAGE_RE = /\.(jpe?g|png|gif|webp|svg|avif|heic)$/i;
const AUDIO_RE = /\.(mp3|wav|m4a|aac|ogg|flac)$/i;

export function isPreviewable(name: string): boolean {
  return VIDEO_RE.test(name) || IMAGE_RE.test(name) || AUDIO_RE.test(name);
}

function parseVttTime(t: string): number {
  const parts = t.trim().split(":");
  let secs = 0;
  for (const p of parts) secs = secs * 60 + parseFloat(p);
  return secs;
}

function parseSpriteVtt(text: string, baseUrl: string): SpriteCue[] {
  const cues: SpriteCue[] = [];
  const blocks = text.replace(/\r/g, "").split("\n\n");
  for (const block of blocks) {
    const lines = block.split("\n").filter(Boolean);
    const timeLine = lines.find((l) => l.includes("-->"));
    const target = lines[lines.indexOf(timeLine || "") + 1];
    if (!timeLine || !target) continue;
    const [a, b] = timeLine.split("-->");
    const [file, frag] = target.split("#xywh=");
    if (!frag) continue;
    const [x, y, w, h] = frag.split(",").map(Number);
    cues.push({ start: parseVttTime(a), end: parseVttTime(b), url: new URL(file, baseUrl).toString(), x, y, w, h });
  }
  return cues;
}

function formatTime(s: number): string {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
}

function VideoPlayer({ item, onDownload }: { item: PreviewableItem; onDownload?: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<any>(null);
  const [info, setInfo] = useState<PreviewInfo | null>(null);
  const [source, setSource] = useState<"hls" | "original" | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [hover, setHover] = useState<{ x: number; t: number } | null>(null);
  const [cues, setCues] = useState<SpriteCue[]>([]);
  const [playError, setPlayError] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(true);
  const startedRef = useRef(false);
  const resumeRef = useRef<{ at: number; play: boolean } | null>(null);
  // Once the rendition has failed, never switch back to it automatically
  // (that would loop: fail -> original -> "ready" -> HLS -> fail…).
  const hlsFailedRef = useRef(false);
  // Bumped on every attach and on unmount; an attach that finishes after a
  // newer one started (or after close) cleans up after itself.
  const attachGenRef = useRef(0);

  const key = item.s3Key || "";

  // ── Load preview status; ask for a rendition if there isn't one ──────────
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async (first: boolean) => {
      try {
        const res = await fetch(`/api/drive/preview?k=${encodeURIComponent(key)}`);
        let data: PreviewInfo = res.ok ? await res.json() : { status: "unknown", enabled: false };
        if (first && data.enabled && (data.status === "none" || data.status === "failed")) {
          const req = await fetch("/api/drive/preview", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key }),
          });
          if (req.ok) data = await req.json();
        }
        if (cancelled) return;
        setInfo(data);
        if (data.status === "queued" || data.status === "processing") {
          timer = setTimeout(() => poll(false), 10_000);
        }
      } catch {
        if (!cancelled) setInfo({ status: "unknown", enabled: false });
      }
    };
    if (key) poll(true);
    else setInfo({ status: "unknown", enabled: false });
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [key]);

  // ── Pick the source: HLS when ready, else the original ───────────────────
  useEffect(() => {
    if (!info || source) return;
    setSource(info.status === "ready" && info.playlist && !hlsFailedRef.current ? "hls" : "original");
  }, [info, source]);

  const failHls = useCallback(() => {
    hlsFailedRef.current = true;
    hlsRef.current?.destroy?.();
    hlsRef.current = null;
    setSource("original");
  }, []);

  const attach = useCallback(async (which: "hls" | "original", resumeAt = 0, autoplay = false) => {
    const video = videoRef.current;
    if (!video) return;
    const gen = ++attachGenRef.current;
    hlsRef.current?.destroy?.();
    hlsRef.current = null;
    setPlayError(null);
    setWaiting(true);

    const afterLoad = () => {
      if (resumeAt > 0) video.currentTime = resumeAt;
      if (autoplay) video.play().catch(() => {});
    };

    if (which === "hls" && info?.playlist) {
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = info.playlist; // Safari / iOS play HLS natively
        video.addEventListener("loadedmetadata", afterLoad, { once: true });
      } else {
        const Hls = (await import("hls.js")).default;
        if (gen !== attachGenRef.current) return; // closed or re-attached while loading
        if (Hls.isSupported()) {
          const hls = new Hls({ maxBufferLength: 30, enableWorker: true });
          hlsRef.current = hls;
          hls.on(Hls.Events.MANIFEST_PARSED, afterLoad);
          hls.on(Hls.Events.ERROR, (_e: unknown, data: any) => {
            // Fall back to the original rather than a dead player.
            if (data?.fatal) failHls();
          });
          hls.loadSource(info.playlist);
          hls.attachMedia(video);
        } else {
          setSource("original");
          return;
        }
      }
      if (info.sprites) {
        fetch(info.sprites)
          .then((r) => (r.ok ? r.text() : ""))
          .then((txt) => txt && setCues(parseSpriteVtt(txt, new URL(info.sprites!, window.location.origin).toString())))
          .catch(() => {});
      }
    } else if (item.url) {
      video.src = item.url;
      video.addEventListener("loadedmetadata", afterLoad, { once: true });
    }
  }, [info, item.url, failHls]);

  useEffect(() => {
    if (source) {
      const resume = resumeRef.current;
      resumeRef.current = null;
      attach(source, resume?.at || 0, resume?.play || false);
    }
    return () => {
      attachGenRef.current++;
      hlsRef.current?.destroy?.();
      hlsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  // A rendition finished while the original was playing: switch if the
  // viewer hasn't started, otherwise offer a button (never yank playback).
  const readyWhileOriginal = source === "original" && info?.status === "ready" && !!info.playlist && !hlsFailedRef.current;
  useEffect(() => {
    if (readyWhileOriginal && !startedRef.current) setSource("hls");
  }, [readyWhileOriginal]);

  const switchToHls = () => {
    const v = videoRef.current;
    resumeRef.current = { at: v?.currentTime || 0, play: !!v && !v.paused };
    setSource("hls");
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  };

  const seekTo = (t: number) => {
    const v = videoRef.current;
    if (!v || !Number.isFinite(t)) return;
    v.currentTime = Math.max(0, Math.min(t, (duration || v.duration || 0) - 0.05));
  };

  const timeAtClientX = (clientX: number) => {
    const bar = barRef.current;
    if (!bar || !duration) return null;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return { x: ratio * rect.width, t: ratio * duration };
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === " " || e.key === "k") { e.preventDefault(); togglePlay(); }
    if (e.key === "ArrowRight") { e.preventDefault(); seekTo(time + 5); }
    if (e.key === "ArrowLeft") { e.preventDefault(); seekTo(time - 5); }
    if (e.key === "m") setMuted((m) => !m);
    if (e.key === "f") containerRef.current?.requestFullscreen?.().catch(() => {});
  };

  const hoverCue = useMemo(() => {
    if (!hover || !cues.length) return null;
    return cues.find((c) => hover.t >= c.start && hover.t < c.end) || cues[cues.length - 1];
  }, [hover, cues]);

  const statusChip = (() => {
    if (!info?.enabled) return null;
    if (source === "hls") return <span className="inline-flex items-center gap-1 text-[11px] text-emerald-300"><Sparkles className="h-3 w-3" />Fast preview</span>;
    if (info.status === "processing") {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] text-white/70">
          <Loader2 className="h-3 w-3 animate-spin" />
          Preparing fast preview{typeof info.progress === "number" ? ` · ${Math.round(info.progress * 100)}%` : "…"}
        </span>
      );
    }
    if (info.status === "queued") return <span className="inline-flex items-center gap-1 text-[11px] text-white/70"><Loader2 className="h-3 w-3 animate-spin" />Fast preview queued</span>;
    if (readyWhileOriginal) {
      return (
        <button onClick={switchToHls} className="inline-flex items-center gap-1 text-[11px] text-emerald-300 hover:underline">
          <Sparkles className="h-3 w-3" />Switch to fast preview
        </button>
      );
    }
    return null;
  })();

  return (
    <div
      ref={containerRef}
      className="relative w-full bg-black rounded-lg overflow-hidden outline-none group"
      tabIndex={0}
      onKeyDown={onKey}
    >
      <video
        ref={videoRef}
        className="w-full max-h-[70vh] bg-black"
        playsInline
        muted={muted}
        onClick={togglePlay}
        onPlay={() => { setPlaying(true); startedRef.current = true; }}
        onPause={() => setPlaying(false)}
        onWaiting={() => setWaiting(true)}
        onPlaying={() => setWaiting(false)}
        onCanPlay={() => setWaiting(false)}
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          setTime(v.currentTime);
          if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1));
        }}
        onDurationChange={(e) => setDuration(e.currentTarget.duration || info?.durationSeconds || 0)}
        onError={() => {
          // Native HLS (Safari/iOS) has no hls.js error event — fall back here.
          if (source === "hls") {
            failHls();
            return;
          }
          if (source === "original") {
            setPlayError(
              info?.enabled
                ? "This file's format can't play in the browser. A web preview is being prepared — check back in a few minutes, or download it."
                : "This file's format can't play in the browser. Download it to watch.",
            );
          }
          setWaiting(false);
        }}
      />

      {waiting && !playError && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-white/80" />
        </div>
      )}

      {playError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 px-6 text-center text-sm text-white">
          <AlertTriangle className="h-6 w-6 text-amber-400" />
          <p className="max-w-md">{playError}</p>
          {onDownload && (
            <Button size="sm" variant="secondary" onClick={onDownload}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> Download
            </Button>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2 pt-8 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-opacity">
        <div
          ref={barRef}
          className="relative h-1.5 cursor-pointer rounded-full bg-white/25 hover:h-2 transition-[height]"
          onMouseMove={(e) => setHover(timeAtClientX(e.clientX))}
          onMouseLeave={() => setHover(null)}
          onClick={(e) => { const p = timeAtClientX(e.clientX); if (p) seekTo(p.t); }}
        >
          <div className="absolute inset-y-0 left-0 rounded-full bg-white/35" style={{ width: duration ? `${(buffered / duration) * 100}%` : 0 }} />
          <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: duration ? `${(time / duration) * 100}%` : 0 }} />
          {hover && (
            <div
              className="pointer-events-none absolute bottom-4 -translate-x-1/2 flex flex-col items-center gap-1"
              style={{ left: hover.x }}
            >
              {hoverCue && (
                <div
                  className="rounded border border-white/30 shadow-lg"
                  style={{
                    width: hoverCue.w,
                    height: hoverCue.h,
                    backgroundImage: `url("${hoverCue.url}")`,
                    backgroundPosition: `-${hoverCue.x}px -${hoverCue.y}px`,
                  }}
                />
              )}
              <span className="rounded bg-black/80 px-1.5 py-0.5 text-[11px] tabular-nums text-white">{formatTime(hover.t)}</span>
            </div>
          )}
        </div>

        <div className="mt-2 flex items-center gap-3 text-white">
          <button onClick={togglePlay} className="p-1 hover:text-primary" aria-label={playing ? "Pause" : "Play"}>
            {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </button>
          <button onClick={() => setMuted((m) => !m)} className="p-1 hover:text-primary" aria-label={muted ? "Unmute" : "Mute"}>
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <span className="text-xs tabular-nums text-white/80">{formatTime(time)} / {formatTime(duration)}</span>
          <div className="ml-auto flex items-center gap-3">
            {statusChip}
            <button
              onClick={() => containerRef.current?.requestFullscreen?.().catch(() => {})}
              className="p-1 hover:text-primary"
              aria-label="Full screen"
            >
              <Maximize className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DrivePreviewModal({
  item,
  open,
  onOpenChange,
  onDownload,
}: {
  item: PreviewableItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDownload?: (item: PreviewableItem) => void;
}) {
  if (!item) return null;
  const isVideo = VIDEO_RE.test(item.name);
  const isImage = IMAGE_RE.test(item.name);
  const isAudio = AUDIO_RE.test(item.name);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-w-5xl w-[95vw] p-0 gap-0 overflow-hidden bg-neutral-950 border-neutral-800 [&>button]:hidden")}>
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-neutral-800 text-white">
          <DialogTitle className="text-sm font-medium truncate flex-1">{item.name}</DialogTitle>
          {onDownload && (
            <Button size="sm" variant="ghost" className="h-8 text-white hover:bg-white/10 hover:text-white" onClick={() => onDownload(item)}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> Download
            </Button>
          )}
          <Button size="icon" variant="ghost" className="h-8 w-8 text-white hover:bg-white/10 hover:text-white" onClick={() => onOpenChange(false)} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-3 sm:p-4">
          {isVideo && <VideoPlayer key={item.s3Key || item.url} item={item} onDownload={onDownload ? () => onDownload(item) : undefined} />}
          {isImage && item.url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.url} alt={item.name} className="mx-auto max-h-[75vh] w-auto rounded" />
          )}
          {isAudio && item.url && <audio src={item.url} controls autoPlay className="w-full" />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
