"use client";

import React, { useState, useEffect } from 'react';
import { 
    Target, 
    ChevronDown, 
    ChevronRight,
    Instagram,
    Youtube,
    Facebook,
    Linkedin,
    Twitter,
    Ghost,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';

// Custom TikTok Icon
const TikTokIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
    </svg>
);

// Platform config
const PLATFORMS: Record<string, { icon: any; color: string; bgColor: string }> = {
    ig: { icon: Instagram, color: 'text-pink-600', bgColor: 'bg-pink-50' },
    instagram: { icon: Instagram, color: 'text-pink-600', bgColor: 'bg-pink-50' },
    yt: { icon: Youtube, color: 'text-red-600', bgColor: 'bg-red-50' },
    youtube: { icon: Youtube, color: 'text-red-600', bgColor: 'bg-red-50' },
    tt: { icon: TikTokIcon, color: 'text-black', bgColor: 'bg-gray-100' },
    tiktok: { icon: TikTokIcon, color: 'text-black', bgColor: 'bg-gray-100' },
    fb: { icon: Facebook, color: 'text-blue-600', bgColor: 'bg-blue-50' },
    facebook: { icon: Facebook, color: 'text-blue-600', bgColor: 'bg-blue-50' },
    li: { icon: Linkedin, color: 'text-blue-700', bgColor: 'bg-blue-50' },
    linkedin: { icon: Linkedin, color: 'text-blue-700', bgColor: 'bg-blue-50' },
    twitter: { icon: Twitter, color: 'text-gray-900', bgColor: 'bg-gray-100' },
    snapchat: { icon: Ghost, color: 'text-yellow-500', bgColor: 'bg-yellow-50' },
};

interface PlatformData {
    name: string;
    sf?: number;
    bsf?: number;
    sqf?: number;
    hp?: number;
    lf?: number;
    lfPer?: string;
    sep?: number;
    sepPer?: string;
    tiles?: boolean;
    thumb?: boolean;
    note?: string;
}

interface ClientData {
    clientName: string;
    platforms: PlatformData[];
}

// Static data from spreadsheet
const STATIC_POSTING_DATA: ClientData[] = [
    {
        clientName: 'The Drew Meyers',
        platforms: [
            { name: 'IG (Trials)', sf: 4, bsf: 1 },
            { name: 'FB Profile', sf: 4, bsf: 1, sqf: 1 },
            { name: 'FB Page', sf: 4, bsf: 1, sqf: 1 },
            { name: 'TT', sf: 4, bsf: 1 },
            { name: 'YT', sf: 4, bsf: 1 },
            { name: 'Snapchat', sep: 3, sepPer: 'week', tiles: true },
        ]
    },
    {
        clientName: 'The Dating Blind Show',
        platforms: [
            { name: 'IG (Trials)', sf: 4, bsf: 1 },
            { name: 'FB TV', sf: 4, sqf: 2, bsf: 1, lf: 1, lfPer: 'week', note: 'every Sunday' },
            { name: 'YT', sf: 4, bsf: 1 },
            { name: 'TT', sf: 4, bsf: 1 },
            { name: 'Snapchat', sep: 3, sepPer: 'week', tiles: true },
        ]
    },
    {
        clientName: 'InvestmentJoy',
        platforms: [
            { name: 'FB TV', sf: 4, sqf: 1, hp: 2, lf: 1, thumb: true },
        ]
    },
    {
        clientName: 'MissBehaveTV',
        platforms: [
            { name: 'FB TV', sf: 4, bsf: 1, sqf: 2 },
            { name: 'IG (Trials)', sf: 4, bsf: 1 },
            { name: 'YT', sf: 4, bsf: 1 },
            { name: 'TT', sf: 4, bsf: 1 },
            { name: 'Snapchat', sep: 2, sepPer: 'week', tiles: true },
        ]
    },
    {
        clientName: 'Coin Laundry Association',
        platforms: [
            { name: 'IG (Trials)', sf: 2 },
            { name: 'TT', sf: 2 },
            { name: 'YT', sf: 2, lf: 1, lfPer: 'week', thumb: true, note: 'every sunday' },
            { name: 'FB TV', sf: 2, lf: 1, lfPer: 'week', thumb: true, note: 'every sunday'  },
            { name: 'LI', sf: 2, lf: 1, lfPer: 'week', thumb: true, note: 'every sunday'  },
        ]
    },
    {
        clientName: 'Soda City Simpson',
        platforms: [
            { name: 'IG (Trials)', sf: 6 },
            { name: 'TT', sf: 6 },
            { name: 'FB TV', sf: 6, sqf: 1, lf: 1, lfPer: 'week', note: 'every sunday' },
            { name: 'YT', sf: 6, lf: 1, lfPer: 'week', note: 'every sunday' },
        ]
    },
    {
        clientName: 'Free Laundromat, LLC',
        platforms: [
            { name: 'IG', sf: 2 },
            { name: 'FB TV', sf: 2 },
            { name: 'TT', sf: 2 },
        ]
    },
    {
        clientName: 'William Coleman',
        platforms: [
            { name: 'FB TV', sf: 1, lf: 1, lfPer: 'week', note: 'every sunday' },
            { name: 'YT', sf: 1, lf: 1, lfPer: 'week', note: 'every sunday' },
            { name: 'TT', sf: 1 },
            { name: 'IG (Trials)', sf: 1 },
        ]
    },
];

