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
  HardDrive, // 🔥 NEW ICON FOR DRIVE
  Briefcase  // 🔥 NEW ICON FOR EMPLOYMENT INFO
} from 'lucide-react';

export const NAVIGATION_ITEMS = {
  admin: [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'reports', label: 'Task Management', icon: FileSpreadsheet },
    { id: 'drive', label: 'Files & Drive', icon: HardDrive },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'leaves', label: 'Employee Management', icon: Users },
    { id: 'clients', label: 'Clients', icon: FolderOpen },
    { id: 'finance', label: 'Financials', icon: DollarSign },
    { id: 'training', label: 'Training Management', icon: Layout },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'audit', label: 'Audit Log', icon: ShieldCheck },
    { id: 'feedback', label: 'Feedback', icon: MessageSquare },
    { id: 'logins', label: 'Logins', icon: MessageSquare },
  ],
  editor: [
    { id: 'my-tasks', label: 'My Tasks', icon: CheckSquare },
    // { id: 'projects', label: 'Projects', icon: FolderOpen },
    { id: 'resources', label: 'Resources', icon: BookOpen },
    { id: 'training', label: 'Training', icon: Layout },
    { id: 'employment-info', label: 'Employment Information', icon: Briefcase },
    { id: 'drive', label: 'Files & Drive', icon: HardDrive },
    { id: 'feedback', label: 'Feedback', icon: MessageSquare }
  ],
  qc: [
    { id: 'review-queue', label: 'Review Queue', icon: CheckSquare },
    { id: 'completed', label: 'Completed', icon: Archive },
    { id: 'guidelines', label: 'Guidelines', icon: BookOpen },
    { id: 'reports', label: 'Reports', icon: FileSpreadsheet },
    { id: 'employment-info', label: 'Employment Information', icon: Briefcase },
    { id: 'training', label: 'Training', icon: Layout },
    { id: 'feedback', label: 'Feedback', icon: MessageSquare }
  ],
  scheduler: [
    { id: 'approved-queue', label: 'Scheduling Queue', icon: CheckSquare },
    { id: 'content-titling', label: 'Content Titling', icon: Sparkles },
    { id: 'reports', label: 'Analytics', icon: FileSpreadsheet },
    { id: 'training', label: 'Training', icon: Layout },
    { id: 'employment-info', label: 'Employment Information', icon: Briefcase },
    { id: 'feedback', label: 'Feedback', icon: MessageSquare },
    { id: 'scheduling', label: 'Employment Information', icon: Clock },
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
    { id: 'feedback', label: 'Feedback', icon: MessageSquare }
  ],
  client: [
    { id: 'approvals', label: 'Approvals', icon: CheckSquare }, 
    { id: 'drive', label: 'Files & Drive', icon: HardDrive },
    { id: 'monthly-overview', label: 'Monthly Overview', icon: LayoutDashboard },
    // { id: 'projects', label: 'My Projects', icon: FolderOpen },
        { id: 'employment-info', label: 'Employment Information', icon: Briefcase },

    { id: 'training', label: 'Training', icon: Layout },
    { id: 'invoices', label: 'Invoices & Billing', icon: Layout },
    { id: 'archive', label: 'Archive', icon: Archive },
    { id: 'feedback', label: 'Feedback', icon: MessageSquare },
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
    { id: 'feedback', label: 'Feedback', icon: MessageSquare }
  ]
} as const;

export type NavigationRole = keyof typeof NAVIGATION_ITEMS;

export const getDefaultPage = (role: string): string => {
  switch (role) {
    case 'admin': return 'dashboard';
    case 'editor': return 'my-tasks';
    case 'qc': return 'review-queue';
    case 'scheduler': return 'approved-queue';
    case 'manager': return 'dashboard';
    case 'client': return 'approvals';
    case 'videographer': return 'dashboard';
    default: return 'dashboard';
  }
};



// import { 
//   LayoutDashboard, 
//   Users, 
//   FileText, 
//   BarChart3, 
//   Calendar, 
//   CheckSquare, 
//   Clock, 
//   TrendingUp,
//   FolderOpen,
//   Layout,
//   BookOpen,
//   MessageSquare,
//   Archive,
//   DollarSign,
//   ShieldCheck,
//   FileSpreadsheet,
//   Camera,
//   Upload,
//   Settings as SettingsIcon,
//   Sparkles,
//   HardDrive,
//   Briefcase  // 🔥 NEW ICON FOR EMPLOYMENT INFO
// } from 'lucide-react';

