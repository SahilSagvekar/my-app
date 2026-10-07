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
        <div className="flex flex-wrap items-center gap-3 bg-white border border-gray-200 rounded-2xl p-4">
            {/* Search */}
            <div className="flex-1 min-w-[200px] relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search by title, client or ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-white h-10 border-gray-300 rounded-lg focus-visible:ring-1 focus-visible:ring-gray-400"
                />
            </div>
            
            {/* Date Selection */}
            <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 font-medium flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    Window:
                </span>
                <FilterSelect
                    value={dateRange}
                    onValueChange={setDateRange}
                    placeholder="Range"
                    className="h-10 w-[120px] text-sm rounded-lg border-gray-300"
                    options={[
                        { value: "7d", label: "Last 7 Days" },
                        { value: "30d", label: "Last 30 Days" },
                        { value: "90d", label: "Last 90 Days" },
                        { value: "all", label: "All Time" },
                    ]}
                />
            </div>

            {/* Client Filter */}
            <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 font-medium flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    Client:
                </span>
                <FilterSelect
                    value={clientFilter}
                    onValueChange={handleClientFilterChange}
                    placeholder="All Clients"
                    className="h-10 w-[150px] text-sm rounded-lg border-gray-300"
                    contentClassName="max-h-[300px]"
                    options={[
                        { value: "all", label: "All Clients" },
                        ...uniqueClients.map(([id, name]) => ({ value: id, label: name })),
                    ]}
                />
            </div>

            {/* Deliverable Type Filter */}
            <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 font-medium flex items-center gap-1.5">
                    <Package className="h-3.5 w-3.5" />
                    Type:
                </span>
                <FilterSelect
                    value={deliverableFilter}
                    onValueChange={handleDeliverableFilterChange}
                    placeholder="All Types"
                    className="h-10 w-[130px] text-sm rounded-lg border-gray-300"
                    options={[
                        { value: "all", label: "All Types" },
                        ...uniqueDeliverables.map((type) => ({ value: type, label: type })),
                    ]}
                />
            </div>

            {/* Editor Filter */}
            <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 font-medium flex items-center gap-1.5">
                    <UserCog className="h-3.5 w-3.5" />
                    Editor:
                </span>
                <FilterSelect
                    value={editorFilter}
                    onValueChange={handleEditorFilterChange}
                    placeholder="All Editors"
                    className="h-10 w-[150px] text-sm rounded-lg border-gray-300"
                    contentClassName="max-h-[300px]"
                    options={[
                        { value: "all", label: "All Editors" },
                        ...uniqueEditors.map(([id, name]) => ({ value: id, label: name })),
                    ]}
                />
            </div>

            {/* Tag Filter */}
            <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 font-medium flex items-center gap-1.5">
                    <TagIcon className="h-3.5 w-3.5" />
                    Tag:
                </span>
                <FilterSelect
                    value={tagFilter}
                    onValueChange={setTagFilter}
                    placeholder="All Tags"
                    className="h-10 w-[130px] text-sm rounded-lg border-gray-300"
                    options={[
                        { value: "all", label: "All Tags" },
                        ...availableTags.map((tag) => ({ value: tag, label: tag })),
                    ]}
                />
            </div>

            {/* Sponsored Filter */}
            <div>
                <button
                    type="button"
                    onClick={() => setSponsoredOnly(!sponsoredOnly)}
                    className={`h-10 px-4 text-sm font-medium rounded-lg border transition-colors whitespace-nowrap ${
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