// Helper to get platform icon
const getPlatformConfig = (platformName: string) => {
    const key = platformName.toLowerCase().split(' ')[0].replace('(', '').replace(')', '');
    return PLATFORMS[key] || { icon: null, color: 'text-gray-600', bgColor: 'bg-gray-100' };
};

// Helper to calculate daily total
const calculateDailyTotal = (platforms: PlatformData[]) => {
    let total = 0;
    platforms.forEach(p => {
        total += p.sf || 0;
        total += p.bsf || 0;
        total += p.sqf || 0;
        total += p.hp || 0;
        total += p.lf || 0;
    });
    return total;
};

export function SchedulerDailyTargetsPage() {
    const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());

    useEffect(() => {
        // Auto-expand first 5 clients
        const firstFive = STATIC_POSTING_DATA.slice(0, 5).map(c => c.clientName);
        setExpandedClients(new Set(firstFive));
    }, []);

    const toggleClient = (clientName: string) => {
        setExpandedClients(prev => {
            const newSet = new Set(prev);
            if (newSet.has(clientName)) newSet.delete(clientName);
            else newSet.add(clientName);
            return newSet;
        });
    };

    const expandAll = () => {
        setExpandedClients(new Set(STATIC_POSTING_DATA.map(c => c.clientName)));
    };

    const collapseAll = () => {
        setExpandedClients(new Set());
    };

    // Calculate grand total
    const grandTotal = STATIC_POSTING_DATA.reduce((sum, client) => {
        return sum + calculateDailyTotal(client.platforms);
    }, 0);

    return (
        <div className="flex flex-col h-full space-y-6">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-gray-200">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg">
                            <Target className="h-6 w-6 text-white" />
                        </div>
                        Daily Posting Targets
                    </h1>
                    <p className="text-muted-foreground mt-2 text-sm sm:text-base">
                        Posts required per day per platform
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="text-lg px-4 py-2">
                        Total: {grandTotal}/day
                    </Badge>
                    <Button variant="outline" size="sm" onClick={expandAll}>
                        Expand All
                    </Button>
                    <Button variant="outline" size="sm" onClick={collapseAll}>
                        Collapse All
                    </Button>
                </div>
            </div>

            {/* Client Cards */}
            <div className="space-y-4">
                {STATIC_POSTING_DATA.map((client, index) => {
                    const isExpanded = expandedClients.has(client.clientName);
                    const dailyTotal = calculateDailyTotal(client.platforms);
                    const isTopClient = index < 3;

                    return (
                        <div 
                            key={client.clientName}
                            className={cn(
                                "bg-white rounded-2xl border shadow-sm overflow-hidden transition-all duration-200",
                                isExpanded && "ring-2 ring-indigo-100"
                            )}
                        >
                            {/* Client Header */}
                            <button
                                onClick={() => toggleClient(client.clientName)}
                                className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors"
                            >
                                <div className="flex items-center gap-4">
                                    <div className={cn(
                                        "w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md",
                                        isTopClient 
                                            ? "bg-gradient-to-br from-amber-400 to-orange-500" 
                                            : "bg-gradient-to-br from-gray-400 to-gray-500"
                                    )}>
                                        {client.clientName.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="text-left">
                                        <h3 className="font-bold text-gray-900 text-lg">{client.clientName}</h3>
                                        <p className="text-sm text-muted-foreground">
                                            {client.platforms.length} platform{client.platforms.length !== 1 ? 's' : ''}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6">
                                    {/* Daily Total */}
                                    <div className={cn(
                                        "px-4 py-2 rounded-xl text-center min-w-[100px]",
                                        dailyTotal >= 10 
                                            ? "bg-gradient-to-r from-rose-500 to-pink-500 text-white" 
                                            : dailyTotal >= 5 
                                                ? "bg-gradient-to-r from-amber-400 to-orange-500 text-white"
                                                : "bg-gradient-to-r from-emerald-400 to-teal-500 text-white"
                                    )}>
                                        <p className="text-[10px] uppercase tracking-wider opacity-90">Daily</p>
                                        <p className="text-2xl font-bold">{dailyTotal}</p>
                                    </div>

                                    {/* Expand Icon */}
                                    <div className="p-2">
                                        {isExpanded ? (
                                            <ChevronDown className="h-5 w-5 text-gray-400" />
                                        ) : (
                                            <ChevronRight className="h-5 w-5 text-gray-400" />
                                        )}
                                    </div>
                                </div>
                            </button>

                            {/* Expanded Content - Platform Table */}
                            {isExpanded && (
                                <div className="border-t bg-gray-50/50 p-5">
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                                                    <th className="pb-3 font-semibold">Platform</th>
                                                    <th className="pb-3 font-semibold">Daily Schedule</th>
                                                    <th className="pb-3 font-semibold text-right">Total/Day</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {client.platforms.map((platform, idx) => {
                                                    const pConfig = getPlatformConfig(platform.name);
                                                    const Icon = pConfig.icon;
                                                    const platformTotal = (platform.sf || 0) + (platform.bsf || 0) + (platform.sqf || 0) + (platform.hp || 0) + (platform.lf || 0);

                                                    return (
                                                        <tr key={idx} className="hover:bg-white transition-colors">
                                                            <td className="py-3">
                                                                <div className={cn(
                                                                    "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium",
                                                                    pConfig.bgColor,
                                                                    pConfig.color
                                                                )}>
                                                                    {Icon && <Icon className="h-4 w-4" />}
                                                                    {platform.name}
                                                                </div>
                                                            </td>
                                                            <td className="py-3">
                                                                <div className="flex flex-wrap gap-1.5">
                                                                    {platform.sf && (
                                                                        <Badge className="bg-violet-100 text-violet-700 hover:bg-violet-100">
                                                                            {platform.sf} SF
                                                                        </Badge>
                                                                    )}
                                                                    {platform.bsf && (
                                                                        <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">
                                                                            {platform.bsf} BSF
                                                                        </Badge>
                                                                    )}
                                                                    {platform.sqf && (
                                                                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                                                                            {platform.sqf} SQF
                                                                        </Badge>
                                                                    )}
                                                                    {platform.hp && (
                                                                        <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100">
                                                                            {platform.hp} HP
                                                                        </Badge>
                                                                    )}
                                                                    {platform.lf && (
                                                                        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
                                                                            {platform.lf} LF{platform.lfPer && `/${platform.lfPer}`}
                                                                        </Badge>
                                                                    )}
                                                                    {platform.sep && (
                                                                        <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">
                                                                            {platform.sep} SEP/{platform.sepPer}
                                                                        </Badge>
                                                                    )}
                                                                    {platform.tiles && (
                                                                        <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100">
                                                                            + Tiles
                                                                        </Badge>
                                                                    )}
                                                                    {platform.thumb && (
                                                                        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                                                                            + Thumb
                                                                        </Badge>
                                                                    )}
                                                                    {platform.note && (
                                                                        <span className="text-sm text-muted-foreground">{platform.note}</span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="py-3 text-right">
                                                                <span className="font-bold text-gray-900">{platformTotal || '-'}</span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Empty State */}
            {STATIC_POSTING_DATA.length === 0 && (
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center p-8">
                        <Target className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Posting Data</h3>
                        <p className="text-muted-foreground">
                            No daily posting targets configured.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}