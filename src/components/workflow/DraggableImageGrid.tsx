"use client";

import { useState } from 'react';
import type { ReactNode } from 'react';
import { GripVertical, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DraggableImageGridProps<T extends { id: string }> {
  items: T[];
  /** Called on drop with the full list in its new order. */
  onReorder: (next: T[]) => void;
  /** Renders the inside of one tile; the grid supplies the drag wrapper. */
  renderTile: (item: T, index: number) => ReactNode;
  isSaving?: boolean;
  className?: string;
}

/**
 * Hard-post image grid where the tiles themselves are dragged to reorder
 * (native HTML5 drag & drop — no library, no separate reorder UI).
 * With a single image it renders as a plain grid.
 */
export function DraggableImageGrid<T extends { id: string }>({
  items,
  onReorder,
  renderTile,
  isSaving = false,
  className,
}: DraggableImageGridProps<T>) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const sortable = items.length > 1;

  const reset = () => {
    setDragIndex(null);
    setOverIndex(null);
  };

  return (
    <div className="space-y-1.5">
      {sortable && (
        <div className="flex items-center justify-between px-1.5 text-[11px] text-gray-500">
          <span className="flex items-center gap-1">
            <GripVertical className="h-3 w-3" />
            Drag images to reorder
          </span>
          {isSaving && (
            <span className="flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Saving…
            </span>
          )}
        </div>
      )}

      <div className={className}>
        {items.map((item, index) => {
          const isDragging = dragIndex === index;
          const isTarget = dragIndex !== null && overIndex === index && dragIndex !== index;

          return (
            <div
              key={item.id}
              draggable={sortable}
              onDragStart={(e) => {
                setDragIndex(index);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', String(index)); // Firefox needs data to start a drag
              }}
              onDragOver={(e) => {
                if (dragIndex === null) return; // ignore unrelated drags (files from the desktop)
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (overIndex !== index) setOverIndex(index);
              }}
              onDrop={(e) => {
                if (dragIndex === null) return;
                e.preventDefault();
                if (dragIndex !== index) {
                  const next = [...items];
                  const [moved] = next.splice(dragIndex, 1);
                  next.splice(index, 0, moved);
                  onReorder(next);
                }
                reset();
              }}
              onDragEnd={reset}
              className={cn(
                'rounded-lg transition-all',
                sortable && 'cursor-grab active:cursor-grabbing',
                isDragging && 'opacity-40 scale-95',
                isTarget && 'ring-2 ring-gray-900 ring-offset-1 scale-[1.03]'
              )}
            >
              {renderTile(item, index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
