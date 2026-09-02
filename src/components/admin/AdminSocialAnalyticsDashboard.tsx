// src/components/admin/AdminSocialAnalyticsDashboard.tsx
//
// Admin-only overview of social media analytics across ALL clients.
// One row per client (total followers/views/likes/comments + which
// platforms are connected), with a drill-in view that reuses the existing
// per-client SocialAnalyticsDashboard (same component clients themselves
// see) so there's one single source of truth for the detailed charts.

'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Youtube, Instagram, Facebook, Music2, Users, Eye, Heart, MessageCircle,
  AlertCircle, ArrowLeft, Building2,
} from 'lucide-react';
import { SocialAnalyticsDashboard } from '@/components/client/SocialAnalyticsDashboard';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const PLATFORM_ICONS: Record<string, any> = {
  youtube: Youtube,
  instagram: Instagram,
  facebook: Facebook,
  tiktok: Music2,
};

const PLATFORM_COLORS: Record<string, string> = {
  youtube: '#FF0000',
  instagram: '#E4405F',
  facebook: '#1877F2',
  tiktok: '#000000',
};

interface ClientRow {
  clientId: string;
  clientName: string;
  companyName: string | null;
  connected: boolean;
  accountCount: number;
  platforms: string[];
  totalFollowers: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  followersChange: number;
  viewsChange: number;
  lastSyncAt: string | null;
}

export function AdminSocialAnalyticsDashboard() {
  const [dateRange, setDateRange] = useState('28d');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedClientName, setSelectedClientName] = useState<string>('');

  const { data, error, isLoading } = useSWR(
    `/api/admin/social-analytics-overview?range=${dateRange}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 },
  );

  // Drill-in view: reuse the exact same dashboard clients see themselves.
  if (selectedClientId) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setSelectedClientId(null)} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to all clients
        </Button>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Building2 className="h-4 w-4" />
          Viewing: <span className="font-medium text-foreground">{selectedClientName}</span>
        </div>
        <SocialAnalyticsDashboard clientId={selectedClientId} />
      </div>
    );
  }

  if (isLoading) return <OverviewSkeleton />;

  if (error || !data?.ok) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">Failed to load analytics</h3>
        <p className="text-muted-foreground">{data?.error || 'Please try again later'}</p>
      </div>
    );
  }

  const clients: ClientRow[] = data.clients || [];
  const summary = data.summary;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Social Media Analytics — All Clients</h2>
          <p className="text-muted-foreground">
            {summary?.connectedClients || 0} of {summary?.totalClients || 0} clients have connected accounts
          </p>
        </div>
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="14d">Last 14 days</SelectItem>
            <SelectItem value="28d">Last 28 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Aggregate stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Connected Clients" value={summary?.connectedClients || 0} icon={Building2} />
        <StatCard title="Total Followers" value={summary?.totalFollowers || 0} icon={Users} formatted />
        <StatCard title="Total Views" value={summary?.totalViews || 0} icon={Eye} formatted />
        <StatCard title="Total Accounts" value={clients.reduce((s, c) => s + c.accountCount, 0)} icon={Music2} />
      </div>

      {/* Per-client table */}
      <Card>
        <CardHeader>
          <CardTitle>By Client</CardTitle>
        </CardHeader>
        <CardContent>
          {clients.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No active clients found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Platforms</TableHead>
                  <TableHead className="text-right">Followers</TableHead>
                  <TableHead className="text-right">Views ({dateRange})</TableHead>
                  <TableHead className="text-right">Likes</TableHead>
                  <TableHead className="text-right">Comments</TableHead>
                  <TableHead>Last Synced</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((c) => (
                  <TableRow
                    key={c.clientId}
                    className={c.connected ? 'cursor-pointer hover:bg-muted/50' : 'opacity-50'}
                    onClick={() => {
                      if (!c.connected) return;
                      setSelectedClientId(c.clientId);
                      setSelectedClientName(c.clientName);
                    }}
                  >
                    <TableCell>
                      <div className="font-medium">{c.clientName}</div>
                      {c.companyName && (
                        <div className="text-xs text-muted-foreground">{c.companyName}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      {c.platforms.length === 0 ? (
                        <Badge variant="outline" className="text-xs">Not connected</Badge>
                      ) : (
                        <div className="flex gap-1">
                          {c.platforms.map((p) => {
                            const Icon = PLATFORM_ICONS[p] || Users;
                            const color = PLATFORM_COLORS[p] || '#666';
                            return (
                              <div
                                key={p}
                                className="p-1 rounded-full"
                                style={{ backgroundColor: `${color}20` }}
                                title={p}
                              >
                                <Icon className="h-3.5 w-3.5" style={{ color }} />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {c.connected ? formatNumber(c.totalFollowers) : '—'}
                      {c.connected && c.followersChange !== 0 && (
                        <ChangeBadge change={c.followersChange} />
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {c.connected ? formatNumber(c.totalViews) : '—'}
                      {c.connected && c.viewsChange !== 0 && <ChangeBadge change={c.viewsChange} />}
                    </TableCell>
                    <TableCell className="text-right">
                      {c.connected ? formatNumber(c.totalLikes) : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {c.connected ? formatNumber(c.totalComments) : '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.lastSyncAt ? new Date(c.lastSyncAt).toLocaleDateString() : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, formatted = false }: {
  title: string; value: number; icon: any; formatted?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-2xl font-bold mt-2">{formatted ? formatNumber(value) : value}</p>
        <p className="text-sm text-muted-foreground">{title}</p>
      </CardContent>
    </Card>
  );
}

function ChangeBadge({ change }: { change: number }) {
  const isPositive = change >= 0;
  return (
    <span
      className={`ml-2 text-xs font-medium px-1.5 py-0.5 rounded ${
        isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
      }`}
    >
      {isPositive ? '+' : ''}{change}%
    </span>
  );
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num?.toString() || '0';
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex justify-between">
        <div>
          <div className="h-8 bg-muted rounded w-96 mb-2" />
          <div className="h-4 bg-muted rounded w-64" />
        </div>
        <div className="h-10 bg-muted rounded w-32" />
      </div>
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-muted rounded" />
        ))}
      </div>
      <div className="h-96 bg-muted rounded" />
    </div>
  );
}