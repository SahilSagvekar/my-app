// import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
// import { Badge } from "../ui/badge";
// import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
// import { Progress } from "../ui/progress";
// import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
// import {
//   TrendingUp,
//   TrendingDown,
//   AlertTriangle,
//   CheckCircle,
//   Clock,
//   Users,
//   Plus,
//   Settings,
//   FileText,
//   Calendar,
// } from "lucide-react";
// import { CreateTaskDialog } from "../tasks/CreateTaskDialog";
// import { RecentTasksCard } from "../tasks/RecentTasksCard";
// import { ClientManagement } from "../management/ClientManagement";
// import { DeliverablesOverview } from "../management/DeliverablesOverview";
// import { Button } from "../ui/button";

// const projectHealthData = [
//   {
//     status: "On Track",
//     count: 15,
//     percentage: 65,
//     color: "text-green-600",
//     bgColor: "bg-green-100",
//     icon: CheckCircle,
//     projects: [
//       { id: "P-001", name: "Brand Refresh", progress: 85 },
//       { id: "P-002", name: "Social Campaign", progress: 72 },
//       { id: "P-003", name: "Website Redesign", progress: 91 },
//     ],
//   },
//   {
//     status: "At Risk",
//     count: 6,
//     percentage: 25,
//     color: "text-yellow-600",
//     bgColor: "bg-yellow-100",
//     icon: AlertTriangle,
//     projects: [
//       { id: "P-004", name: "Video Production", progress: 45 },
//       { id: "P-005", name: "Print Materials", progress: 38 },
//     ],
//   },
//   {
//     status: "Critical",
//     count: 2,
//     percentage: 10,
//     color: "text-red-600",
//     bgColor: "bg-red-100",
//     icon: Clock,
//     projects: [{ id: "P-006", name: "Holiday Campaign", progress: 25 }],
//   },
// ];

// const teamWorkload = [
//   {
//     name: "Sarah Wilson",
//     role: "Senior Designer",
//     avatar: "SW",
//     workload: 95,
//     projects: 4,
//     status: "overloaded",
//   },
//   {
//     name: "Mike Johnson",
//     role: "Video Editor",
//     avatar: "MJ",
//     workload: 78,
//     projects: 3,
//     status: "optimal",
//   },
//   {
//     name: "Lisa Davis",
//     role: "Motion Designer",
//     avatar: "LD",
//     workload: 85,
//     projects: 3,
//     status: "optimal",
//   },
//   {
//     name: "Tom Brown",
//     role: "Web Designer",
//     avatar: "TB",
//     workload: 45,
//     projects: 2,
//     status: "underutilized",
//   },
//   {
//     name: "Emma White",
//     role: "Graphic Designer",
//     avatar: "EW",
//     workload: 92,
//     projects: 5,
//     status: "overloaded",
//   },
//   {
//     name: "Alex Chen",
//     role: "UX Designer",
//     avatar: "AC",
//     workload: 68,
//     projects: 2,
//     status: "optimal",
//   },
// ];

// const performanceMetrics = [
//   {
//     title: "Project Completion Rate",
//     value: "87%",
//     change: "+5%",
//     trend: "up",
//   },
//   {
//     title: "Average Project Duration",
//     value: "8.3 days",
//     change: "-1.2 days",
//     trend: "up",
//   },
//   {
//     title: "Client Satisfaction",
//     value: "4.6/5.0",
//     change: "+0.2",
//     trend: "up",
//   },
//   {
//     title: "Team Efficiency",
//     value: "92%",
//     change: "-3%",
//     trend: "down",
//   },
// ];

// function WorkloadHeatmap() {
//   return (
//     <div className="space-y-4">
//       {teamWorkload.map((member) => (
//         <div
//           key={member.name}
//           className="flex items-center gap-4 p-3 rounded-lg border"
//         >
//           <Avatar className="h-10 w-10">
//             <AvatarImage src="" />
//             <AvatarFallback>{member.avatar}</AvatarFallback>
//           </Avatar>

//           <div className="flex-1 min-w-0">
//             <div className="flex items-center justify-between mb-1">
//               <h4 className="text-sm font-medium">{member.name}</h4>
//               <Badge
//                 variant={
//                   member.status === "overloaded"
//                     ? "destructive"
//                     : member.status === "underutilized"
//                     ? "secondary"
//                     : "default"
//                 }
//                 className="text-xs"
//               >
//                 {member.workload}%
//               </Badge>
//             </div>
//             <p className="text-xs text-muted-foreground mb-2">{member.role}</p>
//             <div className="flex items-center gap-2">
//               <Progress value={member.workload} className="flex-1" />
//               <span className="text-xs text-muted-foreground">
//                 {member.projects} projects
//               </span>
//             </div>
//           </div>
//         </div>
//       ))}
//     </div>
//   );
// }

