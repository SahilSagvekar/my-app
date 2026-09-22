'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, GripVertical, Check } from 'lucide-react';
import { Button } from '../ui/button';

export interface OrderableTaskFile {
    id: string;
    name: string;
    url: string;
    uploadedAt?: string;
    mimeType?: string;
    [key: string]: any;
}

interface ImageOrderModalProps {
    open: boolean;
    onClose: () => void;
    files: OrderableTaskFile[];
    currentFileId?: string;
    onSelectFile: (file: OrderableTaskFile) => void;
    onReorder: (newFiles: OrderableTaskFile[]) => void;
    isSaving?: boolean;
}

export function ImageOrderModal({
    open,
    onClose,
    files,
    currentFileId,
    onSelectFile,
    onReorder,
    isSaving = false,
}: ImageOrderModalProps) {
    const [items, setItems] = useState<OrderableTaskFile[]>(files);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Sync items when files prop changes (and not dragging)
    useEffect(() => {
        if (draggedIndex === null) {
            setItems(files);
        }
    }, [files, draggedIndex]);

    if (!open) return null;

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', index.toString());
        // For smoother dragging preview in some browsers
        if (e.currentTarget) {
            e.currentTarget.style.opacity = '0.4';
        }
    };

    const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
        e.currentTarget.style.opacity = '1';
        setDraggedIndex(null);
        setDragOverIndex(null);
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dragOverIndex !== index) {
            setDragOverIndex(index);
        }
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetIndex: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === targetIndex) {
            setDraggedIndex(null);
            setDragOverIndex(null);
            return;
        }

        const reordered = [...items];
        const [movedItem] = reordered.splice(draggedIndex, 1);
        reordered.splice(targetIndex, 0, movedItem);

        setItems(reordered);
        setDraggedIndex(null);
        setDragOverIndex(null);
        onReorder(reordered);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            {/* Overlay backdrop click to close */}
            <div className="absolute inset-0" onClick={onClose} />

            <div
                ref={containerRef}
                className="relative z-10 w-full max-w-4xl border border-[var(--review-border)] rounded-2xl p-5 shadow-2xl flex flex-col gap-4 text-[var(--review-text-primary)] overflow-hidden max-h-[85vh]"
                style={{ background: 'var(--review-bg-secondary)' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-[var(--review-border)] pb-3">
                    <div className="flex items-center gap-2.5">
                        <span className="font-bold text-base tracking-wide text-[var(--review-text-primary)]">
                            Image Order
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-[var(--review-text-secondary)]">
                            {items.length} {items.length === 1 ? 'image' : 'images'}
                        </span>
                        {isSaving && (
                            <span className="text-xs text-[var(--review-text-secondary)] flex items-center gap-1">
                                <div className="h-2 w-2 rounded-full bg-[var(--review-text-secondary)] animate-pulse" />
                                Saving order...
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <p className="text-xs text-[var(--review-text-muted)] hidden sm:inline">
                            Drag & drop cards to reorder slides
                        </p>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onClose}
                            className="h-8 w-8 text-[var(--review-text-secondary)] hover:text-[var(--review-text-primary)] hover:bg-white/10 rounded-full"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* 4-column Grid */}
                <div className="overflow-y-auto pr-1 review-scrollbar py-2">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
                        {items.map((file, index) => {
                            const isSelected = currentFileId === file.id;
                            const isBeingDragged = draggedIndex === index;
                            const isOver = dragOverIndex === index;

                            return (
                                <div
                                    key={file.id}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, index)}
                                    onDragEnd={handleDragEnd}
                                    onDragOver={(e) => handleDragOver(e, index)}
                                    onDrop={(e) => handleDrop(e, index)}
                                    onClick={() => onSelectFile(file)}
                                    className={`relative group aspect-[3/4] rounded-xl overflow-hidden cursor-grab active:cursor-grabbing select-none transition-all duration-150 border ${
                                        isSelected
                                            ? 'ring-2 ring-white border-[var(--review-text-primary)] scale-[1.02] shadow-lg shadow-white/10'
                                            : 'border-[var(--review-border)] hover:border-[var(--review-border-hover)]'
                                    } ${isOver ? 'ring-2 ring-white/30 border-[var(--review-border-hover)]' : ''} ${
                                        isBeingDragged ? 'opacity-40 scale-95' : 'opacity-100'
                                    }`}
                                    style={{ background: 'var(--review-bg-tertiary)' }}
                                >
                                    {/* Sequence Number Badge */}
                                    <div className="absolute top-2.5 left-2.5 z-10 w-7 h-7 rounded-full bg-black/85 border border-[var(--review-border)] text-[var(--review-text-primary)] font-extrabold text-xs flex items-center justify-center shadow-md">
                                        {index + 1}
                                    </div>

                                    {/* Active Checkmark indicator */}
                                    {isSelected && (
                                        <div className="absolute top-2.5 right-2.5 z-10 px-2 py-0.5 rounded-full bg-[var(--review-text-primary)] text-black font-bold text-[10px] flex items-center gap-1 shadow-md">
                                            <Check className="h-2.5 w-2.5" />
                                            Active
                                        </div>
                                    )}

                                    {/* Image Thumbnail */}
                                    <img
                                        src={file.url}
                                        alt={file.name || `Image ${index + 1}`}
                                        className="w-full h-full object-cover pointer-events-none"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src =
                                                'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" fill="gray"><rect width="100" height="100"/></svg>';
                                        }}
                                    />

                                    {/* Bottom gradient filename */}
                                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-2 pt-5">
                                        <p className="text-[11px] font-medium text-white/90 truncate">
                                            {file.name || `Image #${index + 1}`}
                                        </p>
                                    </div>

                                    {/* Hover drag hint */}
                                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none flex items-center justify-center">
                                        <div className="bg-black/70 backdrop-blur-sm px-2 py-1 rounded-md text-[10px] text-white/90 flex items-center gap-1">
                                            <GripVertical className="h-3 w-3" /> Drag to move
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-between pt-2 border-t border-[var(--review-border)] text-xs text-[var(--review-text-muted)]">
                    <span>
                        The order configured here will be preserved for the scheduler.
                    </span>
                    <Button
                        size="sm"
                        onClick={onClose}
                        className="bg-[var(--review-text-primary)] text-black hover:bg-white/90 font-medium px-4 h-8"
                    >
                        Done
                    </Button>
                </div>
            </div>
        </div>
    );
}