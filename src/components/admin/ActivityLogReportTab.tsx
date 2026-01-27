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
    Users
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

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
    const [loading, setLoading] = useState(true);
    const [logsLoading, setLogsLoading] = useState(true);
    const [generating, setGenerating] = useState(false);

    useEffect(() => {
        loadReports();
        loadRecentLogs();
    }, []);

    async function loadRecentLogs() {
        try {
            setLogsLoading(true);
            const res = await fetch('/api/admin/audit-logs?limit=10');
            const data = await res.json();
            if (data.ok) setRecentLogs(data.logs || []);
        } catch (error) {
            console.error('Failed to load recent logs:', error);
        } finally {
            setLogsLoading(false);
        }
    }

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

    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                <Button
                    onClick={handleGenerateNow}
                    disabled={generating}
                    className="bg-primary text-primary-foreground"
                    size="sm"
                >
                    {generating ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Generate Today's Report Now
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Generated Reports</CardTitle>
                    <CardDescription>
                        Download CSV files of employee activity logs. These are automatically generated daily at 7 PM EST.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : reports.length === 0 ? (
                        <div className="text-center py-12 border-2 border-dashed rounded-lg bg-slate-50">
                            <FileText className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                            <p className="text-slate-500 font-medium">No reports generated yet</p>
                            <p className="text-slate-400 text-sm">Reports will appear here once generated automatically or manually.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto border rounded-lg">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 border-b text-slate-500 font-medium">
                                    <tr>
                                        <th className="px-4 py-3">Report Name</th>
                                        <th className="px-4 py-3">Report Date</th>
                                        <th className="px-4 py-3">Generation Time</th>
                                        <th className="px-4 py-3">Details</th>
                                        <th className="px-4 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {reports.map((report) => (
                                        <tr key={report.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-4 py-3 font-medium text-slate-900">
                                                <div className="flex items-center gap-2">
                                                    <FileText className="h-4 w-4 text-blue-600" />
                                                    {report.fileName}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-slate-600">
                                                {format(new Date(report.reportDate), 'MMM d, yyyy')}
                                            </td>
                                            <td className="px-4 py-3 text-slate-500">
                                                {format(new Date(report.generatedAt), 'h:mm a')}
                                            </td>
                                            <td className="px-4 py-3">
                                                {report.metadata?.logCount !== undefined ? (
                                                    <Badge variant="secondary" className="font-normal">
                                                        {report.metadata.logCount} actions
                                                    </Badge>
                                                ) : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {report.status === 'completed' ? (
                                                        <CheckCircle className="h-4 w-4 text-green-500" />
                                                    ) : (
                                                        <AlertCircle className="h-4 w-4 text-red-500" />
                                                    )}
                                                    {report.fileUrl && (
                                                        <Button
                                                            asChild
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 w-8 p-0"
                                                            title="Download CSV"
                                                        >
                                                            <a href={report.fileUrl} download={report.fileName} target="_blank" rel="noopener noreferrer">
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

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Recent Activity Preview</CardTitle>
                    <CardDescription>The most recent logs from the system audit trail (live view).</CardDescription>
                </CardHeader>
                <CardContent>
                    {logsLoading ? (
                        <div className="flex justify-center py-4">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : recentLogs.length === 0 ? (
                        <p className="text-sm text-center py-4 text-muted-foreground">No recent activity found.</p>
                    ) : (
                        <div className="space-y-3">
                            {recentLogs.map((log) => (
                                <div key={log.id} className="flex items-start justify-between text-sm border-b pb-2 last:border-0 last:pb-0">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="text-[10px] uppercase font-bold py-0 h-4">
                                                {log.actionType}
                                            </Badge>
                                            <span className="font-medium text-slate-800">{log.user}</span>
                                            <span className="text-slate-500">{log.description}</span>
                                        </div>
                                        <div className="text-[11px] text-slate-400 mt-0.5">
                                            {format(new Date(log.timestamp), 'MMM d, h:mm a')} • {log.target}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="bg-blue-50/50 border-blue-100">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <Clock className="h-4 w-4 text-blue-600" />
                            Automatic Schedule
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-slate-600">
                            Reports are scheduled to generate every day at **7:00 PM EST**.
                            Each report captures activity from the beginning of that day until the generation time.
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-slate-50 border-slate-200">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <Users className="h-4 w-4 text-slate-600" />
                            Included Roles
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-slate-600">
                            Only activities from **Editors, QC Specialists, Schedulers, and Videographers** are included.
                            Admin and Client activities are filtered out for focused reporting.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
