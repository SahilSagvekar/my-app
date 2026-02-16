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
} from 'lucide-react';

import { CreateTaskDialog } from '../tasks/CreateTaskDialog';
import { RecentTasksCard } from '../tasks/RecentTasksCard';

// ============================================
// LAZY LOAD SUB-COMPONENTS
// ============================================
const AnalyticsTab = dynamic(() => import('../admin/AnalyticsTab').then(mod => ({ default: mod.AnalyticsTab })), {
  loading: () => <DashboardLoadingFallback componentName="Analytics" />,
  ssr: false,
});

const UserManagementTab = dynamic(() => import('../admin/UserManagementTab').then(mod => ({ default: mod.UserManagementTab })), {
  loading: () => <DashboardLoadingFallback componentName="User Management" />,
  ssr: false,
});

const LeavesComponent = dynamic(() => import('../admin/LeavesComponent'), {
  loading: () => <DashboardLoadingFallback componentName="Leaves" />,
  ssr: false,
});

const ReportsTab = dynamic(() => import('../admin/ReportsTab').then(mod => ({ default: mod.ReportsTab })), {
  loading: () => <DashboardLoadingFallback componentName="Reports" />,
  ssr: false,
});

const AuditLogTab = dynamic(() => import('../admin/AuditLogTab').then(mod => ({ default: mod.AuditLogTab })), {
  loading: () => <DashboardLoadingFallback componentName="Audit Log" />,
  ssr: false,
});

const FinanceTab = dynamic(() => import('../admin/FinanceTab').then(mod => ({ default: mod.FinanceTab })), {
  loading: () => <DashboardLoadingFallback componentName="Finance" />,
  ssr: false,
});

const TaskManagementTab = dynamic(() => import('../admin/TaskManagementTab').then(mod => ({ default: mod.TaskManagementTab })), {
  loading: () => <DashboardLoadingFallback componentName="Task Management" />,
  ssr: false,
});

const ClientManagement = dynamic(() => import('../management/ClientManagement').then(mod => ({ default: mod.ClientManagement })), {
  loading: () => <DashboardLoadingFallback componentName="Client Management" />,
  ssr: false,
});

const ActivityLogReportTab = dynamic(() => import('../admin/ActivityLogReportTab').then(mod => ({ default: mod.ActivityLogReportTab })), {
  loading: () => <DashboardLoadingFallback componentName="Activity Logs" />,
  ssr: false,
});

const PermissionsTab = dynamic(() => import('../admin/PermissionsTab').then(mod => ({ default: mod.PermissionsTab })), {
  loading: () => <DashboardLoadingFallback componentName="Permissions" />,
  ssr: false,
});

const JobManagementSection = dynamic(() => import('../jobs/JobManagementSection').then(mod => ({ default: mod.JobManagementSection })), {
  loading: () => <DashboardLoadingFallback componentName="Job Management" />,
  ssr: false,
});

