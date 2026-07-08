'use client';

import { cn } from '@/lib/utils';

interface SalesHeaderTab<T extends string> {
  id: T;
  label: string;
}

interface SalesHeaderProps<T extends string> {
  tabs?: SalesHeaderTab<T>[];
  activeTab?: T;
  onTabChange?: (id: T) => void;
}

/**
 * Persistent top header for the Sales portal — E8 badge + title/subtitle,
 * with an underlined pill tab row underneath. Matches the design reference
 * (`Sales Portal (reference).dc.html`) header section.
 */
export function SalesHeader<T extends string>({ tabs, activeTab, onTabChange }: SalesHeaderProps<T>) {
  return (
    <div className="sticky top-0 z-30 bg-white border-b border-gray-200 -mx-4 px-4 sm:-mx-6 sm:px-6 mb-4">
      <div className="max-w-[1480px] mx-auto pt-2">
        <div className="flex items-center gap-3.5">
          <div className="w-9 h-9 rounded-[10px] bg-[#0073EA] flex items-center justify-center text-white font-extrabold text-[15px] shrink-0">
            E8
          </div>
          <div>
            <h1 className="m-0 text-[20px] font-extrabold tracking-tight text-gray-900 leading-tight">Sales</h1>
            <p className="m-0 text-[12.5px] text-gray-500 leading-tight">Lead pipeline &amp; performance</p>
          </div>
        </div>

        {tabs && tabs.length > 0 && (
          <div className="flex items-center gap-1 mt-3.5 overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => onTabChange?.(tab.id)}
                className={cn(
                  'px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors -mb-px',
                  activeTab === tab.id
                    ? 'text-[#0073EA] border-[#0073EA]'
                    : 'text-gray-400 border-transparent hover:text-gray-600'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}