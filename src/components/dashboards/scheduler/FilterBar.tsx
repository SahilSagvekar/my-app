import React from 'react';
import { Search, Calendar, Users, Package } from 'lucide-react';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../../ui/select";
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
                    className="pl-9 h-9 text-xs"
                />
            </div>
            
            {/* Date Selection */}
            <div className="flex items-center gap-2 border-l pl-4">
                <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    Window:
                </span>
                <Select value={dateRange} onValueChange={setDateRange}>
                    <SelectTrigger className="h-9 w-[120px] text-xs">
                        <SelectValue placeholder="Range" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="7d">Last 7 Days</SelectItem>
                        <SelectItem value="30d">Last 30 Days</SelectItem>
                        <SelectItem value="90d">Last 90 Days</SelectItem>
                        <SelectItem value="all">All Time</SelectItem>
                    </SelectContent>
                </Select>
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
                <Select value={clientFilter} onValueChange={handleClientFilterChange}>
                    <SelectTrigger className="h-9 w-[150px] text-xs">
                        <SelectValue placeholder="All Clients" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                        <SelectItem value="all">All Clients</SelectItem>
                        {uniqueClients.map(([id, name]) => (
                            <SelectItem key={id} value={id}>{name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Deliverable Type Filter */}
            <div className="flex items-center gap-2 border-l pl-4">
                <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1.5">
                    <Package className="h-3.5 w-3.5" />
                    Type:
                </span>
                <Select value={deliverableFilter} onValueChange={handleDeliverableFilterChange}>
                    <SelectTrigger className="h-9 w-[130px] text-xs">
                        <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        {uniqueDeliverables.map((type) => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
}
