'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    Loader2,
    Calendar,
    MapPin,
    DollarSign,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    User,
    Settings,
    Camera,
    XCircle,
    Link
} from 'lucide-react';
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
        const res = await fetch("/api/jobs");
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || "Failed to load jobs");
          setJobs([]); // ✅ Always an array
          return;
        }

        // Handle both array and wrapped responses
        const jobsArray = Array.isArray(data) ? data : data.jobs || [];
        setJobs(jobsArray); // ✅ Always an array
      } catch (error) {
        console.error("Failed to fetch jobs:", error);
        toast.error("Failed to load jobs");
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
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div className="space-y-1">
                    <CardTitle>Job Postings & Bids</CardTitle>
                    <CardDescription>Post new opportunities and manage videographer applications.</CardDescription>
                </div>
                <CreateJobDialog onJobCreated={fetchJobs} />
            </CardHeader>
            <CardContent>
                {jobs.length === 0 ? (
                    <div className="text-center py-10 bg-muted/30 rounded-lg border-2 border-dashed">
                        <p className="text-muted-foreground text-sm">No jobs posted yet. Start by posting a new job for videographers!</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {jobs.map((job) => (
                            <div key={job.id} className="border rounded-lg bg-card hover:border-primary/50 transition-colors overflow-hidden">
                                <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="space-y-1 flex-1">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-semibold text-sm">{job.title}</h3>
                                            <Badge variant={job.status === 'OPEN' ? 'default' : 'secondary'} className="text-[10px] h-4">
                                                {job.status}
                                            </Badge>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                            {job.client && (
                                                <div className="flex items-center gap-1 text-primary font-medium">
                                                    <User className="h-3 w-3" />
                                                    {job.client.companyName || job.client.name}
                                                </div>
                                            )}
                                            <div className="flex items-center gap-1">
                                                <Calendar className="h-3 w-3" />
                                                {new Date(job.startDate).toLocaleDateString()}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <MapPin className="h-3 w-3" />
                                                {job.location}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <DollarSign className="h-3 w-3" />
                                                {job.budget ? `$${job.budget}` : 'Negotiable'}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="text-right mr-2 hidden sm:block">
                                            <p className="text-xs font-medium">{job.bids?.length || 0} Bids</p>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setExpandedJobId(expandedJobId === job.id ? null : job.id)}
                                            className="h-8 gap-1"
                                        >
                                            {expandedJobId === job.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                            <span className="text-xs">{expandedJobId === job.id ? 'Hide' : 'Bids'}</span>
                                        </Button>
                                    </div>
                                </div>

                                {expandedJobId === job.id && (
                                    <div className="border-t bg-muted/20 p-4 animate-in fade-in duration-300">
                                        {/* 🔥 Job Technical Summary */}
                                        <div className="mb-6 bg-background p-4 rounded-lg border shadow-sm">
                                            <h4 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-4 pb-2 border-b">
                                                <Settings className="h-3 w-3" /> Technical Specs
                                            </h4>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div className="space-y-1">
                                                    <p className="text-[9px] uppercase font-medium text-muted-foreground">Camera</p>
                                                    <div className="flex items-center gap-1.5 text-xs font-medium">
                                                        <Camera className="h-3 w-3 text-primary" />
                                                        {job.camera || 'Any Professional'}
                                                    </div>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-[9px] uppercase font-medium text-muted-foreground">Specs</p>
                                                    <div className="flex items-center gap-1.5 text-xs font-medium">
                                                        <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[10px]">{job.quality || '4K'}</span>
                                                        <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[10px]">{job.frameRate || '24fps'}</span>
                                                    </div>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-[9px] uppercase font-medium text-muted-foreground">Lighting</p>
                                                    <p className="text-xs font-medium truncate">{job.lighting || 'TBD'}</p>
                                                </div>
                                            </div>

                                            {job.exclusions && (
                                                <div className="mt-3 p-2 bg-red-500/5 rounded border border-red-500/10">
                                                    <p className="text-[9px] uppercase font-bold text-red-500 mb-1 flex items-center gap-1">
                                                        <XCircle className="h-2.5 w-2.5" /> Exclusions
                                                    </p>
                                                    <p className="text-[11px] text-muted-foreground italic leading-tight">{job.exclusions}</p>
                                                </div>
                                            )}

                                            {job.referenceLinks && job.referenceLinks.length > 0 && (
                                                <div className="mt-3 flex flex-wrap gap-1.5">
                                                    {job.referenceLinks.map((link: string, i: number) => (
                                                        <a
                                                            key={i}
                                                            href={link.startsWith('http') ? link : `https://${link}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-1 text-[10px] bg-primary/5 text-primary px-2 py-0.5 rounded-full hover:bg-primary/10 border border-primary/10 transition-colors"
                                                        >
                                                            <Link className="h-2.5 w-2.5" /> Ref {i + 1}
                                                        </a>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center justify-between mb-3 px-1">
                                            <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Received Bids</h4>
                                            <span className="text-[10px] text-muted-foreground">{job.bids?.length || 0} Total</span>
                                        </div>

                                        {job.bids?.length === 0 ? (
                                            <p className="text-xs text-center text-muted-foreground py-4 bg-background/50 rounded-lg border border-dashed">No bids received yet.</p>
                                        ) : (
                                            <div className="space-y-2">
                                                {job.bids.map((bid: any) => (
                                                    <div key={bid.id} className="bg-background border p-3 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm hover:border-primary/30 transition-colors">
                                                        <div className="flex items-center gap-3 flex-1">
                                                            <Avatar className="h-8 w-8 border">
                                                                <AvatarImage src={bid.videographer?.image} />
                                                                <AvatarFallback className="text-[10px]"><User className="h-4 w-4" /></AvatarFallback>
                                                            </Avatar>
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    <p className="font-semibold text-xs truncate">{bid.videographer?.name || 'Unknown'}</p>
                                                                    {bid.status === 'ACCEPTED' && (
                                                                        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[9px] h-3.5 px-1">Selected</Badge>
                                                                    )}
                                                                </div>
                                                                <p className="text-xs font-bold text-primary">${bid.amount}</p>
                                                            </div>
                                                        </div>

                                                        {bid.note && (
                                                            <div className="flex-1 min-w-0 sm:max-w-[150px]">
                                                                <p className="text-[10px] text-muted-foreground italic line-clamp-1 bg-muted/30 px-2 py-1 rounded">"{bid.note}"</p>
                                                            </div>
                                                        )}

                                                        <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0">
                                                            <span className="text-[9px] text-muted-foreground">{new Date(bid.createdAt).toLocaleDateString()}</span>
                                                            {job.status === 'OPEN' && (
                                                                <Button
                                                                    size="sm"
                                                                    className="h-7 text-[10px] px-3 bg-emerald-600 hover:bg-emerald-700"
                                                                    disabled={processingBid === bid.id}
                                                                    onClick={() => handleSelectVideographer(job.id, bid.id)}
                                                                >
                                                                    {processingBid === bid.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
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
