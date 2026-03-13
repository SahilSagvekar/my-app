import React, { Suspense } from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// ============================================
// LOADING FALLBACK
// ============================================
const GenericLoading = ({ title }: { title?: string }) => (
  <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8 space-y-4">
    <div className="p-4 bg-muted/50 rounded-full">
      <Loader2 className="h-10 w-10 text-muted-foreground animate-spin" />
    </div>
    <h1 className="text-xl font-semibold text-gray-900">{title || "Loading..."}</h1>
  </div>
);

const ComingSoonPage = ({ title }: { title: string }) => (
  <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8 space-y-4">
    <div className="p-4 bg-muted/50 rounded-full">
      <Loader2 className="h-10 w-10 text-muted-foreground animate-pulse" />
    </div>
    <h1 className="text-3xl font-bold tracking-tight text-gray-900">{title}</h1>
    <p className="text-muted-foreground text-lg max-w-md mx-auto">
      This section is currently under development. Stay tuned for exciting new features!
    </p>
  </div>
);

// ============================================
// DYNAMIC IMPORTS
// ============================================

// Admin
const AdminDashboard = dynamic(() => import("../dashboards/AdminDashboard").then(mod => mod.AdminDashboard), { ssr: false, loading: () => <GenericLoading title="Loading Admin Dashboard..." /> });
const TrainingManagementTab = dynamic(() => import("../admin/TrainingManagementTab").then(mod => mod.TrainingManagementTab), { ssr: false });
const ActivityLogReportTab = dynamic(() => import("../admin/ActivityLogReportTab").then(mod => mod.ActivityLogReportTab), { ssr: false });
const PortfolioManagementTab = dynamic(() => import("../admin/PortfolioManagementTab").then(mod => mod.PortfolioManagementTab), { ssr: false });
const SalesManagementTab = dynamic(() => import("../admin/SalesManagementTab").then(mod => mod.SalesManagementTab), { ssr: false });

// Editor
const EditorDashboard = dynamic(() => import("../dashboards/EditorDashboard").then(mod => mod.EditorDashboard), { ssr: false, loading: () => <GenericLoading title="Loading Editor Dashboard..." /> });
const EditorGuidelinesPage = dynamic(() => import("../dashboards/EditorGuidelinesPage").then(mod => mod.EditorGuidelinesPage), { ssr: false });
const EditorProjects = dynamic(() => import("../EditorProjects").then(mod => mod.EditorProjects), { ssr: false });
const EditorResources = dynamic(() => import("../EditorResources").then(mod => mod.EditorResources), { ssr: false });

// QC
const QCDashboard = dynamic(() => import("../dashboards/QCDashboard").then(mod => mod.QCDashboard), { ssr: false, loading: () => <GenericLoading title="Loading QC Dashboard..." /> });
const QCCompletedPage = dynamic(() => import("../dashboards/QCCompletedPage").then(mod => mod.QCCompletedPage), { ssr: false });
const QCGuidelinesPage = dynamic(() => import("../dashboards/QCGuidelinesPage").then(mod => mod.QCGuidelinesPage), { ssr: false });
const QCReportsPage = dynamic(() => import("../dashboards/QCReportsPage").then(mod => mod.QCReportsPage), { ssr: false });
const QCRejectionPatternsPage = dynamic(() => import("../dashboards/QCRejectionPatternsPage").then(mod => mod.QCRejectionPatternsPage), { ssr: false });
const QCResourcesPage = dynamic(() => import("../dashboards/QCResourcesPage").then(mod => mod.QCResourcesPage), { ssr: false });

