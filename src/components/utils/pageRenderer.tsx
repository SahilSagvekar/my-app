import { AdminDashboard } from '../dashboards/AdminDashboard';
import  { EditorDashboard } from '../dashboards/EditorDashboard';
// import  EditorDashboard  from '../dashboards/EditorDashboard';
import { QCDashboard } from '../dashboards/QCDashboard';
import { SchedulerDashboard } from '../dashboards/SchedulerDashboard';
import { ManagerDashboard } from '../dashboards/ManagerDashboard';
import { ClientDashboard } from '../dashboards/ClientDashboard';
import { ClientMonthlyOverview } from '../dashboards/ClientMonthlyOverview';
import { VideographerDashboard } from '../dashboards/VideographerDashboard';
import { EditorProjects } from '../EditorProjects';

import { EditorResources } from '../EditorResources';
import { FeedbackSystem } from '../FeedbackSystem';

const ComingSoonPage = ({ title }: { title: string }) => (
  <div className="p-8 text-center text-muted-foreground">{title} - Coming Soon</div>
);

export function renderPage(role: string, page: string): JSX.Element {
  if (role === 'admin') {
    switch (page) {
      case 'dashboard':
      case 'analytics':
      case 'clients':
      case 'users':
      case 'reports':
      case 'audit':
      case 'finance':
        return <AdminDashboard currentPage={page} />;
      case 'feedback': 
        return <FeedbackSystem currentRole={role} />;
      default: 
        return <AdminDashboard currentPage="dashboard" />;
    }
  }

  if (role === 'editor') {
    switch (page) {
      case 'my-tasks': return <EditorDashboard />;
      case 'projects': return <EditorProjects />;
      case 'resources': return <EditorResources />;
      case 'feedback': return <FeedbackSystem currentRole={role} />;
      default: return <EditorDashboard />;
    }
  }

  if (role === 'qc') {
    switch (page) {
      case 'review-queue': return <QCDashboard />;
      case 'completed': return <ComingSoonPage title="Completed Reviews" />;
      case 'guidelines': return <ComingSoonPage title="QC Guidelines" />;
      case 'feedback': return <FeedbackSystem currentRole={role} />;
      case 'reports': return <ComingSoonPage title="QC Reports" />;
      default: return <QCDashboard />;
    }
  }

  if (role === 'scheduler') {
    switch (page) {
      case 'calendar': return <SchedulerDashboard />;
      case 'approved-queue': return <ComingSoonPage title="Approved Queue" />;
      case 'scheduling': return <ComingSoonPage title="Scheduling Tools" />;
      case 'resources': return <ComingSoonPage title="Resource Planning" />;
      case 'reports': return <ComingSoonPage title="Schedule Reports" />;
      case 'feedback': return <FeedbackSystem currentRole={role} />;
      default: return <SchedulerDashboard />;
    }
  }

  if (role === 'manager') {
    switch (page) {
      case 'dashboard': return <ManagerDashboard currentPage="team" />;
      case 'clients': return <ManagerDashboard currentPage="clients" />; // Shows the client management tab
      case 'team': return <ManagerDashboard currentPage="team" />; // Shows the team overview tab
      case 'performance': return <ComingSoonPage title="Performance" />;
      case 'reports': return <ComingSoonPage title="Reports" />;
      case 'feedback': return <FeedbackSystem currentRole={role} />;
      default: return <ManagerDashboard currentPage="team" />;
    }
  }

  if (role === 'client') {
    switch (page) {
      case 'monthly-overview': return <ClientMonthlyOverview />;
      case 'approvals': return <ClientDashboard />;
      case 'projects': return <ComingSoonPage title="My Projects" />;
      case 'feedback': return <FeedbackSystem currentRole={role} />;
      case 'archive': return <ComingSoonPage title="Archive" />;
      default: return <ClientMonthlyOverview />;
    }
  }

  if (role === 'videographer') {
    switch (page) {
      case 'dashboard': return <VideographerDashboard />;
      case 'shoots': return <VideographerDashboard />; // Shows shoots tab
      case 'uploads': return <VideographerDashboard />; // Shows uploads tab
      case 'equipment': return <VideographerDashboard />; // Shows equipment tab
      case 'calendar': return <VideographerDashboard />; // Shows calendar tab
      case 'feedback': return <FeedbackSystem currentRole={role} />;
      default: return <VideographerDashboard />;
    }
  }

  return <ComingSoonPage title="Page not found" />;
}