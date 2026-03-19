'use client';

import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
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
const AuditLogTab = safeDynamic(() => import('../admin/AuditLogTab').then(mod => ({ default: mod.AuditLogTab })), "Audit Log");
const FinanceTab = safeDynamic(() => import('../admin/FinanceTab').then(mod => ({ default: mod.FinanceTab })), "Finance");
const TaskManagementTab = safeDynamic(() => import('../admin/TaskManagementTab').then(mod => ({ default: mod.TaskManagementTab })), "Task Management");
const ClientManagement = safeDynamic(() => import('../management/ClientManagement').then(mod => ({ default: mod.ClientManagement })), "Client Management");
const ActivityLogReportTab = safeDynamic(() => import('../admin/ActivityLogReportTab').then(mod => ({ default: mod.ActivityLogReportTab })), "Activity Logs");
const PermissionsTab = safeDynamic(() => import('../admin/PermissionsTab').then(mod => ({ default: mod.PermissionsTab })), "Permissions");
const JobManagementSection = safeDynamic(() => import('../jobs/JobManagementSection').then(mod => ({ default: mod.JobManagementSection })), "Job Management");
const GuidelinesManagementTab = safeDynamic(() => import('../admin/GuidelinesManagementTab').then(mod => ({ default: mod.GuidelinesManagementTab })), "Guidelines Management");
const SalesManagementTab = safeDynamic(() => import('../admin/SalesManagementTab').then(mod => ({ default: mod.SalesManagementTab })), "Sales Management");
const VideographerManagementTab = safeDynamic(() => import('../admin/VideographerManagementTab').then(mod => ({ default: mod.VideographerManagementTab })), "Videographer Management");

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

    return (
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {kpiCards.map((kpi, index) => {
            const Icon = kpi.icon;
            return (
              <Card key={index}>
                <CardContent className="p-6 flex flex-col items-center justify-center text-center">
                  <Icon className={`h-8 w-8 mb-4 ${kpi.color}`} />
                  <p className="text-sm text-muted-foreground">{kpi.title}</p>
                  <h3 className="text-3xl font-bold mt-1">{kpi.value}</h3>
                  <p className={`text-xs mt-2 px-2 py-0.5 rounded-full bg-muted ${kpi.color}`}>
                    {kpi.change} from last month
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Pipeline Chart — full width */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Workflow Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pipelineData && pipelineData.length > 0 ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pipelineData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar
                      dataKey="projects"
                      fill="hsl(var(--primary))"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-80 flex items-center justify-center text-muted-foreground">
                No pipeline data available
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

        {/* System Status + Job Management — side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                System Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {systemStatus ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Server Status</span>
                    <Badge
                      variant="default"
                      className={systemStatus.serverStatus === 'Online' ? 'bg-green-500' : 'bg-red-500'}
                    >
                      {systemStatus.serverStatus}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm">Database</span>
                    <Badge
                      variant="default"
                      className={systemStatus.databaseStatus === 'Healthy' ? 'bg-green-500' : 'bg-red-500'}
                    >
                      {systemStatus.databaseStatus}
                    </Badge>
                  </div>

                  {systemStatus.databaseResponseTime && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm">DB Response Time</span>
                      <span className="text-sm font-medium">{systemStatus.databaseResponseTime}</span>
                    </div>
                  )}

                  {systemStatus.databaseSize && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Database Size</span>
                      <span className="text-sm font-medium">{systemStatus.databaseSize}</span>
                    </div>
                  )}

                  {systemStatus.apiResponseTime && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm">API Response Time</span>
                      <span className="text-sm font-medium">{systemStatus.apiResponseTime}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between group cursor-help relative">
                    <span className="text-sm">Active Users</span>
                    <span className="text-sm font-medium">{systemStatus.activeUsers}</span>

                    {systemStatus.activeUserList && systemStatus.activeUserList.length > 0 && (
                      <div className="absolute hidden group-hover:block right-0 top-full mt-2 w-64 p-3 bg-popover border rounded-lg shadow-lg z-50">
                        <p className="text-xs font-semibold mb-2">Currently Active:</p>
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {systemStatus.activeUserList.map((user: any, idx: number) => (
                            <div key={idx} className="text-xs flex items-center justify-between py-1">
                              <span className="truncate">{user.name || 'Unknown'}</span>
                              <Badge variant="outline" className="text-xs ml-2">
                                {user.role}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {systemStatus.serverUptime && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Server Uptime</span>
                      <span className="text-sm font-medium">{systemStatus.serverUptime}</span>
                    </div>
                  )}

                  {systemStatus.memoryUsage && (
                    <div className="border-t pt-3 mt-3">
                      <p className="text-xs text-muted-foreground mb-2">Memory Usage</p>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Heap Used</span>
                          <span>{systemStatus.memoryUsage.heapUsed} MB</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Heap Total</span>
                          <span>{systemStatus.memoryUsage.heapTotal} MB</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {systemStatus.statistics && (
                    <div className="border-t pt-3 mt-3">
                      <p className="text-xs text-muted-foreground mb-2">Database Records</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Tasks</span>
                          <span className="font-medium">{systemStatus.statistics.totalTasks}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Users</span>
                          <span className="font-medium">{systemStatus.statistics.totalUsers}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Clients</span>
                          <span className="font-medium">{systemStatus.statistics.totalClients}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Logs</span>
                          <span className="font-medium">{systemStatus.statistics.totalAuditLogs}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Loading system status...</p>
              )}
            </CardContent>
          </Card>

          <JobManagementSection />
        </div>
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
          onClick={() => onPageChange?.('finance')}
          className="gap-2 cursor-pointer"
        >
          <DollarSign className="h-4 w-4" />
          Financials & Payouts
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
          onClick={() => onPageChange?.('activity_logs')}
          className="gap-2 cursor-pointer"
        >
          <FileText className="h-4 w-4" />
          Daily Activity Reports
        </DropdownMenuItem>

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

        <DropdownMenuItem
          onClick={() => onPageChange?.('audit')}
          className="gap-2 cursor-pointer"
        >
          <ShieldCheck className="h-4 w-4" />
          System Audit Log
        </DropdownMenuItem>
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
      <div className="flex items-center gap-3">
        {children}
        <ManagementDropdown />
        <QuickAddClientDialog
          onClientCreated={() => {
            // Optionally refresh data or navigate
            console.log('Client created from admin dashboard');
          }}
          trigger={
            <Button variant="outline" className="shadow-sm">
              <Users className="h-4 w-4 mr-2" />
              Add Client
            </Button>
          }
        />
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

      case 'audit':
        return (
          <div className="space-y-6">
            <AdminPageHeader
              title="System Audit Log"
              description="Complete audit trail of all admin actions and system events"
            />
            <AuditLogTab />
          </div>
        );

      case 'activity_logs':
        return (
          <div className="space-y-6">
            <AdminPageHeader
              title="Activity Reports"
              description="Access and download daily employee activity reports (generated at 7 PM EST)"
            />
            <ActivityLogReportTab />
          </div>
        );

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