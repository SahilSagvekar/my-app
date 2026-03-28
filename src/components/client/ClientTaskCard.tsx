'use client';

import { memo } from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import {
  FileText,
  Clock,
  Check,
  ExternalLink,
  Share,
  Download,
} from 'lucide-react';

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

  return (
    <Card
      className={`group cursor-pointer border-none shadow-sm transition-all duration-300 rounded-[1.25rem] overflow-hidden flex flex-col h-full bg-white hover:shadow-md hover:ring-1 hover:ring-zinc-200 ${
        isSelected ? 'ring-2 ring-primary' : ''
      }`}
      onClick={() => onTaskClick(task)}
    >
      {/* Visual Header / Thumbnail Area */}
      <div className="h-44 relative flex items-center justify-center bg-zinc-50 transition-colors overflow-hidden font-bold">
        {displayThumbnail ? (
          <img
            src={displayThumbnail}
            alt={task.title}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            loading="lazy"
          />
        ) : (
          <div className="text-zinc-300 text-[10px] font-bold uppercase tracking-wider">
            No thumbnail
          </div>
        )}

        {displayThumbnail && <div className="absolute inset-0 bg-black/5" />}

        {/* File Count - Top Right */}
        <div className="absolute top-3 right-3 flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/80 text-zinc-700 text-[11px] font-semibold border border-zinc-200/50 shadow-sm backdrop-blur-sm">
            <FileText className="h-3 w-3" />
            {task.files?.length || 0}
          </div>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-4 flex flex-col gap-3">
        {/* Title */}
        <h4 className="text-zinc-900 font-bold text-sm line-clamp-1">{task.title}</h4>

        {/* Status & Actions Row */}
        <div className="flex items-center justify-between text-zinc-500 text-[11px]">
          <div className="flex flex-wrap gap-2 pt-1">
            {task.status === 'POSTED' ? (
              <Badge className="bg-orange-50 text-orange-600 hover:bg-orange-100 border-none rounded-full px-3 py-0.5 text-[10px] font-bold flex items-center gap-1">
                <ExternalLink className="h-2.5 w-2.5" />
                Posted
              </Badge>
            ) : task.status === 'SCHEDULED' ? (
              <Badge className="bg-blue-50 text-blue-600 hover:bg-blue-100 border-none rounded-full px-3 py-0.5 text-[10px] font-bold flex items-center gap-1">
                <Clock className="h-2.5 w-2.5" />
                Scheduled
              </Badge>
            ) : task.status === 'COMPLETED' ? (
              <Badge className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border-none rounded-full px-3 py-0.5 text-[10px] font-bold flex items-center gap-1">
                <Check className="h-2.5 w-2.5" />
                Approved
              </Badge>
            ) : (
              <Badge className="bg-zinc-50 text-zinc-600 hover:bg-zinc-100 border-none rounded-full px-3 py-0.5 text-[10px] font-bold">
                Pending Review
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-7 w-7 min-h-[44px] min-w-[44px] rounded-full bg-white shadow-sm flex items-center justify-center p-0 border border-zinc-200/50 transition-all hover:bg-zinc-50 hover:border-zinc-300 active:bg-zinc-100"
                  onClick={(e) => onShare(e, task)}
                  disabled={isSharing}
                >
                  <Share className="h-3.5 w-3.5 text-zinc-700" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="bg-zinc-900 text-white text-[10px] px-2 py-1 rounded shadow-xl border-none">
                <p>Share review screen</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-7 w-7 min-h-[44px] min-w-[44px] rounded-full bg-white shadow-sm flex items-center justify-center p-0 border border-zinc-200/50 transition-all hover:bg-zinc-50 hover:border-zinc-300 active:bg-zinc-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDownload(task);
                  }}
                >
                  <Download className="h-3.5 w-3.5 text-zinc-700" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="bg-zinc-900 text-white text-[10px] px-2 py-1 rounded shadow-xl border-none">
                <p>Download</p>
              </TooltipContent>
            </Tooltip>
          </div>
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
