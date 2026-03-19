'use client';

import { Card } from '../ui/card';

export function TaskCardSkeleton() {
  return (
    <Card className="border-none shadow-sm rounded-[1.25rem] overflow-hidden flex flex-col h-full bg-white animate-pulse">
      {/* Thumbnail skeleton */}
      <div className="h-44 bg-zinc-200" />
      
      {/* Card body skeleton */}
      <div className="p-4 flex flex-col gap-3">
        {/* Title skeleton */}
        <div className="h-4 bg-zinc-200 rounded w-3/4" />
        
        {/* Status & actions skeleton */}
        <div className="flex items-center justify-between">
          <div className="h-6 bg-zinc-100 rounded-full w-24" />
          <div className="flex gap-2">
            <div className="h-7 w-7 bg-zinc-100 rounded-full" />
            <div className="h-7 w-7 bg-zinc-100 rounded-full" />
          </div>
        </div>
      </div>
    </Card>
  );
}

export function TaskGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <TaskCardSkeleton key={i} />
      ))}
    </div>
  );
}
