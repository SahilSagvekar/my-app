// components/admin/ActivityLogReportTab.tsx
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
    FileText,
    Download,
    RefreshCw,
    Calendar,
    Clock,
    CheckCircle,
    AlertCircle,
    Loader2,
    Users,
    Activity,
    Search,
    Filter,
    ArrowUpDown,
    FileSearch,
    TrendingUp
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

interface ActivityReport {
    id: string;
    fileName: string;
    fileUrl: string | null;
    reportDate: string;
    generatedAt: string;
    status: string;
    metadata?: any;
}

export function ActivityLogReportTab() {
    const [reports, setReports] = useState<ActivityReport[]>([]);
    const [recentLogs, setRecentLogs] = useState<any[]>([]);
    const [explorerLogs, setExplorerLogs] = useState<any[]>([]);
    const [explorerStats, setExplorerStats] = useState<any>(null);

    // UI State
    const [loading, setLoading] = useState(true);
    const [explorerLoading, setExplorerLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [activeTab, setActiveTab] = useState('reports');

    // Filter State
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

    useEffect(() => {
        console.log('🛡️ ActivityLogReportTab Mounted');
        loadReports();
        loadExplorerData();
    }, [roleFilter, searchQuery, selectedDate]);

    async function loadReports() {
        try {
            setLoading(true);
            const res = await fetch('/api/reports/activity');
            if (!res.ok) throw new Error('Failed to load reports');
            const data = await res.json();
            setReports(data);
        } catch (error) {
            console.error(error);
            toast.error('Could not load activity reports');
        } finally {
            setLoading(false);
        }
    }

    async function loadExplorerData() {
        try {
            setExplorerLoading(true);
            const params = new URLSearchParams({
                date: selectedDate,
                role: roleFilter,
                search: searchQuery
            });
            const res = await fetch(`/api/admin/activity-records?${params}`);
            const data = await res.json();
            if (res.ok) {
                setExplorerLogs(data.logs || []);
                setExplorerStats(data.stats);
            }
        } catch (error) {
            console.error('Failed to load explorer data:', error);
        } finally {
            setExplorerLoading(false);
        }
    }

    async function handleGenerateNow() {
        try {
            setGenerating(true);
            const res = await fetch('/api/reports/activity', { method: 'POST' });
            if (!res.ok) throw new Error('Generation failed');
            const newReport = await res.json();
            setReports([newReport, ...reports]);
            toast.success('Report generated successfully');
        } catch (error) {
            console.error(error);
            toast.error('Failed to generate report');
        } finally {
            setGenerating(false);
        }
    }

    const getRoleStyles = (role: string) => {
        switch (role.toLowerCase()) {
            case 'editor': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'qc': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'scheduler': return 'bg-purple-100 text-purple-700 border-purple-200';
            case 'videographer': return 'bg-orange-100 text-orange-700 border-orange-200';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    return (
        <div className="space-y-6">
            {process.env.NODE_ENV === 'development' && (
                <div className="bg-yellow-50 border border-yellow-200 p-2 text-[10px] rounded text-yellow-700">
                    Debug: ActivityLogReportTab Rendered | Tab: {activeTab} | Date: {selectedDate}
                </div>
            )}
            <Tabs defaultValue="reports" onValueChange={setActiveTab} className="w-full">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                    <TabsList className="bg-slate-100/80 p-1 border border-slate-200 rounded-xl">
                        <TabsTrigger value="reports" className="px-4 py-2 transition-all">
                            <FileText className="h-4 w-4 mr-2" />
                            Reports History
                        </TabsTrigger>
                        <TabsTrigger value="explorer" className="px-4 py-2 transition-all">
                            <Activity className="h-4 w-4 mr-2" />
                            Records Explorer
                        </TabsTrigger>
                    </TabsList>

                    {activeTab === 'reports' && (
                        <Button
                            onClick={handleGenerateNow}
                            disabled={generating}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 transition-all"
                            size="sm"
                        >
                            {generating ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <RefreshCw className="h-4 w-4 mr-2" />
                            )}
                            Generate Today's Report
                        </Button>
                    )}
                </div>

                <TabsContent value="reports" className="space-y-6">
                    {/* Stats Summary for Reports */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="border-none shadow-sm bg-gradient-to-br from-white to-slate-50 overflow-hidden relative">
                            <div className="absolute top-0 right-0 p-3 opacity-10">
                                <FileText className="h-12 w-12 text-primary" />
                            </div>
                            <CardHeader className="pb-2">
                                <CardDescription className="text-xs uppercase tracking-wider font-semibold">Total Reports</CardDescription>
                                <CardTitle className="text-3xl font-bold">{reports.length}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-xs text-muted-foreground flex items-center gap-1">
                                    <TrendingUp className="h-3 w-3 text-emerald-500" />
                                    Latest: {reports[0] ? format(new Date(reports[0].reportDate), 'MMM d') : 'None'}
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-none shadow-sm bg-gradient-to-br from-white to-slate-50 overflow-hidden relative">
                            <div className="absolute top-0 right-0 p-3 opacity-10">
                                <Clock className="h-12 w-12 text-blue-500" />
                            </div>
                            <CardHeader className="pb-2">
                                <CardDescription className="text-xs uppercase tracking-wider font-semibold">Generation Logic</CardDescription>
                                <CardTitle className="text-lg font-bold">Daily at 7 PM EST</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-xs text-muted-foreground">Automated archival system enabled</div>
                            </CardContent>
                        </Card>

                        <Card className="border-none shadow-sm bg-gradient-to-br from-white to-slate-50 overflow-hidden relative">
                            <div className="absolute top-0 right-0 p-3 opacity-10">
                                <Users className="h-12 w-12 text-purple-500" />
                            </div>
                            <CardHeader className="pb-2">
                                <CardDescription className="text-xs uppercase tracking-wider font-semibold">Target Audience</CardDescription>
                                <CardTitle className="text-lg font-bold">Internal Ops Team</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-xs text-muted-foreground">Excludes Admin/Client roles</div>
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="border-slate-200/60 shadow-xl shadow-slate-200/20">
                        <CardHeader className="border-b bg-slate-50/50">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Report Archive</CardTitle>
                                    <CardDescription>Downloadable CSV archives of all system activity logs.</CardDescription>
                                </div>
                                <div className="p-2 bg-blue-50 rounded-lg">
                                    <FileSearch className="h-5 w-5 text-blue-600" />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-4">
                                    <Loader2 className="h-10 w-10 animate-spin text-primary/40" />
                                    <p className="text-sm font-medium text-slate-400">Fetching report history...</p>
                                </div>
                            ) : reports.length === 0 ? (
                                <div className="text-center py-20 border-t-0">
                                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <FileText className="h-8 w-8 text-slate-300" />
                                    </div>
                                    <p className="text-slate-500 font-semibold text-lg">No reports found</p>
                                    <p className="text-slate-400 max-w-xs mx-auto text-sm mt-1">Reports are automatically generated. You can also trigger one manually.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50/50 border-b text-slate-500 font-bold text-xs uppercase tracking-wider">
                                            <tr>
                                                <th className="px-6 py-4">Report Name</th>
                                                <th className="px-6 py-4">Date Range</th>
                                                <th className="px-6 py-4">Generated</th>
                                                <th className="px-6 py-4">Records</th>
                                                <th className="px-6 py-4 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {reports.map((report) => (
                                                <tr key={report.id} className="group hover:bg-blue-50/30 transition-all duration-200">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 bg-white border border-slate-100 rounded-lg group-hover:border-blue-200 transition-colors">
                                                                <FileText className="h-4 w-4 text-primary" />
                                                            </div>
                                                            <span className="font-semibold text-slate-700 truncate max-w-[200px]">{report.fileName}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-600 font-medium">
                                                        {format(new Date(report.reportDate), 'MMM d, yyyy')}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col">
                                                            <span className="text-slate-700 font-medium">{format(new Date(report.generatedAt), 'h:mm a')}</span>
                                                            <span className="text-[10px] text-slate-400 uppercase tracking-tighter">Automatic</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <Badge variant="secondary" className="bg-slate-100 text-slate-600 hover:bg-slate-200 px-3 py-0.5 rounded-full font-bold">
                                                            {report.metadata?.logCount || 0}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex items-center justify-end gap-3">
                                                            <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold ring-1 ring-emerald-100">
                                                                <CheckCircle className="h-3 w-3" />
                                                                Ready
                                                            </div>
                                                            {report.fileUrl && (
                                                                <Button
                                                                    asChild
                                                                    variant="outline"
                                                                    size="icon"
                                                                    className="h-9 w-9 border-slate-200 hover:border-primary hover:text-primary hover:bg-blue-50 transition-all active:scale-95"
                                                                    title="Download report"
                                                                >
                                                                    <a href={`/api/reports/activity/download?id=${report.id}`} target="_blank" rel="noopener noreferrer">
                                                                        <Download className="h-4 w-4" />
                                                                    </a>
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="explorer" className="space-y-6">
                    {/* Explorer Filter Bar */}
                    <Card className="border-none shadow-sm bg-slate-50/50">
                        <CardContent className="p-4 sm:p-6">
                            <div className="flex flex-col lg:flex-row gap-4">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <Input
                                        placeholder="Search by employee name or action..."
                                        className="pl-10 bg-white border-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>

                                <div className="flex flex-wrap gap-2 sm:gap-4">
                                    <div className="w-[160px]">
                                        <Select value={roleFilter} onValueChange={setRoleFilter}>
                                            <SelectTrigger className="bg-white border-slate-200 hover:border-slate-300 transition-colors">
                                                <div className="flex items-center gap-2">
                                                    <Users className="h-4 w-4 text-slate-400" />
                                                    <SelectValue placeholder="All Roles" />
                                                </div>
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Roles</SelectItem>
                                                <SelectItem value="editor">Editors</SelectItem>
                                                <SelectItem value="qc">QC Specialists</SelectItem>
                                                <SelectItem value="scheduler">Schedulers</SelectItem>
                                                <SelectItem value="videographer">Videographers</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="w-[180px]">
                                        <Input
                                            type="date"
                                            className="bg-white border-slate-200 hover:border-slate-300 transition-colors"
                                            value={selectedDate}
                                            onChange={(e) => setSelectedDate(e.target.value)}
                                        />
                                    </div>

                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-10 w-10 border-slate-200 hover:bg-white"
                                        onClick={loadExplorerData}
                                    >
                                        <RefreshCw className={cn("h-4 w-4", explorerLoading && "animate-spin")} />
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Stats Highlights */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { label: 'Actions Found', value: explorerStats?.totalActions || 0, icon: Activity, color: 'blue' },
                            { label: 'Active Personnel', value: explorerStats?.uniqueEmployees || 0, icon: Users, color: 'emerald' },
                            { label: 'Peak Action', value: explorerStats?.topAction || 'N/A', icon: TrendingUp, color: 'purple', isText: true },
                            { label: 'View Date', value: format(parseISO(selectedDate), 'MMM d'), icon: Calendar, color: 'slate', isText: true }
                        ].map((stat, i) => (
                            <div key={i} className="bg-white p-4 rounded-xl border border-slate-200 relative overflow-hidden group hover:border-primary/50 transition-colors">
                                <div className={cn("absolute -right-2 -bottom-2 opacity-[0.03] group-hover:scale-110 transition-transform", `text-${stat.color}-600`)}>
                                    <stat.icon className="h-16 w-16" />
                                </div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{stat.label}</p>
                                <p className={cn("font-black tracking-tight", stat.isText ? "text-lg truncate max-w-full" : "text-2xl")}>
                                    {stat.value}
                                </p>
                            </div>
                        ))}
                    </div>

                    <Card className="border-slate-200/60 shadow-xl shadow-slate-200/20 overflow-hidden">
                        <CardHeader className="bg-slate-50/50 border-b py-4">
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                Records Stream
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {explorerLoading ? (
                                <div className="p-20 text-center space-y-4">
                                    <div className="relative inline-block">
                                        <div className="h-16 w-16 rounded-full border-4 border-slate-100" />
                                        <div className="h-16 w-16 rounded-full border-t-4 border-primary absolute top-0 animate-spin" />
                                    </div>
                                    <p className="text-sm font-bold text-slate-400">Syncing with system audit...</p>
                                </div>
                            ) : explorerLogs.length === 0 ? (
                                <div className="p-20 text-center">
                                    <div className="w-20 h-20 bg-slate-50 rounded-6xl flex items-center justify-center mx-auto mb-6 text-slate-200 border-4 border-white shadow-inner">
                                        <Activity className="h-10 w-10 opacity-50" />
                                    </div>
                                    <h3 className="text-xl font-black text-slate-800">Static Ground</h3>
                                    <p className="text-slate-400 max-w-xs mx-auto text-sm mt-2">
                                        No logs found matching your criteria. Try adjusting the filters or switching the date.
                                    </p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto custom-scrollbar">
                                    {explorerLogs.map((log) => (
                                        <div key={log.id} className="flex gap-4 p-5 hover:bg-slate-50/80 transition-all relative group items-start">
                                            <div className="flex flex-col items-center pt-1 min-w-[70px]">
                                                <span className="text-[11px] font-black leading-none text-slate-800">{format(new Date(log.timestamp), 'HH:mm')}</span>
                                                <span className="text-[9px] font-bold text-slate-400 mt-1 uppercase">{format(new Date(log.timestamp), 'SS')}s</span>
                                                <div className="w-px h-full bg-slate-100 mt-3 absolute left-[75px] top-12 group-last:hidden" />
                                            </div>

                                            <div className="flex-1 space-y-2">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="font-black text-slate-900 leading-none mr-2">{log.User?.name || 'Unknown'}</span>
                                                    <Badge variant="outline" className={cn("text-[9px] font-black uppercase tracking-tighter px-2 h-5 flex items-center rounded-md border-2", getRoleStyles(log.User?.role || ''))}>
                                                        {log.User?.role}
                                                    </Badge>
                                                    <Badge className="bg-slate-900 text-white text-[9px] font-black px-2 h-5 rounded-md border-0 uppercase">
                                                        {log.action}
                                                    </Badge>
                                                </div>

                                                <div className="bg-white border rounded-xl p-3 shadow-inner shadow-slate-50 relative">
                                                    <p className="text-sm text-slate-600 font-medium leading-relaxed">{log.description}</p>
                                                    {log.target && (
                                                        <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                                                            <div className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                                                            TARGET: <span className="text-slate-600">{log.target}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Visual Help Card */}
                    <Card className="border-blue-100 bg-blue-50/30 overflow-hidden group">
                        <div className="flex flex-col md:flex-row items-center gap-6 p-6">
                            <div className="h-24 w-24 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                <TrendingUp className="h-10 w-10 text-blue-600" />
                            </div>
                            <div className="text-center md:text-left">
                                <h4 className="text-lg font-black text-blue-900 mb-1">Activity Intelligence</h4>
                                <p className="text-sm text-blue-700/80 font-semibold leading-snug">
                                    The Records Explorer provides real-time visibility into your team's tactical execution.
                                    Filtering by role can help identify productivity surges or bottlenecks within specific departments.
                                </p>
                            </div>
                        </div>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}

function parseISO(dateStr: string) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
}
