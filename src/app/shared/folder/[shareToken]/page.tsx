'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  Folder,
  File as FileIcon,
  AlertCircle,
  Loader2,
  Image as ImageIcon,
  Video,
  FileText,
  Music,
  Archive,
  ChevronRight,
  Share2,
  Home,
} from 'lucide-react';
import { ShareAccessGate } from '@/components/shared/ShareAccessGate';

interface FolderItem {
  name: string;
  type: 'file' | 'folder';
  s3Key: string;
  size?: string;
  rawSize?: number;
  lastModified?: string | null;
  url?: string;
}

interface FolderData {
  folderName: string;
  subpath: string;
  s3Key: string;
  items: FolderItem[];
  createdAt: string;
}

// Matches the icon/color scheme used in the main Drive UI (DriveExplorer)
// so a shared folder looks the same as the real thing.
function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext))
    return <ImageIcon className="h-8 w-8 text-blue-500" />;
  if (['mp4', 'webm', 'mov', 'avi'].includes(ext))
    return <Video className="h-8 w-8 text-purple-500" />;
  if (['pdf', 'doc', 'docx', 'txt'].includes(ext))
    return <FileText className="h-8 w-8 text-red-500" />;
  if (['mp3', 'wav', 'ogg'].includes(ext))
    return <Music className="h-8 w-8 text-green-500" />;
  if (['zip', 'rar', '7z', 'tar'].includes(ext))
    return <Archive className="h-8 w-8 text-yellow-500" />;
  return <FileIcon className="h-8 w-8 text-gray-500" />;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function SharedFolderPage() {
  const params = useParams();
  const shareToken = params.shareToken as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [folderData, setFolderData] = useState<FolderData | null>(null);
  // Breadcrumb segments below the shared root — e.g. ["TDBS-2", "Renders"]
  const [pathSegments, setPathSegments] = useState<string[]>([]);

  const loadFolder = useCallback(
    async (subpathSegments: string[]) => {
      try {
        setLoading(true);
        setError(null);
        setNeedsVerification(false);
        const subpath = subpathSegments.join('/');
        const url = subpath
          ? `/api/shared/folder/${shareToken}?subpath=${encodeURIComponent(subpath)}`
          : `/api/shared/folder/${shareToken}`;
        const res = await fetch(url);
        const data = await res.json();
        if (!res.ok) {
          if (data.error === 'EMAIL_VERIFICATION_REQUIRED') {
            setNeedsVerification(true);
            return;
          }
          throw new Error(data.error || 'Failed to load folder');
        }
        setFolderData(data);
      } catch (err: any) {
        setError(err.message || 'Something went wrong');
      } finally {
        setLoading(false);
      }
    },
    [shareToken]
  );

  useEffect(() => {
    if (shareToken) loadFolder(pathSegments);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareToken]);

  const navigateTo = (segments: string[]) => {
    setPathSegments(segments);
    loadFolder(segments);
  };

  const handleItemClick = (item: FolderItem) => {
    if (item.type === 'folder') {
      navigateTo([...pathSegments, item.name]);
    } else if (item.url) {
      window.open(item.url, '_blank');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">Loading folder...</p>
        </div>
      </div>
    );
  }

  if (needsVerification) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <ShareAccessGate shareToken={shareToken} itemType="folder" onVerified={() => loadFolder(pathSegments)} />
      </div>
    );
  }

  if (error || !folderData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <h1 className="text-xl font-semibold">Folder not available</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  const currentFolderName = pathSegments.length > 0 ? pathSegments[pathSegments.length - 1] : folderData.folderName;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-4 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                <Folder className="h-5 w-5 text-blue-500" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-semibold truncate">{currentFolderName}</h1>
                <p className="text-xs text-muted-foreground">
                  {folderData.items.length} item{folderData.items.length !== 1 ? 's' : ''} · Shared on{' '}
                  {formatDate(folderData.createdAt)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Share2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground hidden sm:inline">E8 Productions</span>
            </div>
          </div>

          {/* Breadcrumb — only shown once you've browsed into a subfolder */}
          {pathSegments.length > 0 && (
            <div className="flex items-center gap-1 mt-3 text-xs text-muted-foreground overflow-x-auto">
              <button
                onClick={() => navigateTo([])}
                className="flex items-center gap-1 hover:text-foreground shrink-0"
              >
                <Home className="h-3 w-3" />
                {folderData.folderName}
              </button>
              {pathSegments.map((seg, i) => (
                <span key={i} className="flex items-center gap-1 shrink-0">
                  <ChevronRight className="h-3 w-3" />
                  <button
                    onClick={() => navigateTo(pathSegments.slice(0, i + 1))}
                    className={i === pathSegments.length - 1 ? 'text-foreground font-medium' : 'hover:text-foreground'}
                  >
                    {seg}
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {folderData.items.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Folder className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>This folder is empty.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
            {folderData.items.map((item) => (
              <div
                key={item.s3Key}
                onClick={() => handleItemClick(item)}
                className="group relative border rounded-lg p-2 sm:p-4 cursor-pointer hover:bg-accent transition-colors"
              >
                <div className="flex flex-col items-center text-center">
                  {item.type === 'folder' ? (
                    <Folder className="h-12 w-12 sm:h-16 sm:w-16 text-blue-500 mb-1 sm:mb-2" />
                  ) : (
                    <div className="mb-1 sm:mb-2 w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center rounded-md overflow-hidden bg-muted/40">
                      <div className="scale-75 sm:scale-100">{getFileIcon(item.name)}</div>
                    </div>
                  )}

                  <p className="text-xs sm:text-sm font-medium truncate w-full px-1">{item.name}</p>

                  {item.type === 'file' && item.size && (
                    <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">{item.size}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t mt-12">
        <div className="max-w-6xl mx-auto px-4 py-4 text-center text-xs text-muted-foreground">
          Shared via E8 Productions Drive
        </div>
      </div>
    </div>
  );
}