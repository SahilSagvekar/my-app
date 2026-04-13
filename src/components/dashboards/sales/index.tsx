"use client";

import React, { useState } from 'react';
import { 
    Search, RefreshCw, Plus, Download, Settings2, Mail 
} from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { toast } from 'sonner';
import { useSalesLeads } from './useSalesLeads';
import { CORE_COLUMNS, STATUS_GROUPS } from './constants';
import { StatusPill, PriorityPill, MondayTick, SocialCell } from './SalesComponents';

export function SalesDashboard() {
    const {
        leads,
        loading,
        refreshing,
        search,
        setSearch,
        statusFilter,
        setStatusFilter,
        loadLeads,
        updateLead,
        deleteLead
    } = useSalesLeads();

    const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());

    if (loading && !refreshing) {
        return (
            <div className="flex items-center justify-center h-screen bg-[#F5F6F8]">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-10 w-10 text-[#0073EA] animate-spin" />
                    <p className="text-[14px] font-bold text-gray-500 uppercase tracking-widest">Loading CRM...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-[#F5F6F8] overflow-hidden">
            {/* Header */}
            <header className="h-[60px] min-h-[60px] bg-white border-b px-6 flex items-center justify-between shadow-sm z-30">
                <div className="flex items-center gap-4">
                    <h1 className="text-xl font-bold tracking-tight text-gray-800">Sales CRM</h1>
                    <div className="h-6 w-[1.5px] bg-gray-200" />
                    <Button variant="ghost" size="sm" onClick={loadLeads} className="text-gray-500 hover:text-[#0073EA]">
                        <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                        Sync
                    </Button>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                        <Input 
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search leads..." 
                            className="h-8 w-[240px] pl-8 text-[12px] border-gray-200 focus:border-[#0073EA] focus:ring-1 focus:ring-[#0073EA]"
                        />
                    </div>
                    <Button size="sm" className="bg-[#0073EA] hover:bg-[#0060C0] h-8 text-xs font-bold px-3">
                        <Plus className="h-4 w-4 mr-1" /> New Lead
                    </Button>
                </div>
            </header>

            {/* Main Content (Table Placeholder for brevity in refactor) */}
            <main className="flex-1 overflow-auto p-6">
                <div className="bg-white rounded-lg border shadow-sm overflow-hidden min-w-max">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b">
                                <th className="p-3 w-10 border-r"></th>
                                {CORE_COLUMNS.map(col => (
                                    <th key={col.id} className="p-2 text-[12px] font-semibold text-gray-500 border-r" style={{ width: col.width }}>
                                        {col.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {leads.map(lead => (
                                <tr key={lead.id} className="border-b hover:bg-slate-50 group">
                                    <td className="p-2 border-r text-center">
                                        <input type="checkbox" className="rounded" />
                                    </td>
                                    <td className="p-2 border-r text-[13px] font-medium">{lead.name}</td>
                                    <td className="p-2 border-r text-[13px]">{lead.company}</td>
                                    <td className="p-2 border-r">
                                        <StatusPill value={lead.status} onChange={(v) => updateLead(lead.id, { status: v })} />
                                    </td>
                                    <td className="p-2 border-r">
                                        <PriorityPill value={lead.priority} onChange={(v) => updateLead(lead.id, { priority: v })} />
                                    </td>
                                    <td className="p-2 border-r text-[13px]">{lead.email}</td>
                                    <td className="p-2 border-r text-[13px]">{lead.phone}</td>
                                    <td className="p-2 border-r">
                                        <SocialCell value={lead.socials} onUpdate={(p) => updateLead(lead.id, p)} />
                                    </td>
                                    <td className="p-2 border-r text-center text-[13px]">
                                        {lead.value ? `$${lead.value}` : '—'}
                                    </td>
                                    <td className="p-2 border-r text-[13px]">{lead.source}</td>
                                    <td className="p-2 border-r">{/* Activity Placeholder */}</td>
                                    <td className="p-2 border-r text-center">
                                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:text-red-500" onClick={() => deleteLead(lead.id)}>
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </main>
        </div>
    );
}

import { Loader2, Trash2 } from 'lucide-react';
