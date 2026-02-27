"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../ui/card";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { PlayCircle, Video, Loader2, X } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
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
  completed?: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  editor: "Editor",
  qc: "QC Specialist",
  scheduler: "Scheduler",
  manager: "Manager",
  videographer: "Videographer",
  sales: "Sales",
};

const getYouTubeEmbedUrl = (url: string) => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  if (match && match[2].length === 11) {
    return `https://www.youtube.com/embed/${match[2]}`;
  }
  return null;
};
export function TrainingPortalPage() {
  const { user } = useAuth();
  const [videos, setVideos] = useState<TrainingVideoType[]>([]);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState<TrainingVideoType | null>(null);

  const role = (user?.role || "").toLowerCase();
  const courseTitle = role ? `${ROLE_LABELS[role] || role} Training` : "Training";

  useEffect(() => {
    loadVideos();
  }, []);

  async function markAsCompleted(videoId: string) {
    try {
      const res = await fetch("/api/training/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId }),
      });
      if (res.ok) {
        // Refresh video list to unlock next one
        loadVideos();
      }
    } catch (e) {
      console.error("Failed to mark as completed", e);
    }
  }

  async function loadVideos() {
    try {
      setLoading(true);
      const res = await fetch("/api/training/videos");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      const list = (data.videos || []).sort((a: TrainingVideoType, b: TrainingVideoType) => a.order - b.order);
      setVideos(list);
    } catch (e) {
      console.error("Failed to load training videos", e);
      toast.error("Failed to load training videos");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground">Loading training course...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-6 w-6" />
            {courseTitle}
          </CardTitle>
          <CardDescription>
            Watch the videos in order. Click &quot;Watch&quot; to play.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {videos.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">
              No training videos assigned for your role yet. Check back later.
            </p>
          ) : (
            <ul className="space-y-3">
              {videos.map((v, index) => {
                const isFirst = index === 0;
                const prevCompleted = index > 0 ? videos[index - 1].completed : false;
                const isLocked = !isFirst && !prevCompleted && !v.completed;

                return (
                  <li
                    key={v.id}
                    className={`flex items-center justify-between gap-4 p-4 rounded-lg border transition-colors ${
                      isLocked ? "bg-gray-50 opacity-75" : "bg-card hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <span className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm ${
                        v.completed 
                          ? "bg-green-100 text-green-700" 
                          : isLocked 
                            ? "bg-gray-200 text-gray-400" 
                            : "bg-primary/10 text-primary"
                      }`}>
                        {v.completed ? "✓" : index + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`font-medium truncate ${isLocked ? "text-muted-foreground" : ""}`}>
                            {v.title}
                          </p>
                          {isLocked && (
                            <span className="text-[10px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded uppercase font-bold">
                              Locked
                            </span>
                          )}
                        </div>
                        {v.description && (
                          <p className="text-sm text-muted-foreground truncate mt-0.5">{v.description}</p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant={isLocked ? "outline" : "default"}
                      size="sm"
                      onClick={() => !isLocked && setPlaying(v)}
                      className="shrink-0"
                      disabled={isLocked}
                    >
                      <PlayCircle className="h-4 w-4 mr-2" />
                      {isLocked ? "Locked" : v.completed ? "Watch Again" : "Watch"}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!playing} onOpenChange={(open) => !open && setPlaying(null)}>
        <DialogContent className="max-w-4xl w-[95vw] p-0 gap-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="pr-8">{playing?.title}</DialogTitle>
            <DialogDescription>
              Training video player. Press play to start the lesson.
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 space-y-4">
            {playing?.videoUrl && (
              <div className="aspect-video w-full rounded-lg overflow-hidden bg-black shadow-inner">
                {getYouTubeEmbedUrl(playing.videoUrl) ? (
                  <iframe
                    src={`${getYouTubeEmbedUrl(playing.videoUrl)!}?autoplay=1&rel=0`}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title={playing.title}
                  />
                ) : (
                  <video
                    key={playing.id}
                    src={playing.videoUrl}
                    controls
                    className="w-full h-full"
                    playsInline
                    autoPlay
                    onEnded={() => {
                      if (playing && !playing.completed) {
                        markAsCompleted(playing.id);
                      }
                    }}
                  >
                    Your browser does not support the video tag.
                  </video>
                )}
              </div>
            )}

            {!playing?.completed && (
              <div className="flex justify-end pt-2 border-t border-gray-100">
                <Button 
                  onClick={() => {
                    if (playing) {
                      markAsCompleted(playing.id);
                      setPlaying(null);
                      toast.success("Progress saved! Next video unlocked.");
                    }
                  }}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  Mark as Completed
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
