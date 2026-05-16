'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Folder,
  File as FileIcon,
  Download,
  AlertCircle,
  Loader2,
  Image as ImageIcon,
  Video,
  FileText,
  Music,
  Archive,
  ChevronRight,
  Share2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

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
  s3Key: string;
  items: FolderItem[];
  createdAt: string;
}

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext))
    return <ImageIcon className="h-5 w-5 text-blue-500 flex-shrink-0" />;
  if (['mp4', 'webm', 'mov', 'avi'].includes(ext))
    return <Video className="h-5 w-5 text-purple-500 flex-shrink-0" />;
  if (['pdf', 'doc', 'docx', 'txt'].includes(ext))
    return <FileText className="h-5 w-5 text-red-500 flex-shrink-0" />;
  if (['mp3', 'wav', 'ogg'].includes(ext))
    return <Music className="h-5 w-5 text-green-500 flex-shrink-0" />;
  if (['zip', 'rar', '7z', 'tar'].includes(ext))
    return <Archive className="h-5 w-5 text-yellow-500 flex-shrink-0" />;
  return <FileIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />;
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
  const [folderData, setFolderData] = useState<FolderData | null>(null);

  useEffect(() => {
    if (shareToken) loadFolder();
  }, [shareToken]);

  const loadFolder = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/shared/folder/${shareToken}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load folder');
      setFolderData(data);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
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

  const files = folderData.items.filter((i) => i.type === 'file');
  const folders = folderData.items.filter((i) => i.type === 'folder');

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="max-w-4xl mx-auto px-4 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <Folder className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <h1 className="text-base font-semibold">{folderData.folderName}</h1>
              <p className="text-xs text-muted-foreground">
                {folderData.items.length} item{folderData.items.length !== 1 ? 's' : ''} · Shared on{' '}
                {formatDate(folderData.createdAt)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Share2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground hidden sm:inline">E8 Productions</span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {folderData.items.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Folder className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>This folder is empty.</p>
          </div>
        )}

        {folders.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Folders
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {folders.map((folder) => (
                <div
                  key={folder.s3Key}
                  className="border rounded-lg p-4 flex flex-col items-center gap-2 bg-card hover:bg-accent transition-colors"
                >
                  <Folder className="h-10 w-10 text-blue-500" />
                  <p className="text-xs font-medium text-center truncate w-full">{folder.name}</p>
                  <span className="text-[10px] text-muted-foreground">Folder</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {files.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Files
            </p>
            <div className="border rounded-lg overflow-hidden divide-y">
              {files.map((file) => (
                <div
                  key={file.s3Key}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors"
                >
                  {getFileIcon(file.name)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {file.size && <span>{file.size}</span>}
                      {file.lastModified && (
                        <>
                          <ChevronRight className="h-3 w-3" />
                          <span>{formatDate(file.lastModified)}</span>
                        </>
                      )}
                    </div>
                  </div>
                  {file.url && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 shrink-0"
                      onClick={() => window.open(file.url, '_blank')}
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Download</span>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="border-t mt-12">
        <div className="max-w-4xl mx-auto px-4 py-4 text-center text-xs text-muted-foreground">
          Shared via E8 Productions Drive
        </div>
      </div>
    </div>
  );
}