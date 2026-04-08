import type { LucideIcon } from "lucide-react";

export interface KPIData {
  totalRevenue: {
    value: string;
    change: string;
    trend: "up" | "down";
  };
  activeProjects: {
    value: string;
    change: string;
    trend: "up" | "down";
  };
  teamMembers: {
    value: string;
    change: string;
    trend: "up" | "down";
  };
  avgCompletion: {
    value: string;
    change: string;
    trend: "up" | "down";
  };
}

export interface ActivityData {
  id: number;
  type: string;
  message: string;
  time: string;
  status: "success" | "error" | "warning" | "info";
  user?: string;
}

export interface ClientDeliverableProgress {
  id: string;
  type: string;
  quantity: number;
  platforms: string[];
  completedTasks: number;
  totalTasks: number;
  progress: number;
}

export interface ClientProgress {
  clientId: string;
  clientName: string;
  deliverables: ClientDeliverableProgress[];
  totalExpected: number;
  totalCompleted: number;
  overallProgress: number;
}

export interface DashboardOverviewResponse {
  ok: boolean;
  kpi?: KPIData;
  recentActivity?: ActivityData[];
  clientDeliverablesProgress?: ClientProgress[];
  message?: string;
}

export interface KpiCardConfig {
  title: string;
  value: string;
  change: string;
  trend: "up" | "down";
  icon: LucideIcon;
  colorClassName: string;
}
