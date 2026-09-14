'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Loader, Film, Image as ImageIcon, ExternalLink } from 'lucide-react';

interface PortfolioVideo {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  category: string;
}

interface PortfolioImage {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  category: string;
}

type Tab = 'videos' | 'images';

// Read-only — clients can browse E8's portfolio but have no add/edit/delete
// controls. Admin/videographer keep full CRUD via PortfolioManagementTab;
// this hits the same already-public GET endpoints those use (without
// `all=true`, so only isActive:true entries are ever returned here).
export function ClientPortfolioPage() {
  const [tab, setTab] = useState<Tab>('videos');
  const [videos, setVideos] = useState<PortfolioVideo[]>([]);
  const [images, setImages] = useState<PortfolioImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<string>('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [videosRes, imagesRes] = await Promise.all([
        fetch('/api/portfolio/videos'),
        fetch('/api/portfolio/images'),
      ]);
      const videosData = await videosRes.json().catch(() => null);
      const imagesData = await imagesRes.json().catch(() => null);
      setVideos(videosData?.videos || []);
      setImages(imagesData?.images || []);
    } catch (err) {
      console.error('Failed to load portfolio:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const categories = useMemo(() => {
    const items = tab === 'videos' ? videos : images;
    return ['all', ...new Set(items.map((i) => i.category).filter(Boolean))];
  }, [tab, videos, images]);

  const visibleVideos = useMemo(
    () => category === 'all' ? videos : videos.filter((v) => v.category === category),
    [videos, category],
  );
  const visibleImages = useMemo(
    () => category === 'all' ? images : images.filter((i) => i.category === category),
    [images, category],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-4">
          <Loader className="h-10 w-10 animate-spin mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">Loading portfolio...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-[28px] font-black tracking-tight text-zinc-950">Portfolio</h1>
        <p className="text-zinc-500 text-sm mt-1.5">A look at E8's recent work</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-zinc-100 rounded-xl p-1 w-fit">
          <button
            onClick={() => { setTab('videos'); setCategory('all'); }}
            className={`h-9 px-3.5 rounded-lg text-[13px] font-bold flex items-center gap-1.5 ${tab === 'videos' ? 'bg-white shadow-sm text-zinc-950' : 'text-zinc-500 hover:text-zinc-800'}`}
          >
            <Film className="h-3.5 w-3.5" /> Videos
          </button>
          <button
            onClick={() => { setTab('images'); setCategory('all'); }}
            className={`h-9 px-3.5 rounded-lg text-[13px] font-bold flex items-center gap-1.5 ${tab === 'images' ? 'bg-white shadow-sm text-zinc-950' : 'text-zinc-500 hover:text-zinc-800'}`}
          >
            <ImageIcon className="h-3.5 w-3.5" /> Photos
          </button>
        </div>
        {categories.length > 1 && (
          <div className="flex items-center gap-1 flex-wrap">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`h-8 px-3 rounded-full text-xs font-bold capitalize ${category === c ? 'bg-zinc-950 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      {tab === 'videos' ? (
        visibleVideos.length === 0 ? (
          <div className="text-center py-16 bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
            <Film className="h-10 w-10 text-zinc-300 mx-auto mb-3" />
            <p className="text-zinc-500 font-medium">No videos yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {visibleVideos.map((v) => (
              <a
                key={v.id}
                href={v.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-xl border border-zinc-200 overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="aspect-video bg-zinc-100 relative overflow-hidden">
                  {v.thumbnailUrl ? (
                    <img src={v.thumbnailUrl} alt={v.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><Film className="h-8 w-8 text-zinc-300" /></div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <ExternalLink className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
                <div className="p-4">
                  <div className="text-xs font-bold text-zinc-400 uppercase tracking-wide mb-1">{v.category}</div>
                  <div className="text-sm font-bold text-zinc-950">{v.title}</div>
                  {v.description && <div className="text-xs text-zinc-500 mt-1 line-clamp-2">{v.description}</div>}
                </div>
              </a>
            ))}
          </div>
        )
      ) : (
        visibleImages.length === 0 ? (
          <div className="text-center py-16 bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
            <ImageIcon className="h-10 w-10 text-zinc-300 mx-auto mb-3" />
            <p className="text-zinc-500 font-medium">No photos yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {visibleImages.map((img) => (
              <a
                key={img.id}
                href={img.imageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-xl border border-zinc-200 overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="aspect-square bg-zinc-100 overflow-hidden">
                  <img src={img.imageUrl} alt={img.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                </div>
                {img.title && (
                  <div className="p-2.5">
                    <div className="text-xs font-bold text-zinc-950 truncate">{img.title}</div>
                  </div>
                )}
              </a>
            ))}
          </div>
        )
      )}
    </div>
  );
}
