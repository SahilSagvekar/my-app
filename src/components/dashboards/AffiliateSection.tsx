'use client';

import { useState, useEffect, useMemo } from 'react';
import {
    DollarSign, TrendingUp, Clock, Check, Loader2, ChevronRight,
    Calendar, Users, Wallet, BadgePercent, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Commission {
    id: string;
    salesUserId: number;
    leadId: string;
    clientName: string;
    dealValue: string;
    commissionRate: string;
    commissionAmt: string;
    month: string;
    status: string;
    paidAt: string | null;
    approvedAt: string | null;
    approvedBy: number | null;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
    user: {
        id: number;
        name: string | null;
        email: string;
        image: string | null;
    };
    lead: {
        id: string;
        name: string;
        company: string;
        status: string;
        value: number | null;
    };
}

interface Summary {
    totalEarned: number;
    totalPending: number;
    totalApproved: number;
    thisMonth: number;
    commissionRate: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function formatMonth(isoStr: string): string {
    const d = new Date(isoStr);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
}

function formatDate(isoStr: string): string {
    const d = new Date(isoStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
    PENDING: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: 'Pending Approval' },
    APPROVED: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', label: 'Approved' },
    PAID: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Paid' },
    CANCELLED: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', label: 'Cancelled' },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, subtext, color, trend }: {
    icon: any; label: string; value: string; subtext?: string; color: string;
    trend?: 'up' | 'down' | 'neutral';
}) {
    return (
        <div className="group relative bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
            {/* Colored top border */}
            <div className="absolute top-0 left-0 right-0 h-1 rounded-t-xl" style={{ backgroundColor: color }} />
            <div className="p-5 pt-6">
                <div className="flex items-start justify-between">
                    <div className="space-y-2.5">
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">{label}</p>
                        <p className="text-2xl font-bold text-gray-900 tracking-tight">{value}</p>
                        {subtext && (
                            <div className="flex items-center gap-1.5">
                                {trend === 'up' && <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />}
                                {trend === 'down' && <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />}
                                <p className={cn("text-xs font-medium",
                                    trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-red-600' : 'text-gray-500'
                                )}>{subtext}</p>
                            </div>
                        )}
                    </div>
                    <div className="p-2.5 rounded-lg transition-colors" style={{ backgroundColor: color + '14' }}>
                        <Icon className="h-5 w-5" style={{ color }} />
                    </div>
                </div>
            </div>
        </div>
    );
}

function CommissionStatusBadge({ status }: { status: string }) {
    const style = STATUS_STYLES[status] || STATUS_STYLES.PENDING;
    return (
        <span className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors",
            style.bg, style.text, style.border
        )}>
            {status === 'PAID' && <Check className="h-3 w-3" />}
            {status === 'PENDING' && <Clock className="h-3 w-3" />}
            {status === 'APPROVED' && <Check className="h-3 w-3" />}
            {style.label}
        </span>
    );
}

// ─── Monthly Group ────────────────────────────────────────────────────────────

