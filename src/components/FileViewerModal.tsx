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

  const isPDF = file.mimeType?.includes("pdf");
  const isImage = file.mimeType?.startsWith("image/");
  const isVideo = file.mimeType?.startsWith("video/");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{file.name}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden border rounded-md">
          {/* PDF */}
          {isPDF && (
            <iframe
              src={file.url}
              className="w-full h-full"
              title="PDF Preview"
            />
          )}

          {/* IMAGE */}
          {isImage && (
            <img
              src={file.url}
              alt={file.name}
              className="w-full h-full object-contain bg-black"
            />
          )}

          {/* VIDEO */}
          {isVideo && (
            <video
              src={file.url}
              controls
              className="w-full h-full bg-black"
            />
          )}

          {/* ANY OTHER FILE */}
          {!isPDF && !isImage && !isVideo && (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center">
              <p className="text-sm text-muted-foreground mb-4">
                Preview not available for this file type.
              </p>
              <Button onClick={() => window.open(file.url, "_blank")}>
                Download File
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
