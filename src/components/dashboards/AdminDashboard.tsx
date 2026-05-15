'use client';

import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { useEffect, useState } from "react";
import {
  TrendingUp,
  Users,
  FileText,
  Clock,
  DollarSign,
  Plus,
  RefreshCw,
  Loader,
  ChevronDown,
  ShieldCheck,
  LayoutDashboard,
  Settings as SettingsIcon,
  BarChart3,
  BookOpen,
  TrendingUp as SalesIcon,
  Camera,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  FolderSearch,
} from 'lucide-react';

import { CreateTaskDialog } from '../tasks/CreateTaskDialog';
import { RecentTasksCard } from '../tasks/RecentTasksCard';
import { QuickAddClientDialog } from '../client/QuickAddClientDialog';

// ============================================
// ROBUST DYNAMIC IMPORT WRAPPER
// ============================================
const safeDynamic = (importFn: () => Promise<any>, componentName: string) => {
  return dynamic(
    () => importFn().catch((error) => {
      console.error(`❌ [DYNAMIC IMPORT ERROR] ${componentName}:`, error);

      // Check if it's a chunk load error
      if (error.name === 'ChunkLoadError' ||
        error.message?.includes('Loading chunk') ||
        error.message?.includes('Failed to fetch dynamically imported module')) {

        console.warn(`🔄 Attempting to recover from ChunkLoadError for ${componentName}...`);

        // Prevents infinite reload loops
        const lastReload = sessionStorage.getItem('last_chunk_error_reload');
        const now = Date.now();

        if (!lastReload || now - parseInt(lastReload) > 10000) { // 10 second cooldown
          sessionStorage.setItem('last_chunk_error_reload', now.toString());
          window.location.reload();
          return new Promise(() => { }); // Stop execution
        }
      }
      throw error;
    }),
    {
      loading: () => <DashboardLoadingFallback componentName={componentName} />,
      ssr: false,
    }
  );
};

const AnalyticsTab = safeDynamic(() => import('../admin/AnalyticsTab').then(mod => ({ default: mod.AnalyticsTab })), "Analytics");
const UserManagementTab = safeDynamic(() => import('../admin/UserManagementTab').then(mod => ({ default: mod.UserManagementTab })), "User Management");
const LeavesComponent = safeDynamic(() => import('../admin/LeavesComponent'), "Leaves");
const ReportsTab = safeDynamic(() => import('../admin/ReportsTab').then(mod => ({ default: mod.ReportsTab })), "Reports");
// const AuditLogTab = safeDynamic(() => import('../admin/AuditLogTab').then(mod => ({ default: mod.AuditLogTab })), "Audit Log");
const FinanceTab = safeDynamic(() => import('../admin/FinanceTab').then(mod => ({ default: mod.FinanceTab })), "Finance");
const TaskManagementTab = safeDynamic(() => import('../admin/TaskManagementTab').then(mod => ({ default: mod.TaskManagementTab })), "Task Management");
const ClientManagement = safeDynamic(() => import('../management/ClientManagement').then(mod => ({ default: mod.ClientManagement })), "Client Management");
// const ActivityLogReportTab = safeDynamic(() => import('../admin/ActivityLogReportTab').then(mod => ({ default: mod.ActivityLogReportTab })), "Activity Logs");
const PermissionsTab = safeDynamic(() => import('../admin/PermissionsTab').then(mod => ({ default: mod.PermissionsTab })), "Permissions");
const JobManagementSection = safeDynamic(() => import('../jobs/JobManagementSection').then(mod => ({ default: mod.JobManagementSection })), "Job Management");
const GuidelinesManagementTab = safeDynamic(() => import('../admin/GuidelinesManagementTab').then(mod => ({ default: mod.GuidelinesManagementTab })), "Guidelines Management");
const SalesManagementTab = safeDynamic(() => import('../admin/SalesManagementTab').then(mod => ({ default: mod.SalesManagementTab })), "Sales Management");
const VideographerManagementTab = safeDynamic(() => import('../admin/VideographerManagementTab').then(mod => ({ default: mod.VideographerManagementTab })), "Videographer Management");
const MonthlyDeliverablesTab = safeDynamic(() => import('../admin/MonthlyDeliverablesTab').then(mod => ({ default: mod.MonthlyDeliverablesTab })), "Monthly Deliverables");
const BillingDashboard = safeDynamic(() => import('../billing/BillingDashboard').then(mod => ({ default: mod.BillingDashboard })), "Billing");
const FolderRepairTool = safeDynamic(() => import('../admin/Folderrepairtool').then(mod => ({ default: mod.FolderRepairTool })), "Folder Repair");

