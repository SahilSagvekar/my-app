"use client";

import { useAdminYouTubeAnalytics } from "@/lib/hooks/useYouTubeAnalytics";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users,
  Youtube,
  TrendingUp,
  Eye,
  Clock,
  DollarSign,
  ExternalLink,
  ChevronRight,
  RefreshCw
} from "lucide-react";
import { formatNumber, formatRevenue } from "./YouTubeStudio";

interface AdminYouTubeAnalyticsProps {
  onSelectClient: (clientId: string) => void;
}

export default function AdminYouTubeAnalytics({ onSelectClient }: AdminYouTubeAnalyticsProps) {
  const { data, loading, error, range, setRange, refetch } = useAdminYouTubeAnalytics();

  if (loading) {
    return <div className="p-8 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="h-24 bg-muted/50 rounded-t-xl" />
          </Card>
        ))}
      </div>
      <Card className="animate-pulse">
        <CardHeader className="h-64 bg-muted/30" />
      </Card>
    </div>;
  }

  if (error) {
    return <div className="p-8 text-center bg-red-50 dark:bg-red-950/20 text-red-600 rounded-xl border border-red-200">
      <p className="font-medium">Error loading admin analytics</p>
      <p className="text-sm opacity-80 mt-1">{error}</p>
      <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
        Try Again
      </Button>
    </div>;
  }

  const { summary, clients } = data;

  return (
    <div className="space-y-6 p-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row justify-end items-start md:items-center gap-4">

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh Global Data
          </Button>
        </div>
      </div>

      {/* Global Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-none shadow-sm bg-gradient-to-br from-red-500/10 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
              Total Subscribers
              <Users className="w-4 h-4 text-red-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(summary.totalSubscribers)}</div>
            <p className="text-xs text-muted-foreground mt-1">Across all connected channels</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-gradient-to-br from-blue-500/10 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
              Total Views
              <Eye className="w-4 h-4 text-blue-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(summary.totalViews)}</div>
            <p className="text-xs text-muted-foreground mt-1">Sum of all views in last 28d</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-gradient-to-br from-orange-500/10 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
              Total Watch Time
              <Clock className="w-4 h-4 text-orange-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(summary.totalWatchTimeHours)}h</div>
            <p className="text-xs text-muted-foreground mt-1">Cumulative watch hours</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-gradient-to-br from-green-500/10 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
              Total Revenue
              <DollarSign className="w-4 h-4 text-green-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatRevenue(summary.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground mt-1">Total estimated earnings</p>
          </CardContent>
        </Card>
      </div>

      {/* Client Channels Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Client Channels</CardTitle>
          <CardDescription>Detailed breakdown of each client's YouTube status.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative overflow-x-auto rounded-lg border">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-muted/50 border-b">
                <tr>
                  <th className="px-4 py-3 font-semibold">Client</th>
                  <th className="px-4 py-3 font-semibold text-center">Connection</th>
                  <th className="px-4 py-3 font-semibold text-right">Subscribers</th>
                  <th className="px-4 py-3 font-semibold text-right">Views (28d)</th>
                  <th className="px-4 py-3 font-semibold text-right">Revenue (28d)</th>
                  <th className="px-4 py-3 font-semibold text-right">Sync Status</th>
                  <th className="px-4 py-3 font-semibold text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {clients.map((client: any) => (
                  <tr key={client.clientId} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {client.channelAvatar ? (
                          <img src={client.channelAvatar} className="w-8 h-8 rounded-full border border-muted-foreground/20" alt="" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                            <Youtube className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <p className="font-semibold">{client.clientName}</p>
                          <p className="text-xs text-muted-foreground">{client.channelTitle || client.companyName || "No channel connected"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {client.isConnected ? (
                        <Badge variant="outline" className="bg-green-100 text-green-700 hover:bg-green-100 border-none">Connected</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground border-dashed">Not Linked</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {client.isConnected ? (
                        <span>{formatNumber(client.currentSubscribers)}</span>
                      ) : "-"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {client.isConnected ? (
                        <span>{formatNumber(client.viewsInPeriod)}</span>
                      ) : "-"}
                    </td>
                    <td className="px-4 py-3 text-right text-green-600 font-medium">
                      {client.isConnected ? (
                        <span>{formatRevenue(client.estimatedRevenue || 0)}</span>
                      ) : "-"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {client.isConnected ? (
                        <Badge
                          variant="secondary"
                          className={`
                                                        ${client.syncStatus === 'SYNCING' ? 'animate-pulse bg-blue-50 text-blue-600' : ''}
                                                        ${client.syncStatus === 'FAILED' ? 'bg-red-50 text-red-600' : ''}
                                                    `}
                        >
                          {client.syncStatus || "PENDING"}
                        </Badge>
                      ) : "-"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {client.isConnected ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => onSelectClient(client.clientId)}
                        >
                          View Details
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      ) : (
                        <Badge variant="outline" className="text-[10px] opacity-50">Pending Connection</Badge>
                      )}
                    </td>
                  </tr>
                ))}
                {clients.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                      No clients found in the system.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}