// export const NAVIGATION_ITEMS = {
//   admin: [
//     { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
//     { id: 'reports', label: 'Task Management', icon: FileSpreadsheet },
//     { id: 'drive', label: 'Files & Drive', icon: HardDrive },
//     { id: 'analytics', label: 'Analytics', icon: BarChart3 },
//     { id: 'leaves', label: 'Employee Management', icon: Users },
//     { id: 'clients', label: 'Clients', icon: FolderOpen },
//     { id: 'finance', label: 'Financials', icon: DollarSign },
//     { id: 'training', label: 'Training Management', icon: Layout },
//     { id: 'users', label: 'Users', icon: Users },
//     { id: 'audit', label: 'Audit Log', icon: ShieldCheck },
//     { id: 'feedback', label: 'Feedback', icon: MessageSquare }
//   ],
//   editor: [
//     { id: 'my-tasks', label: 'My Tasks', icon: CheckSquare },
//     { id: 'resources', label: 'Resources', icon: BookOpen },
//     { id: 'training', label: 'Training', icon: Layout },
//     { id: 'drive', label: 'Files & Drive', icon: HardDrive },
//     { id: 'employment-info', label: 'Employment Information', icon: Briefcase },
//     { id: 'feedback', label: 'Feedback', icon: MessageSquare }
//   ],
//   qc: [
//     { id: 'review-queue', label: 'Review Queue', icon: CheckSquare },
//     { id: 'completed', label: 'Completed', icon: Archive },
//     { id: 'guidelines', label: 'Guidelines', icon: BookOpen },
//     { id: 'reports', label: 'Reports', icon: FileSpreadsheet },
//     { id: 'training', label: 'Training', icon: Layout },
//     { id: 'employment-info', label: 'Employment Information', icon: Briefcase },
//     { id: 'feedback', label: 'Feedback', icon: MessageSquare }
//   ],
//   scheduler: [
//     { id: 'approved-queue', label: 'Scheduling Queue', icon: CheckSquare },
//     { id: 'content-titling', label: 'Content Titling', icon: Sparkles },
//     { id: 'reports', label: 'Analytics', icon: FileSpreadsheet },
//     { id: 'training', label: 'Training', icon: Layout },
//     { id: 'employment-info', label: 'Employment Information', icon: Briefcase },
//     { id: 'feedback', label: 'Feedback', icon: MessageSquare },
//     { id: 'scheduling', label: 'Employment Information', icon: Clock },
//   ],
//   manager: [
//     { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
//     { id: 'clients', label: 'Clients', icon: FolderOpen },
//     { id: 'team', label: 'Team', icon: Users },
//     { id: 'performance', label: 'Performance', icon: TrendingUp },
//     { id: 'reports', label: 'Reports', icon: FileSpreadsheet },
//     { id: 'drive', label: 'Files & Drive', icon: HardDrive },
//     { id: 'leaves', label: 'Employee Management', icon: Users },
//     { id: 'training', label: 'Training Management', icon: Layout },
//     { id: 'employment-info', label: 'Employment Information', icon: Briefcase },
//     { id: 'feedback', label: 'Feedback', icon: MessageSquare }
//   ],
//   client: [
//     { id: 'approvals', label: 'Approvals', icon: CheckSquare }, 
//     { id: 'drive', label: 'Files & Drive', icon: HardDrive },
//     { id: 'monthly-overview', label: 'Monthly Overview', icon: LayoutDashboard },
//     { id: 'training', label: 'Training', icon: Layout },
//     { id: 'invoices', label: 'Invoices & Billing', icon: Layout },
//     { id: 'archive', label: 'Archive', icon: Archive },
//     { id: 'employment-info', label: 'Employment Information', icon: Briefcase },
//     { id: 'feedback', label: 'Feedback', icon: MessageSquare },
//   ],
//   videographer: [
//     { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
//     { id: 'shoots', label: 'Shooting Schedule', icon: Camera },
//     { id: 'uploads', label: 'File Uploads', icon: Upload },
//     { id: 'equipment', label: 'Equipment', icon: SettingsIcon },
//     { id: 'calendar', label: 'Calendar', icon: Calendar },
//     { id: 'training', label: 'Training', icon: Layout },
//     { id: 'drive', label: 'Files & Drive', icon: HardDrive },
//     { id: 'employment-info', label: 'Employment Information', icon: Briefcase },
//     { id: 'feedback', label: 'Feedback', icon: MessageSquare }
//   ]
// } as const;

// export type NavigationRole = keyof typeof NAVIGATION_ITEMS;

// export const getDefaultPage = (role: string): string => {
//   switch (role) {
//     case 'admin': return 'dashboard';
//     case 'editor': return 'my-tasks';
//     case 'qc': return 'review-queue';
//     case 'scheduler': return 'approved-queue';
//     case 'manager': return 'dashboard';
//     case 'client': return 'approvals';
//     case 'videographer': return 'dashboard';
//     default: return 'dashboard';
//   }
// };