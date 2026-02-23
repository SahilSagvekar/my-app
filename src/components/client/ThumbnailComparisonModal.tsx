import React, { useState } from 'react';
import {
    Dialog,
    DialogContent,
} from "../ui/dialog";
import { Button } from "../ui/button";
import {
    X,
    Maximize2
} from "lucide-react";

interface TaskFile {
    id: string;
    name: string;
    url: string;
    uploadedAt: string;
    uploadedBy: string;
    mimeType: string;
    size: number;
    folderType?: string;
    version?: number;
    isActive?: boolean;
    revisionNote?: string;
}

interface ThumbnailComparisonModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    thumbnails: TaskFile[];
    taskTitle: string;
}

export function ThumbnailComparisonModal({
    isOpen,
    onOpenChange,
    thumbnails,
    taskTitle,
}: ThumbnailComparisonModalProps) {
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    // Sort thumbnails by version descending (latest first)
    const sortedThumbnails = [...thumbnails].sort((a, b) =>
        (b.version || 1) - (a.version || 1)
    );

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onOpenChange}>
                <DialogContent
                    className="fixed inset-0 sm:max-w-none w-screen h-screen m-0 p-0 border-none bg-black rounded-none flex items-center overflow-hidden translate-x-0 translate-y-0"
                    aria-describedby="comparison-description"
                >
                    <div id="comparison-description" className="sr-only">Thumbnail Comparison for {taskTitle}</div>

                    {/* Simple Close Button */}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onOpenChange(false)}
                        className="fixed top-8 right-8 z-[100] text-zinc-500 hover:text-white hover:bg-white/10 rounded-full h-12 w-12"
                    >
                        <X className="h-8 w-8" />
                    </Button>

                    {/* Side-by-Side Strip */}
                    <div className="w-full h-full overflow-x-auto overflow-y-hidden flex items-center justify-start scrollbar-hide">
                        <div className="flex gap-20 px-[10vw] min-w-max">
                            {sortedThumbnails.map((thumb) => (
                                <div key={thumb.id} className="flex flex-col items-center gap-10 flex-shrink-0 animate-in fade-in zoom-in-95 duration-700">
                                    {/* Version indicator */}
                                    <div className="flex flex-col items-center gap-2 text-center">
                                        <span className={`text-xs font-black tracking-[0.4em] uppercase ${thumb.isActive !== false ? 'text-[#3b82f6]' : 'text-zinc-600'}`}>
                                            Version {thumb.version || 1}
                                        </span>
                                        {thumb.isActive !== false && (
                                            <div className="px-2 py-0.5 bg-[#3b82f6] text-white text-[9px] font-bold rounded-sm tracking-widest uppercase">
                                                Latest
                                            </div>
                                        )}
                                    </div>

                                    {/* Image Container */}
                                    <div
                                        className={`relative overflow-hidden rounded-2xl bg-zinc-900 shadow-[0_0_80px_rgba(0,0,0,0.9)] transition-all duration-700 hover:scale-[1.02] ${thumb.isActive !== false ? 'ring-2 ring-[#3b82f6] ring-offset-[16px] ring-offset-black' : 'opacity-30 hover:opacity-100 scale-95'
                                            }`}
                                        style={{ width: 'min(750px, 75vw)' }}
                                    >
                                        <div className="aspect-video relative">
                                            <img
                                                src={thumb.url}
                                                alt={`V${thumb.version}`}
                                                className="w-full h-full object-cover"
                                            />
                                            <button
                                                onClick={() => setSelectedImage(thumb.url)}
                                                className="absolute inset-0 w-full h-full bg-black/0 hover:bg-black/10 transition-colors"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Simple Zoom Modal */}
            <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
                <DialogContent className="max-w-[95vw] h-[95vh] p-0 border-none bg-black/95">
                    {selectedImage && (
                        <div className="relative w-full h-full flex items-center justify-center p-4">
                            <img
                                src={selectedImage}
                                alt="Zoomed"
                                className="max-w-full max-h-full object-contain"
                            />
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setSelectedImage(null)}
                                className="absolute top-4 right-4 text-white hover:bg-white/10"
                            >
                                <X className="h-6 w-6" />
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