// Scheduler
const SchedulerDashboard = dynamic(() => import("../dashboards/SchedulerDashboard").then(mod => mod.SchedulerDashboard), { ssr: false, loading: () => <GenericLoading title="Loading Scheduler..." /> });
const SchedulerSpreadsheetView = dynamic(() => import("../dashboards/SchedulerSpreadsheetView").then(mod => mod.SchedulerSpreadsheetView), { ssr: false });
const SchedulerContentTitlingPage = dynamic(() => import("../dashboards/SchedulerContentTitlingPage").then(mod => mod.SchedulerContentTitlingPage), { ssr: false });
const SchedulerSchedulingPage = dynamic(() => import("../dashboards/SchedulerSchedulingPage").then(mod => mod.SchedulerSchedulingPage), { ssr: false });
const SchedulerResourcesPage = dynamic(() => import("../dashboards/SchedulerResourcesPage").then(mod => mod.SchedulerResourcesPage), { ssr: false });
const SchedulerReportsPage = dynamic(() => import("../dashboards/SchedulerReportsPage").then(mod => mod.SchedulerReportsPage), { ssr: false });
const SchedulerPostedArchivePage = dynamic(() => import("../dashboards/SchedulerPostedArchivePage").then(mod => mod.SchedulerPostedArchivePage), { ssr: false });

// Manager & Sales
const ManagerDashboard = dynamic(() => import("../dashboards/ManagerDashboard").then(mod => mod.ManagerDashboard), { ssr: false, loading: () => <GenericLoading title="Loading Manager Portal..." /> });
const SalesDashboard = dynamic(() => import("../dashboards/SalesDashboard").then(mod => mod.SalesDashboard), { ssr: false, loading: () => <GenericLoading title="Loading Sales Dashboard..." /> });
const AffiliateSection = dynamic(() => import("../dashboards/AffiliateSection").then(mod => mod.AffiliateSection), { ssr: false });

// Client
const ClientDashboard = dynamic(() => import("../dashboards/ClientDashboard").then(mod => mod.ClientDashboard), { ssr: false, loading: () => <GenericLoading title="Loading approvals..." /> });
const ClientMonthlyOverview = dynamic(() => import("../dashboards/ClientMonthlyOverview").then(mod => mod.ClientMonthlyOverview), { ssr: false });
const ClientContractsPage = dynamic(() => import("../contracts/ClientContractsPage").then(mod => mod.ClientContractsPage), { ssr: false });

// Videographer
const VideographerDashboard = dynamic(() => import("../dashboards/VideographerDashboard").then(mod => mod.VideographerDashboard), { ssr: false, loading: () => <GenericLoading title="Loading Videographer Portal..." /> });

// Shared / Common
const TrainingPortalPage = dynamic(() => import("../training/TrainingPortalPage").then(mod => mod.TrainingPortalPage), { ssr: false });
const FeedbackSystem = dynamic(() => import("../FeedbackSystem").then(mod => mod.FeedbackSystem), { ssr: false });
const LeavesComponent = dynamic(() => import("../admin/LeavesComponent"), { ssr: false });
const ResetPasswordWithOTP = dynamic(() => import("../auth/ResetPasswordWithOTP").then(mod => mod.ResetPasswordWithOTP), { ssr: false });
const DriveExplorer = dynamic(() => import("../drive/DriveExplorer").then(mod => mod.DriveExplorer), { ssr: false });
const EmploymentInfo = dynamic(() => import("../EmploymentInfo").then(mod => mod.EmploymentInfo), { ssr: false });
const SocialLogins = dynamic(() => import("../Sociallogins").then(mod => mod.SocialLogins), { ssr: false });
const PostedContentSidebar = dynamic(() => import("../Postedcontentsidebar").then(mod => mod.PostedContentSidebar), { ssr: false });
const YouTubeAnalyticsWrapper = dynamic(() => import("../youtube/YouTubeAnalyticsWrapper").then(mod => mod.YouTubeAnalyticsWrapper), { ssr: false });
const MetaAnalyticsWrapper = dynamic(() => import("../meta/MetaAnalyticsWrapper").then(mod => mod.MetaAnalyticsWrapper), { ssr: false });
const ContractsDashboard = dynamic(() => import("../contracts/ContractsDashboard").then(mod => mod.ContractsDashboard), { ssr: false });


