'use client';

import type { ComponentType } from 'react';

import dynamic from 'next/dynamic';
import { RefreshCw } from 'lucide-react';

import { AdminDashboardHeader } from './admin-dashboard/AdminDashboardHeader';
import { AdminDashboardOverview } from './admin-dashboard/AdminDashboardOverview';
import { DashboardLoadingFallback } from './admin-dashboard/DashboardLoadingFallback';
import { useAdminDashboardOverview } from './admin-dashboard/useAdminDashboardOverview';
import { Button } from '../ui/button';

interface AdminDashboardProps {
  currentPage?: string;
  onPageChange?: (page: string) => void;
}

interface AdminPageConfig {
  title: string;
  description: string;
  Component: ComponentType;
}

function isChunkLoadError(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === 'ChunkLoadError' ||
      error.message.includes('Loading chunk') ||
      error.message.includes('Failed to fetch dynamically imported module'))
  );
}

const safeDynamic = (
  importFn: () => Promise<{ default: ComponentType }>,
  componentName: string,
) =>
  dynamic(
    async () => {
      try {
        return await importFn();
      } catch (error) {
        console.error(`[DYNAMIC IMPORT ERROR] ${componentName}:`, error);

        if (isChunkLoadError(error)) {
          const lastReload = sessionStorage.getItem('last_chunk_error_reload');
          const now = Date.now();

          if (!lastReload || now - Number.parseInt(lastReload, 10) > 10000) {
            sessionStorage.setItem('last_chunk_error_reload', now.toString());
            window.location.reload();
            return new Promise<never>(() => {});
          }
        }

        throw error;
      }
    },
    {
      loading: () => <DashboardLoadingFallback componentName={componentName} />,
      ssr: false,
    },
  );

const AnalyticsTab = safeDynamic(
  () =>
    import('../admin/AnalyticsTab').then((mod) => ({
      default: mod.AnalyticsTab,
    })),
  'Analytics',
);
const UserManagementTab = safeDynamic(
  () =>
    import('../admin/UserManagementTab').then((mod) => ({
      default: mod.UserManagementTab,
    })),
  'User Management',
);
const LeavesComponent = safeDynamic(() => import('../admin/LeavesComponent'), 'Leaves');
const AuditLogTab = safeDynamic(
  () =>
    import('../admin/AuditLogTab').then((mod) => ({
      default: mod.AuditLogTab,
    })),
  'Audit Log',
);
const FinanceTab = safeDynamic(
  () =>
    import('../admin/FinanceTab').then((mod) => ({
      default: mod.FinanceTab,
    })),
  'Finance',
);
const TaskManagementTab = safeDynamic(
  () =>
    import('../admin/TaskManagementTab').then((mod) => ({
      default: mod.TaskManagementTab,
    })),
  'Task Management',
);
const ClientManagement = safeDynamic(
  () =>
    import('../management/ClientManagement').then((mod) => ({
      default: mod.ClientManagement,
    })),
  'Client Management',
);
const ActivityLogReportTab = safeDynamic(
  () =>
    import('../admin/ActivityLogReportTab').then((mod) => ({
      default: mod.ActivityLogReportTab,
    })),
  'Activity Logs',
);
const PermissionsTab = safeDynamic(
  () =>
    import('../admin/PermissionsTab').then((mod) => ({
      default: mod.PermissionsTab,
    })),
  'Permissions',
);
const JobManagementSection = safeDynamic(
  () =>
    import('../jobs/JobManagementSection').then((mod) => ({
      default: mod.JobManagementSection,
    })),
  'Job Management',
);
const GuidelinesManagementTab = safeDynamic(
  () =>
    import('../admin/GuidelinesManagementTab').then((mod) => ({
      default: mod.GuidelinesManagementTab,
    })),
  'Guidelines Management',
);
const SalesManagementTab = safeDynamic(
  () =>
    import('../admin/SalesManagementTab').then((mod) => ({
      default: mod.SalesManagementTab,
    })),
  'Sales Management',
);
const VideographerManagementTab = safeDynamic(
  () =>
    import('../admin/VideographerManagementTab').then((mod) => ({
      default: mod.VideographerManagementTab,
    })),
  'Videographer Management',
);
const MonthlyDeliverablesTab = safeDynamic(
  () =>
    import('../admin/MonthlyDeliverablesTab').then((mod) => ({
      default: mod.MonthlyDeliverablesTab,
    })),
  'Monthly Deliverables',
);
const BillingDashboard = safeDynamic(
  () =>
    import('../billing/BillingDashboard').then((mod) => ({
      default: mod.BillingDashboard,
    })),
  'Billing',
);

