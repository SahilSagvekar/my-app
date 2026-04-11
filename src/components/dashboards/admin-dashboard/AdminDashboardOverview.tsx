"use client";

import { Clock, DollarSign, FileText, Users } from "lucide-react";

import type { ComponentType } from "react";

import { RecentTasksCard } from "../../tasks/RecentTasksCard";
import { DashboardLoadingFallback } from "./DashboardLoadingFallback";
import { DashboardKpiGrid } from "./DashboardKpiGrid";
import { MonthlyDeliverablesCard } from "./MonthlyDeliverablesCard";
import { RecentActivityCard } from "./RecentActivityCard";
import type {
  ActivityData,
  ClientProgress,
  KpiCardConfig,
  KPIData,
} from "./types";

interface AdminDashboardOverviewProps {
  loading: boolean;
  kpiData: KPIData | null;
  clientProgress: ClientProgress[];
  recentActivity: ActivityData[];
  recentTasksReloadKey: number;
  JobManagementSection: ComponentType;
}

export function AdminDashboardOverview({
  loading,
  kpiData,
  clientProgress,
  recentActivity,
  recentTasksReloadKey,
  JobManagementSection,
}: AdminDashboardOverviewProps) {
  if (loading) {
    return <DashboardLoadingFallback componentName="Dashboard Overview" />;
  }

  const kpiCards: KpiCardConfig[] = [
    {
      title: "Total Revenue",
      value: kpiData?.totalRevenue.value ?? "$0",
      change: kpiData?.totalRevenue.change ?? "+0%",
      trend: kpiData?.totalRevenue.trend ?? "up",
      icon: DollarSign,
      colorClassName: "text-green-600",
    },
    {
      title: "Active Tasks",
      value: kpiData?.activeProjects.value ?? "0",
      change: kpiData?.activeProjects.change ?? "+0",
      trend: kpiData?.activeProjects.trend ?? "up",
      icon: FileText,
      colorClassName: "text-blue-600",
    },
    {
      title: "Team Members",
      value: kpiData?.teamMembers.value ?? "0",
      change: kpiData?.teamMembers.change ?? "+0",
      trend: kpiData?.teamMembers.trend ?? "up",
      icon: Users,
      colorClassName: "text-purple-600",
    },
    {
      title: "Avg. Completion",
      value: kpiData?.avgCompletion.value ?? "0 days",
      change: kpiData?.avgCompletion.change ?? "+0 days",
      trend: kpiData?.avgCompletion.trend ?? "up",
      icon: Clock,
      colorClassName: "text-orange-600",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <DashboardKpiGrid cards={kpiCards} />
      <MonthlyDeliverablesCard clientProgress={clientProgress} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RecentActivityCard recentActivity={recentActivity} />
        <RecentTasksCard
          title="Recently Assigned Tasks"
          showCreateButton={true}
          reloadKey={recentTasksReloadKey}
        />
      </div>

      <JobManagementSection />
    </div>
  );
}
