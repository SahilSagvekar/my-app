'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  RefreshCw,
  Play,
  Square,
  Server,
  HardDrive,
  DollarSign,
  Clock,
  AlertCircle,
  CheckCircle,
  Loader2,
  Zap,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CompressionStatus {
  queue: {
    pending: number;
    pendingSizeGB: number;
    processing: number;
    completed: number;
    failed: number;
  };
  spot: {
    status: string;
    instanceId?: string;
  };
  budget: {
    used: number;
    remaining: number;
    limit: number;
  };
  worker: {
    running: boolean;
    currentJob: string | null;
  };
  jobs?: {
    pending: any[];
    processing: any[];
  };
}

export function CompressionDashboard() {
  const [status, setStatus] = useState<CompressionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/compression/status?includeJobs=true');
      if (!res.ok) throw new Error('Failed to fetch status');
      const data = await res.json();
      setStatus(data);
    } catch (error: any) {
      console.error('Failed to fetch compression status:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleAction = async (action: string) => {
    try {
      setActionLoading(action);
      const res = await fetch('/api/compression/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      const data = await res.json();

      if (data.success) {
        toast({
          title: 'Success',
          description: data.message,
        });
        fetchStatus();
      } else {
        throw new Error(data.message);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  };

  const getStatusBadge = (spotStatus: string) => {
    switch (spotStatus) {
      case 'running':
        return <Badge className="bg-green-500">Running</Badge>;
      case 'starting':
        return <Badge className="bg-yellow-500">Starting</Badge>;
      case 'stopping':
        return <Badge className="bg-orange-500">Stopping</Badge>;
      default:
        return <Badge variant="secondary">Stopped</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!status) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <AlertCircle className="w-6 h-6 mr-2" />
        Failed to load compression status
      </div>
    );
  }

  const budgetPercent = (status.budget.used / status.budget.limit) * 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Video Compression</h2>
          <p className="text-muted-foreground">Monitor and control the compression system</p>
        </div>
        <Button onClick={fetchStatus} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Queue Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <HardDrive className="w-4 h-4" />
              Queue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{status.queue.pending}</div>
            <p className="text-xs text-muted-foreground">
              {status.queue.pendingSizeGB.toFixed(2)} GB pending
            </p>
            <div className="flex gap-2 mt-2 text-xs">
              <span className="text-yellow-500">{status.queue.processing} processing</span>
              <span className="text-green-500">{status.queue.completed} done</span>
              {status.queue.failed > 0 && (
                <span className="text-red-500">{status.queue.failed} failed</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Spot Instance */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Server className="w-4 h-4" />
              Spot Instance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {getStatusBadge(status.spot.status)}
            </div>
            {status.spot.instanceId && (
              <p className="text-xs text-muted-foreground mt-1 font-mono">
                {status.spot.instanceId}
              </p>
            )}
            <div className="flex gap-2 mt-3">
              {status.spot.status === 'stopped' ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAction('start-spot')}
                  disabled={actionLoading === 'start-spot'}
                >
                  {actionLoading === 'start-spot' ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Play className="w-3 h-3" />
                  )}
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAction('stop-spot')}
                  disabled={actionLoading === 'stop-spot'}
                >
                  {actionLoading === 'stop-spot' ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Square className="w-3 h-3" />
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Budget */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Monthly Budget
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${status.budget.used.toFixed(2)}
              <span className="text-sm font-normal text-muted-foreground">
                {' '}/ ${status.budget.limit}
              </span>
            </div>
            <Progress value={budgetPercent} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              ${status.budget.remaining.toFixed(2)} remaining
            </p>
          </CardContent>
        </Card>

        {/* Worker */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Local Worker
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {status.worker.running ? (
                <Badge className="bg-green-500">Active</Badge>
              ) : (
                <Badge variant="secondary">Inactive</Badge>
              )}
            </div>
            {status.worker.currentJob && (
              <p className="text-xs text-muted-foreground mt-1 font-mono truncate">
                Job: {status.worker.currentJob.slice(0, 8)}...
              </p>
            )}
            <div className="flex gap-2 mt-3">
              {!status.worker.running ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAction('start-worker')}
                  disabled={actionLoading === 'start-worker'}
                >
                  {actionLoading === 'start-worker' ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Play className="w-3 h-3" />
                  )}
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAction('stop-worker')}
                  disabled={actionLoading === 'stop-worker'}
                >
                  {actionLoading === 'stop-worker' ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Square className="w-3 h-3" />
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Jobs Table */}
      {status.jobs && (status.jobs.pending.length > 0 || status.jobs.processing.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Active Jobs</CardTitle>
            <CardDescription>Currently queued and processing videos</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job ID</TableHead>
                  <TableHead>Video</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Processor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Processing jobs first */}
                {status.jobs.processing.map((job: any) => (
                  <TableRow key={job.id}>
                    <TableCell className="font-mono text-xs">
                      {job.id.slice(0, 8)}...
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {job.videoKey.split('/').pop()}
                    </TableCell>
                    <TableCell>{formatBytes(job.sizeBytes)}</TableCell>
                    <TableCell>
                      <Badge className="bg-blue-500">Processing</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={job.progress} className="w-20" />
                        <span className="text-xs">{job.progress}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {job.processor === 'spot' ? 'Spot' : 'Local'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {/* Pending jobs */}
                {status.jobs.pending.slice(0, 10).map((job: any) => (
                  <TableRow key={job.id}>
                    <TableCell className="font-mono text-xs">
                      {job.id.slice(0, 8)}...
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {job.videoKey.split('/').pop()}
                    </TableCell>
                    <TableCell>{formatBytes(job.sizeBytes)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">Pending</Badge>
                    </TableCell>
                    <TableCell>
                      <Clock className="w-4 h-4 text-muted-foreground" />
                    </TableCell>
                    <TableCell>-</TableCell>
                  </TableRow>
                ))}
                {status.jobs.pending.length > 10 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      +{status.jobs.pending.length - 10} more pending jobs
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {status.jobs && status.jobs.pending.length === 0 && status.jobs.processing.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle className="w-12 h-12 text-green-500 mb-4" />
            <p className="text-lg font-medium">All caught up!</p>
            <p className="text-muted-foreground">No videos in the compression queue</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default CompressionDashboard;