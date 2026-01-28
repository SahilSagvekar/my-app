// components/FilePreviewModal.tsx

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function FilePreviewModal({
  file,
  open,
  onOpenChange
}: {
  file: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {

  if (!file) return null;

  const getMimeType = (f: any) => {
    if (f.mimeType) return f.mimeType;
    if (f.contentType) return f.contentType;

    const url = (f.url || "").split('?')[0]; // Strip query params
    const name = f.name || "";
    const ext = (name || url).split('.').pop()?.toLowerCase();
    if (!ext) return '';

    if (['mp4', 'webm', 'ogg', 'mov'].includes(ext)) return 'video/mp4';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'image/jpeg';
    if (ext === 'pdf') return 'application/pdf';
    if (['html', 'htm'].includes(ext)) return 'text/html';
    return '';
  };

  const mimeType = getMimeType(file);
  const isPDF = mimeType.includes("pdf");
  const isImage = mimeType.startsWith("image/");
  const isVideo = mimeType.startsWith("video/");
  const isWeb = mimeType === "text/html" || mimeType === "application/x-html" || (!isPDF && !isImage && !isVideo && file.url?.startsWith("http"));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-4 border-b">
          <DialogTitle className="truncate pr-8">{file.name}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden bg-accent/20">
          {/* PDF */}
          {isPDF && (
            <iframe
              key={file.url}
              src={file.url}
              className="w-full h-full bg-white"
              title="PDF Preview"
            />
          )}

          {/* IMAGE */}
          {isImage && (
            <div className="w-full h-full flex items-center justify-center p-4">
              <img
                key={file.url}
                src={file.url}
                alt={file.name}
                className="max-w-full max-h-full object-contain shadow-2xl rounded-sm"
              />
            </div>
          )}

          {/* VIDEO */}
          {isVideo && (
            <div className="w-full h-full flex items-center justify-center bg-black">
              <video
                key={file.url}
                src={file.url}
                controls
                className="max-w-full max-h-full"
                preload="auto"
                playsInline
                autoPlay
              />
            </div>
          )}

          {/* WEB LINK / SOCIAL MEDIA */}
          {isWeb && !isPDF && !isImage && !isVideo && (
            <iframe
              key={file.url}
              src={file.url}
              className="w-full h-full bg-white"
              title="Web Preview"
              sandbox="allow-scripts allow-same-origin allow-popups"
            />
          )}

          {/* ANY OTHER FILE */}
          {!isPDF && !isImage && !isVideo && !isWeb && (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center">
              <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-4">
                <span className="text-3xl">📁</span>
              </div>
              <h3 className="text-lg font-medium mb-2">No Preview Available</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm">
                We can't preview this file type directly. You can download it to view it on your device.
              </p>
              <Button onClick={() => window.open(file.url, "_blank")} size="lg">
                Download File
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
