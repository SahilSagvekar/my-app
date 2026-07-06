'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import { Plus, Trash2, GripVertical, PlayCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface HelpVideo {
  id: string;
  title: string;
  description: string | null;
  youtubeUrl: string;
  order: number;
  isActive: boolean;
}

function getYoutubeThumbnail(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
  return match ? `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg` : null;
}

export function HelpVideosManagementTab() {
  const [videos, setVideos] = useState<HelpVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/help-videos', { credentials: 'include' });
      const data = await res.json();
      setVideos(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Failed to load help videos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setYoutubeUrl('');
    setShowAdd(false);
  };

  const handleAdd = async () => {
    if (!title.trim() || !youtubeUrl.trim()) {
      toast.error('Title and YouTube URL are required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/help-videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title, description, youtubeUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Video added');
      resetForm();
      load();
    } catch (e: any) {
      toast.error(e.message || 'Failed to add video');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (video: HelpVideo) => {
    setVideos((prev) => prev.map((v) => (v.id === video.id ? { ...v, isActive: !v.isActive } : v)));
    try {
      await fetch(`/api/help-videos/${video.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isActive: !video.isActive }),
      });
    } catch {
      toast.error('Failed to update video');
      load();
    }
  };

  const handleDelete = async (id: string, videoTitle: string) => {
    if (!confirm(`Delete "${videoTitle}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/help-videos/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Video deleted');
      load();
    } catch {
      toast.error('Failed to delete video');
    }
  };

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= videos.length) return;
    const a = videos[index];
    const b = videos[target];
    const reordered = [...videos];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setVideos(reordered);
    try {
      await Promise.all([
        fetch(`/api/help-videos/${a.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ order: b.order }),
        }),
        fetch(`/api/help-videos/${b.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ order: a.order }),
        }),
      ]);
    } catch {
      toast.error('Failed to reorder');
      load();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <PlayCircle className="h-5 w-5 text-blue-600" />
            Help Videos
          </h2>
          <p className="text-sm text-gray-500">Manage the YouTube videos shown in the client portal</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd((v) => !v)} className="bg-blue-600 hover:bg-blue-700 text-white">
          <Plus size={14} className="mr-1" /> Add Video
        </Button>
      </div>

      {showAdd && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Input placeholder="YouTube URL (e.g. https://youtube.com/watch?v=...)" value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} />
            <Textarea placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAdd} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Save
              </Button>
              <Button size="sm" variant="outline" onClick={resetForm}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="text-center text-gray-400 py-16">Loading...</div>
      ) : videos.length === 0 ? (
        <div className="text-center text-gray-400 py-16">No help videos yet — add one to get started</div>
      ) : (
        <div className="space-y-2">
          {videos.map((video, i) => {
            const thumb = getYoutubeThumbnail(video.youtubeUrl);
            return (
              <Card key={video.id}>
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="flex flex-col text-gray-300">
                    <button onClick={() => move(i, -1)} disabled={i === 0} className="disabled:opacity-30 hover:text-gray-600">▲</button>
                    <GripVertical size={14} />
                    <button onClick={() => move(i, 1)} disabled={i === videos.length - 1} className="disabled:opacity-30 hover:text-gray-600">▼</button>
                  </div>
                  {thumb ? (
                    <img src={thumb} alt={video.title} className="w-24 h-14 object-cover rounded-md flex-shrink-0" />
                  ) : (
                    <div className="w-24 h-14 bg-gray-100 rounded-md flex items-center justify-center flex-shrink-0">
                      <PlayCircle className="h-6 w-6 text-gray-300" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{video.title}</p>
                    {video.description && <p className="text-xs text-gray-500 truncate">{video.description}</p>}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="flex items-center gap-1.5">
                      <Switch checked={video.isActive} onCheckedChange={() => toggleActive(video)} />
                      <span className="text-xs text-gray-500">{video.isActive ? 'Active' : 'Hidden'}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => handleDelete(video.id, video.title)}
                    >
                      <Trash2 size={13} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
