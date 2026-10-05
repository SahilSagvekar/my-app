'use client';

import { memo, useState, useEffect } from 'react';
import { Button } from '../ui/button';
import {
  Eye,
  Send,
  Download,
  Check,
  Image as ImageIcon,
} from 'lucide-react';
import {
  getTaskCardThumbnailUrl,
  taskThumbnailFallbackLabel,
} from '@/lib/task-thumbnail';
import { getDeliverableBadge } from '@/lib/deliverable-badge';

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
  dueDate?: string | null;
  createdAt?: string | null;
  files?: TaskFile[];
  monthlyDeliverable?: any;
  oneOffDeliverable?: any;
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

// Same version logic as the QC review cards: prefer the active video's
// version, otherwise the highest version across any file on the task.
function getTaskLatestVersion(files?: TaskFile[]): number {
  const latestVideo = (files || [])
    .filter((f) => f.mimeType?.startsWith('video/'))
    .sort((a, b) => {
      if (a.isActive && !b.isActive) return -1;
      if (!a.isActive && b.isActive) return 1;
      return (b.version || 1) - (a.version || 1);
    })[0];
  if (latestVideo?.version) return latestVideo.version;

  let maxVer = 1;
  for (const f of files || []) {
    if (f.version && f.version > maxVer) maxVer = f.version;
  }
  return maxVer;
}

// Same count the QC cards show next to the image icon: image / thumbnail /
// tile / cover files, falling back to the total file count.
function getImageFilesCount(files?: TaskFile[]): number {
  const list = files || [];
  const images = list.filter(
    (f) =>
      (f.mimeType || '').startsWith('image/') ||
      f.folderType === 'thumbnails' ||
      f.folderType === 'tiles' ||
      f.folderType === 'covers' ||
      (f.name && /\.(jpe?g|png|webp|gif|avif)$/i.test(f.name))
  ).length;
  return images || list.length;
}

function formatCardDate(dateVal?: string | null): string {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getRawDeliverableType(task: ClientTask): string {
  const t =
    task.deliverableType ||
    task.monthlyDeliverable?.type ||
    task.oneOffDeliverable?.type ||
    '';
  if (t) return t;
  // Text posts only carry their type on taskType.
  return (task.taskType || '').toLowerCase().includes('text post') ? 'text post' : '';
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

  // Footer info (same as the QC review cards)
  const contentName = task.title || cardTitle;
  const deliverableBadge = getDeliverableBadge(getRawDeliverableType(task), task.title);
  const latestVersion = getTaskLatestVersion(task.files);
  const imageFilesCount = getImageFilesCount(task.files);
  const dateLabel = formatCardDate(task.dueDate || task.createdAt);

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
      className={`group cursor-pointer rounded-2xl transition-all duration-200 overflow-hidden flex flex-col h-full bg-[#0e0f12] border shadow-sm hover:shadow-md ${
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
        } flex-1 min-h-0 relative flex items-center justify-center bg-zinc-900 overflow-hidden select-none`}
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

      {/* Card Body */}
      <div className="p-4 pt-3 pb-3.5 flex flex-col gap-2 bg-[#0e0f12] mt-auto shrink-0">
        {/* Row 1: Content name */}
        <h4
          className="text-[13px] font-bold text-white truncate leading-snug tracking-tight"
          title={contentName}
        >
          {contentName}
        </h4>

        {/* Row 2: Date */}
        {dateLabel && (
          <div className="flex items-center text-xs text-zinc-400 font-normal leading-none">
            <span className="shrink-0">{dateLabel}</span>
          </div>
        )}

        {/* Row 3: Deliverable type, version & media count */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-800/70 mt-1">
          <div className="flex items-center gap-1.5 min-w-0">
            {deliverableBadge && (
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] sm:text-[11px] font-bold tracking-wide uppercase shrink-0 ${deliverableBadge.colorClass}`}
              >
                {deliverableBadge.label}
              </span>
            )}
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-semibold bg-[#27272a] text-zinc-300 shrink-0">
              V{latestVersion}
            </span>
          </div>

          <div
            className="flex items-center gap-1 text-[11px] font-medium text-zinc-400 shrink-0"
            title={`${imageFilesCount} file(s)`}
          >
            <ImageIcon className="h-3.5 w-3.5 stroke-[1.75]" />
            <span>{imageFilesCount}</span>
          </div>
        </div>

        {/* Primary Action Button: Review */}
        <Button
          type="button"
          className="w-full bg-white hover:bg-zinc-100 text-zinc-950 font-bold text-xs sm:text-sm h-9 rounded-lg flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer mt-1"
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
            className="flex-1 bg-[#1c1c1f] hover:bg-[#1c1c1f] text-zinc-300 hover:text-orange-500 border border-zinc-800 hover:border-orange-500 text-xs font-semibold h-8 rounded-lg flex items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer shadow-none"
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
            className={`flex-1 text-xs font-semibold h-8 rounded-lg flex items-center justify-center gap-1.5 transition-all duration-200 border cursor-pointer shadow-none ${
              isFullyDownloaded
                ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300 hover:bg-emerald-950/90 hover:border-emerald-400 hover:text-emerald-200'
                : 'bg-[#1c1c1f] hover:bg-[#1c1c1f] text-zinc-300 hover:text-blue-400 border-zinc-800 hover:border-blue-500'
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
    prevProps.task.deliverableType === nextProps.task.deliverableType &&
    prevProps.task.dueDate === nextProps.task.dueDate &&
    getTaskLatestVersion(prevProps.task.files) === getTaskLatestVersion(nextProps.task.files) &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.thumbnail === nextProps.thumbnail &&
    prevProps.isSharing === nextProps.isSharing
  );
});