const GuidelinesManagementTab = dynamic(() => import('../admin/GuidelinesManagementTab').then(mod => ({ default: mod.GuidelinesManagementTab })), {
  loading: () => <DashboardLoadingFallback componentName="Guidelines Management" />,
  ssr: false,
});

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
      const res = await fetch("/api/tasks");
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
      const res = await fetch("/api/admin/dashboard/overview");
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
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem
          onClick={() => onPageChange?.('dashboard')}
          className="gap-2 cursor-pointer"
        >
          <LayoutDashboard className="h-4 w-4" />
          Dashboard
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onPageChange?.('users')}
          className="gap-2 cursor-pointer"
        >
          <Users className="h-4 w-4" />
          Users
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onPageChange?.('permissions')}
          className="gap-2 cursor-pointer"
        >
          <SettingsIcon className="h-4 w-4" />
          Permissions
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onPageChange?.('activity_logs')}
          className="gap-2 cursor-pointer"
        >
          <FileText className="h-4 w-4" />
          Activity Reports
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onPageChange?.('guidelines')}
          className="gap-2 cursor-pointer"
        >
          <BookOpen className="h-4 w-4" />
          Guidelines
        </DropdownMenuItem>
        {/* <DropdownMenuItem
          onClick={() => onPageChange?.('leaves')}
          className="gap-2 cursor-pointer"
        >
          <Users className="h-4 w-4" />
          User Management (Leaves)
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onPageChange?.('finance')}
          className="gap-2 cursor-pointer"
        >
          <DollarSign className="h-4 w-4" />
          Financials
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onPageChange?.('audit')}
          className="gap-2 cursor-pointer"
        >
          <ShieldCheck className="h-4 w-4" />
          Audit Log
        </DropdownMenuItem> */}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  // Render the appropriate content based on currentPage
  const renderPageContent = () => {
    switch (currentPage) {
      case 'dashboard':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Dashboard</h1>
                <p className="text-muted-foreground mt-2">
                  Overview of system performance, recent activity, and key metrics
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={handleRefresh}
                  disabled={refreshing}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>

                <ManagementDropdown />
                <CreateTaskDialog
                  onTaskCreated={handleTaskCreated}
                  trigger={
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Task
                    </Button>
                  }
                />
              </div>
            </div>
            <DashboardOverview />
          </div>
        );

      case 'analytics':
        console.log('📑 [ADMIN] Switching to Analytics tab');
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Client Analytics</h1>
                <p className="text-muted-foreground mt-2">
                  Social media performance analytics across all clients and platforms
                </p>
              </div>
            </div>
            <AnalyticsTab />
          </div>
        );

      case 'clients':
        console.log('📑 [ADMIN] Switching to Clients tab');
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Clients</h1>
                <p className="text-muted-foreground mt-2">
                  Manage client accounts, brand assets, guidelines, and team assignments
                </p>
              </div>
              <div className="flex items-center gap-3">
                <CreateTaskDialog
                  onTaskCreated={handleTaskCreated}
                  trigger={
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Task
                    </Button>
                  }
                />
              </div>
            </div>
            <ClientManagement />
          </div>
        );

      case 'users':
        console.log('📑 [ADMIN] Switching to Users tab');
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Users</h1>
                <p className="text-muted-foreground mt-2">
                  Manage team members, roles, permissions, and employee information
                </p>
              </div>
            </div>
            <UserManagementTab />
          </div>
        );

      case 'reports':
        console.log('📑 [ADMIN] Switching to Reports tab');
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Task Management</h1>
                <p className="text-muted-foreground mt-2">
                  Manage all tasks, assignments, and track team workload
                </p>
              </div>
            </div>
            <TaskManagementTab />
          </div>
        );

      case 'audit':
        console.log('📑 [ADMIN] Switching to Audit tab');
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Audit Log</h1>
                <p className="text-muted-foreground mt-2">
                  Complete audit trail of all admin actions and system events
                </p>
              </div>
            </div>
            <AuditLogTab />
          </div>
        );

      case 'activity_logs':
        console.log('📑 [ADMIN] Switching to Activity Logs tab');
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Activity Reports</h1>
                <p className="text-muted-foreground mt-2">
                  Access and download daily employee activity reports (generated at 7 PM EST)
                </p>
              </div>
            </div>
            <ActivityLogReportTab />
          </div>
        );

      case 'finance':
        console.log('📑 [ADMIN] Switching to Finance tab');
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Financials</h1>
                <p className="text-muted-foreground mt-2">
                  Manage client billing, editor payouts, and system-wide financial overview
                </p>
              </div>
            </div>
            <FinanceTab />
          </div>
        );

      case 'permissions':
        console.log('📑 [ADMIN] Switching to Permissions tab');
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Permissions</h1>
                <p className="text-muted-foreground mt-2">
                  Configure sidebar visibility and role-based access for all team members
                </p>
              </div>
            </div>
            <PermissionsTab />
          </div>
        );

      case 'leaves':
        console.log('📑 [ADMIN] Switching to Leaves tab');
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">User Management</h1>
                <p className="text-muted-foreground mt-2">
                  Manage employee leaves, assignments, and team availability
                </p>
              </div>
            </div>
            <LeavesComponent />
          </div>
        );

      case 'guidelines':
        console.log('📑 [ADMIN] Switching to Guidelines tab');
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Guidelines</h1>
                <p className="text-muted-foreground mt-2">
                  Manage rules, standards, and client-specific instructions for the team
                </p>
              </div>
            </div>
            <GuidelinesManagementTab />
          </div>
        );

      default:
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Dashboard</h1>
                <p className="text-muted-foreground mt-2">
                  Overview of system performance, recent activity, and key metrics
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={handleRefresh}
                  disabled={refreshing}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>

                <ManagementDropdown />
                <CreateTaskDialog
                  onTaskCreated={handleTaskCreated}
                  trigger={
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Task
                    </Button>
                  }
                />
              </div>
            </div>
            <DashboardOverview />
          </div>
        );
    }
  };

  return renderPageContent();
}