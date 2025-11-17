import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Users, FileText, Clock, DollarSign, Plus } from 'lucide-react';
import { CreateTaskDialog } from '../tasks/CreateTaskDialog';
import { RecentTasksCard } from '../tasks/RecentTasksCard';
import { AnalyticsTab } from '../admin/AnalyticsTab';
import { UserManagementTab } from '../admin/UserManagementTab';
import { ReportsTab } from '../admin/ReportsTab';
import { AuditLogTab } from '../admin/AuditLogTab';
import { FinanceTab } from '../admin/FinanceTab';
import { ClientManagement } from '../management/ClientManagement';
import { Button } from '../ui/button';
import { useEffect, useState } from "react";

const kpiData = [
  {
    title: 'Total Revenue',
    value: '$124,563',
    change: '+12.5%',
    trend: 'up',
    icon: DollarSign,
    color: 'text-green-600'
  },
  {
    title: 'Active Projects',
    value: '23',
    change: '+3',
    trend: 'up',
    icon: FileText,
    color: 'text-blue-600'
  },
  {
    title: 'Team Members',
    value: '47',
    change: '+2',
    trend: 'up',
    icon: Users,
    color: 'text-purple-600'
  },
  {
    title: 'Avg. Completion',
    value: '4.2 days',
    change: '-0.3 days',
    trend: 'up',
    icon: Clock,
    color: 'text-orange-600'
  }
];

const pipelineData = [
  { name: 'Planning', projects: 8, revenue: 45000 },
  { name: 'In Progress', projects: 12, revenue: 67000 },
  { name: 'QC Review', projects: 6, revenue: 28000 },
  { name: 'Client Review', projects: 4, revenue: 35000 },
  { name: 'Completed', projects: 15, revenue: 89000 }
];

const projectHealthData = [
  { name: 'On Track', value: 65, color: '#22c55e' },
  { name: 'At Risk', value: 25, color: '#f59e0b' },
  { name: 'Critical', value: 10, color: '#ef4444' }
];

const recentActivity = [
  {
    id: 1,
    type: 'project_completed',
    message: 'Video Campaign #VID-2024-003 completed by Sarah Wilson',
    time: '2 minutes ago',
    status: 'success'
  },
  {
    id: 2,
    type: 'qc_rejected',
    message: 'Social Media Asset #SM-2024-089 rejected in QC review',
    time: '15 minutes ago',
    status: 'error'
  },
  {
    id: 3,
    type: 'client_approved',
    message: 'Brand Guidelines #BG-2024-012 approved by Acme Corp',
    time: '32 minutes ago',
    status: 'success'
  },
  {
    id: 4,
    type: 'new_project',
    message: 'New project "Holiday Campaign 2024" assigned to Team Alpha',
    time: '1 hour ago',
    status: 'info'
  },
  {
    id: 5,
    type: 'deadline_approaching',
    message: 'Website Redesign #WEB-2024-005 due in 2 days',
    time: '2 hours ago',
    status: 'warning'
  }
];

interface AdminDashboardProps {
  currentPage?: string;
}



export function AdminDashboard({ currentPage = 'dashboard' }: AdminDashboardProps) {
  
  const [tasks, setTasks] = useState([]);

  const handleTaskCreated = (task: any) => {
    console.log('New task created:', task);
    // In a real app, this would update the task list or refresh data
  };

 const [recentTasks, setRecentTasks] = useState([]);

useEffect(() => {
  loadTasks();
}, []);

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

  

  // Main dashboard overview content
  const DashboardOverview = () => (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpiData.map((kpi, index) => {
          const Icon = kpi.icon;
          return (
            <Card key={index}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{kpi.title}</p>
                    <h3 className="mt-2">{kpi.value}</h3>
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
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pipelineData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Bar
                    dataKey="projects"
                    fill="hsl(var(--primary))"
                    radius={4}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
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
                  >
                    {projectHealthData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
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
                  <span className="font-medium">{item.value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 pb-3 border-b last:border-b-0"
                >
                  <div
                    className={`w-2 h-2 rounded-full mt-2 ${
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
                    </p>
                  </div>
                </div>
              ))}
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
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Server Status</span>
                <Badge variant="default" className="bg-green-500">
                  Online
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Database</span>
                <Badge variant="default" className="bg-green-500">
                  Healthy
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">API Response Time</span>
                <span className="text-sm">125ms</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Active Users</span>
                <span className="text-sm">34</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  // Render the appropriate content based on currentPage
  const renderPageContent = () => {
     const completed = 0;
  const total =  0;
    switch (currentPage) {
      case 'dashboard':
        return (
          <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1>Admin Portal</h1>
                <p className="text-muted-foreground mt-2">
                  Overview of system performance, recent activity, and key metrics
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
            <DashboardOverview />
          </div>
        );

      case 'analytics':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1>Admin Portal</h1>
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
                <h1>Admin Portal</h1>
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
                <h1>Admin Portal</h1>
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
                <h1>Admin Portal</h1>
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
                <h1>Admin Portal</h1>
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

      default:
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1>Admin Portal</h1>
                <p className="text-muted-foreground mt-2">
                  Overview of system performance, recent activity, and key metrics
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
            <DashboardOverview />
          </div>
        );
    }
  };

  return renderPageContent();
}