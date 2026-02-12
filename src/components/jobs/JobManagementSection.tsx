'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Calendar, MapPin, DollarSign, CheckCircle2, ChevronDown, ChevronUp, User } from 'lucide-react';
import { toast } from 'sonner';
import { CreateJobDialog } from './CreateJobDialog';

export function JobManagementSection() {
    const [jobs, setJobs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
    const [processingBid, setProcessingBid] = useState<string | null>(null);

    const fetchJobs = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/jobs');
            const data = await res.json();
            setJobs(data || []);
        } catch (error) {
            console.error('Failed to fetch jobs:', error);
            toast.error('Failed to load jobs');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchJobs();
    }, []);

    const handleSelectVideographer = async (jobId: string, bidId: string) => {
        if (!confirm('Are you sure you want to award this job to this videographer? This will notify them and reject all other bids.')) return;

        setProcessingBid(bidId);
        try {
            const res = await fetch(`/api/jobs/${jobId}/select`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bidId }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to select videographer');
            }

            toast.success('Videographer selected successfully!');
            fetchJobs(); // Refresh the list
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setProcessingBid(null);
        }
    };

    if (loading && jobs.length === 0) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <Card className="mt-8 border-t-4 border-t-primary shadow-lg overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
                <div className="space-y-1">
                    <CardTitle className="text-2xl font-bold">Job Postings & Bids</CardTitle>
                    <CardDescription>Post new opportunities and manage videographer applications.</CardDescription>
                </div>
                <CreateJobDialog onJobCreated={fetchJobs} />
            </CardHeader>
            <CardContent>
                {jobs.length === 0 ? (
                    <div className="text-center py-10 bg-slate-50 rounded-lg border-2 border-dashed">
                        <p className="text-muted-foreground">No jobs posted yet. Start by posting a new job for videographers!</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {jobs.map((job) => (
                            <div key={job.id} className="border rounded-xl bg-card hover:shadow-md transition-all">
                                <div className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="space-y-2 flex-1">
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-lg font-semibold">{job.title}</h3>
                                            <Badge variant={job.status === 'OPEN' ? 'default' : 'secondary'}>
                                                {job.status}
                                            </Badge>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                            {job.client && (
                                                <div className="flex items-center gap-1 text-primary font-medium">
                                                    <User className="h-3.5 w-3.5" />
                                                    {job.client.companyName || job.client.name}
                                                </div>
                                            )}
                                            <div className="flex items-center gap-1">
                                                <Calendar className="h-3.5 w-3.5" />
                                                {new Date(job.startDate).toLocaleDateString()}
                                                {job.endDate && ` - ${new Date(job.endDate).toLocaleDateString()}`}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <MapPin className="h-3.5 w-3.5" />
                                                {job.location}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <DollarSign className="h-3.5 w-3.5" />
                                                {job.budget ? `$${job.budget}` : 'Negotiable'}
                                            </div>
                                        </div>
                                        {job.equipment && (
                                            <div className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded inline-block mt-2">
                                                <span className="font-semibold">Equipment:</span> {job.equipment}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="text-right mr-2 hidden sm:block">
                                            <p className="text-sm font-medium">{job.bids?.length || 0} Bids</p>
                                            <p className="text-xs text-muted-foreground">Applications</p>
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setExpandedJobId(expandedJobId === job.id ? null : job.id)}
                                            className="w-full sm:w-auto"
                                        >
                                            {expandedJobId === job.id ? <ChevronUp className="h-4 w-4 mr-2" /> : <ChevronDown className="h-4 w-4 mr-2" />}
                                            {expandedJobId === job.id ? 'Hide Bids' : 'View Bids'}
                                        </Button>
                                    </div>
                                </div>

                                {expandedJobId === job.id && (
                                    <div className="border-t bg-slate-50/50 p-4 sm:p-6 animate-in slide-in-from-top-2">
                                        <h4 className="text-sm font-semibold mb-4 uppercase tracking-wider text-muted-foreground">Bids Received</h4>
                                        {job.bids?.length === 0 ? (
                                            <p className="text-sm text-center text-muted-foreground py-4">No bids received yet for this job.</p>
                                        ) : (
                                            <div className="grid grid-cols-1 gap-3">
                                                {job.bids.map((bid: any) => (
                                                    <div key={bid.id} className="bg-white border p-4 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm hover:border-primary/30 transition-colors">
                                                        <div className="flex items-start gap-4 flex-1">
                                                            <Avatar className="h-10 w-10 border">
                                                                <AvatarImage src={bid.videographer?.image} />
                                                                <AvatarFallback><User /></AvatarFallback>
                                                            </Avatar>
                                                            <div className="space-y-1">
                                                                <div className="flex items-center gap-2">
                                                                    <p className="font-semibold text-sm">{bid.videographer?.name || 'Unknown Videographer'}</p>
                                                                    {bid.status === 'ACCEPTED' && (
                                                                        <Badge className="bg-green-100 text-green-700 border-green-200">Selected</Badge>
                                                                    )}
                                                                </div>
                                                                <p className="text-sm font-bold text-primary">${bid.amount}</p>
                                                                {bid.note && <p className="text-xs text-muted-foreground italic mt-1 bg-slate-50 p-2 rounded">"{bid.note}"</p>}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 pt-3 sm:pt-0">
                                                            <div className="text-xs text-muted-foreground sm:mr-2">
                                                                Posted {new Date(bid.createdAt).toLocaleDateString()}
                                                            </div>
                                                            {job.status === 'OPEN' && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="default"
                                                                    className="bg-green-600 hover:bg-green-700"
                                                                    disabled={processingBid === bid.id}
                                                                    onClick={() => handleSelectVideographer(job.id, bid.id)}
                                                                >
                                                                    {processingBid === bid.id ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <CheckCircle2 className="h-3 w-3 mr-2" />}
                                                                    Hire
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
