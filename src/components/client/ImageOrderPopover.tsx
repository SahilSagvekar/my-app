'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ListOrdered, ChevronUp, ChevronDown, Check, GripVertical, Loader2, X } from 'lucide-react';
import { TaskFile } from './ThumbnailReviewModal';

interface ImageOrderPopoverProps {
    files: TaskFile[];
    currentFileId?: string;
    onSelectFile: (file: TaskFile) => void;
    onReorder: (newFiles: TaskFile[]) => void;
    isSaving?: boolean;
    buttonLabel?: string;
}

export function ImageOrderPopover({
    files,
    currentFileId,
    onSelectFile,
    onReorder,
    isSaving = false,
    buttonLabel = 'Order',
}: ImageOrderPopoverProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [items, setItems] = useState<TaskFile[]>(files);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);

    // Sync items when files prop changes (and not actively dragging)
    useEffect(() => {
        if (draggedIndex === null) {
            setItems(files);
        }
    }, [files, draggedIndex]);

    // Close on outside click
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (e: MouseEvent) => {
            if (
                popoverRef.current &&
                !popoverRef.current.contains(e.target as Node) &&
                triggerRef.current &&
                !triggerRef.current.contains(e.target as Node)
            ) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', index.toString());
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

    if (files.length <= 1) return null;

    return (
        <div className="relative inline-flex items-center">
            {/* Popover Panel (Upward Dropdown) */}
            {isOpen && (
                <div
                    ref={popoverRef}
                    className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 z-50 p-3 rounded-2xl border border-white/20 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
                    style={{
                        background: 'rgba(18, 19, 24, 0.96)',
                        boxShadow: '0 20px 40px -10px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.1)',
                        width: 'max-content',
                        maxWidth: 'calc(100vw - 32px)',
                    }}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between gap-4 pb-2.5 mb-2.5 border-b border-white/10 px-1">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white tracking-wide">
                                Order Images ({items.length})
                            </span>
                            <span className="text-[10px] text-[var(--review-text-muted)]">
                                Drag to reorder
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            {isSaving && (
                                <span className="flex items-center gap-1 text-[10px] text-purple-300 font-medium">
                                    <Loader2 className="h-3 w-3 animate-spin" /> Saving...
                                </span>
                            )}
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="text-[var(--review-text-muted)] hover:text-white p-0.5 rounded-md hover:bg-white/10 transition-colors"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>

                    {/* 4-column Grid that expands vertically */}
                    <div
                        className="grid grid-cols-4 gap-2.5 max-h-[380px] overflow-y-auto p-1 review-scrollbar"
                        style={{ minWidth: 'min(360px, 85vw)' }}
                    >
                        {items.map((file, index) => {
                            const isCurrent = file.id === currentFileId;
                            const isBeingDragged = draggedIndex === index;
                            const isDragOver = dragOverIndex === index;

                            return (
                                <div
                                    key={file.id}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, index)}
                                    onDragEnd={handleDragEnd}
                                    onDragOver={(e) => handleDragOver(e, index)}
                                    onDrop={(e) => handleDrop(e, index)}
                                    onClick={() => {
                                        onSelectFile(file);
                                    }}
                                    className={`relative group aspect-square rounded-xl overflow-hidden cursor-grab active:cursor-grabbing transition-all select-none ${
                                        isCurrent
                                            ? 'border-2 border-white ring-2 ring-white/40 shadow-lg shadow-white/10'
                                            : 'border border-white/15 hover:border-white/40 opacity-85 hover:opacity-100'
                                    } ${isBeingDragged ? 'opacity-30 scale-95' : ''} ${
                                        isDragOver && !isBeingDragged ? 'border-purple-400 ring-2 ring-purple-400/50 scale-105' : ''
                                    }`}
                                    style={{
                                        background: 'rgba(0, 0, 0, 0.6)',
                                        width: '80px',
                                        height: '80px',
                                    }}
                                    title={`#${index + 1} - ${file.name}`}
                                >
                                    {/* Image Thumbnail */}
                                    <img
                                        src={file.url}
                                        alt={file.name}
                                        className="w-full h-full object-cover pointer-events-none"
                                    />

                                    {/* Number Badge */}
                                    <div className="absolute top-1 left-1 bg-black/75 backdrop-blur-md text-white font-bold text-[10px] w-5 h-5 rounded-full flex items-center justify-center border border-white/20 shadow-md">
                                        {index + 1}
                                    </div>

                                    {/* Grip indicator on hover */}
                                    <div className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 rounded p-0.5">
                                        <GripVertical className="h-3 w-3 text-white/70" />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Trigger Button */}
            <button
                ref={triggerRef}
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer shadow-sm border ${
                    isOpen
                        ? 'bg-white text-black border-white shadow-md font-bold'
                        : 'bg-white/10 hover:bg-white/20 text-white border-white/20 hover:border-white/40'
                }`}
                title="Reorder images"
            >
                <ListOrdered className={`h-3.5 w-3.5 ${isOpen ? 'text-black' : 'text-blue-400'}`} />
                <span>{buttonLabel}</span>
                <ChevronUp className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
        </div>
    );
}