const ADMIN_PAGE_CONFIGS: Record<string, AdminPageConfig> = {
  analytics: {
    title: 'Client Analytics',
    description: 'Social media performance analytics across all clients and platforms',
    Component: AnalyticsTab,
  },
  clients: {
    title: 'Client Management',
    description: 'Manage client accounts, brand assets, guidelines, and team assignments',
    Component: ClientManagement,
  },
  users: {
    title: 'User Management',
    description: 'Manage team members, roles, permissions, and employee information',
    Component: UserManagementTab,
  },
  reports: {
    title: 'Task Management',
    description: 'Manage all tasks, assignments, and track team workload',
    Component: TaskManagementTab,
  },
  audit: {
    title: 'System Audit Log',
    description: 'Complete audit trail of all admin actions and system events',
    Component: AuditLogTab,
  },
  activity_logs: {
    title: 'Activity Reports',
    description: 'Access and download daily employee activity reports (generated at 7 PM EST)',
    Component: ActivityLogReportTab,
  },
  finance: {
    title: 'Financial Overview',
    description: 'Manage client billing, editor payouts, and system-wide financial overview',
    Component: FinanceTab,
  },
  permissions: {
    title: 'Role Permissions',
    description: 'Configure sidebar visibility and role-based access for all team members',
    Component: PermissionsTab,
  },
  leaves: {
    title: 'User Management',
    description: 'Manage employee leaves, assignments, and team availability',
    Component: LeavesComponent,
  },
  guidelines: {
    title: 'Company Guidelines',
    description: 'Manage rules, standards, and client-specific instructions for the team',
    Component: GuidelinesManagementTab,
  },
  'sales-management': {
    title: 'Sales Management',
    description: 'View and monitor all lead activity across the entire sales team',
    Component: SalesManagementTab,
  },
  'videographer-management': {
    title: 'Videographer Management',
    description: 'Post jobs for bidding or directly assign videographers to tasks',
    Component: VideographerManagementTab,
  },
  'monthly-deliverables': {
    title: 'Monthly Deliverables',
    description: 'Track deliverable completion across clients and employee productivity over time',
    Component: MonthlyDeliverablesTab,
  },
  billing: {
    title: 'Client Billing',
    description: 'Manage invoices, subscriptions, and payment tracking',
    Component: BillingDashboard,
  },
};

export function AdminDashboard({
  currentPage = 'dashboard',
  onPageChange,
}: AdminDashboardProps) {
  const selectedPage = ADMIN_PAGE_CONFIGS[currentPage];
  const isDashboardPage = selectedPage === undefined;
  const {
    kpiData,
    recentActivity,
    clientProgress,
    loading,
    refreshing,
    refreshNonce,
    reload,
    handleTaskCreated,
  } = useAdminDashboardOverview({ enabled: isDashboardPage });

  if (!isDashboardPage) {
    const { title, description, Component } = selectedPage;

    return (
      <div className="space-y-6">
        <AdminDashboardHeader
          title={title}
          description={description}
          onPageChange={onPageChange}
        />
        <Component />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminDashboardHeader
        title="Admin Dashboard"
        description="Overview of system performance, recent activity, and key metrics"
        onPageChange={onPageChange}
        onTaskCreated={handleTaskCreated}
      >
        <Button variant="outline" onClick={reload} disabled={refreshing}>
          <RefreshCw
            data-icon="inline-start"
            className={refreshing ? 'animate-spin' : undefined}
          />
          Refresh
        </Button>
      </AdminDashboardHeader>

      <AdminDashboardOverview
        loading={loading}
        kpiData={kpiData}
        clientProgress={clientProgress}
        recentActivity={recentActivity}
        recentTasksReloadKey={refreshNonce}
        JobManagementSection={JobManagementSection}
      />
    </div>
  );
}
