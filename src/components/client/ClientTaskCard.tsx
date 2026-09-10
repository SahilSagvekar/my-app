'use client';

import { memo, useState, useEffect } from 'react';
import { Button } from '../ui/button';
import {
  Eye,
  Send,
  Download,
  Check,
} from 'lucide-react';
import {
  getTaskCardThumbnailUrl,
  taskThumbnailFallbackLabel,
} from '@/lib/task-thumbnail';

interface TaskFile {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  folderType?: string;
  version?: number;
  isActive?: boolean;
  s3Key?: string;
}

interface ClientTask {
  id: string;
  title: string;
  status: string;
  taskType?: string;
  deliverableType?: string;
  files?: TaskFile[];
  monthlyDeliverable?: any;
}

interface ClientTaskCardProps {
  task: ClientTask;
  isSelected: boolean;
  thumbnail: string | null;
  onTaskClick: (task: ClientTask) => void;
  onShare: (e: React.MouseEvent, task: ClientTask) => void;
  onDownload: (task: ClientTask) => void;
  isSharing: boolean;
}

// Helper to format deliverable type names into singular form (e.g., "Long Form Videos" -> "Long Form Video")
export function formatDeliverableTypeTitle(title: string): string {
  if (!title) return '';
  return title
    .replace(/_/g, ' ')
    .replace(/\b(Long\s+Form\s+)Videos\b/gi, '$1Video')
    .replace(/\b(Short\s+Form\s+)Videos\b/gi, '$1Video')
    .replace(/\b(Square\s+Form\s+)Videos\b/gi, '$1Video')
    .replace(/\b(Beta\s+Short\s+Form\s+)Videos\b/gi, '$1Video')
    .replace(/\b(Snapchat\s+)Videos\b/gi, '$1Video')
    .replace(/\bVideos\b/gi, 'Video')
    .replace(/\bPosts\b/gi, 'Post')
    .replace(/\bThumbnails\b/gi, 'Thumbnail')
    .replace(/\bPodcasts\b/gi, 'Podcast');
}

// Helper to check if deliverable is widescreen long-form
export function isLongFormTask(task: any): boolean {
  const t = (task.deliverableType || task.monthlyDeliverable?.type || task.taskType || task.title || '').toLowerCase();
  return t.includes('long form') || t.includes('longform') || t === 'lf';
}

// Helper to get thumbnail from task files
function getTaskThumbnailFromFiles(files?: TaskFile[]): string | null {
  return getTaskCardThumbnailUrl(files as any);
}

export const ClientTaskCard = memo(function ClientTaskCard({
  task,
  isSelected,
  thumbnail,
  onTaskClick,
  onShare,
  onDownload,
  isSharing,
}: ClientTaskCardProps) {
  const displayThumbnail = thumbnail || getTaskThumbnailFromFiles(task.files);

  const rawTitle = (task.taskType || '').toLowerCase().includes('text post')
    ? task.title
    : task.monthlyDeliverable?.type
    ? task.monthlyDeliverable.type
    : task.title || 'Content';

  const cardTitle = formatDeliverableTypeTitle(rawTitle);
  const isLongForm = isLongFormTask(task);

  // Desktop app check for local cached files
  const [isFullyDownloaded, setIsFullyDownloaded] = useState(false);

  useEffect(() => {
    const desktop = (window as any).e8;
    if (!desktop?.isDesktopApp) return;

    const videoFiles = (task.files || []).filter((f) => f.mimeType?.startsWith('video/'));
    if (videoFiles.length === 0) {
      setIsFullyDownloaded(false);
      return;
    }

    let cancelled = false;
    Promise.all(videoFiles.map((f) => desktop.isDownloaded(f.id))).then((results) => {
      if (!cancelled) setIsFullyDownloaded(results.every(Boolean));
    });

    return () => {
      cancelled = true;
    };
  }, [task.files]);

  return (
    <div
      className={`group cursor-pointer rounded-2xl transition-all duration-200 overflow-hidden flex flex-col h-full bg-[#111113] border shadow-sm hover:shadow-md ${
        isLongForm
          ? 'col-span-1 sm:col-span-2 md:col-span-2 lg:col-span-2 xl:col-span-2'
          : 'col-span-1'
      } ${
        isSelected
          ? 'ring-2 ring-blue-500 border-blue-500'
          : 'border-zinc-800 hover:border-zinc-700'
      }`}
      onClick={() => onTaskClick(task)}
    >
      {/* Visual Header / Thumbnail Area */}
      <div
        className={`w-full ${
          isLongForm ? 'aspect-video' : 'aspect-[4/5]'
        } relative flex items-center justify-center bg-zinc-900 overflow-hidden select-none`}
      >
        {displayThumbnail ? (
          <>
            <img
              src={displayThumbnail}
              alt={cardTitle}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 z-10"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).style.opacity = '0';
              }}
            />
            <div className="absolute inset-0 bg-black/10 z-10 pointer-events-none" />
          </>
        ) : (
          <div className="text-zinc-500 text-xs font-bold uppercase tracking-wider absolute inset-0 flex items-center justify-center">
            {taskThumbnailFallbackLabel(task.files)}
          </div>
        )}
      </div>

      {/* Dark Action Bottom Bar */}
      <div className="p-3 bg-black flex flex-col gap-2">
        {/* Primary Action Button: Review */}
        <Button
          type="button"
          className="w-full bg-white hover:bg-zinc-100 text-zinc-950 font-bold text-xs sm:text-sm h-9 rounded-lg flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            onTaskClick(task);
          }}
        >
          <Eye className="h-4 w-4 stroke-[2.2]" />
          Review
        </Button>

        {/* Secondary Actions Row: Share & Download */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1 bg-[#1c1c1f] hover:bg-[#28282d] text-zinc-200 hover:text-white border-white/10 text-xs font-semibold h-8 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onShare(e, task);
            }}
            disabled={isSharing}
          >
            <Send className="h-3 w-3 stroke-[2]" />
            Share
          </Button>

          <Button
            type="button"
            variant="outline"
            className={`flex-1 text-xs font-semibold h-8 rounded-lg flex items-center justify-center gap-1.5 transition-colors border cursor-pointer ${
              isFullyDownloaded
                ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/80 hover:text-emerald-200'
                : 'bg-[#1c1c1f] hover:bg-[#28282d] text-zinc-200 hover:text-white border-white/10'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              onDownload(task);
            }}
          >
            {isFullyDownloaded ? (
              <Check className="h-3 w-3 stroke-[2.5]" />
            ) : (
              <Download className="h-3 w-3 stroke-[2]" />
            )}
            {isFullyDownloaded ? 'Saved' : 'Download'}
          </Button>
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.task.id === nextProps.task.id &&
    prevProps.task.status === nextProps.task.status &&
    prevProps.task.title === nextProps.task.title &&
    prevProps.task.files?.length === nextProps.task.files?.length &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.thumbnail === nextProps.thumbnail &&
    prevProps.isSharing === nextProps.isSharing
  );
});