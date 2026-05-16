// src/components/client/SocialAnalyticsDashboard.tsx

'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
import { 
  Youtube, Instagram, Facebook, Music2, 
  TrendingUp, Users, Eye, Heart, MessageCircle,
  Plus, RefreshCw, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ManualSocialConnect } from './ManualSocialConnect';

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

interface Platform {
  id: string;
  name: string;
  icon: any;
  color: string;
  description: string;
}

// Updated: Instagram removed (deprecated Dec 2024), Facebook includes Instagram Business
const PLATFORMS: Platform[] = [
  {
    id: 'youtube',
    name: 'YouTube',
    icon: Youtube,
    color: '#FF0000',
    description: 'Connect your YouTube channel to track video performance',
  },
  {
    id: 'facebook',
    name: 'Facebook + Instagram',
    icon: Facebook,
    color: '#1877F2',
    description: 'Connect Facebook Page (includes linked Instagram Business)',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    icon: Music2,
    color: '#000000',
    description: 'Connect your TikTok account for video analytics',
  },
];

export function SocialAnalyticsDashboard({ clientId, initialOpen = false }: { clientId: string; initialOpen?: boolean }) {
  const [dateRange, setDateRange] = useState('28d');
  const [syncing, setSyncing] = useState(false);
  const [showConnectDialog, setShowConnectDialog] = useState(initialOpen);

  const { data, error, isLoading, mutate } = useSWR(
    `/api/social/analytics?clientId=${clientId}&range=${dateRange}`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  );

  // Check for connection success/error in URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('social_connected');
    const errorParam = params.get('social_error');

    if (connected) {
      toast.success(`Successfully connected ${connected}!`);
      window.history.replaceState({}, '', window.location.pathname);
      mutate();
    }

    if (errorParam) {
      toast.error(`Connection failed: ${decodeURIComponent(errorParam)}`);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [mutate]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await fetch(`/api/social/sync?clientId=${clientId}`, { method: 'POST' });
      await mutate();
      toast.success('Sync completed!');
    } catch (err) {
      toast.error('Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async (accountId: string, platformName: string) => {
    if (!confirm(`Are you sure you want to disconnect ${platformName}?`)) {
      return;
    }

    setDisconnecting(accountId);
    try {
      const res = await fetch(`/api/social/accounts?accountId=${accountId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Failed to disconnect');
      }

      toast.success(`Disconnected ${platformName}`);
      mutate();
    } catch (err) {
      toast.error('Failed to disconnect account');
    } finally {
      setDisconnecting(null);
    }
  };

  if (isLoading) return <AnalyticsSkeleton />;
  
  if (error || !data?.ok) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">Failed to load analytics</h3>
        <p className="text-muted-foreground mb-4">
          {data?.error || 'Please try again later'}
        </p>
        <Button onClick={() => mutate()}>Retry</Button>
      </div>
    );
  }

  const { accounts, overview, chartData, topPosts } = data;
  const hasAccounts = accounts && accounts.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Social Media Analytics</h2>
          <p className="text-muted-foreground">
            Track performance across all your platforms
          </p>
        </div>
        <div className="flex items-center gap-3">
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
          {hasAccounts && (
            <Button variant="outline" onClick={handleSync} disabled={syncing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              Sync
            </Button>
          )}
          <Button onClick={() => setShowConnectDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Connect Account
          </Button>
        </div>
      </div>

      {/* Connect Account Dialog — manual token flow (no OAuth verification needed) */}
      <ManualSocialConnect
        open={showConnectDialog}
        onOpenChange={setShowConnectDialog}
        clientId={clientId}
        onConnected={() => { mutate(); setShowConnectDialog(false); }}
      />

      {/* No accounts state */}
      {!hasAccounts && (
        <Card className="p-12">
          <div className="text-center">
            <div className="flex justify-center gap-4 mb-6">
              <div className="p-3 rounded-full bg-red-100">
                <Youtube className="h-8 w-8 text-red-500" />
              </div>
              <div className="p-3 rounded-full bg-blue-100">
                <Facebook className="h-8 w-8 text-blue-500" />
              </div>
              <div className="p-3 rounded-full bg-gray-100">
                <Music2 className="h-8 w-8 text-gray-700" />
              </div>
            </div>
            <h3 className="text-xl font-semibold mb-2">Connect Your Social Accounts</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Link your YouTube, Facebook, or TikTok accounts to track performance and engagement metrics.
            </p>
            <Button size="lg" onClick={() => setShowConnectDialog(true)}>
              <Plus className="h-5 w-5 mr-2" />
              Connect Your First Account
            </Button>
          </div>
        </Card>
      )}

      {/* Connected Accounts */}
      {hasAccounts && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {accounts.map((account: any) => {
              const Icon = PLATFORM_ICONS[account.platform] || Users;
              const color = PLATFORM_COLORS[account.platform] || '#666';
              const isDisconnecting = disconnecting === account.id;
              return (
                <Card key={account.id} className="relative overflow-hidden group">
                  <div 
                    className="absolute top-0 left-0 w-1 h-full"
                    style={{ backgroundColor: color }}
                  />
                  {/* Disconnect button - shows on hover */}
                  <button
                    onClick={() => handleDisconnect(account.id, account.platformName)}
                    disabled={isDisconnecting}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-red-100 text-red-600 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-200 disabled:opacity-50"
                    title="Disconnect account"
                  >
                    {isDisconnecting ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <X className="h-3 w-3" />
                    )}
                  </button>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div 
                        className="p-2 rounded-full"
                        style={{ backgroundColor: `${color}20` }}
                      >
                        <Icon className="h-5 w-5" style={{ color }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{account.platformName}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatNumber(account.followerCount)} followers
                        </p>
                      </div>
                    </div>
                    {account.lastSyncAt && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Synced: {new Date(account.lastSyncAt).toLocaleDateString()}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
            {/* Add more accounts card */}
            <Card 
              className="border-dashed cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => setShowConnectDialog(true)}
            >
              <CardContent className="p-4 flex items-center justify-center h-full min-h-[100px]">
                <div className="text-center text-muted-foreground">
                  <Plus className="h-6 w-6 mx-auto mb-1" />
                  <span className="text-sm">Add Account</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Overview Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatCard 
              title="Total Followers" 
              value={overview?.totalFollowers || 0} 
              change={overview?.followersChange || 0}
              icon={Users}
            />
            <StatCard 
              title="Total Views" 
              value={overview?.totalViews || 0} 
              change={overview?.viewsChange || 0}
              icon={Eye}
            />
            <StatCard 
              title="Total Likes" 
              value={overview?.totalLikes || 0} 
              change={overview?.likesChange || 0}
              icon={Heart}
            />
            <StatCard 
              title="Total Comments" 
              value={overview?.totalComments || 0} 
              change={overview?.commentsChange || 0}
              icon={MessageCircle}
            />
            <StatCard 
              title="Engagement Rate" 
              value={`${(overview?.avgEngagement || 0).toFixed(2)}%`} 
              change={overview?.engagementChange || 0}
              icon={TrendingUp}
            />
          </div>

          {/* Charts */}
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="followers">Followers</TabsTrigger>
              <TabsTrigger value="posts">Top Posts</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <Card>
                <CardHeader>
                  <CardTitle>Performance Over Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData?.daily || []}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--background))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                        <Legend />
                        <Line 
                          type="monotone" 
                          dataKey="views" 
                          stroke="#8884d8" 
                          strokeWidth={2}
                          name="Views"
                          dot={false}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="likes" 
                          stroke="#82ca9d" 
                          strokeWidth={2}
                          name="Likes"
                          dot={false}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="comments" 
                          stroke="#ffc658" 
                          strokeWidth={2}
                          name="Comments"
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="followers">
              <Card>
                <CardHeader>
                  <CardTitle>Follower Growth</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData?.followers || []}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--background))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                        <Legend />
                        <Bar dataKey="gained" fill="#82ca9d" name="Gained" />
                        <Bar dataKey="lost" fill="#ff6b6b" name="Lost" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="posts">
              <Card>
                <CardHeader>
                  <CardTitle>Top Performing Posts</CardTitle>
                </CardHeader>
                <CardContent>
                  {topPosts && topPosts.length > 0 ? (
                    <div className="space-y-4">
                      {topPosts.map((post: any) => (
                        <PostRow key={post.id} post={post} />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No posts found in this period
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

function StatCard({ title, value, change, icon: Icon }: { 
  title: string; 
  value: number | string; 
  change: number; 
  icon: any;
}) {
  const isPositive = change >= 0;
  const displayValue = typeof value === 'number' ? formatNumber(value) : value;
  
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <Icon className="h-5 w-5 text-muted-foreground" />
          <span className={`text-xs font-medium px-2 py-0.5 rounded ${
            isPositive 
              ? 'bg-green-100 text-green-700' 
              : 'bg-red-100 text-red-700'
          }`}>
            {isPositive ? '+' : ''}{change}%
          </span>
        </div>
        <p className="text-2xl font-bold mt-2">{displayValue}</p>
        <p className="text-sm text-muted-foreground">{title}</p>
      </CardContent>
    </Card>
  );
}

function PostRow({ post }: { post: any }) {
  const Icon = PLATFORM_ICONS[post.platform] || Users;
  const color = PLATFORM_COLORS[post.platform] || '#666';
  
  return (
    <div className="flex items-center gap-4 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
      {post.thumbnailUrl ? (
        <img 
          src={post.thumbnailUrl} 
          alt={post.title || 'Post thumbnail'}
          className="w-20 h-12 object-cover rounded"
        />
      ) : (
        <div className="w-20 h-12 bg-muted rounded flex items-center justify-center">
          <Icon className="h-6 w-6 text-muted-foreground" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{post.title || 'Untitled'}</p>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Icon className="h-3 w-3" style={{ color }} />
          <span>{new Date(post.publishedAt).toLocaleDateString()}</span>
        </div>
      </div>
      <div className="flex gap-6 text-sm">
        <div className="text-center">
          <p className="font-semibold">{formatNumber(post.views)}</p>
          <p className="text-muted-foreground text-xs">Views</p>
        </div>
        <div className="text-center">
          <p className="font-semibold">{formatNumber(post.likes)}</p>
          <p className="text-muted-foreground text-xs">Likes</p>
        </div>
        <div className="text-center">
          <p className="font-semibold">{formatNumber(post.comments)}</p>
          <p className="text-muted-foreground text-xs">Comments</p>
        </div>
      </div>
    </div>
  );
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num?.toString() || '0';
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex justify-between">
        <div>
          <div className="h-8 bg-muted rounded w-64 mb-2" />
          <div className="h-4 bg-muted rounded w-48" />
        </div>
        <div className="h-10 bg-muted rounded w-32" />
      </div>
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-muted rounded" />
        ))}
      </div>
      <div className="grid grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-28 bg-muted rounded" />
        ))}
      </div>
      <div className="h-[400px] bg-muted rounded" />
    </div>
  );
}