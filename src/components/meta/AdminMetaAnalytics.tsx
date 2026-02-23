// src/components/meta/AdminMetaAnalytics.tsx
"use client";

import { useState } from "react";
import { useAdminMetaAnalytics } from "@/lib/hooks/useMetaAnalytics";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Instagram,
    Eye,
    TrendingUp,
    RefreshCw,
    ChevronRight,
    DollarSign,
    Share2,
    Users,
} from "lucide-react";
import { formatNumber, formatRevenue } from "./MetaStudio";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function AdminMetaAnalytics({ onSelectClient }: { onSelectClient: (id: string) => void }) {
    const { data, loading, error, refetch } = useAdminMetaAnalytics();
    const [isLoggingRevenue, setIsLoggingRevenue] = useState(false);
    const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

    if (loading) return (
        <div className="p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                    <Card key={i} className="animate-pulse h-32 bg-muted/20" />
                ))}
            </div>
            <Card className="animate-pulse h-96 bg-muted/10" />
        </div>
    );

    if (error) return (
        <div className="p-8 text-center bg-red-50 dark:bg-red-950/20 text-red-600 rounded-xl border border-red-200">
            <p className="font-medium">Error loading admin analytics</p>
            <p className="text-sm opacity-80 mt-1">{error}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
                Try Again
            </Button>
        </div>
    );

    const summary = {
        totalFollowers: data.reduce((sum, acc) => sum + (acc.followers || 0), 0),
        totalImpressions: data.reduce((sum, acc) => sum + (acc.impressions || 0), 0),
        totalReach: data.reduce((sum, acc) => sum + (acc.reach || 0), 0),
        connectedCount: data.filter(acc => acc.username).length,
    };

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row justify-end items-start md:items-center gap-4">
                <Button variant="outline" size="sm" onClick={() => refetch()} className="hover:bg-pink-50">
                    <RefreshCw className="w-4 h-4 mr-2" /> Refresh Global Data
                </Button>
            </div>

            {/* Global Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-none shadow-sm bg-gradient-to-br from-pink-500/10 to-transparent">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                            Total Followers
                            <Users className="w-4 h-4 text-pink-500" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold font-mono tracking-tight">{formatNumber(summary.totalFollowers)}</div>
                        <p className="text-xs text-muted-foreground mt-1">Across all connected accounts</p>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-gradient-to-br from-purple-500/10 to-transparent">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                            Total Impressions
                            <Eye className="w-4 h-4 text-purple-500" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold font-mono tracking-tight">{formatNumber(summary.totalImpressions)}</div>
                        <p className="text-xs text-muted-foreground mt-1">Sum of all reach in last 28d</p>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-gradient-to-br from-blue-500/10 to-transparent">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                            Total Reach
                            <Share2 className="w-4 h-4 text-blue-500" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold font-mono tracking-tight">{formatNumber(summary.totalReach)}</div>
                        <p className="text-xs text-muted-foreground mt-1">Unique accounts reached</p>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-gradient-to-br from-emerald-500/10 to-transparent">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                            Avg Engagement
                            <TrendingUp className="w-4 h-4 text-emerald-500" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold font-mono tracking-tight">
                            {(data.reduce((sum, acc) => sum + acc.engagementRate, 0) / (data.length || 1)).toFixed(2)}%
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Based on follower interaction</p>
                    </CardContent>
                </Card>
            </div>

            {/* Client List Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Client Instagram Performance</CardTitle>
                    <CardDescription>Detailed breakdown of Instagram status for each client.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="relative overflow-x-auto rounded-lg border">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs uppercase bg-muted/50 border-b">
                                <tr>
                                    <th className="px-6 py-4 font-semibold">Client</th>
                                    <th className="px-6 py-4 font-semibold">Username</th>
                                    <th className="px-6 py-4 font-semibold text-right">Followers</th>
                                    <th className="px-6 py-4 font-semibold text-right">Reach (28d)</th>
                                    <th className="px-6 py-4 font-semibold text-right">ER %</th>
                                    <th className="px-6 py-4 font-semibold text-center">Sync Status</th>
                                    <th className="px-6 py-4 font-semibold text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {data.map((client) => (
                                    <tr key={client.id} className="hover:bg-muted/30 transition-colors group">
                                        <td className="px-6 py-4 font-bold">{client.clientName}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <Instagram className="w-4 h-4 text-pink-600" />
                                                <span className="font-medium">@{client.username || "—"}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono">{formatNumber(client.followers)}</td>
                                        <td className="px-6 py-4 text-right font-mono">{formatNumber(client.reach)}</td>
                                        <td className="px-6 py-4 text-right font-mono text-xs">{client.engagementRate}%</td>
                                        <td className="px-6 py-4 text-center">
                                            <Badge
                                                variant={client.syncStatus === 'COMPLETED' ? 'outline' : 'secondary'}
                                                className={`
                          ${client.syncStatus === 'SYNCING' ? 'animate-pulse bg-blue-50 text-blue-600' : ''}
                          ${client.syncStatus === 'FAILED' ? 'bg-red-50 text-red-600' : ''}
                        `}
                                            >
                                                {client.syncStatus || 'PENDING'}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0 hover:text-green-600"
                                                    title="Log Revenue"
                                                    onClick={() => {
                                                        setSelectedClientId(client.clientId);
                                                        setIsLoggingRevenue(true);
                                                    }}
                                                >
                                                    <DollarSign className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0"
                                                    title="View Details"
                                                    onClick={() => onSelectClient(client.clientId)}
                                                >
                                                    <ChevronRight className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            <LogRevenueDialog
                isOpen={isLoggingRevenue}
                onClose={() => setIsLoggingRevenue(false)}
                clientId={selectedClientId}
            />
        </div>
    );
}

function LogRevenueDialog({ isOpen, onClose, clientId }: { isOpen: boolean, onClose: () => void, clientId: string | null }) {
    const [amount, setAmount] = useState("");
    const [source, setSource] = useState("brand_deal");
    const [notes, setNotes] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!clientId) return;
        setLoading(true);

        try {
            const res = await fetch("/api/meta/revenue", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    clientId,
                    platform: "instagram",
                    amount: parseFloat(amount),
                    source,
                    notes,
                    period: new Date().toISOString()
                })
            });

            if (!res.ok) throw new Error("Failed to log revenue");
            toast.success("Revenue logged successfully");
            onClose();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-green-500" />
                        Log Instagram Revenue
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                    <div className="space-y-2">
                        <Label htmlFor="amount">Amount (INR)</Label>
                        <Input
                            id="amount"
                            type="number"
                            step="0.01"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            required
                            placeholder="Enter amount in ₹"
                            className="text-lg font-semibold"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="source">Source</Label>
                        <select
                            id="source"
                            className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            value={source}
                            onChange={(e) => setSource(e.target.value)}
                        >
                            <option value="brand_deal">Brand Deal</option>
                            <option value="adsense">Ad Bonuses / Payouts</option>
                            <option value="badges">Badges</option>
                            <option value="subscription">Subscriptions</option>
                            <option value="manual">Other / Manual</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="notes">Notes</Label>
                        <Input
                            id="notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Campaign name, month, etc."
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-6">
                        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                        <Button
                            type="submit"
                            disabled={loading}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                            {loading ? "Saving..." : "Log Revenue"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
