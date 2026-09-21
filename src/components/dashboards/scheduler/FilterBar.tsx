import React from 'react';
import { Search, Calendar, Users, Package, Tag as TagIcon, UserCog } from 'lucide-react';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
import { FilterSelect } from "../../ui/filter-select";
import { Badge } from '../../ui/badge';
import { Loader2, ChevronUp, ChevronDown } from 'lucide-react';

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
        <div className="flex flex-wrap items-center gap-4 bg-white border rounded-lg p-3 shadow-sm">
            {/* Search */}
            <div className="flex-1 min-w-[200px] relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search by title, client or ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-secondary/30 h-10 border-transparent focus-visible:ring-1 focus-visible:ring-primary/20 transition-all rounded-full"
                />
            </div>
            
            {/* Date Selection */}
            <div className="flex items-center gap-2 border-l pl-4">
                <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    Window:
                </span>
                <FilterSelect
                    value={dateRange}
                    onValueChange={setDateRange}
                    placeholder="Range"
                    className="h-9 w-[120px] text-xs"
                    options={[
                        { value: "7d", label: "Last 7 Days" },
                        { value: "30d", label: "Last 30 Days" },
                        { value: "90d", label: "Last 90 Days" },
                        { value: "all", label: "All Time" },
                    ]}
                />
            </div>

            {/* Status Toggle */}
            <div className="flex items-center gap-1 border-l pl-4">
                <Button
                    variant={statusFilter === 'all' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setStatusFilter('all')}
                    className={`h-9 px-3 text-xs ${statusFilter === 'all' ? 'bg-slate-900 text-white' : ''}`}
                >
                    All
                </Button>
                <Button
                    variant={statusFilter === 'pending' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setStatusFilter('pending')}
                    className={`h-9 px-3 text-xs ${statusFilter === 'pending' ? 'bg-indigo-600 text-white' : ''}`}
                >
                    Pending
                </Button>
                <Button
                    variant={statusFilter === 'scheduled' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setStatusFilter('scheduled')}
                    className={`h-9 px-3 text-xs ${statusFilter === 'scheduled' ? 'bg-emerald-600 text-white' : ''}`}
                >
                    Scheduled
                </Button>
            </div>

            {/* Client Filter */}
            <div className="flex items-center gap-2 border-l pl-4">
                <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    Client:
                </span>
                <FilterSelect
                    value={clientFilter}
                    onValueChange={handleClientFilterChange}
                    placeholder="All Clients"
                    className="h-9 w-[150px] text-xs"
                    contentClassName="max-h-[300px]"
                    options={[
                        { value: "all", label: "All Clients" },
                        ...uniqueClients.map(([id, name]) => ({ value: id, label: name })),
                    ]}
                />
            </div>

            {/* Deliverable Type Filter */}
            <div className="flex items-center gap-2 border-l pl-4">
                <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1.5">
                    <Package className="h-3.5 w-3.5" />
                    Type:
                </span>
                <FilterSelect
                    value={deliverableFilter}
                    onValueChange={handleDeliverableFilterChange}
                    placeholder="All Types"
                    className="h-9 w-[130px] text-xs"
                    options={[
                        { value: "all", label: "All Types" },
                        ...uniqueDeliverables.map((type) => ({ value: type, label: type })),
                    ]}
                />
            </div>

            {/* Editor Filter */}
            <div className="flex items-center gap-2 border-l pl-4">
                <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1.5">
                    <UserCog className="h-3.5 w-3.5" />
                    Editor:
                </span>
                <FilterSelect
                    value={editorFilter}
                    onValueChange={handleEditorFilterChange}
                    placeholder="All Editors"
                    className="h-9 w-[150px] text-xs"
                    contentClassName="max-h-[300px]"
                    options={[
                        { value: "all", label: "All Editors" },
                        ...uniqueEditors.map(([id, name]) => ({ value: id, label: name })),
                    ]}
                />
            </div>

            {/* Tag Filter */}
            <div className="flex items-center gap-2 border-l pl-4">
                <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1.5">
                    <TagIcon className="h-3.5 w-3.5" />
                    Tag:
                </span>
                <FilterSelect
                    value={tagFilter}
                    onValueChange={setTagFilter}
                    placeholder="All Tags"
                    className="h-9 w-[130px] text-xs"
                    options={[
                        { value: "all", label: "All Tags" },
                        ...availableTags.map((tag) => ({ value: tag, label: tag })),
                    ]}
                />
            </div>

            {/* Sponsored Filter */}
            <div className="border-l pl-4">
                <button
                    type="button"
                    onClick={() => setSponsoredOnly(!sponsoredOnly)}
                    className={`h-9 px-3 text-xs font-medium rounded-md border transition-colors whitespace-nowrap ${
                        sponsoredOnly
                            ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
                            : 'bg-transparent text-muted-foreground border-input hover:border-yellow-300 hover:text-yellow-700'
                    }`}
                >
                    ★ Sponsored
                </button>
            </div>
        </div>
    );
}