// interface ManagerDashboardProps {
//   currentPage?: string;
// }

// export function ManagerDashboard({
//   currentPage = "dashboard",
// }: ManagerDashboardProps) {
//   const handleTaskCreated = (task: any) => {
//     console.log("New task created:", task);
//     // In a real app, this would update the task list, refresh workload data, etc.
//   };

//   const TeamOverview = () => (
//     <div className="space-y-6">
//       {/* Performance Metrics */}
//       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
//         {performanceMetrics.map((metric, index) => (
//           <Card key={index}>
//             <CardContent className="p-6">
//               <div className="space-y-2">
//                 <p className="text-sm text-muted-foreground">{metric.title}</p>
//                 <h3>{metric.value}</h3>
//                 <div className="flex items-center gap-2">
//                   {metric.trend === "up" ? (
//                     <TrendingUp className="h-4 w-4 text-green-600" />
//                   ) : (
//                     <TrendingDown className="h-4 w-4 text-red-600" />
//                   )}
//                   <span
//                     className={`text-sm ${
//                       metric.trend === "up" ? "text-green-600" : "text-red-600"
//                     }`}
//                   >
//                     {metric.change} from last month
//                   </span>
//                 </div>
//               </div>
//             </CardContent>
//           </Card>
//         ))}
//       </div>

//       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
//         {/* Project Health */}
//         <Card>
//           <CardHeader>
//             <CardTitle>Project Health Overview</CardTitle>
//           </CardHeader>
//           <CardContent>
//             <div className="space-y-6">
//               {projectHealthData.map((health) => {
//                 const Icon = health.icon;
//                 return (
//                   <div key={health.status} className="space-y-3">
//                     <div className="flex items-center justify-between">
//                       <div className="flex items-center gap-3">
//                         <div className={`p-2 rounded-lg ${health.bgColor}`}>
//                           <Icon className={`h-5 w-5 ${health.color}`} />
//                         </div>
//                         <div>
//                           <h4 className="font-medium">{health.status}</h4>
//                           <p className="text-sm text-muted-foreground">
//                             {health.count} projects ({health.percentage}%)
//                           </p>
//                         </div>
//                       </div>
//                       <Badge variant="secondary">{health.count}</Badge>
//                     </div>

//                     <div className="ml-14 space-y-2">
//                       {health.projects.map((project) => (
//                         <div
//                           key={project.id}
//                           className="flex items-center justify-between text-sm"
//                         >
//                           <span>{project.name}</span>
//                           <div className="flex items-center gap-2">
//                             <Progress
//                               value={project.progress}
//                               className="w-16"
//                             />
//                             <span className="text-xs text-muted-foreground w-8">
//                               {project.progress}%
//                             </span>
//                           </div>
//                         </div>
//                       ))}
//                     </div>
//                   </div>
//                 );
//               })}
//             </div>
//           </CardContent>
//         </Card>

//         {/* Team Workload */}
//         <Card>
//           <CardHeader>
//             <CardTitle className="flex items-center gap-2">
//               <Users className="h-5 w-5" />
//               Team Workload Heatmap
//             </CardTitle>
//           </CardHeader>
//           <CardContent>
//             <WorkloadHeatmap />
//           </CardContent>
//         </Card>
//       </div>

//       {/* Recent Tasks */}
//       <RecentTasksCard
//         title="Recent Task Assignments"
//         showCreateButton={true}
//       />
//     </div>
//   );

//   return (
//     <div className="space-y-6">
//       {/* Page Header */}
//       <div className="flex items-center justify-between">
//         <div>
//           <h1>Manager Portal</h1>
//           <p className="text-muted-foreground mt-2">
//             Monitor team performance, manage content assignments, and track
//             deliverables
//           </p>
//         </div>
//         <div className="flex items-center gap-3">
//           <CreateTaskDialog
//             onTaskCreated={handleTaskCreated}
//             trigger={
//               <Button>
//                 <Plus className="h-4 w-4 mr-2" />
//                 Assign Task
//               </Button>
//             }
//           />
//         </div>
//       </div>

//       {/* Main Content Tabs */}
//       <Tabs
//         defaultValue={
//           currentPage === "clients"
//             ? "clients"
//             : currentPage === "team"
//             ? "team"
//             : "team"
//         }
//         className="space-y-6"
//       >
//         <TabsList className="grid w-full grid-cols-3">
//           <TabsTrigger value="team" className="flex items-center gap-2">
//             <Users className="h-4 w-4" />
//             Team Overview
//           </TabsTrigger>
//           <TabsTrigger value="clients" className="flex items-center gap-2">
//             <FileText className="h-4 w-4" />
//             Client Management
//           </TabsTrigger>
//           <TabsTrigger value="deliverables" className="flex items-center gap-2">
//             <Calendar className="h-4 w-4" />
//             Deliverables
//           </TabsTrigger>
//         </TabsList>

