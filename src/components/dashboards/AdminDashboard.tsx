// components/admin/AdminDashboard.tsx
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { TrendingUp, Users, FileText, Clock, DollarSign, Plus, RefreshCw } from 'lucide-react';
import { CreateTaskDialog } from '../tasks/CreateTaskDialog';
import { RecentTasksCard } from '../tasks/RecentTasksCard';
import { AnalyticsTab } from '../admin/AnalyticsTab';
import { UserManagementTab } from '../admin/UserManagementTab';
import LeavesComponent from '../admin/LeavesComponent';
import { ReportsTab } from '../admin/ReportsTab';
import { AuditLogTab } from '../admin/AuditLogTab';
import { FinanceTab } from '../admin/FinanceTab';
import { ClientManagement } from '../management/ClientManagement';
import { Button } from '../ui/button';
import { useEffect, useState } from "react";

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
}

export function AdminDashboard({ currentPage = 'dashboard' }: AdminDashboardProps) {
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
    loadDashboardData(); // Refresh dashboard data
  };

  useEffect(() => {
    loadTasks();
    if (currentPage === 'dashboard') {
      loadDashboardData();
    }
  }, [currentPage]);

  async function loadTasks() {
    try {
      const res = await fetch("/api/tasks");
      const data = await res.json();

      // Take the latest 10 tasks
      const sorted = (data.tasks || [])
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10);

      setRecentTasks(sorted);
    } catch (err) {
      console.error("Failed to fetch tasks:", err);
    }
  }

  async function loadDashboardData() {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/dashboard/overview");
      const data = await res.json();

      if (data.ok) {
        setKpiData(data.kpi);
        setPipelineData(data.pipeline);
        setProjectHealthData(data.projectHealth);
        setRecentActivity(data.recentActivity);
        setSystemStatus(data.systemStatus);
      } else {
        console.error("Failed to fetch dashboard data:", data.message);
      }
    } catch (err) {
      console.error("Failed to fetch dashboard:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadDashboardData();
    await loadTasks();
    setRefreshing(false);
  }

  // Main dashboard overview content
  const DashboardOverview = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading dashboard data...</p>
          </div>
        </div>
      );
    }

    // Provide fallback values if data is not loaded
    const kpiCards = [
      {
        title: 'Total Revenue',
        value: kpiData?.totalRevenue?.value || '₹0',
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
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{kpi.title}</p>
                      <h3 className="text-2xl font-bold mt-2">{kpi.value}</h3>
                      <p className={`text-sm mt-1 ${kpi.color}`}>
                        {kpi.change} from last month
                      </p>
                    </div>
                    <Icon className={`h-8 w-8 ${kpi.color}`} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pipeline Chart */}
          <Card className="col-span-1 lg:col-span-2">
            <CardHeader>
              <CardTitle>Project Pipeline</CardTitle>
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
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Project Health */}
          <Card>
            <CardHeader>
              <CardTitle>Project Health</CardTitle>
            </CardHeader>
            <CardContent>
              {projectHealthData && projectHealthData.length > 0 ? (
                <>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={projectHealthData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={80}
                          dataKey="value"
                          label
                        >
                          {projectHealthData.map((entry, index) => (
                            <Cell key={index} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2 mt-4">
                    {projectHealthData.map((item, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: item.color }}
                          />
                          <span>{item.name}</span>
                        </div>
                        <span className="font-medium">
                          {item.value}% ({item.count})
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="h-48 flex items-center justify-center text-muted-foreground">
                  No project health data
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="col-span-1 lg:col-span-2">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
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
                        className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                          activity.status === "success"
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
        </div>

        {/* Recent Tasks */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RecentTasksCard
            title="Recently Assigned Tasks"
            tasks={recentTasks}
            showCreateButton={true}
          />

          <Card>
            <CardHeader>
              <CardTitle>System Status</CardTitle>
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
        </div>
      </div>
    );
  };

  // Render the appropriate content based on currentPage
  const renderPageContent = () => {
    switch (currentPage) {
      case 'dashboard':
        return (
          <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Admin Portal</h1>
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
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Admin Portal</h1>
                <p className="text-muted-foreground mt-2">
                  Social media performance analytics across all clients and platforms
                </p>
              </div>
            </div>
            <AnalyticsTab />
          </div>
        );

      case 'clients':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Admin Portal</h1>
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
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Admin Portal</h1>
                <p className="text-muted-foreground mt-2">
                  Manage team members, roles, permissions, and employee information
                </p>
              </div>
            </div>
            <UserManagementTab />
          </div>
        );

      case 'reports':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Admin Portal</h1>
                <p className="text-muted-foreground mt-2">
                  Daily output reports and team performance analytics
                </p>
              </div>
            </div>
            <ReportsTab />
          </div>
        );

      case 'audit':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Admin Portal</h1>
                <p className="text-muted-foreground mt-2">
                  Complete audit trail of all admin actions and system events
                </p>
              </div>
            </div>
            <AuditLogTab />
          </div>
        );

      case 'finance':
        return <FinanceTab />;

      case 'leaves':
        return <LeavesComponent />;

      default:
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Admin Portal</h1>
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