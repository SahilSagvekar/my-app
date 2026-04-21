'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import {
  BarChart3,
  Users,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  RefreshCw,
  Loader2,
  Search,
  ChevronDown,
  ChevronRight,
  Video,
  Film,
  Square,
  Image as ImageIcon,
  Zap,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Shield,
  Calendar,
  Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ───

interface StatusCounts {
  total: number;
  pending: number;
  inProgress: number;
  readyForQc: number;
  completed: number;
  scheduled: number;
  posted: number;
  clientReview: number;
  onHold: number;
}

type TaskStatusFilter =
  | 'all'
  | 'pending'
  | 'inProgress'
  | 'readyForQc'
  | 'clientReview'
  | 'completed'
  | 'scheduled'
  | 'posted';

interface StatusSummary
  extends Pick<
    StatusCounts,
    | 'pending'
    | 'inProgress'
    | 'readyForQc'
    | 'clientReview'
    | 'completed'
    | 'scheduled'
    | 'posted'
  > {
  all: number;
}

interface DeliverableProgress {
  deliverableId: string;
  type: string;
  promised: number;
  isTrial: boolean;
  statusCounts: StatusCounts;
  doneCount: number;
  extraCount: number;
  extraDoneCount: number;
  progressPercent: number;
  health: 'healthy' | 'warning' | 'critical';
}

interface ClientProgress {
  clientId: string;
  clientName: string;
  isTrial: boolean;
  deliverables: DeliverableProgress[];
  totalTasks: number;
  totalPromised: number;
  totalDone: number;
  totalExtraTasks: number;
  totalExtraDone: number;
  overallProgress: number;
  health: 'healthy' | 'warning' | 'critical';
}

interface EditorPerf {
  id: number;
  name: string;
  role: string;
  statusBreakdown: StatusCounts;
  completionRate: number;
  avgTurnaroundDays: number;
  clientCount: number;
}

interface QCPerf {
  id: number;
  name: string;
  role: string;
  totalReviewed: number;
  passed: number;
  rejected: number;
  passRate: number;
  avgReviewHours: number;
}

interface SchedulerPerf {
  id: number;
  name: string;
  role: string;
  totalAssigned: number;
  scheduled: number;
  posted: number;
  withLinks: number;
  postRate: number;
}

interface Summary {
  totalClients: number;
  totalTasksThisMonth: number;
  totalPromised: number;
  totalDone: number;
  totalInProgress: number;
  totalPending: number;
  totalPosted: number;
  atRiskCount: number;
  overallProgress: number;
}

interface TrackerData {
  month: string;
  summary: Summary;
  statusSummary: StatusSummary;
  clientProgress: ClientProgress[];
  editorPerformance: EditorPerf[];
  qcPerformance: QCPerf[];
  schedulerPerformance: SchedulerPerf[];
  atRiskClients: ClientProgress[];
  availableMonths: string[];
}

// ─── Deliverable type icons ───
const TYPE_ICONS: Record<string, React.ReactNode> = {
  'Short Form Videos': <Video className="h-3.5 w-3.5" />,
  'Long Form Videos': <Film className="h-3.5 w-3.5" />,
  'Square Form Videos': <Square className="h-3.5 w-3.5" />,
  'Thumbnails': <ImageIcon className="h-3.5 w-3.5" />,
  'Beta Short Form': <Zap className="h-3.5 w-3.5" />,
};

const SHORT_TYPE: Record<string, string> = {
  'Short Form Videos': 'SF',
  'Long Form Videos': 'LF',
  'Square Form Videos': 'SQF',
  'Thumbnails': 'THUMB',
  'Tiles': 'TILE',
  'Hard Posts / Graphic Images': 'HP',
  'Snapchat Episodes': 'SNAP',
  'Beta Short Form': 'BSF',
};

