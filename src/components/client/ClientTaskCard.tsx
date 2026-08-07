'use client';

import { memo, useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { getDeliverableTypeColor } from '../constants/deliverableColors';
import {
  FileText,
  Check,
  Share,
  Download,
} from 'lucide-react';

// Shared shape for both action buttons so they stay identical.
const PILL =
  'h-7 min-h-[36px] sm:min-h-0 rounded-full px-3 border text-[10px] font-bold ' +
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors';

interface TaskFile {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  folderType?: string;
  version?: number;
  isActive?: boolean;
}

interface ClientTask {
  id: string;
  title: string;
  status: string;
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

// Helper to get thumbnail from task files
function getTaskThumbnailFromFiles(files?: TaskFile[]): string | null {
  if (!files || files.length === 0) return null;

  // First try to find an active thumbnail
  const activeThumbnail = files.find(
    (f) => f.folderType === 'thumbnails' && f.isActive !== false && f.mimeType?.startsWith('image/')
  );
  if (activeThumbnail?.url) return activeThumbnail.url;

  // Then try any image
  const anyImage = files.find((f) => f.mimeType?.startsWith('image/') && f.isActive !== false);
  if (anyImage?.url) return anyImage.url;

  return null;
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

  // 🔥 Desktop app only — checks whether this task's video file(s) are
  // already saved to the client's disk, so the Download button can show
  // "Downloaded" instead once auto-download (or a manual click) has
  // finished. window.e8 doesn't exist in a normal browser tab, so this
  // is a no-op there.
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

  // Same per-type colors QC and editors see, so a Short Form card reads the same
  // to a client as it does internally.
  const typeColors = getDeliverableTypeColor(
    (task as any).deliverableType || (task as any).taskType || ''
  );

  return (
    <Card
      // gap-0 overrides the Card component's default gap-6, which was adding 24px
      // of dead space between the thumbnail and the title on top of the body padding.
      className={`group cursor-pointer border shadow-sm transition-all duration-300 rounded-[1.25rem] overflow-hidden flex flex-col gap-0 h-full hover:shadow-md hover:ring-1 ${typeColors.bg} ${typeColors.border} ${typeColors.ring} ${
        isSelected ? 'ring-2 ring-primary' : ''
      }`}
      onClick={() => onTaskClick(task)}
    >
      {/* Visual Header / Thumbnail Area */}
      <div className="h-44 relative flex items-center justify-center bg-zinc-50 transition-colors overflow-hidden font-bold">
        {displayThumbnail && (
          <img
            src={displayThumbnail}
            alt={task.title}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 z-10"
            loading="lazy"
            onError={(e) => {
              // Hide broken image so fallback shows through
              (e.target as HTMLImageElement).style.opacity = '0';
            }}
          />
        )}
        {/* No thumbnail text fallback - always rendered behind, visible when no image or image fails */}
        <div className="text-zinc-300 text-[10px] font-bold uppercase tracking-wider absolute inset-0 flex items-center justify-center">
          No thumbnail
        </div>

        {displayThumbnail && <div className="absolute inset-0 bg-black/5 z-10 pointer-events-none" />}
      </div>

      {/* Card Body */}
      <div className="p-4 flex flex-col gap-3">
        {/* Title takes all remaining width; the file count only takes what it
            needs and sits flush right — which is the same edge as the Download
            pill below, since both rows share this container's padding. */}
        <div className="flex items-center gap-2">
          <h4 className="flex-1 min-w-0 text-zinc-900 font-bold text-base leading-snug line-clamp-1">{task.monthlyDeliverable?.type ? task.monthlyDeliverable.type.replace(/_/g, " ") : "Content"}</h4>
          <span className="shrink-0 flex items-center gap-1.5 text-zinc-500 text-xs font-semibold">
            <FileText className="h-3.5 w-3.5" />
            {task.files?.length || 0}
          </span>
        </div>

        {/* Actions Row — no status pill: every card in a given tab already shares
            that status, so repeating it on each card said nothing. The two actions
            split the row evenly instead. */}
        <div className="flex items-stretch gap-2 text-[11px]">
          <Button
            variant="secondary"
            className={`${PILL} flex-1 bg-orange-500 text-white border-orange-500 shadow-sm hover:bg-orange-600 hover:border-orange-600 active:bg-orange-700`}
            onClick={(e) => onShare(e, task)}
            disabled={isSharing}
          >
            <Share className="h-3 w-3" />
            Share
          </Button>

          <Button
            variant="secondary"
            className={`${PILL} flex-1 text-white shadow-sm ${
              isFullyDownloaded
                ? 'bg-emerald-500 border-emerald-500 hover:bg-emerald-600 hover:border-emerald-600'
                : 'bg-blue-600 border-blue-600 hover:bg-blue-700 hover:border-blue-700 active:bg-blue-800'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              onDownload(task);
            }}
          >
            {isFullyDownloaded ? (
              <Check className="h-3 w-3" />
            ) : (
              <Download className="h-3 w-3" />
            )}
            {isFullyDownloaded ? 'Saved' : 'Download'}
          </Button>
        </div>
      </div>
    </Card>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for better memoization
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