"use client";
import React, { useState } from 'react';
import { Search, ChevronDown } from 'lucide-react';
import { Input } from '../../ui/input';
import { cn } from '../../ui/utils';
import * as SelectPrimitive from '@radix-ui/react-select';

interface FilterBarProps {
    searchTerm: string;
    setSearchTerm: (val: string) => void;
    dateRange: string;
    setDateRange: (val: string) => void;
    statusFilter: string;
    setStatusFilter: (val: any) => void;
    clientFilter: string;
    handleClientFilterChange: (val: string) => void;
    deliverableFilter: string;
    handleDeliverableFilterChange: (val: string) => void;
    uniqueClients: [string, string][];
    uniqueDeliverables: string[];
    editorFilter: string;
    handleEditorFilterChange: (val: string) => void;
    uniqueEditors: [string, string][];
    sponsoredOnly: boolean;
    setSponsoredOnly: (val: boolean) => void;
    tagFilter: string;
    setTagFilter: (val: string) => void;
    availableTags: string[];
}

interface InlineSelectProps {
    label: string;
    value: string;
    onValueChange: (val: string) => void;
    options: { value: string; label: string }[];
    contentClassName?: string;
}

function InlineSelect({ label, value, onValueChange, options, contentClassName }: InlineSelectProps) {
    const [open, setOpen] = useState(false);
    const selected = options.find(o => o.value === value);

    return (
        <SelectPrimitive.Root value={value} onValueChange={onValueChange} open={open} onOpenChange={setOpen}>
            <SelectPrimitive.Trigger
                className={cn(
                    "inline-flex items-center gap-1 h-8 px-2.5 text-sm border rounded-md bg-white cursor-pointer focus:outline-none hover:border-gray-300 transition-colors whitespace-nowrap",
                    open ? "border-gray-300 shadow-none" : "border-gray-200 shadow-none"
                )}
            >
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium text-gray-900">{selected?.label ?? 'All'}</span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-0.5" />
            </SelectPrimitive.Trigger>
            <SelectPrimitive.Portal>
                <SelectPrimitive.Content
                    position="popper"
                    sideOffset={4}
                    className={cn(
                        "z-50 min-w-[140px] rounded-lg border border-gray-200 bg-white shadow-md overflow-hidden",
                        contentClassName
                    )}
                >
                    <SelectPrimitive.Viewport className="p-1">
                        {options.map((opt) => (
                            <SelectPrimitive.Item
                                key={opt.value}
                                value={opt.value}
                                className="relative flex items-center px-3 py-1.5 text-sm rounded-md cursor-pointer select-none outline-none hover:bg-gray-100 data-[highlighted]:bg-gray-100 data-[state=checked]:font-medium"
                            >
                                <SelectPrimitive.ItemText>{opt.label}</SelectPrimitive.ItemText>
                            </SelectPrimitive.Item>
                        ))}
                    </SelectPrimitive.Viewport>
                </SelectPrimitive.Content>
            </SelectPrimitive.Portal>
        </SelectPrimitive.Root>
    );
}

export function FilterBar({
    searchTerm,
    setSearchTerm,
    dateRange,
    setDateRange,
    statusFilter,
    setStatusFilter,
    clientFilter,
    handleClientFilterChange,
    deliverableFilter,
    handleDeliverableFilterChange,
    uniqueClients,
    uniqueDeliverables,
    editorFilter,
    handleEditorFilterChange,
    uniqueEditors,
    sponsoredOnly,
    setSponsoredOnly,
    tagFilter,
    setTagFilter,
    availableTags,
}: FilterBarProps) {
    return (
        <div className="flex flex-wrap items-center gap-2 bg-white border rounded-lg px-3 py-2 shadow-sm">
            {/* Search — grows to fill available space */}
            <div className="flex-1 min-w-[180px] relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search by title, client or ID"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 h-9 text-sm bg-gray-50 border-gray-200 rounded-md focus-visible:ring-0"
                />
            </div>

            {/* All filters inline — wrap naturally on small screens */}
            <InlineSelect
                label="Window"
                value={dateRange}
                onValueChange={setDateRange}
                options={[
                    { value: "all", label: "All Time" },
                    { value: "7d", label: "Last 7 Days" },
                    { value: "30d", label: "Last 30 Days" },
                    { value: "90d", label: "Last 90 Days" },
                ]}
            />

            <InlineSelect
                label="Client"
                value={clientFilter}
                onValueChange={handleClientFilterChange}
                contentClassName="max-h-[300px] overflow-y-auto"
                options={[
                    { value: "all", label: "All" },
                    ...uniqueClients.map(([id, name]) => ({ value: id, label: name })),
                ]}
            />

            <InlineSelect
                label="Type"
                value={deliverableFilter}
                onValueChange={handleDeliverableFilterChange}
                options={[
                    { value: "all", label: "All" },
                    ...uniqueDeliverables.map((type) => ({ value: type, label: type })),
                ]}
            />

            <InlineSelect
                label="Editor"
                value={editorFilter}
                onValueChange={handleEditorFilterChange}
                contentClassName="max-h-[300px] overflow-y-auto"
                options={[
                    { value: "all", label: "All" },
                    ...uniqueEditors.map(([id, name]) => ({ value: id, label: name })),
                ]}
            />

            <InlineSelect
                label="Tag"
                value={tagFilter}
                onValueChange={setTagFilter}
                options={[
                    { value: "all", label: "All" },
                    ...availableTags.map((tag) => ({ value: tag, label: tag })),
                ]}
            />

            {/* Sponsored toggle */}
            <button
                type="button"
                onClick={() => setSponsoredOnly(!sponsoredOnly)}
                className={cn(
                    "inline-flex items-center h-8 px-2.5 text-sm font-medium rounded-md border transition-colors whitespace-nowrap",
                    sponsoredOnly
                        ? "bg-yellow-100 text-yellow-800 border-yellow-300"
                        : "bg-white text-muted-foreground border-gray-200 hover:border-yellow-300 hover:text-yellow-700"
                )}
            >
                ★ Sponsored
            </button>
        </div>
    );
}