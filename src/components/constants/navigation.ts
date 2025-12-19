import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  BarChart3, 
  Calendar, 
  CheckSquare, 
  Clock, 
  TrendingUp,
  FolderOpen,
  Layout,
  BookOpen,
  MessageSquare,
  Archive,
  DollarSign,
  ShieldCheck,
  FileSpreadsheet,
  Camera,
  Upload,
  Settings as SettingsIcon,
  Sparkles
} from 'lucide-react';

export const NAVIGATION_ITEMS = {
  admin: [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'clients', label: 'Clients', icon: FolderOpen },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'reports', label: 'Reports', icon: FileSpreadsheet },
    { id: 'audit', label: 'Audit Log', icon: ShieldCheck },
    { id: 'finance', label: 'Financials', icon: DollarSign },
    { id: 'leaves', label: 'Employee Management', icon: Users },
    { id: 'training', label: 'Training', icon: Layout },
    { id: 'feedback', label: 'Feedback', icon: MessageSquare }
  ],
  editor: [
    { id: 'my-tasks', label: 'My Tasks', icon: CheckSquare },
    { id: 'projects', label: 'Projects', icon: FolderOpen },
    { id: 'resources', label: 'Resources', icon: BookOpen },
    { id: 'training', label: 'Training', icon: Layout },
    { id: 'feedback', label: 'Feedback', icon: MessageSquare }
  ],
  qc: [
    { id: 'review-queue', label: 'Review Queue', icon: CheckSquare },
    { id: 'completed', label: 'Completed', icon: Archive },
    { id: 'guidelines', label: 'Guidelines', icon: BookOpen },
    { id: 'reports', label: 'Reports', icon: FileSpreadsheet },
    { id: 'resources', label: 'Resources', icon: FolderOpen },
    { id: 'training', label: 'Training', icon: Layout },
    { id: 'feedback', label: 'Feedback', icon: MessageSquare }
  ],
  scheduler: [
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'approved-queue', label: 'Approved Queue', icon: CheckSquare },
    { id: 'scheduling', label: 'Scheduling', icon: Clock },
    { id: 'content-titling', label: 'Content Titling', icon: Sparkles },
    { id: 'resources', label: 'Resources', icon: BookOpen },
    { id: 'reports', label: 'Reports', icon: FileSpreadsheet },
    { id: 'training', label: 'Training', icon: Layout },
    { id: 'feedback', label: 'Feedback', icon: MessageSquare }
  ],
  manager: [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'clients', label: 'Clients', icon: FolderOpen },
    { id: 'team', label: 'Team', icon: Users },
    { id: 'performance', label: 'Performance', icon: TrendingUp },
    { id: 'reports', label: 'Reports', icon: FileSpreadsheet },
    { id: 'training', label: 'Training', icon: Layout },
    { id: 'feedback', label: 'Feedback', icon: MessageSquare }
  ],
  client: [
    { id: 'monthly-overview', label: 'Monthly Overview', icon: LayoutDashboard },
    { id: 'approvals', label: 'Approvals', icon: CheckSquare },
    { id: 'projects', label: 'My Projects', icon: FolderOpen },
    { id: 'feedback', label: 'Feedback', icon: MessageSquare },
    { id: 'training', label: 'Training', icon: Layout },
    { id: 'archive', label: 'Archive', icon: Archive }
  ],
  videographer: [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'shoots', label: 'Shooting Schedule', icon: Camera },
    { id: 'uploads', label: 'File Uploads', icon: Upload },
    { id: 'equipment', label: 'Equipment', icon: SettingsIcon },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'training', label: 'Training', icon: Layout },
    { id: 'feedback', label: 'Feedback', icon: MessageSquare }
  ]
} as const;

export type NavigationRole = keyof typeof NAVIGATION_ITEMS;

export const getDefaultPage = (role: string): string => {
  switch (role) {
    case 'admin': return 'dashboard';
    case 'editor': return 'my-tasks';
    case 'qc': return 'review-queue';
    case 'scheduler': return 'calendar';
    case 'manager': return 'dashboard';
    case 'client': return 'monthly-overview';
    case 'videographer': return 'dashboard';
    default: return 'dashboard';
  }
};