// src/components/youtube/AdminYouTubeAnalytics.tsx
// Admin-facing: overview of ALL clients' YouTube performance

"use client";

import { useState } from "react";
import { useAdminYouTubeAnalytics } from "@/lib/hooks/useYouTubeAnalytics";
import type { DateRange } from "@/types/youtube";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowUp,
  ArrowDown,
  Youtube,
  Users,
  Eye,
  Clock,
  DollarSign,
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Link2,
} from "lucide-react";

// ============================================================================
// HELPERS
// ============================================================================

function formatNumber(num: number): string {
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + "M";
  if (num >= 1_000) return (num / 1_000).toFixed(1) + "K";
  return num.toLocaleString();
}

function formatRevenue(amount: number | null): string {
  if (amount == null || amount === 0) return "—";
  return "₹" + amount.toLocaleString("en-IN", { minimumFractionDigits: 0 });
}

function getSyncBadge(status: string | null) {
  switch (status) {
    case "COMPLETED":
      return (
        <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20">
          <CheckCircle2 className="w-3 h-3 mr-1" /> Synced
        </Badge>
      );
    case "SYNCING":
      return (
        <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50 dark:bg-blue-900/20">
          <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Syncing
        </Badge>
      );
    case "FAILED":
      return (
        <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50 dark:bg-red-900/20">
          <XCircle className="w-3 h-3 mr-1" /> Failed
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-zinc-400">
          <AlertCircle className="w-3 h-3 mr-1" /> Not connected
        </Badge>
      );
  }
}

const RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "28d", label: "Last 28 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "365d", label: "Last 365 days" },
];

type SortKey = "clientName" | "currentSubscribers" | "viewsInPeriod" | "watchTimeHours" | "estimatedRevenue" | "subscriberChange";

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function AdminYouTubeAnalytics() {
  const { data, loading, error, range, setRange, refetch } =
    useAdminYouTubeAnalytics();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("viewsInPeriod");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [syncing, setSyncing] = useState(false);

  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      await fetch("/api/cron/youtube-sync", { method: "POST" });
      // Wait a bit then refetch
      setTimeout(() => {
        refetch();
        setSyncing(false);
      }, 3000);
    } catch {
      setSyncing(false);
    }
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ field }: { field: SortKey }) => {
    if (sortKey !== field) return null;
    return sortDir === "desc" ? (
      <ArrowDown className="w-3 h-3 inline ml-1" />
    ) : (
      <ArrowUp className="w-3 h-3 inline ml-1" />
    );
  };

  // Loading
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="h-4 w-24 bg-muted animate-pulse rounded mb-2" />
                <div className="h-8 w-20 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            Loading analytics...
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="py-8 text-center">
          <p className="text-destructive">{error}</p>
          <Button variant="outline" className="mt-4" onClick={refetch}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { summary, clients } = data || { summary: {}, clients: [] };

  // Filter and sort
  const filtered = (clients || [])
    .filter(
      (c: any) =>
        c.clientName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.channelTitle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.companyName?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a: any, b: any) => {
      const aVal = a[sortKey] ?? 0;
      const bVal = b[sortKey] ?? 0;
      if (typeof aVal === "string") {
        return sortDir === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    });

  const rangeLabel = RANGE_OPTIONS.find((r) => r.value === range)?.label || "";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Youtube className="w-5 h-5 text-red-600" />
            YouTube Analytics
          </h2>
          <p className="text-sm text-muted-foreground">
            {summary.connectedClients || 0} of {summary.totalClients || 0}{" "}
            clients connected
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={range}
            onValueChange={(v) => setRange(v as DateRange)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncAll}
            disabled={syncing}
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${syncing ? "animate-spin" : ""}`} />
            Sync All
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="w-4 h-4" /> Total Subscribers
            </div>
            <p className="text-2xl font-bold mt-1">
              {formatNumber(summary.totalSubscribers || 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Eye className="w-4 h-4" /> Total Views
            </div>
            <p className="text-2xl font-bold mt-1">
              {formatNumber(summary.totalViews || 0)}
            </p>
            <p className="text-xs text-muted-foreground">{rangeLabel}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" /> Watch Time (hrs)
            </div>
            <p className="text-2xl font-bold mt-1">
              {formatNumber(summary.totalWatchTimeHours || 0)}
            </p>
            <p className="text-xs text-muted-foreground">{rangeLabel}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <DollarSign className="w-4 h-4" /> Total Revenue
            </div>
            <p className="text-2xl font-bold mt-1">
              {formatRevenue(summary.totalRevenue)}
            </p>
            <p className="text-xs text-muted-foreground">{rangeLabel}</p>
          </CardContent>
        </Card>
      </div>

      {/* Client Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-base">All Clients</CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search clients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="cursor-pointer hover:text-foreground"
                    onClick={() => handleSort("clientName")}
                  >
                    Client <SortIcon field="clientName" />
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead
                    className="text-right cursor-pointer hover:text-foreground"
                    onClick={() => handleSort("currentSubscribers")}
                  >
                    Subscribers <SortIcon field="currentSubscribers" />
                  </TableHead>
                  <TableHead
                    className="text-right cursor-pointer hover:text-foreground"
                    onClick={() => handleSort("subscriberChange")}
                  >
                    Sub Change <SortIcon field="subscriberChange" />
                  </TableHead>
                  <TableHead
                    className="text-right cursor-pointer hover:text-foreground"
                    onClick={() => handleSort("viewsInPeriod")}
                  >
                    Views <SortIcon field="viewsInPeriod" />
                  </TableHead>
                  <TableHead
                    className="text-right cursor-pointer hover:text-foreground"
                    onClick={() => handleSort("watchTimeHours")}
                  >
                    Watch Time <SortIcon field="watchTimeHours" />
                  </TableHead>
                  <TableHead
                    className="text-right cursor-pointer hover:text-foreground"
                    onClick={() => handleSort("estimatedRevenue")}
                  >
                    Revenue <SortIcon field="estimatedRevenue" />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-8 text-muted-foreground"
                    >
                      {searchQuery
                        ? "No clients match your search"
                        : "No clients found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((client: any) => (
                    <TableRow
                      key={client.clientId}
                      className="cursor-pointer hover:bg-muted/50"
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {client.channelAvatar ? (
                            <img
                              src={client.channelAvatar}
                              alt=""
                              className="w-8 h-8 rounded-full"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                              <Youtube className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-sm">
                              {client.clientName}
                            </p>
                            {client.channelTitle && (
                              <p className="text-xs text-muted-foreground">
                                {client.channelTitle}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getSyncBadge(client.syncStatus)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {client.isConnected
                          ? formatNumber(client.currentSubscribers)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {client.isConnected ? (
                          <span
                            className={
                              client.subscriberChange > 0
                                ? "text-emerald-600"
                                : client.subscriberChange < 0
                                ? "text-red-600"
                                : "text-muted-foreground"
                            }
                          >
                            {client.subscriberChange > 0 ? "+" : ""}
                            {formatNumber(client.subscriberChange)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {client.isConnected
                          ? formatNumber(client.viewsInPeriod)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {client.isConnected
                          ? formatNumber(client.watchTimeHours) + "h"
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {client.isConnected
                          ? formatRevenue(client.estimatedRevenue)
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}