'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '../ui/card';
import { PlayCircle, Loader2 } from 'lucide-react';

interface HelpVideo {
  id: string;
  title: string;
  description: string | null;
  youtubeUrl: string;
}

function getYoutubeEmbedUrl(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : null;
}

export function ClientHelpVideos() {
  const [videos, setVideos] = useState<HelpVideo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/help-videos', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setVideos(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
          <PlayCircle className="h-6 w-6 text-blue-600" />
          E8-help
        </h1>
        <p className="text-muted-foreground mt-1">
          Quick videos to help you get the most out of your E8 portal
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : videos.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <PlayCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-600 mb-1">No help videos yet</h3>
          <p className="text-sm text-gray-400">Check back soon — the E8 team is adding helpful content here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {videos.map((video) => {
            const embedUrl = getYoutubeEmbedUrl(video.youtubeUrl);
            return (
              <Card key={video.id} className="overflow-hidden">
                <div className="aspect-video bg-black">
                  {embedUrl ? (
                    <iframe
                      src={embedUrl}
                      title={video.title}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">
                      Video unavailable
                    </div>
                  )}
                </div>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-gray-900">{video.title}</h3>
                  {video.description && (
                    <p className="text-sm text-gray-500 mt-1">{video.description}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
