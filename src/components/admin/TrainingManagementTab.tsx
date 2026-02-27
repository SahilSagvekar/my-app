"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Plus, Video, Edit, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface TrainingVideoType {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  role: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

const ROLES = [
  { id: "editor", name: "Editor" },
  { id: "qc", name: "QC Specialist" },
  { id: "scheduler", name: "Scheduler" },
  { id: "manager", name: "Manager" },
  { id: "videographer", name: "Videographer" },
  { id: "sales", name: "Sales" },
];

const getYouTubeEmbedUrl = (url: string) => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  if (match && match[2].length === 11) {
    return `https://www.youtube.com/embed/${match[2]}`;
  }
  return null;
};
export function TrainingManagementTab() {
  const [videos, setVideos] = useState<TrainingVideoType[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingVideo, setEditingVideo] = useState<TrainingVideoType | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewing, setPreviewing] = useState<TrainingVideoType | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    role: "editor",
    order: "0",
    videoUrl: "",
  });
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    loadVideos();
  }, []);

  async function loadVideos() {
    try {
      setLoading(true);
      const res = await fetch("/api/training/videos");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setVideos(data.videos || []);
    } catch (e) {
      console.error("Failed to load training videos", e);
      toast.error("Failed to load training videos");
    } finally {
      setLoading(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (editingVideo) {
      try {
        const res = await fetch(`/api/training/videos/${editingVideo.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: formData.title.trim(),
            description: formData.description.trim(),
            role: formData.role,
            order: parseInt(formData.order, 10) || 0,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Update failed");
        toast.success("Video updated");
        setShowAddDialog(false);
        setEditingVideo(null);
        resetForm();
        loadVideos();
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Update failed");
      }
      return;
    }

    if (!file && !formData.videoUrl.trim()) {
      toast.error("Upload a video file or paste a video URL");
      return;
    }
    if (file && !formData.videoUrl.trim()) {
      setUploading(true);
      try {
        const fd = new FormData();
        fd.set("title", formData.title.trim());
        fd.set("description", formData.description.trim());
        fd.set("role", formData.role);
        fd.set("order", formData.order || "0");
        fd.set("file", file);
        const res = await fetch("/api/training/videos", {
          method: "POST",
          body: fd,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed");
        toast.success("Video uploaded");
        setShowAddDialog(false);
        resetForm();
        setFile(null);
        loadVideos();
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
      }
      return;
    }

    if (formData.videoUrl.trim().startsWith("http")) {
      setUploading(true);
      try {
        const fd = new FormData();
        fd.set("title", formData.title.trim());
        fd.set("description", formData.description.trim());
        fd.set("role", formData.role);
        fd.set("order", formData.order || "0");
        fd.set("videoUrl", formData.videoUrl.trim());
        const res = await fetch("/api/training/videos", {
          method: "POST",
          body: fd,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Create failed");
        toast.success("Video added");
        setShowAddDialog(false);
        resetForm();
        loadVideos();
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Create failed");
      } finally {
        setUploading(false);
      }
    }
  };

  function resetForm() {
    setFormData({
      title: "",
      description: "",
      role: "editor",
      order: "0",
      videoUrl: "",
    });
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this training video?")) return;
    try {
      const res = await fetch(`/api/training/videos/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Delete failed");
      }
      toast.success("Video deleted");
      loadVideos();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const openEdit = (v: TrainingVideoType) => {
    setEditingVideo(v);
    setFormData({
      title: v.title,
      description: v.description,
      role: v.role,
      order: String(v.order),
      videoUrl: "",
    });
    setFile(null);
    setShowAddDialog(true);
  };

  const filteredVideos = roleFilter === "all"
    ? [...videos].sort((a, b) => (a.role.localeCompare(b.role)) || a.order - b.order)
    : [...videos].filter((v) => v.role === roleFilter).sort((a, b) => a.order - b.order);

  const byRole = filteredVideos.reduce<Record<string, TrainingVideoType[]>>((acc, v) => {
    if (!acc[v.role]) acc[v.role] = [];
    acc[v.role].push(v);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5" />
              Training Videos (Cloudinary)
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All roles</SelectItem>
                  {ROLES.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Dialog
                open={showAddDialog}
                onOpenChange={(open) => {
                  setShowAddDialog(open);
                  if (!open) {
                    setEditingVideo(null);
                    resetForm();
                    setFile(null);
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Video
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>{editingVideo ? "Edit Video" : "Add Training Video"}</DialogTitle>
                    <DialogDescription>
                      {editingVideo
                        ? "Update title, description, role, and order."
                        : "Upload a video file (or paste URL). Set role and order for the course."}
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Title</Label>
                      <Input
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        placeholder="e.g. Module 1: Introduction"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Description (optional)</Label>
                      <Textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Short description"
                        rows={2}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Role</Label>
                        <Select
                          value={formData.role}
                          onValueChange={(val) => setFormData({ ...formData, role: val })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLES.map((r) => (
                              <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Order in course</Label>
                        <Input
                          type="number"
                          min={0}
                          value={formData.order}
                          onChange={(e) => setFormData({ ...formData, order: e.target.value })}
                          placeholder="0"
                        />
                      </div>
                    </div>
                    {!editingVideo && (
                      <>
                        <div className="space-y-2">
                          <Label>Video file (upload to Cloudinary)</Label>
                          <Input
                            type="file"
                            accept="video/*"
                            onChange={(e) => setFile(e.target.files?.[0] || null)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Or paste video URL</Label>
                          <Input
                            value={formData.videoUrl}
                            onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                            placeholder="https://..."
                          />
                        </div>
                      </>
                    )}
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setShowAddDialog(false);
                          setEditingVideo(null);
                          resetForm();
                        }}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={uploading}>
                        {uploading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        {editingVideo ? "Save" : "Add Video"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredVideos.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No training videos yet. Add one to get started.</p>
          ) : (
            <div className="space-y-6">
              {Object.entries(byRole).map(([role, list]) => (
                <div key={role}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      {ROLES.find((r) => r.id === role)?.name || role}
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      {list.length} video{list.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {list.map((v, index) => (
                      <li
                        key={v.id}
                        className="flex items-center justify-between gap-4 p-3 rounded-lg border bg-card hover:bg-muted/60 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-muted-foreground font-mono text-sm w-6">
                            {index + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{v.title}</p>
                            {v.description && (
                              <p className="text-sm text-muted-foreground truncate">{v.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setPreviewing(v)}
                            title="Preview video"
                          >
                            <Video className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(v)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(v.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Admin preview dialog */}
      <Dialog open={!!previewing} onOpenChange={(open) => !open && setPreviewing(null)}>
        <DialogContent className="max-w-4xl w-[95vw] p-0 gap-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="pr-8">
              {previewing?.title || "Preview training video"}
            </DialogTitle>
            <DialogDescription>
              Admin preview of the training video exactly as the role will see it.
            </DialogDescription>
          </DialogHeader>
          <div className="p-4">
            {previewing?.videoUrl && (
              <div className="aspect-video w-full rounded-lg overflow-hidden bg-black">
                {getYouTubeEmbedUrl(previewing.videoUrl) ? (
                  <iframe
                    src={getYouTubeEmbedUrl(previewing.videoUrl)!}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title={previewing.title}
                  />
                ) : (
                  <video
                    key={previewing.id}
                    src={previewing.videoUrl}
                    controls
                    className="w-full h-full"
                    playsInline
                  >
                    Your browser does not support the video tag.
                  </video>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