const STATUS_FILTER_OPTIONS: {
  key: TaskStatusFilter;
  label: string;
  color: string;
}[] = [
  { key: 'all', label: 'All', color: 'bg-gray-900 text-white border-gray-900' },
  { key: 'pending', label: 'Pending', color: 'bg-gray-100 text-gray-700 border-gray-200' },
  { key: 'readyForQc', label: 'Ready for QC', color: 'bg-violet-100 text-violet-700 border-violet-200' },
  { key: 'clientReview', label: 'Client Review', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { key: 'completed', label: 'Completed', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { key: 'scheduled', label: 'Scheduled', color: 'bg-sky-100 text-sky-700 border-sky-200' },
  { key: 'posted', label: 'Posted', color: 'bg-green-100 text-green-700 border-green-200' },
];

const CLIENT_STATUS_FILTER_OPTIONS = STATUS_FILTER_OPTIONS.filter(
  (option) => option.key !== 'all'
);

function getClientStatusCount(
  client: ClientProgress,
  filter: TaskStatusFilter
) {
  if (filter === 'all') return client.totalTasks;
  return client.deliverables.reduce(
    (sum, deliverable) => sum + deliverable.statusCounts[filter],
    0
  );
}

function ClientStatusCounts({ client }: { client: ClientProgress }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {client.totalExtraTasks > 0 && (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-rose-100 text-rose-700 border-rose-200">
          Extra: {client.totalExtraDone}/{client.totalExtraTasks}
        </span>
      )}
      {CLIENT_STATUS_FILTER_OPTIONS.map((option) => {
        const count = getClientStatusCount(client, option.key);
        return (
          <span
            key={option.key}
            className={cn(
              'text-[10px] font-bold px-2 py-0.5 rounded-full border',
              count > 0
                ? option.color
                : 'bg-gray-50 text-gray-400 border-gray-100'
            )}
          >
            {option.label}: {count}
          </span>
        );
      })}
    </div>
  );
}

// ─── Health badge ───
function HealthBadge({ health }: { health: string }) {
  if (health === 'critical')
    return (
      <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px] font-bold gap-1">
        <AlertTriangle className="h-3 w-3" /> At Risk
      </Badge>
    );
  if (health === 'warning')
    return (
      <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] font-bold gap-1">
        <Clock className="h-3 w-3" /> Behind
      </Badge>
    );
  return (
    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] font-bold gap-1">
      <CheckCircle className="h-3 w-3" /> On Track
    </Badge>
  );
}

// ─── Progress bar with color ───
function ColorProgress({ value, health }: { value: number; health: string }) {
  return (
    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
      <div
        className={cn(
          'h-full rounded-full transition-all duration-500',
          health === 'critical'
            ? 'bg-red-500'
            : health === 'warning'
            ? 'bg-amber-500'
            : 'bg-emerald-500'
        )}
        style={{ width: `${Math.min(100, value)}%` }}
      />
    </div>
  );
}

