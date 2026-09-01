'use client';

import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SalesPipelineToolbarProps {
  title?: string;
  subtitle?: string;
  search: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function SalesPipelineToolbar({
  title,
  subtitle,
  search,
  onSearchChange,
  searchPlaceholder = 'Search leads, companies…',
  actions,
  className,
}: SalesPipelineToolbarProps) {
  return (
    <div className={cn('sticky top-0 z-20 bg-white relative flex flex-col md:flex-row md:items-center justify-between gap-3 py-1', className)}>
      {title && (
        <div>
          <h1 className="text-[20px] font-extrabold text-gray-900 tracking-tight">{title}</h1>
          {subtitle && <p className="text-[12.5px] text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
      )}
      <div className="relative md:absolute md:left-1/2 md:-translate-x-1/2">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="h-10 pl-10 pr-9 rounded-full border border-transparent bg-secondary/30 text-[13px] focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 transition-all w-[220px] md:w-[280px]"
        />
        {search && (
          <button onClick={() => onSearchChange('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 md:ml-auto">
        {actions}
      </div>
    </div>
  );
}