// ============================================
// LOADING FALLBACK COMPONENT WITH LOGGING
// ============================================
function DashboardLoadingFallback({ componentName = "Dashboard" }) {
  useEffect(() => {
    console.log(`⏳ [LAZY LOADING] ${componentName} is loading...`);
    return () => {
      console.log(`✅ [LAZY LOADING] ${componentName} loaded successfully`);
    };
  }, [componentName]);

  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center space-y-4">
        <Loader className="h-12 w-12 animate-spin mx-auto text-muted-foreground" />
        <p className="text-muted-foreground">Loading {componentName}...</p>
      </div>
    </div>
  );
}

interface KPIData {
  totalRevenue: {
    value: string;
    change: string;
    trend: 'up' | 'down';
  };
  activeProjects: {
    value: string;
    change: string;
    trend: 'up' | 'down';
  };
  teamMembers: {
    value: string;
    change: string;
    trend: 'up' | 'down';
  };
  avgCompletion: {
    value: string;
    change: string;
    trend: 'up' | 'down';
  };
}

interface PipelineData {
  name: string;
  projects: number;
  revenue: number;
}

interface ProjectHealthData {
  name: string;
  value: number;
  count: number;
  color: string;
}

interface ActivityData {
  id: number;
  type: string;
  message: string;
  time: string;
  status: 'success' | 'error' | 'warning' | 'info';
  user?: string;
}

interface SystemStatusData {
  serverStatus: string;
  databaseStatus: string;
  databaseResponseTime: string;
  databaseSize: string;
  activeUsers: number;
  activeUserList?: Array<{
    name: string;
    role: string;
    lastActive: Date;
  }>;
  apiResponseTime: string;
  serverUptime: string;
  memoryUsage: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
  statistics: {
    totalTasks: number;
    totalUsers: number;
    totalClients: number;
    totalAuditLogs: number;
  };
}

interface AdminDashboardProps {
  currentPage?: string;
  onPageChange?: (page: string) => void;
}

