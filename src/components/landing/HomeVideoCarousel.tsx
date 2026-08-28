"use client";

import { useEffect, useRef, useState } from "react";

interface CarouselVideo {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  order: number;
}

// Category key this section reads from — matches the admin's Home Carousel
// control in Portfolio Management. Kept in sync manually with
// HOME_CAROUSEL_CATEGORY_KEY in PortfolioManagementTab.tsx.
const HOME_CAROUSEL_CATEGORY_KEY = "home-video-carousel";

function getEmbedAutoplayUrl(url: string): string | null {
  const ytMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/
  );
  if (ytMatch) {
    const id = ytMatch[1];
    return `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&controls=0&playsinline=1`;
  }

  const vmMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vmMatch) {
    return `https://player.vimeo.com/video/${vmMatch[1]}?autoplay=1&muted=1&loop=1&background=1`;
  }

  return null; // not a recognized embed link — treat as a direct video file
}

function VideoCard({ video, keyPrefix }: { video: CarouselVideo; keyPrefix: string }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [inView, setInView] = useState(false);
  const embedUrl = getEmbedAutoplayUrl(video.videoUrl);

  // Pause/resume playback as the card scrolls in and out of view so an
  // infinite-scroll strip doesn't keep dozens of videos decoding at once.
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: "100px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (embedUrl) return; // iframe handles its own playback
    const el = videoRef.current;
    if (!el) return;
    if (inView) {
      el.play().catch(() => {
        // Autoplay can be blocked in rare cases (e.g. low-power mode) —
        // fail silently, the poster image still shows.
      });
    } else {
      el.pause();
    }
  }, [inView, embedUrl]);

  return (
    <div
      key={`${keyPrefix}-${video.id}`}
      ref={cardRef}
      className="flex-none w-[140px] sm:w-[170px] lg:w-[190px] aspect-[9/16] rounded-xl sm:rounded-2xl overflow-hidden relative bg-black"
    >
      {embedUrl ? (
        inView ? (
          <iframe
            src={embedUrl}
            className="absolute inset-0 w-full h-full pointer-events-none"
            allow="autoplay; encrypted-media"
            title={video.title}
          />
        ) : video.thumbnailUrl ? (
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-black/10" />
        )
      ) : (
        <video
          ref={videoRef}
          src={video.videoUrl}
          poster={video.thumbnailUrl || undefined}
          muted
          loop
          playsInline
          preload="metadata"
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {/* Caption */}
      {video.title && (
        <div className="absolute bottom-0 left-0 right-0 p-2.5 bg-gradient-to-t from-black/70 to-transparent pointer-events-none">
          <p className="text-white text-xs font-medium line-clamp-2">
            {video.title}
          </p>
        </div>
      )}
    </div>
  );
}

export function HomeVideoCarousel() {
  const [videos, setVideos] = useState<CarouselVideo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/portfolio/videos?category=${HOME_CAROUSEL_CATEGORY_KEY}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.ok) setVideos(data.videos || []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Nothing configured yet in admin — render nothing rather than an empty section.
  if (!loading && videos.length === 0) return null;
  if (loading) return null;

  return (
    <section className="py-8 sm:py-12 lg:py-16 px-4 sm:px-6 lg:px-8 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-6 sm:mb-10">
          {/* <a
            href="https://e8productions.com/portfolio"
            className="inline-flex items-center gap-1.5 text-sm sm:text-base font-medium text-black hover:text-black/70 underline underline-offset-4 transition-colors"
          >
            Checkout Our Portfolio https://e8productions.com/portfolio
          </a> */}
        </div>

        <div className="relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-12 sm:w-20 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-12 sm:w-20 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />

          <div className="home-carousel-track flex gap-3 sm:gap-4">
            {videos.map((v) => (
              <VideoCard key={`set1-${v.id}`} video={v} keyPrefix="set1" />
            ))}
            {videos.map((v) => (
              <VideoCard key={`set2-${v.id}`} video={v} keyPrefix="set2" />
            ))}
          </div>
        </div>

        <div className="text-center mt-6 sm:mt-8">
          <a
            href="https://e8productions.com/portfolio"
            className="inline-flex items-center gap-1.5 text-sm sm:text-base font-medium text-black hover:text-black/70 underline underline-offset-4 transition-colors"
          >
            Checkout Our Portfolio https://e8productions.com/portfolio
          </a>
        </div>
      </div>

      <style jsx>{`
        @keyframes home-carousel-scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .home-carousel-track {
          animation: home-carousel-scroll 65s linear infinite;
          width: fit-content;
        }
      `}</style>
    </section>
  );
}