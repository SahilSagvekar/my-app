import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import {
    AlertTriangle,
    Clock,
    User,
    Users,
    TrendingDown,
    RefreshCw,
} from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';

interface RejectionItem {
    taskId: string;
    title: string;
    editorName?: string | null;
    clientName?: string | null;
    reason: string;
    count: number;
}

export function QCRejectionPatternsPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [qcRejections, setQcRejections] = useState<RejectionItem[]>([]);
    const [clientRejections, setClientRejections] = useState<RejectionItem[]>([]);

    const loadData = async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await fetch("/api/qc/rejection-sidebar");
            const data = await res.json();
            if (!res.ok || !data.ok) {
                throw new Error(data.message || "Failed to load rejection data");
            }
            setQcRejections(data.qcRejections || []);
            setClientRejections(data.clientRejections || []);
        } catch (err: any) {
            console.error("Rejection patterns error:", err);
            setError(err?.message || "Failed to load data");
            toast.error("Failed to load rejection patterns");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const totalPatterns = qcRejections.length + clientRejections.length;

    return (
        <div className="flex flex-col h-full space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-gray-200">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                        Rejection Patterns
                    </h1>
                    <p className="text-muted-foreground mt-1 text-lg">
                        Tasks rejected 3+ times for the same reason across the last 90 days
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-zinc-100 shadow-sm">
                        <div className="flex flex-col items-center text-center">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 leading-none mb-1">
                                Patterns Found
                            </span>
                            <span className="text-xl font-bold text-zinc-900 leading-none">
                                {totalPatterns}
                            </span>
                        </div>
                        <div className="ml-4 h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center border border-amber-100">
                            <TrendingDown className="h-4 w-4 text-amber-500" />
                        </div>
                    </div>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={loadData}
                        disabled={loading}
                        className="gap-2"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Content */}
            {loading ? (
                <div className="h-64 flex flex-col items-center justify-center text-muted-foreground w-full border-2 border-dashed rounded-2xl bg-muted/20">
                    <Clock className="h-12 w-12 mx-auto mb-4 opacity-40 animate-spin" />
                    <p className="font-medium">Loading rejection patterns...</p>
                </div>
            ) : error ? (
                <div className="h-64 flex flex-col items-center justify-center text-muted-foreground w-full border-2 border-dashed rounded-2xl bg-red-50/50">
                    <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-40 text-red-400" />
                    <p className="font-medium text-red-600">{error}</p>
                    <Button variant="outline" size="sm" onClick={loadData} className="mt-4">
                        Try Again
                    </Button>
                </div>
            ) : totalPatterns === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-muted-foreground w-full border-2 border-dashed rounded-2xl bg-muted/20">
                    <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-40 text-green-500" />
                    <p className="font-medium">No repeated rejection patterns detected</p>
                    <p className="text-sm mt-1">
                        Tasks that get rejected 3+ times for the same reason will appear here
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* QC / Admin Rejections */}
                    <Card className="border border-zinc-200 shadow-sm">
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-red-50 flex items-center justify-center border border-red-100">
                                    <User className="h-5 w-5 text-red-500" />
                                </div>
                                <div>
                                    <CardTitle className="text-base font-semibold">
                                        QC / Admin Rejections
                                    </CardTitle>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        Same editor repeating the same mistake
                                    </p>
                                </div>
                                {qcRejections.length > 0 && (
                                    <Badge className="ml-auto bg-red-50 text-red-600 border-red-200 text-xs">
                                        {qcRejections.length} pattern{qcRejections.length !== 1 ? 's' : ''}
                                    </Badge>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {qcRejections.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-4 text-center">
                                    No repeated QC rejections detected.
                                </p>
                            ) : (
                                qcRejections.map((item) => (
                                    <div
                                        key={`${item.taskId}-${item.reason}`}
                                        className="border rounded-xl px-4 py-3 bg-white hover:bg-zinc-50/50 transition-colors"
                                    >
                                        <div className="flex items-center justify-between gap-3 mb-1.5">
                                            <span className="font-semibold text-sm text-zinc-800 line-clamp-1">
                                                {item.title}
                                            </span>
                                            <Badge
                                                variant="outline"
                                                className="text-xs px-2 py-0.5 bg-red-50 text-red-600 border-red-200 flex-shrink-0"
                                            >
                                                ×{item.count}
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed">
                                            {item.reason}
                                        </p>
                                        {item.editorName && (
                                            <div className="flex items-center gap-1.5 mt-2 text-[11px] text-zinc-400">
                                                <User className="h-3 w-3" />
                                                Editor: {item.editorName}
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>

                    {/* Client Rejections */}
                    <Card className="border border-zinc-200 shadow-sm">
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-orange-50 flex items-center justify-center border border-orange-100">
                                    <Users className="h-5 w-5 text-orange-500" />
                                </div>
                                <div>
                                    <CardTitle className="text-base font-semibold">
                                        Client Rejections
                                    </CardTitle>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        Same client rejecting for the same reason
                                    </p>
                                </div>
                                {clientRejections.length > 0 && (
                                    <Badge className="ml-auto bg-orange-50 text-orange-600 border-orange-200 text-xs">
                                        {clientRejections.length} pattern{clientRejections.length !== 1 ? 's' : ''}
                                    </Badge>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {clientRejections.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-4 text-center">
                                    No repeated client rejections detected.
                                </p>
                            ) : (
                                clientRejections.map((item) => (
                                    <div
                                        key={`${item.taskId}-${item.reason}`}
                                        className="border rounded-xl px-4 py-3 bg-white hover:bg-zinc-50/50 transition-colors"
                                    >
                                        <div className="flex items-center justify-between gap-3 mb-1.5">
                                            <span className="font-semibold text-sm text-zinc-800 line-clamp-1">
                                                {item.title}
                                            </span>
                                            <Badge
                                                variant="outline"
                                                className="text-xs px-2 py-0.5 bg-orange-50 text-orange-600 border-orange-200 flex-shrink-0"
                                            >
                                                ×{item.count}
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed">
                                            {item.reason}
                                        </p>
                                        {item.clientName && (
                                            <div className="flex items-center gap-1.5 mt-2 text-[11px] text-zinc-400">
                                                <Users className="h-3 w-3" />
                                                Client: {item.clientName}
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