export function AdminDashboard({ currentPage = 'dashboard', onPageChange }: AdminDashboardProps) {
  const [tasks, setTasks] = useState([]);
  const [recentTasks, setRecentTasks] = useState([]);

  // Dashboard data states
  const [kpiData, setKpiData] = useState<KPIData | null>(null);
  const [pipelineData, setPipelineData] = useState<PipelineData[]>([]);
  const [projectHealthData, setProjectHealthData] = useState<ProjectHealthData[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityData[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clientProgress, setClientProgress] = useState<any[]>([]);
  const [carouselIndex, setCarouselIndex] = useState(0);

  const handleTaskCreated = (task: any) => {
    console.log('New task created:', task);
    loadTasks();
    loadDashboardData();
  };

  useEffect(() => {
    console.log(`📄 [ADMIN DASHBOARD] Mounted - Current Page: ${currentPage}`);
    loadTasks();
    if (currentPage === 'dashboard') {
      loadDashboardData();
    }
    return () => {
      console.log(`📄 [ADMIN DASHBOARD] Unmounted`);
    };
  }, [currentPage]);

  async function loadTasks() {
    try {
      console.log('🔄 [ADMIN] Fetching tasks...');
      const res = await fetch("/api/tasks", { cache: "no-store" });
      const data = await res.json();

      const sorted = (data.tasks || [])
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10);

      setRecentTasks(sorted);
      console.log(`✅ [ADMIN] Tasks loaded: ${sorted.length} tasks`);
    } catch (err) {
      console.error("❌ [ADMIN] Failed to fetch tasks:", err);
    }
  }

  async function loadDashboardData() {
    try {
      console.log('🔄 [ADMIN] Fetching dashboard overview...');
      setLoading(true);
      const res = await fetch("/api/admin/dashboard/overview", { cache: "no-store" });
      const data = await res.json();

      if (data.ok) {
        setKpiData(data.kpi);
        setPipelineData(data.pipeline);
        setProjectHealthData(data.projectHealth);
        setRecentActivity(data.recentActivity);
        setSystemStatus(data.systemStatus);
        setClientProgress(data.clientDeliverablesProgress || []);
        console.log('✅ [ADMIN] Dashboard data loaded successfully');
      } else {
        console.error("❌ [ADMIN] Failed to fetch dashboard data:", data.message);
      }
    } catch (err) {
      console.error("❌ [ADMIN] Failed to fetch dashboard:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    console.log('🔄 [ADMIN] Refreshing dashboard...');
    setRefreshing(true);
    await loadDashboardData();
    await loadTasks();
    setRefreshing(false);
    console.log('✅ [ADMIN] Dashboard refreshed');
  }

  // Main dashboard overview content
  const DashboardOverview = () => {
    if (loading) {
      return <DashboardLoadingFallback componentName="Dashboard Overview" />;
    }

    const kpiCards = [
      {
        title: 'Total Revenue',
        value: kpiData?.totalRevenue?.value || '$0',
        change: kpiData?.totalRevenue?.change || '+0%',
        trend: kpiData?.totalRevenue?.trend || 'up',
        icon: DollarSign,
        color: 'text-green-600'
      },
      {
        title: 'Active Tasks',
        value: kpiData?.activeProjects?.value || '0',
        change: kpiData?.activeProjects?.change || '+0',
        trend: kpiData?.activeProjects?.trend || 'up',
        icon: FileText,
        color: 'text-blue-600'
      },
      {
        title: 'Team Members',
        value: kpiData?.teamMembers?.value || '0',
        change: kpiData?.teamMembers?.change || '+0',
        trend: kpiData?.teamMembers?.trend || 'up',
        icon: Users,
        color: 'text-purple-600'
      },
      {
        title: 'Avg. Completion',
        value: kpiData?.avgCompletion?.value || '0 days',
        change: kpiData?.avgCompletion?.change || '+0 days',
        trend: kpiData?.avgCompletion?.trend || 'up',
        icon: Clock,
        color: 'text-orange-600'
      }
    ];

    const [revenueVisible, setRevenueVisible] = useState(false);

    return (
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 items-stretch">
          {kpiCards.map((kpi, index) => {
            const Icon = kpi.icon;
            const isRevenue = kpi.title === 'Total Revenue';
            return (
              <Card key={index} className="flex flex-col">
                <CardContent className="p-3 sm:p-5 flex flex-1 flex-row items-center justify-center gap-3">
                  {/* Icon — left side */}
                  <div className="flex-shrink-0 rounded-lg p-2 bg-muted">
                    <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${kpi.color}`} />
                  </div>
                  {/* Data — centered within its block */}
                  <div className="flex flex-col items-center text-center">
                    <div className="flex items-center justify-center gap-1">
                      <h3 className="text-base sm:text-lg font-bold whitespace-nowrap">
                        {isRevenue ? (revenueVisible ? kpi.value : '••••••') : kpi.value}
                      </h3>
                      {isRevenue && (
                        <button
                          onClick={() => setRevenueVisible(v => !v)}
                          className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors p-0.5"
                          aria-label={revenueVisible ? 'Hide revenue' : 'Show revenue'}
                        >
                          {revenueVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight whitespace-nowrap">{kpi.title}</p>
                    <span className={`inline-block text-[9px] sm:text-xs mt-1 px-2 py-0.5 rounded-full bg-muted whitespace-nowrap ${kpi.color}`}>
                      {kpi.change} vs last month
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Client Deliverables Progress Carousel — full width */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Monthly Deliverables Progress
            </CardTitle>
            {clientProgress.length > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-700">
                  {carouselIndex + 1} / {clientProgress.length}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 sm:h-8 sm:w-8"
                  onClick={() => setCarouselIndex((prev) => (prev - 1 + clientProgress.length) % clientProgress.length)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 sm:h-8 sm:w-8"
                  onClick={() => setCarouselIndex((prev) => (prev + 1) % clientProgress.length)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {clientProgress.length > 0 ? (() => {
              const client = clientProgress[carouselIndex];
              if (!client) return null;
              return (
                <div className="space-y-4">
                  {/* Client Header */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">{client.clientName}</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        {client.totalCompleted} of {client.totalExpected} completed
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className={`text-xl sm:text-2xl font-bold ${client.overallProgress >= 100 ? 'text-emerald-600' : 'text-gray-900'}`}>
                        {client.overallProgress}%
                      </div>
                      <p className="text-xs text-muted-foreground">Overall</p>
                    </div>
                  </div>

                  {/* Overall progress bar */}
                  <Progress
                    value={client.overallProgress}
                    className="h-2"
                    indicatorColor={client.overallProgress >= 100 ? '#10b981' : '#3b82f6'}
                  />

                  {/* Individual deliverables */}
                  <div className="space-y-2">
                    {client.deliverables.map((d: any) => {
                      const progress = Math.min(d.progress, 100);
                      const isComplete = progress >= 100;
                      return (
                        <div key={d.id} className="p-3 rounded-lg border bg-gray-50/50">
                          {/* Top: type + count left, badges right — stacks on very small screens */}
                          <div className="flex flex-wrap items-center justify-between gap-1 mb-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-medium text-sm text-gray-900 truncate">{d.type}</span>
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                ({d.completedTasks}/{d.quantity || d.totalTasks})
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-1">
                              {(d.platforms || []).slice(0, 2).map((p: string) => (
                                <Badge key={p} variant="outline" className="text-[10px] h-5 px-1.5">
                                  {p}
                                </Badge>
                              ))}
                              {(d.platforms || []).length > 2 && (
                                <span className="text-[10px] text-muted-foreground">+{d.platforms.length - 2}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Progress
                              value={progress}
                              className="h-1.5 flex-1"
                              indicatorColor={isComplete ? '#10b981' : '#3b82f6'}
                            />
                            <span className={`text-xs font-medium w-9 text-right whitespace-nowrap ${isComplete ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                              {progress}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Dots indicator */}
                  {clientProgress.length > 1 && (
                    <div className="flex items-center justify-center gap-1.5 pt-2">
                      {clientProgress.map((_: any, i: number) => (
                        <button
                          key={i}
                          onClick={() => setCarouselIndex(i)}
                          className={`h-1.5 rounded-full transition-all ${
                            i === carouselIndex ? 'w-6 bg-primary' : 'w-1.5 bg-gray-300 hover:bg-gray-400'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })() : (
              <div className="h-48 flex items-center justify-center text-muted-foreground">
                No active client deliverables this month
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity + Recent Tasks — side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivity && recentActivity.length > 0 ? (
                  recentActivity.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-start gap-3 pb-3 border-b last:border-b-0"
                    >
                      <div
                        className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${activity.status === "success"
                          ? "bg-green-500"
                          : activity.status === "error"
                            ? "bg-red-500"
                            : activity.status === "warning"
                              ? "bg-yellow-500"
                              : "bg-blue-500"
                          }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">{activity.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {activity.time}
                          {activity.user && ` • ${activity.user}`}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No recent activity
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recently Assigned Tasks */}
          <RecentTasksCard
            title="Recently Assigned Tasks"
            showCreateButton={true}
          />
        </div>

        {/* Job Management — full width */}
        <JobManagementSection />
      </div>
    );
  };

  // Management Dropdown Component
  const ManagementDropdown = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          Manage <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuItem
          onClick={() => onPageChange?.('dashboard')}
          className="gap-2 cursor-pointer"
        >
          <LayoutDashboard className="h-4 w-4" />
          Dashboard Overview
        </DropdownMenuItem>

        <div className="h-px bg-muted my-1" />
        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Core Management
        </div>

        <DropdownMenuItem
          onClick={() => onPageChange?.('clients')}
          className="gap-2 cursor-pointer"
        >
          <Users className="h-4 w-4" />
          Client Management
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => onPageChange?.('users')}
          className="gap-2 cursor-pointer"
        >
          <Users className="h-4 w-4" />
          User Management
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => onPageChange?.('reports')}
          className="gap-2 cursor-pointer"
        >
          <FileText className="h-4 w-4" />
          Task Managementh
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => onPageChange?.('sales-management')}
          className="gap-2 cursor-pointer"
        >
          <SalesIcon className="h-4 w-4 text-yellow-500" />
          Sales Management
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => onPageChange?.('videographer-management')}
          className="gap-2 cursor-pointer"
        >
          <Camera className="h-4 w-4 text-orange-500" />
          Videographer Management
        </DropdownMenuItem>

        <div className="h-px bg-muted my-1" />
        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Operations & Finance
        </div>

        <DropdownMenuItem
          onClick={() => onPageChange?.('monthly-deliverables')}
          className="gap-2 cursor-pointer"
        >
          <BarChart3 className="h-4 w-4 text-blue-500" />
          Monthly Deliverables
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => onPageChange?.('finance')}
          className="gap-2 cursor-pointer"
        >
          <DollarSign className="h-4 w-4" />
          Financials & Payouts
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => onPageChange?.('billing')}
          className="gap-2 cursor-pointer"
        >
          <FileText className="h-4 w-4 text-green-500" />
          Client Billing
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => onPageChange?.('analytics')}
          className="gap-2 cursor-pointer"
        >
          <BarChart3 className="h-4 w-4" />
          Client Analytics
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => onPageChange?.('leaves')}
          className="gap-2 cursor-pointer"
        >
          <Clock className="h-4 w-4" />
          Leave Management
        </DropdownMenuItem>

        <div className="h-px bg-muted my-1" />
        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          System & Compliance
        </div>

        <DropdownMenuItem
          onClick={() => onPageChange?.('repair-folders')}
          className="gap-2 cursor-pointer"
        >
          <FolderSearch className="h-4 w-4 text-amber-500" />
          Repair R2 Folders
        </DropdownMenuItem>

        {/* <DropdownMenuItem
          onClick={() => onPageChange?.('activity_logs')}
          className="gap-2 cursor-pointer"
        >
          <FileText className="h-4 w-4" />
          Daily Activity Reports
        </DropdownMenuItem> */}

        <DropdownMenuItem
          onClick={() => onPageChange?.('guidelines')}
          className="gap-2 cursor-pointer"
        >
          <BookOpen className="h-4 w-4" />
          Company Guidelines
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => onPageChange?.('permissions')}
          className="gap-2 cursor-pointer"
        >
          <SettingsIcon className="h-4 w-4" />
          Role Permissions
        </DropdownMenuItem>

        {/* <DropdownMenuItem
          onClick={() => onPageChange?.('audit')}
          className="gap-2 cursor-pointer"
        >
          <ShieldCheck className="h-4 w-4" />
          System Audit Log
        </DropdownMenuItem> */}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  // Helper for consistent page headers
  const AdminPageHeader = ({ title, description, children }: { title: string; description: string; children?: React.ReactNode }) => (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-gray-200">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">{title}</h1>
        <p className="text-muted-foreground mt-1 text-lg">
          {description}
        </p>
      </div>
      <div className="flex items-center w-full md:w-auto gap-3">
        {children}
        <div className="flex items-center gap-3 ml-auto md:ml-0">
          <ManagementDropdown />
          <CreateTaskDialog
            onTaskCreated={handleTaskCreated}
            trigger={
              <Button className="shadow-sm">
                <Plus className="h-4 w-4 mr-2" />
                Create Task
              </Button>
            }
          />
        </div>
      </div>
    </div>
  );

  // Render the appropriate content based on currentPage
  const renderPageContent = () => {
    switch (currentPage) {
      case 'dashboard':
        return (
          <div className="space-y-6">
            <AdminPageHeader
              title="Admin Dashboard"
              description="Overview of system performance, recent activity, and key metrics"
            >
              <Button
                variant="outline"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </AdminPageHeader>
            <DashboardOverview />
          </div>
        );

      case 'analytics':
        return (
          <div className="space-y-6">
            <AdminPageHeader
              title="Client Analytics"
              description="Social media performance analytics across all clients and platforms"
            />
            <AnalyticsTab />
          </div>
        );

      case 'clients':
        return (
          <div className="space-y-6">
            <AdminPageHeader
              title="Client Management"
              description="Manage client accounts, brand assets, guidelines, and team assignments"
            />
            <ClientManagement />
          </div>
        );

      case 'users':
        return (
          <div className="space-y-6">
            <AdminPageHeader
              title="User Management"
              description="Manage team members, roles, permissions, and employee information"
            />
            <UserManagementTab />
          </div>
        );

      case 'reports':
        return (
          <div className="space-y-6">
            <AdminPageHeader
              title="Task Management"
              description="Manage all tasks, assignments, and track team workload"
            />
            <TaskManagementTab />
          </div>
        );

      // case 'audit':
      //   return (
      //     <div className="space-y-6">
      //       <AdminPageHeader
      //         title="System Audit Log"
      //         description="Complete audit trail of all admin actions and system events"
      //       />
      //       <AuditLogTab />
      //     </div>
      //   );

      // case 'activity_logs':
      //   return (
      //     <div className="space-y-6">
      //       <AdminPageHeader
      //         title="Activity Reports"
      //         description="Access and download daily employee activity reports (generated at 7 PM EST)"
      //       />
      //       <ActivityLogReportTab />
      //     </div>
      //   );

      case 'finance':
        return (
          <div className="space-y-6">
            <AdminPageHeader
              title="Financial Overview"
              description="Manage client billing, editor payouts, and system-wide financial overview"
            />
            <FinanceTab />
          </div>
        );

      case 'permissions':
        return (
          <div className="space-y-6">
            <AdminPageHeader
              title="Role Permissions"
              description="Configure sidebar visibility and role-based access for all team members"
            />
            <PermissionsTab />
          </div>
        );

      case 'leaves':
        return (
          <div className="space-y-6">
            <AdminPageHeader
              title="User Management"
              description="Manage employee leaves, assignments, and team availability"
            />
            <LeavesComponent />
          </div>
        );

      case 'guidelines':
        return (
          <div className="space-y-6">
            <AdminPageHeader
              title="Company Guidelines"
              description="Manage rules, standards, and client-specific instructions for the team"
            />
            <GuidelinesManagementTab />
          </div>
        );

      case 'sales-management':
        return (
          <div className="space-y-6">
            <AdminPageHeader
              title="Sales Management"
              description="View and monitor all lead activity across the entire sales team"
            />
            <SalesManagementTab />
          </div>
        );

      case 'videographer-management':
        return (
          <div className="space-y-6">
            <AdminPageHeader
              title="Videographer Management"
              description="Post jobs for bidding or directly assign videographers to tasks"
            />
            <VideographerManagementTab />
          </div>
        );

      case 'monthly-deliverables':
        return (
          <div className="space-y-6">
            <AdminPageHeader
              title="Monthly Deliverables"
              description="Track deliverable completion across clients and employee productivity over time"
            />
            <MonthlyDeliverablesTab />
          </div>
        );

      case 'billing':
        return (
          <div className="space-y-6">
            <AdminPageHeader
              title="Client Billing"
              description="Manage invoices, subscriptions, and payment tracking"
            />
            <BillingDashboard />
          </div>
        );

      case 'repair-folders':
        return <FolderRepairTool />;

      default:
        console.log('📑 [ADMIN] Falling back to dashboard');
        return (
          <div className="space-y-6">
            <AdminPageHeader
              title="Admin Dashboard"
              description="Overview of system performance, recent activity, and key metrics"
            />
            <DashboardOverview />
          </div>
        );
    }
  };

  return renderPageContent();
}