// ─── Stat Card ───
function StatCard({
  title,
  value,
  icon,
  subtitle,
  trend,
  color = 'bg-gray-50',
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  subtitle?: string;
  trend?: 'up' | 'down' | 'flat';
  color?: string;
}) {
  return (
    <Card className="border shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {title}
            </p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold tracking-tight">{value}</p>
              {trend && (
                <span
                  className={cn(
                    'text-xs font-medium',
                    trend === 'up'
                      ? 'text-emerald-600'
                      : trend === 'down'
                      ? 'text-red-600'
                      : 'text-gray-400'
                  )}
                >
                  {trend === 'up' && <ArrowUpRight className="h-3 w-3 inline" />}
                  {trend === 'down' && <ArrowDownRight className="h-3 w-3 inline" />}
                  {trend === 'flat' && <Minus className="h-3 w-3 inline" />}
                </span>
              )}
            </div>
            {subtitle && (
              <p className="text-[11px] text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div className={cn('p-2.5 rounded-xl', color)}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Component ───

export function ProductionTracker() {
  const [data, setData] = useState<TrackerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedClients, setExpandedClients] = useState<Set<string>>(
    new Set()
  );
  const [activeTab, setActiveTab] = useState<
    'overview' | 'clients' | 'editors' | 'qc' | 'schedulers'
  >('overview');
  const [healthFilter, setHealthFilter] = useState<
    'all' | 'critical' | 'warning' | 'healthy'
  >('all');
  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>('all');

  const fetchData = async (month?: string) => {
    try {
      setLoading(true);
      const url = month
        ? `/api/admin/production-tracker?month=${encodeURIComponent(month)}`
        : '/api/admin/production-tracker';
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setData(json);
      if (!selectedMonth && json.month) setSelectedMonth(json.month);
    } catch (err) {
      console.error('Production tracker fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleMonthChange = (month: string) => {
    setSelectedMonth(month);
    fetchData(month);
  };

  const toggleClient = (id: string) => {
    setExpandedClients((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Filter clients
  const filteredClients = useMemo(() => {
    if (!data) return [];
    return data.clientProgress
      .filter((c) => c.totalPromised > 0) // only clients with deliverables
      .filter(
        (c) => statusFilter === 'all' || getClientStatusCount(c, statusFilter) > 0
      )
      .filter(
        (c) =>
          healthFilter === 'all' || c.health === healthFilter
      )
      .filter(
        (c) =>
          !searchQuery ||
          c.clientName.toLowerCase().includes(searchQuery.toLowerCase())
      );
  }, [data, healthFilter, searchQuery, statusFilter]);

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Loading production data...
        </p>
      </div>
    );
  }

  if (!data) return null;

  const { summary, statusSummary } = data;

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* ─── Header ─── */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Target className="h-6 w-6 text-indigo-600" />
              Production Tracker
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Monthly deliverable progress & employee performance
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Month Selector */}
            <Select value={selectedMonth} onValueChange={handleMonthChange}>
              <SelectTrigger className="w-[180px] h-9 text-sm">
                <Calendar className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                {data.availableMonths.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchData(selectedMonth)}
              disabled={loading}
              className="h-9"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* ─── Summary Cards ─── */}
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-4">
          <StatCard
            title="Overall Progress"
            value={`${summary.overallProgress}%`}
            icon={<TrendingUp className="h-5 w-5 text-indigo-600" />}
            subtitle={`${summary.totalDone} / ${summary.totalPromised} done`}
            color="bg-indigo-50"
          />
          <StatCard
            title="Active Clients"
            value={summary.totalClients}
            icon={<Users className="h-5 w-5 text-blue-600" />}
            subtitle={`${summary.atRiskCount} at risk`}
            color="bg-blue-50"
          />
          <StatCard
            title="Tasks This Month"
            value={summary.totalTasksThisMonth}
            icon={<BarChart3 className="h-5 w-5 text-violet-600" />}
            subtitle={`${summary.totalInProgress} in progress`}
            color="bg-violet-50"
          />
          <StatCard
            title="Posted"
            value={summary.totalPosted}
            icon={<CheckCircle className="h-5 w-5 text-emerald-600" />}
            subtitle={`${summary.totalPending} pending`}
            color="bg-emerald-50"
          />
          <StatCard
            title="At Risk"
            value={summary.atRiskCount}
            icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
            subtitle="clients behind schedule"
            color="bg-red-50"
          />
        </div>

        {/* ─── Tab Navigation ─── */}
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg w-fit">
          {(
            [
              { id: 'overview', label: 'Overview', icon: Eye },
              { id: 'clients', label: 'Clients', icon: Users },
              { id: 'editors', label: 'Editors', icon: Film },
              { id: 'qc', label: 'QC', icon: Shield },
              { id: 'schedulers', label: 'Schedulers', icon: Calendar },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                activeTab === tab.id
                  ? 'bg-white shadow-sm text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ─── Status Filters ─── */}
        <Card className="border shadow-sm">
          <CardContent className="p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-1">
                Task Status
              </span>
              {STATUS_FILTER_OPTIONS.map((option) => {
                const isActive = statusFilter === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setStatusFilter(option.key)}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition-all',
                      isActive
                        ? option.color
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    )}
                  >
                    <span>{option.label}</span>
                    <span
                      className={cn(
                        'rounded-full px-1.5 py-0.5 text-[10px]',
                        isActive ? 'bg-white/20' : 'bg-gray-100 text-gray-700'
                      )}
                    >
                      {statusSummary[option.key]}
                    </span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* ─── Overview Tab ─── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* At Risk Clients Alert */}
            {data.atRiskClients.length > 0 && (
              <Card className="border-red-200 bg-red-50/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold text-red-800 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    At-Risk Clients ({data.atRiskClients.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {data.atRiskClients.map((client) => (
                      <div
                        key={client.clientId}
                        className="bg-white rounded-lg border border-red-100 p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm truncate">
                            {client.clientName}
                          </span>
                          <HealthBadge health={client.health} />
                        </div>
                        <ColorProgress
                          value={client.overallProgress}
                          health={client.health}
                        />
                        <div className="flex justify-between text-[11px] text-muted-foreground">
                          <span>
                            {client.totalDone}/{client.totalPromised} done
                          </span>
                          <span className="font-medium">
                            {client.overallProgress}%
                          </span>
                        </div>
                        <ClientStatusCounts client={client} />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* All Clients Quick Grid */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold">
                    All Client Progress
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 text-[10px]">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>On Track</span>
                      <div className="w-2 h-2 rounded-full bg-amber-500 ml-2" />
                      <span>Behind</span>
                      <div className="w-2 h-2 rounded-full bg-red-500 ml-2" />
                      <span>At Risk</span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {filteredClients
                    .sort((a, b) => {
                      const order = { critical: 0, warning: 1, healthy: 2 };
                      return (
                        order[a.health] - order[b.health] ||
                        a.overallProgress - b.overallProgress
                      );
                    })
                    .map((client) => (
                      <div
                        key={client.clientId}
                        className={cn(
                          'rounded-lg border p-3 space-y-2 transition-all cursor-pointer hover:shadow-sm',
                          client.health === 'critical'
                            ? 'border-red-200 bg-red-50/30'
                            : client.health === 'warning'
                            ? 'border-amber-200 bg-amber-50/30'
                            : 'border-gray-200'
                        )}
                        onClick={() => {
                          setActiveTab('clients');
                          setExpandedClients(new Set([client.clientId]));
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm truncate pr-2">
                            {client.clientName}
                          </span>
                          {client.isTrial && (
                            <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[9px]">
                              TRIAL
                            </Badge>
                          )}
                        </div>
                        <ColorProgress
                          value={client.overallProgress}
                          health={client.health}
                        />
                        <div className="flex justify-between text-[11px] text-muted-foreground">
                          <span>
                            {client.totalDone}/{client.totalPromised}
                          </span>
                          <span className="font-semibold text-gray-700">
                            {client.overallProgress}%
                          </span>
                        </div>
                        <ClientStatusCounts client={client} />
                        {/* Mini deliverable breakdown */}
                        <div className="flex flex-wrap gap-1">
                          {client.deliverables.map((d) => (
                            <Tooltip key={d.deliverableId}>
                              <TooltipTrigger asChild>
                                <span
                                  className={cn(
                                    'text-[9px] font-bold px-1.5 py-0.5 rounded',
                                    d.health === 'critical'
                                      ? 'bg-red-100 text-red-700'
                                      : d.health === 'warning'
                                      ? 'bg-amber-100 text-amber-700'
                                      : 'bg-emerald-100 text-emerald-700'
                                  )}
                                >
                                  {SHORT_TYPE[d.type] || d.type.slice(0, 3)}{' '}
                                  {d.doneCount}/{d.promised}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="text-xs">
                                {d.type}: {d.doneCount}/{d.promised} done (
                                {d.progressPercent}%)
                              </TooltipContent>
                            </Tooltip>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            {/* Editor Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Film className="h-4 w-4 text-violet-600" />
                    Editor Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    {data.editorPerformance
                      .sort((a, b) => b.statusBreakdown.total - a.statusBreakdown.total)
                      .map((editor) => (
                        <div
                          key={editor.id}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50"
                        >
                          <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 text-xs font-bold">
                            {(editor.name || '?').charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium truncate">
                                {editor.name}
                              </span>
                              <span className="text-xs font-bold text-gray-700">
                                {editor.statusBreakdown.completed}/
                                {editor.statusBreakdown.total}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <Progress
                                value={editor.completionRate}
                                className="h-1.5 flex-1"
                              />
                              <span className="text-[10px] text-muted-foreground w-8">
                                {editor.completionRate}%
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    {data.editorPerformance.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No editor data
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Shield className="h-4 w-4 text-blue-600" />
                    QC Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    {data.qcPerformance
                      .sort((a, b) => b.totalReviewed - a.totalReviewed)
                      .map((qc) => (
                        <div
                          key={qc.id}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50"
                        >
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold">
                            {(qc.name || '?').charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium truncate">
                                {qc.name}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {qc.totalReviewed} reviewed
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <Progress
                                value={qc.passRate}
                                className="h-1.5 flex-1"
                              />
                              <span className="text-[10px] text-muted-foreground w-12">
                                {qc.passRate}% pass
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    {data.qcPerformance.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No QC data
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ─── Clients Tab ─── */}
        {activeTab === 'clients' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search clients..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
              </div>
              <Select
                value={healthFilter}
                onValueChange={(v: any) => setHealthFilter(v)}
              >
                <SelectTrigger className="w-[140px] h-9 text-xs">
                  <SelectValue placeholder="Health" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="critical">At Risk</SelectItem>
                  <SelectItem value="warning">Behind</SelectItem>
                  <SelectItem value="healthy">On Track</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Client Rows */}
            <div className="space-y-2">
              {filteredClients
                .sort((a, b) => {
                  const order = { critical: 0, warning: 1, healthy: 2 };
                  return order[a.health] - order[b.health];
                })
                .map((client) => {
                  const isExpanded = expandedClients.has(client.clientId);
                  return (
                    <Card
                      key={client.clientId}
                      className={cn(
                        'transition-all',
                        client.health === 'critical' && 'border-red-200',
                        client.health === 'warning' && 'border-amber-200'
                      )}
                    >
                      {/* Client Header Row */}
                      <button
                        onClick={() => toggleClient(client.clientId)}
                        className="w-full flex items-center gap-4 p-4 text-left hover:bg-gray-50/50 transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-semibold text-sm">
                              {client.clientName}
                            </span>
                            {client.isTrial && (
                              <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[9px]">
                                TRIAL
                              </Badge>
                            )}
                          </div>
                          <ClientStatusCounts client={client} />
                        </div>

                        {/* Mini deliverable tags */}
                        <div className="hidden md:flex items-center gap-1.5">
                          {client.deliverables.map((d) => (
                            <span
                              key={d.deliverableId}
                              className={cn(
                                'text-[9px] font-bold px-1.5 py-0.5 rounded',
                                d.health === 'critical'
                                  ? 'bg-red-100 text-red-700'
                                  : d.health === 'warning'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-emerald-100 text-emerald-700'
                              )}
                            >
                              {SHORT_TYPE[d.type] || d.type.slice(0, 3)}{' '}
                              {d.doneCount}/{d.promised}
                            </span>
                          ))}
                        </div>

                        {/* Progress */}
                        <div className="flex items-center gap-3 w-48 shrink-0">
                          <ColorProgress
                            value={client.overallProgress}
                            health={client.health}
                          />
                          <span className="text-xs font-bold w-10 text-right">
                            {client.overallProgress}%
                          </span>
                        </div>

                        <HealthBadge health={client.health} />
                      </button>

                      {/* Expanded Detail */}
                      {isExpanded && (
                        <div className="px-4 pb-4 border-t bg-gray-50/50">
                          <div className="pt-4 space-y-3">
                            {client.deliverables.map((del) => (
                              <div
                                key={del.deliverableId}
                                className="bg-white rounded-lg border p-3"
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    {TYPE_ICONS[del.type] || (
                                      <Video className="h-3.5 w-3.5" />
                                    )}
                                    <span className="text-sm font-medium">
                                      {del.type}
                                    </span>
                                    {del.isTrial && (
                                      <Badge className="bg-amber-100 text-amber-700 text-[9px]">
                                        TRIAL
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold">
                                      {del.doneCount}/{del.promised}
                                    </span>
                                    {del.extraCount > 0 && (
                                      <span className="text-[10px] font-bold text-rose-700">
                                        +{del.extraDoneCount}/{del.extraCount} extra
                                      </span>
                                    )}
                                    <HealthBadge health={del.health} />
                                  </div>
                                </div>

                                <ColorProgress
                                  value={del.progressPercent}
                                  health={del.health}
                                />

                                {/* Status breakdown pills */}
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                  {del.statusCounts.pending > 0 && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                                      {del.statusCounts.pending} Pending
                                    </span>
                                  )}
                                  {del.statusCounts.inProgress > 0 && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-600">
                                      {del.statusCounts.inProgress} Editing
                                    </span>
                                  )}
                                  {del.statusCounts.readyForQc > 0 && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-600">
                                      {del.statusCounts.readyForQc} In QC
                                    </span>
                                  )}
                                  {del.statusCounts.clientReview > 0 && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-100 text-orange-600">
                                      {del.statusCounts.clientReview} Client Review
                                    </span>
                                  )}
                                  {del.statusCounts.completed > 0 && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-600">
                                      {del.statusCounts.completed} Done
                                    </span>
                                  )}
                                  {del.statusCounts.scheduled > 0 && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-100 text-sky-600">
                                      {del.statusCounts.scheduled} Scheduled
                                    </span>
                                  )}
                                  {del.statusCounts.posted > 0 && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                                      {del.statusCounts.posted} Posted
                                    </span>
                                  )}
                                  {del.statusCounts.onHold > 0 && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                                      {del.statusCounts.onHold} On Hold
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </Card>
                  );
                })}

              {filteredClients.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p className="font-medium">No clients match filters</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── Editors Tab ─── */}
        {activeTab === 'editors' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {data.editorPerformance
                .sort((a, b) => b.statusBreakdown.total - a.statusBreakdown.total)
                .map((editor) => (
                  <Card key={editor.id}>
                    <CardContent className="p-4 space-y-4">
                      {/* Editor header */}
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-bold">
                          {(editor.name || '?').charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{editor.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {editor.clientCount} clients •{' '}
                            {editor.avgTurnaroundDays}d avg turnaround
                          </p>
                        </div>
                      </div>

                      {/* Completion rate */}
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">
                            Completion Rate
                          </span>
                          <span className="font-bold">
                            {editor.completionRate}%
                          </span>
                        </div>
                        <Progress
                          value={editor.completionRate}
                          className="h-2"
                        />
                      </div>

                      {/* Status breakdown */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="text-center p-2 rounded-lg bg-gray-50">
                          <p className="text-lg font-bold">
                            {editor.statusBreakdown.total}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Total
                          </p>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-emerald-50">
                          <p className="text-lg font-bold text-emerald-700">
                            {editor.statusBreakdown.completed}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Done
                          </p>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-blue-50">
                          <p className="text-lg font-bold text-blue-700">
                            {editor.statusBreakdown.inProgress}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            In Progress
                          </p>
                        </div>
                      </div>

                      {/* Extra stats */}
                      <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-3">
                        <span>
                          {editor.statusBreakdown.readyForQc} in QC
                        </span>
                        <span>
                          {editor.statusBreakdown.pending} pending
                        </span>
                        <span>
                          {editor.statusBreakdown.onHold} on hold
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>

            {data.editorPerformance.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Film className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>No editor data for this month</p>
              </div>
            )}
          </div>
        )}

        {/* ─── QC Tab ─── */}
        {activeTab === 'qc' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {data.qcPerformance
                .sort((a, b) => b.totalReviewed - a.totalReviewed)
                .map((qc) => (
                  <Card key={qc.id}>
                    <CardContent className="p-4 space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
                          {(qc.name || '?').charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{qc.name}</p>
                          <p className="text-[11px] text-muted-foreground capitalize">
                            {qc.role}
                          </p>
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">
                            Pass Rate
                          </span>
                          <span className="font-bold">{qc.passRate}%</span>
                        </div>
                        <Progress value={qc.passRate} className="h-2" />
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="text-center p-2 rounded-lg bg-gray-50">
                          <p className="text-lg font-bold">
                            {qc.totalReviewed}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Reviewed
                          </p>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-emerald-50">
                          <p className="text-lg font-bold text-emerald-700">
                            {qc.passed}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Passed
                          </p>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-red-50">
                          <p className="text-lg font-bold text-red-700">
                            {qc.rejected}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Rejected
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>

            {data.qcPerformance.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Shield className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>No QC data for this month</p>
              </div>
            )}
          </div>
        )}

        {/* ─── Schedulers Tab ─── */}
        {activeTab === 'schedulers' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {data.schedulerPerformance
                .sort((a, b) => b.totalAssigned - a.totalAssigned)
                .map((sched) => (
                  <Card key={sched.id}>
                    <CardContent className="p-4 space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-sky-100 flex items-center justify-center text-sky-700 font-bold">
                          {(sched.name || '?').charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{sched.name}</p>
                          <p className="text-[11px] text-muted-foreground capitalize">
                            {sched.role}
                          </p>
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">
                            Post Rate
                          </span>
                          <span className="font-bold">{sched.postRate}%</span>
                        </div>
                        <Progress value={sched.postRate} className="h-2" />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="text-center p-2 rounded-lg bg-gray-50">
                          <p className="text-lg font-bold">
                            {sched.totalAssigned}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Assigned
                          </p>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-sky-50">
                          <p className="text-lg font-bold text-sky-700">
                            {sched.scheduled}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Scheduled
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-3">
                        <span>{sched.posted} posted</span>
                        <span>{sched.withLinks} with links</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>

            {data.schedulerPerformance.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Calendar className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>No scheduler data for this month</p>
              </div>
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