export function renderPage(
  role: string,
  page: string,
  onPageChange?: (page: string) => void,
  hasPostingServices?: boolean
): React.ReactElement {
  console.log(`Rendering page for role: ${role}, page: ${page}`);

  // 🔥 Block unauthorized access for clients without posting services
  if (role.toLowerCase() === 'client' && hasPostingServices === false) {
    const forbiddenIds = ['posted', 'monthly-overview', 'youtube-analytics', 'instagram-analytics', 'archive', 'feedback'];
    if (forbiddenIds.includes(page)) {
      console.warn(`Unauthorized access attempt to ${page} for client without posting services. Redirecting to Approvals.`);
      return <ClientDashboard />;
    }
  }

  if (page === "forgot-password") {
    return (
      <ResetPasswordWithOTP
        onBackToLogin={() => (window.location.href = "/login")}
      />
    );
  }

  if (page === "drive") {
    return <DriveExplorer role={role} />;
  }

  if (page === "logins") {
    return <SocialLogins />;
  }

  if (page === "invoices") {
    return <ComingSoonPage title="Invoices & Billing" />;
  }

  if (page === "scheduling") {
    return <ComingSoonPage title="Scheduling" />;
  }

  if (page === "posted") {
    return <PostedContentSidebar />;
  }

  if (page === "activity_logs") {
    return <ActivityLogReportTab />;
  }

  if (role === "admin") {
    switch (page) {
      case "dashboard":
      case "analytics":
      case "clients":
      case "users":
      case "reports":
      case "audit":
      case "finance":
      case "permissions":
      case "leaves":
      case "activity_logs":
      case "guidelines":
      case "sales-management":
      case "videographer-management":
        return <AdminDashboard currentPage={page} onPageChange={onPageChange} />;
      case "portfolio":
        return <PortfolioManagementTab />;
      case "contracts":
        return <ContractsDashboard />;
      case "feedback":
        return <FeedbackSystem currentRole={role} />;
      case "training":
        return (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-gray-200">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-gray-900">Training Management</h1>
                <p className="text-muted-foreground mt-1 text-lg">
                  Upload and manage role-specific training videos (Cloudinary). Staff see them as a course.
                </p>
              </div>
            </div>
            <TrainingManagementTab />
          </div>
        );
      case "logins":
        return (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-gray-200">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-gray-900">Social Logins</h1>
                <p className="text-muted-foreground mt-1 text-lg">
                  Securely manage social media credentials and account access
                </p>
              </div>
            </div>
            <SocialLogins />
          </div>
        );
      case "drive":
        return (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-gray-200">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-gray-900">Files & Drive</h1>
                <p className="text-muted-foreground mt-1 text-lg">
                  Centralized storage for assets, project files, and shared documents
                </p>
              </div>
            </div>
            <DriveExplorer role={role} />
          </div>
        );
      case "activity_logs":
        return <ActivityLogReportTab />;
      default:
        return <AdminDashboard currentPage="dashboard" onPageChange={onPageChange} />;
    }
  }

  if (role === "editor") {
    switch (page) {
      case "my-tasks":
        return <EditorDashboard />;
      case "projects":
        return <EditorProjects />;
      case "resources":
        return <EditorResources />;
      case "training":
        return <TrainingPortalPage />;
      case "guidelines":
        return <EditorGuidelinesPage />;
      case "employment-info":
        return <EmploymentInfo currentRole={role} />;
      case "feedback":
        return <FeedbackSystem currentRole={role} />;
      default:
        return <EditorDashboard />;
    }
  }

  if (role === "qc") {
    switch (page) {
      case "review-queue":
        return <QCDashboard />;
      case "completed":
        return <QCCompletedPage />;
      case "guidelines":
        return <QCGuidelinesPage />;
      case "reports":
        return <QCReportsPage />;
      case "rejection-patterns":
        return <QCRejectionPatternsPage />;
      case "resources":
        return <QCResourcesPage />;
      case "training":
        return <TrainingPortalPage />;
      case "employment-info":
        return <EmploymentInfo currentRole={role} />;
      case "feedback":
        return <FeedbackSystem currentRole={role} />;
      default:
        return <QCDashboard />;
    }
  }

  if (role === "scheduler") {
    switch (page) {
      case "calendar":
        return <SchedulerDashboard />;
      case "approved-queue":
        return <SchedulerSpreadsheetView />;
      case "scheduling":
        return <SchedulerSchedulingPage />;
      case "content-titling":
        return <SchedulerContentTitlingPage />;
      case "resources":
        return <SchedulerResourcesPage />;
      case "reports":
        return <SchedulerReportsPage />;
      case "training":
        return <TrainingPortalPage />;
      case "employment-info":
        return <EmploymentInfo currentRole={role} />;
      case "posted-archive":
        return <SchedulerPostedArchivePage />;
      case "feedback":
        return <FeedbackSystem currentRole={role} />;
      default:
        return <SchedulerDashboard />;
    }
  }

  if (role === "manager") {
    switch (page) {
      case "dashboard":
        return <ManagerDashboard currentPage="team" />;
      case "clients":
        return <ManagerDashboard currentPage="clients" />;
      case "team":
        return <ManagerDashboard currentPage="team" />;
      case "performance":
        return <ComingSoonPage title="Performance" />;
      case "reports":
        return <ComingSoonPage title="Reports" />;
      case "training":
        return <TrainingPortalPage />;
      case "leaves":
        return <LeavesComponent />;
      case "employment-info":
        return <EmploymentInfo currentRole={role} />;
      case "portfolio":
        return <PortfolioManagementTab />;
      case "contracts":
        return <ContractsDashboard />;
      case "feedback":
        return <FeedbackSystem currentRole={role} />;
      default:
        return <ManagerDashboard currentPage="team" />;
    }
  }

  if (role === "client") {
    switch (page) {
      case "monthly-overview":
        return <ComingSoonPage title="Monthly Overview" />;
      case "approvals":
        return <ClientDashboard />;
      case "projects":
        return <ComingSoonPage title="My Projects" />;
      case "employment-info":
        return <EmploymentInfo currentRole={role} />;
      case "feedback":
        return <FeedbackSystem currentRole={role} />;
      case "training":
        return <TrainingPortalPage />;
      case "archive":
        return <ComingSoonPage title="Archive" />;
      case "contracts":
        return <ClientContractsPage />;
      default:
        return <ClientMonthlyOverview />;
    }
  }

  if (role === "videographer") {
    switch (page) {
      case "dashboard":
        return <VideographerDashboard initialTab="jobs" />;
      case "shoots":
        return <VideographerDashboard initialTab="shoots" />;
      case "uploads":
        return <VideographerDashboard initialTab="uploads" />;
      case "equipment":
        return <VideographerDashboard initialTab="equipment" />;
      case "calendar":
        return <VideographerDashboard initialTab="calendar" />;
      case "training":
        return <TrainingPortalPage />;
      case "employment-info":
        return <EmploymentInfo currentRole={role} />;
      case "feedback":
        return <FeedbackSystem currentRole={role} />;
      default:
        return <VideographerDashboard initialTab="jobs" />;
    }
  }

  if (role === "sales") {
    switch (page) {
      case "dashboard":
      case "sales-management":
        return <SalesDashboard />;
      case "affiliate":
        return <AffiliateSection />;
      case "clients":
        return <SalesDashboard />;
      case "training":
        return <TrainingPortalPage />;
      case "employment-info":
        return <EmploymentInfo currentRole={role} />;
      case "feedback":
        return <FeedbackSystem currentRole={role} />;
      default:
        return <SalesDashboard />;
    }
  }

  return <ComingSoonPage title="Page not found" />;
}