import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Package, Clock, ChevronDown, ChevronRight, Globe, AlertCircle } from 'lucide-react';
import { ClientDeliverable, PlatformKey } from './types';
import { PLATFORMS } from './icons';
import { formatPostingTimes } from './utils';

interface DeliverablesSummaryProps {
    deliverables: ClientDeliverable[];
    isExpanded: boolean;
    onToggle: () => void;
    isLoading: boolean;
}

export function DeliverablesSummary({
    deliverables,
    isExpanded,
    onToggle,
    isLoading
}: DeliverablesSummaryProps) {
    if (isLoading) {
        return (
            <div className="bg-white border rounded-lg p-6 flex justify-center">
                <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
            </div>
        );
    }

    if (deliverables.length === 0) return null;

    return (
        <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors border-b"
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                        <Package className="h-4 w-4" />
                    </div>
                    <div className="text-left">
                        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tighter">Client Content Strategy</h3>
                        <p className="text-[10px] text-slate-400 font-medium">Active Deliverables & Posting Schedule</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <Badge variant="outline" className="h-5 text-[10px] px-2 font-bold bg-slate-50">
                        {deliverables.length} Active Plan{deliverables.length > 1 ? 's' : ''}
                    </Badge>
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </div>
            </button>

            {isExpanded && (
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-in slide-in-from-top-1">
                    {deliverables.map(d => (
                        <div key={d.id} className="group relative p-4 bg-slate-50 hover:bg-white rounded-xl border border-slate-100 hover:border-indigo-200 hover:shadow-md transition-all">
                            <div className="absolute top-4 right-4 text-[10px] font-bold text-slate-300 group-hover:text-indigo-200 uppercase tracking-widest pointer-events-none">
                                {d.isOneOff ? 'One-Off' : 'Monthly'}
                            </div>
                            
                            <div className="space-y-4">
                                <div>
                                    <Badge className={`${d.isOneOff ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-indigo-100 text-indigo-700 border-indigo-200'} text-[9px] uppercase font-black px-1.5 h-4 mb-2 shadow-none`}>
                                        {d.type}
                                    </Badge>
                                    <h4 className="text-xs font-bold text-slate-800 line-clamp-1">{d.quantity} Videos / Month</h4>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 bg-white border rounded shadow-sm">
                                            <Clock className="h-3 w-3 text-slate-400" />
                                        </div>
                                        <div>
                                            <p className="text-[9px] text-slate-400 uppercase font-black tracking-tighter mb-0.5">Schedule</p>
                                            <p className="text-[10px] font-bold text-slate-700">{d.postingSchedule}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 bg-white border rounded shadow-sm">
                                            <Globe className="h-3 w-3 text-slate-400" />
                                        </div>
                                        <div>
                                            <p className="text-[9px] text-slate-400 uppercase font-black tracking-tighter mb-0.5">Platforms</p>
                                            <div className="flex gap-1">
                                                {d.platforms.map(p => {
                                                    const config = PLATFORMS[p.toLowerCase() as PlatformKey];
                                                    const Icon = config?.icon || Globe;
                                                    return (
                                                        <Icon key={p} className={`h-3 w-3 ${config?.color || 'text-slate-400'}`} />
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {d.postingTimes && d.postingTimes.length > 0 && (
                                    <div className="pt-3 border-t border-slate-200/60">
                                        <p className="text-[9px] text-slate-400 uppercase font-black tracking-tighter mb-1.5">Daily Posting Times</p>
                                        <div className="flex flex-wrap gap-1">
                                            {d.postingTimes.map(t => (
                                                <span key={t} className="px-1.5 py-0.5 bg-white border rounded text-[9px] font-bold text-slate-600 shadow-sm">
                                                    {t}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