function MonthlyGroup({ monthLabel, commissions, monthTotal }: {
    monthLabel: string; commissions: Commission[]; monthTotal: number;
}) {
    const [collapsed, setCollapsed] = useState(false);

    const paidCount = commissions.filter(c => c.status === 'PAID').length;
    const pendingCount = commissions.filter(c => c.status === 'PENDING').length;
    const approvedCount = commissions.filter(c => c.status === 'APPROVED').length;

    return (
        <div className="rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm">
            {/* Month header */}
            <button
                onClick={() => setCollapsed(!collapsed)}
                className="w-full flex items-center justify-between px-5 py-4 bg-gradient-to-r from-gray-50 to-white hover:from-gray-100 hover:to-gray-50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <ChevronRight className={cn("h-4 w-4 text-gray-400 transition-transform", !collapsed && "rotate-90")} />
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span className="text-[15px] font-bold text-gray-800">{monthLabel}</span>
                    <span className="text-[12px] text-gray-400 font-medium">
                        {commissions.length} {commissions.length === 1 ? 'deal' : 'deals'}
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    {paidCount > 0 && (
                        <span className="text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                            {paidCount} paid
                        </span>
                    )}
                    {approvedCount > 0 && (
                        <span className="text-[11px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                            {approvedCount} approved
                        </span>
                    )}
                    {pendingCount > 0 && (
                        <span className="text-[11px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                            {pendingCount} pending
                        </span>
                    )}
                    <span className="text-[15px] font-bold text-gray-900">{formatCurrency(monthTotal)}</span>
                </div>
            </button>

            {/* Commission rows */}
            {!collapsed && (
                <div className="border-t border-gray-100">
                    <table className="w-full text-[13px]">
                        <thead>
                            <tr className="bg-gray-50/80 border-b border-gray-100">
                                <th className="px-5 py-2.5 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Lead / Client</th>
                                <th className="px-4 py-2.5 text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest">Deal Value</th>
                                <th className="px-4 py-2.5 text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">Rate</th>
                                <th className="px-4 py-2.5 text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest">Commission</th>
                                <th className="px-4 py-2.5 text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
                                <th className="px-4 py-2.5 text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest">Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {commissions.map((c) => (
                                <tr key={c.id} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors group">
                                    <td className="px-5 py-3.5">
                                        <div>
                                            <p className="font-semibold text-gray-800 group-hover:text-blue-700 transition-colors">
                                                {c.lead?.name || c.clientName || '—'}
                                            </p>
                                            {(c.lead?.company || c.clientName) && (
                                                <p className="text-[11px] text-gray-400 mt-0.5">{c.lead?.company || c.clientName}</p>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3.5 text-right font-semibold text-gray-700">
                                        {formatCurrency(parseFloat(c.dealValue))}
                                    </td>
                                    <td className="px-4 py-3.5 text-center">
                                        <span className="inline-flex items-center gap-1 text-[12px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100">
                                            <BadgePercent className="h-3 w-3" />
                                            {(parseFloat(c.commissionRate) * 100).toFixed(0)}%
                                        </span>
                                    </td>
                                    <td className="px-4 py-3.5 text-right">
                                        <span className="font-bold text-emerald-600 text-[14px]">
                                            {formatCurrency(parseFloat(c.commissionAmt))}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3.5 text-center">
                                        <CommissionStatusBadge status={c.status} />
                                    </td>
                                    <td className="px-4 py-3.5 text-right text-[12px] text-gray-400">
                                        {formatDate(c.createdAt)}
                                        {c.paidAt && (
                                            <p className="text-[10px] text-emerald-500 mt-0.5">Paid {formatDate(c.paidAt)}</p>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        {/* Summary row */}
                        <tfoot>
                            <tr className="bg-gray-50/80 border-t-2 border-gray-200">
                                <td className="px-5 py-3 text-[11px] font-bold text-gray-400 uppercase">{commissions.length} deals</td>
                                <td className="px-4 py-3 text-right font-bold text-gray-600 text-[13px]">
                                    {formatCurrency(commissions.reduce((s, c) => s + parseFloat(c.dealValue), 0))}
                                </td>
                                <td className="px-4 py-3 text-center text-[11px] text-gray-400">15%</td>
                                <td className="px-4 py-3 text-right font-bold text-emerald-700 text-[14px]">
                                    {formatCurrency(monthTotal)}
                                </td>
                                <td colSpan={2} />
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}
        </div>
    );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function AffiliateSection() {
    const [commissions, setCommissions] = useState<Commission[]>([]);
    const [summary, setSummary] = useState<Summary>({ totalEarned: 0, totalPending: 0, totalApproved: 0, thisMonth: 0, commissionRate: 0.15 });
    const [loading, setLoading] = useState(true);

    // ── Fetch commissions ──
    useEffect(() => {
        (async () => {
            try {
                const res = await fetch('/api/affiliate/commissions');
                const data = await res.json();
                if (data.ok) {
                    setCommissions(data.commissions);
                    setSummary(data.summary);
                } else {
                    toast.error(data.message || 'Failed to load commissions');
                }
            } catch {
                toast.error('Failed to load commissions');
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    // ── Group by month ──
    const grouped = useMemo(() => {
        const groups: Record<string, { label: string; commissions: Commission[]; total: number; sortKey: number }> = {};

        commissions.forEach(c => {
            const d = new Date(c.month);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const label = formatMonth(c.month);

            if (!groups[key]) {
                groups[key] = { label, commissions: [], total: 0, sortKey: d.getTime() };
            }
            groups[key].commissions.push(c);
            groups[key].total += parseFloat(c.commissionAmt);
        });

        // Sort by most recent month first
        return Object.values(groups).sort((a, b) => b.sortKey - a.sortKey);
    }, [commissions]);

    // ── Monthly chart data (last 6 months) ──
    const chartData = useMemo(() => {
        const months: { label: string; earned: number; pending: number }[] = [];
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const label = d.toLocaleDateString('en-US', { month: 'short' });
            const group = grouped.find(g => {
                const gd = new Date(g.commissions[0]?.month);
                return `${gd.getFullYear()}-${String(gd.getMonth() + 1).padStart(2, '0')}` === key;
            });
            const earned = group?.commissions.filter(c => c.status === 'PAID').reduce((s, c) => s + parseFloat(c.commissionAmt), 0) || 0;
            const pending = group?.commissions.filter(c => c.status !== 'PAID' && c.status !== 'CANCELLED').reduce((s, c) => s + parseFloat(c.commissionAmt), 0) || 0;
            months.push({ label, earned, pending });
        }
        return months;
    }, [grouped]);

    const maxBar = Math.max(...chartData.map(m => m.earned + m.pending), 1);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center space-y-3">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-emerald-500" />
                    <p className="text-sm text-gray-400">Loading earnings…</p>
                </div>
            </div>
        );
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // RENDER
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    return (
        <div className="space-y-6" style={{ fontFamily: "'Figtree', 'Inter', system-ui, sans-serif" }}>
            {/* ── Header ── */}
            <div>
                <h1 className="text-[26px] font-bold text-gray-900 tracking-tight">Affiliate Earnings</h1>
                <p className="text-[13px] text-gray-400 flex items-center gap-1.5 mt-0.5">
                    <BadgePercent className="h-3.5 w-3.5 text-purple-500" />
                    15% commission on every closed deal • Paid monthly
                </p>
            </div>

            {/* ── Stats Cards ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    icon={Wallet}
                    label="Total Earned"
                    value={formatCurrency(summary.totalEarned)}
                    subtext="All-time paid commissions"
                    color="#10B981"
                    trend="neutral"
                />
                <StatCard
                    icon={Clock}
                    label="Pending Approval"
                    value={formatCurrency(summary.totalPending)}
                    subtext={`${commissions.filter(c => c.status === 'PENDING').length} deals awaiting approval`}
                    color="#F59E0B"
                    trend="neutral"
                />
                <StatCard
                    icon={Check}
                    label="Approved"
                    value={formatCurrency(summary.totalApproved)}
                    subtext="Approved, awaiting payout"
                    color="#3B82F6"
                    trend="neutral"
                />
                <StatCard
                    icon={TrendingUp}
                    label="This Month"
                    value={formatCurrency(summary.thisMonth)}
                    subtext="Current month projection"
                    color="#8B5CF6"
                    trend="up"
                />
            </div>

            {/* ── Earnings Chart (Simple Bar) ── */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-gray-400" />
                        <span className="text-[14px] font-bold text-gray-800">6-Month Earnings Overview</span>
                    </div>
                    <div className="flex items-center gap-4 text-[11px]">
                        <span className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded-sm bg-emerald-500" /> Paid
                        </span>
                        <span className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded-sm bg-amber-400" /> Pending/Approved
                        </span>
                    </div>
                </div>
                <div className="p-5">
                    <div className="flex items-end gap-3 h-[180px]">
                        {chartData.map((m, i) => {
                            const earnedHeight = maxBar > 0 ? (m.earned / maxBar) * 160 : 0;
                            const pendingHeight = maxBar > 0 ? (m.pending / maxBar) * 160 : 0;
                            const totalHeight = earnedHeight + pendingHeight;

                            return (
                                <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group">
                                    {/* Bar value tooltip */}
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-bold text-gray-600 whitespace-nowrap">
                                        {formatCurrency(m.earned + m.pending)}
                                    </div>
                                    {/* Stacked bar */}
                                    <div className="w-full relative" style={{ height: '160px' }}>
                                        <div className="absolute bottom-0 left-0 right-0 flex flex-col items-stretch">
                                            {m.pending > 0 && (
                                                <div
                                                    className="bg-amber-400/80 rounded-t-md transition-all duration-500 ease-out"
                                                    style={{ height: `${pendingHeight}px` }}
                                                />
                                            )}
                                            {m.earned > 0 && (
                                                <div
                                                    className="bg-emerald-500 rounded-t-md transition-all duration-500 ease-out"
                                                    style={{ height: `${earnedHeight}px`, borderRadius: m.pending > 0 ? '0' : undefined }}
                                                />
                                            )}
                                            {totalHeight === 0 && (
                                                <div className="bg-gray-100 rounded-md" style={{ height: '4px' }} />
                                            )}
                                        </div>
                                    </div>
                                    {/* Month label */}
                                    <span className="text-[11px] font-semibold text-gray-400">{m.label}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ── Commission Details by Month ── */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-gray-400" />
                    <span className="text-[14px] font-bold text-gray-800">Commission Details</span>
                    <span className="text-[12px] text-gray-400">({commissions.length} total)</span>
                </div>

                {grouped.length === 0 ? (
                    <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
                        <div className="mx-auto w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                            <DollarSign className="h-8 w-8 text-gray-300" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-600 mb-1">No commissions yet</h3>
                        <p className="text-sm text-gray-400 max-w-md mx-auto">
                            When you close a deal by marking a lead as <strong>"Won"</strong> with a deal value,
                            your 15% commission will appear here automatically.
                        </p>
                    </div>
                ) : (
                    grouped.map(g => (
                        <MonthlyGroup
                            key={g.label}
                            monthLabel={g.label}
                            commissions={g.commissions}
                            monthTotal={g.total}
                        />
                    ))
                )}
            </div>

            {/* ── Footer Info ── */}
            <div className="rounded-xl bg-gradient-to-r from-purple-50 via-blue-50 to-emerald-50 border border-gray-200 p-5">
                <div className="flex items-start gap-4">
                    <div className="p-2 rounded-lg bg-white/80 border border-gray-200">
                        <BadgePercent className="h-5 w-5 text-purple-500" />
                    </div>
                    <div className="space-y-1">
                        <h4 className="text-[14px] font-bold text-gray-800">How Affiliate Commissions Work</h4>
                        <ul className="text-[12px] text-gray-500 space-y-0.5 list-disc list-inside">
                            <li>You earn <strong className="text-purple-600">15%</strong> of every deal value when a lead is marked as <strong>"Won"</strong></li>
                            <li>Commissions start as <strong className="text-amber-600">Pending</strong> and require admin approval</li>
                            <li>Once <strong className="text-blue-600">Approved</strong>, commissions are paid out on a monthly cycle</li>
                            <li>Paid commissions are marked with a <strong className="text-emerald-600">Paid</strong> badge and payout date</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