//         <TabsContent value="team">
//           <TeamOverview />
//         </TabsContent>

//         <TabsContent value="clients">
//           <ClientManagement />
//         </TabsContent>

//         <TabsContent value="deliverables">
//           <DeliverablesOverview />
//         </TabsContent>
//       </Tabs>
//     </div>
//   );
// }


// components/manager/ManagerDashboard.tsx
'use client';

import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Progress } from "../ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  Users,
  Plus,
  Settings,
  FileText,
  Calendar,
  Loader,
} from "lucide-react";
import { CreateTaskDialog } from "../tasks/CreateTaskDialog";
import { RecentTasksCard } from "../tasks/RecentTasksCard";
import { Button } from "../ui/button";
import { useEffect, useState } from "react";

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

const ClientManagement = safeDynamic(() => import('../management/ClientManagement').then(mod => ({ default: mod.ClientManagement })), "Client Management");
const DeliverablesOverview = safeDynamic(() => import('../management/DeliverablesOverview').then(mod => ({ default: mod.DeliverablesOverview })), "Deliverables");

// ============================================
// LOADING FALLBACK COMPONENT WITH LOGGING
// ============================================
function DashboardLoadingFallback({ componentName = "Component" }) {
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

const projectHealthData = [
  {
    status: "On Track",
    count: 15,
    percentage: 65,
    color: "text-green-600",
    bgColor: "bg-green-100",
    icon: CheckCircle,
    projects: [
      { id: "P-001", name: "Brand Refresh", progress: 85 },
      { id: "P-002", name: "Social Campaign", progress: 72 },
      { id: "P-003", name: "Website Redesign", progress: 91 },
    ],
  },
  {
    status: "At Risk",
    count: 6,
    percentage: 25,
    color: "text-yellow-600",
    bgColor: "bg-yellow-100",
    icon: AlertTriangle,
    projects: [
      { id: "P-004", name: "Video Production", progress: 45 },
      { id: "P-005", name: "Print Materials", progress: 38 },
    ],
  },
  {
    status: "Critical",
    count: 2,
    percentage: 10,
    color: "text-red-600",
    bgColor: "bg-red-100",
    icon: Clock,
    projects: [{ id: "P-006", name: "Holiday Campaign", progress: 25 }],
  },
];

const teamWorkload = [
  {
    name: "Sarah Wilson",
    role: "Senior Designer",
    avatar: "SW",
    workload: 95,
    projects: 4,
    status: "overloaded",
  },
  {
    name: "Mike Johnson",
    role: "Video Editor",
    avatar: "MJ",
    workload: 78,
    projects: 3,
    status: "optimal",
  },
  {
    name: "Lisa Davis",
    role: "Motion Designer",
    avatar: "LD",
    workload: 85,
    projects: 3,
    status: "optimal",
  },
  {
    name: "Tom Brown",
    role: "Web Designer",
    avatar: "TB",
    workload: 45,
    projects: 2,
    status: "underutilized",
  },
  {
    name: "Emma White",
    role: "Graphic Designer",
    avatar: "EW",
    workload: 92,
    projects: 5,
    status: "overloaded",
  },
  {
    name: "Alex Chen",
    role: "UX Designer",
    avatar: "AC",
    workload: 68,
    projects: 2,
    status: "optimal",
  },
];

const performanceMetrics = [
  {
    title: "Project Completion Rate",
    value: "87%",
    change: "+5%",
    trend: "up",
  },
  {
    title: "Average Project Duration",
    value: "8.3 days",
    change: "-1.2 days",
    trend: "up",
  },
  {
    title: "Client Satisfaction",
    value: "4.6/5.0",
    change: "+0.2",
    trend: "up",
  },
  {
    title: "Team Efficiency",
    value: "92%",
    change: "-3%",
    trend: "down",
  },
];

function WorkloadHeatmap() {
  return (
    <div className="space-y-4">
      {teamWorkload.map((member) => (
        <div
          key={member.name}
          className="flex items-center gap-4 p-3 rounded-lg border"
        >
          <Avatar className="h-10 w-10">
            <AvatarFallback>{member.avatar}</AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-sm font-medium">{member.name}</h4>
              <Badge
                variant={
                  member.status === "overloaded"
                    ? "destructive"
                    : member.status === "underutilized"
                      ? "secondary"
                      : "default"
                }
                className="text-xs"
              >
                {member.workload}%
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-2">{member.role}</p>
            <div className="flex items-center gap-2">
              <Progress value={member.workload} className="flex-1" />
              <span className="text-xs text-muted-foreground">
                {member.projects} projects
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

interface ManagerDashboardProps {
  currentPage?: string;
}

export function ManagerDashboard({
  currentPage = "dashboard",
}: ManagerDashboardProps) {
  useEffect(() => {
    console.log(`📄 [MANAGER DASHBOARD] Mounted - Current Page: ${currentPage}`);
    return () => {
      console.log(`📄 [MANAGER DASHBOARD] Unmounted`);
    };
  }, [currentPage]);

  const handleTaskCreated = (task: any) => {
    console.log("📝 [MANAGER] New task created:", task);
  };

  const TeamOverview = () => {
    useEffect(() => {
      console.log('📊 [MANAGER] Team Overview component mounted');
      return () => console.log('📊 [MANAGER] Team Overview component unmounted');
    }, []);

    return (
      <div className="space-y-6">
        {/* Performance Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {performanceMetrics.map((metric, index) => (
            <Card key={index}>
              <CardContent className="p-6">
                <div className="flex flex-col items-center text-center gap-2">
                  <p className="text-sm text-muted-foreground">{metric.title}</p>
                  <h3 className="text-3xl font-bold">{metric.value}</h3>
                  <div className="flex items-center gap-2 mt-1 px-2 py-0.5 rounded-full bg-muted">
                    {metric.trend === "up" ? (
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-600" />
                    )}
                    <span
                      className={`text-xs font-medium ${metric.trend === "up" ? "text-green-600" : "text-red-600"
                        }`}
                    >
                      {metric.change}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Project Health */}
          <Card>
            <CardHeader>
              <CardTitle>Project Health Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {projectHealthData.map((health) => {
                  const Icon = health.icon;
                  return (
                    <div key={health.status} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${health.bgColor}`}>
                            <Icon className={`h-5 w-5 ${health.color}`} />
                          </div>
                          <div>
                            <h4 className="font-medium">{health.status}</h4>
                            <p className="text-sm text-muted-foreground">
                              {health.count} projects ({health.percentage}%)
                            </p>
                          </div>
                        </div>
                        <Badge variant="secondary">{health.count}</Badge>
                      </div>

                      <div className="ml-14 space-y-2">
                        {health.projects.map((project) => (
                          <div
                            key={project.id}
                            className="flex items-center justify-between text-sm"
                          >
                            <span>{project.name}</span>
                            <div className="flex items-center gap-2">
                              <Progress
                                value={project.progress}
                                className="w-16"
                              />
                              <span className="text-xs text-muted-foreground w-8">
                                {project.progress}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Team Workload */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Team Workload Heatmap
              </CardTitle>
            </CardHeader>
            <CardContent>
              <WorkloadHeatmap />
            </CardContent>
          </Card>
        </div>

        {/* Recent Tasks */}
        <RecentTasksCard
          title="Recent Task Assignments"
          showCreateButton={true}
        />
      </div>
    );
  };

  const renderPageContent = () => {
    switch (currentPage) {
      case 'dashboard':
      case 'team':
        console.log('📑 [MANAGER] Switching to Team Overview tab');
        return <TeamOverview />;

      case 'clients':
        console.log('📑 [MANAGER] Switching to Clients tab');
        return <ClientManagement />;

      case 'deliverables':
        console.log('📑 [MANAGER] Switching to Deliverables tab');
        return <DeliverablesOverview />;

      default:
        return <TeamOverview />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-gray-200">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Manager Portal</h1>
          <p className="text-muted-foreground mt-1 text-lg">
            Monitor team performance, manage content assignments, and track deliverables
          </p>
        </div>
        <div className="flex items-center gap-3">
          <CreateTaskDialog
            onTaskCreated={handleTaskCreated}
            trigger={
              <Button className="shadow-sm">
                <Plus className="h-4 w-4 mr-2" />
                Assign Task
              </Button>
            }
          />
        </div>
      </div>

      {/* Main Content Tabs */}
      <Tabs
        defaultValue={
          currentPage === "clients"
            ? "clients"
            : currentPage === "deliverables"
              ? "deliverables"
              : "team"
        }
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="team" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Team Overview
          </TabsTrigger>
          <TabsTrigger value="clients" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Client Management
          </TabsTrigger>
          <TabsTrigger value="deliverables" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Deliverables
          </TabsTrigger>
        </TabsList>

        <TabsContent value="team">
          <TeamOverview />
        </TabsContent>

        <TabsContent value="clients">
          <ClientManagement />
        </TabsContent>

        <TabsContent value="deliverables">
          <DeliverablesOverview />
        </TabsContent>
      </Tabs>
    </div>
  );
}