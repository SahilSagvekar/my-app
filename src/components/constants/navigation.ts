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
  Sparkles,
  HardDrive,
  Briefcase,
  LogIn,
  Instagram,
  Film,
  PenLine,
  Target,
  History,
  PlayCircle,
} from 'lucide-react';

export const NAVIGATION_ITEMS = {
  admin: [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'reports', label: 'Task Management', icon: FileSpreadsheet },
    { id: 'drive', label: 'Files & Drive', icon: HardDrive },
    { id: 'logins', label: 'Logins', icon: LogIn },
    { id: 'analytics', label: 'Client Analytics', icon: BarChart3 },
    { id: 'leaves', label: 'User Management', icon: Users },
    { id: 'clients', label: 'Clients', icon: FolderOpen },
    { id: 'finance', label: 'Financials', icon: DollarSign },
    { id: 'training', label: 'Training Management', icon: Layout },
    { id: 'portfolio', label: 'Portfolio', icon: Film },
    { id: 'contracts', label: 'Contracts', icon: PenLine },
    { id: 'compression', label: 'Video Compression', icon: Camera },
    { id: 'production-tracker', label: 'Production Tracker', icon: Target },
    { id: 'posting-tracker', label: 'Posting Tracker', icon: Calendar },
    { id: 'feedback', label: 'Feedback', icon: MessageSquare },
    { id: 'repair-folders', label: 'Folder Repair', icon: MessageSquare },
    { id: 'nas-backup', label: 'NAS Backup', icon: HardDrive },
    { id: 'help-videos', label: 'Help Videos', icon: PlayCircle },
  ],
  editor: [
    { id: 'my-tasks', label: 'My Tasks', icon: CheckSquare },
    { id: 'my-tracker', label: 'My Tracker', icon: Target },
    { id: 'logins', label: 'Logins', icon: LogIn },
    // { id: 'resources', label: 'Resources', icon: BookOpen },
    { id: 'guidelines', label: 'Guidelines', icon: FileText },
    { id: 'training', label: 'Training', icon: Layout },
    { id: 'employment-info', label: 'Employment Information', icon: Briefcase },
    { id: 'drive', label: 'Files & Drive', icon: HardDrive },
    { id: 'upload-history', label: 'Upload History', icon: History },
  ],
  qc: [
    { id: 'review-queue', label: 'Review Queue', icon: CheckSquare },
    { id: 'reports', label: 'Task Management', icon: FileSpreadsheet },
    { id: 'completed', label: 'Completed', icon: Archive },
    { id: 'guidelines', label: 'Guidelines', icon: FileText },
    { id: 'rejection-patterns', label: 'Rejection Patterns', icon: TrendingUp },
    { id: 'employment-info', label: 'Employment Information', icon: Briefcase },
    { id: 'training', label: 'Training', icon: Layout },
  ],
  scheduler: [
    { id: 'approved-queue', label: 'Scheduling Queue', icon: CheckSquare },
    { id: 'daily-targets', label: 'Daily Targets', icon: Target },
    { id: 'content-titling', label: 'Content Titling', icon: Sparkles },
    { id: 'drive', label: 'Files & Drive', icon: HardDrive },
    { id: 'logins', label: 'Logins', icon: LogIn },
    { id: 'reports', label: 'Analytics', icon: FileSpreadsheet },
    { id: 'training', label: 'Training', icon: Layout },
    { id: 'employment-info', label: 'Employment Information', icon: Briefcase },
  ],
  manager: [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'clients', label: 'Clients', icon: FolderOpen },
    { id: 'team', label: 'Team', icon: Users },
    { id: 'performance', label: 'Performance', icon: TrendingUp },
    { id: 'reports', label: 'Reports', icon: FileSpreadsheet },
    { id: 'drive', label: 'Files & Drive', icon: HardDrive },
    { id: 'employment-info', label: 'Employment Information', icon: Briefcase },
    { id: 'leaves', label: 'Employee Management', icon: Users },
    { id: 'training', label: 'Training Management', icon: Layout },
    { id: 'portfolio', label: 'Portfolio', icon: Film },
    { id: 'contracts', label: 'Contracts', icon: PenLine },
  ],
  client: [
    { id: 'approvals', label: 'Content Review', icon: CheckSquare },
    { id: 'posted', label: 'Posted Content', icon: MessageSquare },
    { id: 'drive', label: 'Files & Drive', icon: HardDrive },
    { id: 'social', label: 'Social Media', icon: Instagram },
    { id: 'logins', label: 'Logins', icon: LogIn },
    { id: 'contracts', label: 'Contracts & Billing', icon: FileText },
    { id: 'help-videos', label: 'Help Videos', icon: PlayCircle },
  ],
  videographer: [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'shoots', label: 'Shooting Schedule', icon: Camera },
    { id: 'uploads', label: 'File Uploads', icon: Upload },
    { id: 'equipment', label: 'Equipment', icon: SettingsIcon },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'employment-info', label: 'Employment Information', icon: Briefcase },
    { id: 'training', label: 'Training', icon: Layout },
    { id: 'drive', label: 'Files & Drive', icon: HardDrive },
  ],
  sales: [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'affiliate', label: 'Affiliate Earnings', icon: DollarSign },
    { id: 'training', label: 'Training', icon: Layout },
    { id: 'employment-info', label: 'Employment Information', icon: Briefcase },
  ],
  sales_manager: [
    { id: 'dashboard', label: 'Sales Team', icon: Users },
    { id: 'employment-info', label: 'Employment Information', icon: Briefcase },
  ],
} as const;

export type NavigationRole = keyof typeof NAVIGATION_ITEMS;

export const getDefaultPage = (role: string): string => {
  switch (role) {
    case 'admin': return 'dashboard';
    case 'editor': return 'my-tasks';
    case 'qc': return 'review-queue';
    case 'scheduler': return 'approved-queue';
    case 'manager': return 'dashboard';
    case 'client': return 'contracts';
    case 'videographer': return 'dashboard';
    case 'sales': return 'dashboard';
    case 'sales_manager': return 'dashboard';
    default: return 'dashboard';
  }
};