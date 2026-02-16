import React from "react";
import { AdminDashboard } from "../dashboards/AdminDashboard";
import { EditorDashboard } from "../dashboards/EditorDashboard";
import { QCDashboard } from "../dashboards/QCDashboard";
import { QCCompletedPage } from "../dashboards/QCCompletedPage";
import { QCGuidelinesPage } from "../dashboards/QCGuidelinesPage";
import { QCReportsPage } from "../dashboards/QCReportsPage";
import { QCResourcesPage } from "../dashboards/QCResourcesPage";
import { QCTrainingPage } from "../dashboards/QCTrainingPage";
import { EditorGuidelinesPage } from "../dashboards/EditorGuidelinesPage";
import { SchedulerDashboard } from "../dashboards/SchedulerDashboard";
import { SchedulerSpreadsheetView } from "../dashboards/SchedulerSpreadsheetView";
import { SchedulerContentTitlingPage } from "../dashboards/SchedulerContentTitlingPage";
import { SchedulerSchedulingPage } from "../dashboards/SchedulerSchedulingPage";
import { SchedulerResourcesPage } from "../dashboards/SchedulerResourcesPage";
import { SchedulerReportsPage } from "../dashboards/SchedulerReportsPage";
import { SchedulerTrainingPage } from "../dashboards/SchedulerTrainingPage";
import { SchedulerPostedArchivePage } from "../dashboards/SchedulerPostedArchivePage";
import { ManagerDashboard } from "../dashboards/ManagerDashboard";
import { ClientDashboard } from "../dashboards/ClientDashboard";
import { ClientMonthlyOverview } from "../dashboards/ClientMonthlyOverview";
import { VideographerDashboard } from "../dashboards/VideographerDashboard";
import { EditorProjects } from "../EditorProjects";
import { EditorResources } from "../EditorResources";
import { FeedbackSystem } from "../FeedbackSystem";
import LeavesComponent from "../admin/LeavesComponent";
import { ResetPasswordWithOTP } from "../auth/ResetPasswordWithOTP";
import { DriveExplorer } from "../drive/DriveExplorer";
import { EmploymentInfo } from "../EmploymentInfo";
import { SocialLogins } from "../Sociallogins"
import { PostedContentSidebar } from "../Postedcontentsidebar"
import { ActivityLogReportTab } from "../admin/ActivityLogReportTab";
import { YouTubeAnalyticsWrapper } from "../youtube/YouTubeAnalyticsWrapper";
import { MetaAnalyticsWrapper } from "../meta/MetaAnalyticsWrapper";

const ComingSoonPage = ({ title }: { title: string }) => (
  <div className="p-8 text-center text-muted-foreground">
    {title} - Coming Soon
  </div>
);

export function renderPage(role: string, page: string, onPageChange?: (page: string) => void): React.ReactElement {
  console.log(`Rendering page for role: ${role}, page: ${page}`);

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
        return <AdminDashboard currentPage={page} onPageChange={onPageChange} />;
      case "feedback":
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Feedback</h1>
                <p className="text-muted-foreground mt-2">
                  View and respond to feedback from team members and clients
                </p>
              </div>
            </div>
            <FeedbackSystem currentRole={role} />
          </div>
        );
      case "training":
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Training Management</h1>
                <p className="text-muted-foreground mt-2">
                  Oversee employee training modules, certifications, and progress
                </p>
              </div>
            </div>
            <QCTrainingPage currentRole={role} />
          </div>
        );
      case "logins":
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Social Logins</h1>
                <p className="text-muted-foreground mt-2">
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
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Files & Drive</h1>
                <p className="text-muted-foreground mt-2">
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
        return <QCTrainingPage currentRole={role} />;
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

  console.log(role);

  if (role === "qc") {
    // console.log(role);
    console.log(page);
    switch (page) {
      case "review-queue":
        return <QCDashboard />;
      case "completed":
        return <QCCompletedPage />;
      case "guidelines":
        return <QCGuidelinesPage />;
      case "reports":
        return <QCReportsPage />;
      case "resources":
        return <QCResourcesPage />;
      case "training":
        return <QCTrainingPage currentRole={role} />;
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
        return <SchedulerTrainingPage currentRole={role} />;
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
        return <ManagerDashboard currentPage="clients" />; // Shows the client management tab
      case "team":
        return <ManagerDashboard currentPage="team" />; // Shows the team overview tab
      case "performance":
        return <ComingSoonPage title="Performance" />;
      case "reports":
        return <ComingSoonPage title="Reports" />;
      case "training":
        return <QCTrainingPage currentRole={role} />;
      case "leaves":
        return <LeavesComponent />;
      case "employment-info":
        return <EmploymentInfo currentRole={role} />;
      case "feedback":
        return <FeedbackSystem currentRole={role} />;
      default:
        return <ManagerDashboard currentPage="team" />;
    }
  }

  if (role === "client") {
    switch (page) {
      // case 'monthly-overview': return <ClientMonthlyOverview />;
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
        return <QCTrainingPage currentRole={role} />;
      case "archive":
        return <ComingSoonPage title="Archive" />;
      default:
        return <ClientMonthlyOverview />;
    }
  }

  if (role === "videographer") {
    switch (page) {
      case "dashboard":
        return <VideographerDashboard />;
      case "shoots":
        return <VideographerDashboard />; // Shows shoots tab
      case "uploads":
        return <VideographerDashboard />; // Shows uploads tab
      case "equipment":
        return <VideographerDashboard />; // Shows equipment tab
      case "calendar":
        return <VideographerDashboard />; // Shows calendar tab
      case "training":
        return <QCTrainingPage currentRole={role} />;
      case "employment-info":
        return <EmploymentInfo currentRole={role} />;
      case "feedback":
        return <FeedbackSystem currentRole={role} />;
      default:
        return <VideographerDashboard />;
    }
  }

  return <ComingSoonPage title="Page not found" />;
}
