import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface SearchResult {
  id: string;
  type: 'page' | 'task' | 'project' | 'user' | 'client' | 'report';
  title: string;
  description: string;
  url: string;
  category: string;
  priority?: 'high' | 'medium' | 'low';
  status?: string;
  date?: string;
}

interface SearchContextType {
  searchResults: SearchResult[];
  isLoading: boolean;
  search: (query: string, role: string) => Promise<SearchResult[]>;
  navigateToResult: (result: SearchResult, onPageChange: (page: string) => void) => void;
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

export function useSearch() {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error('useSearch must be used within a SearchProvider');
  }
  return context;
}

// Mock search data for different roles
const getSearchData = (role: string): SearchResult[] => {
  const baseData = {
    admin: [
      // Dashboard items
      { id: 'admin-dashboard', type: 'page', title: 'Admin Dashboard', description: 'System overview and KPIs', url: '/admin/dashboard', category: 'Navigation' },
      { id: 'analytics', type: 'page', title: 'Analytics', description: 'Social media performance analytics', url: '/admin/analytics', category: 'Navigation' },
      { id: 'user-management', type: 'page', title: 'User Management', description: 'Manage team members and roles', url: '/admin/users', category: 'Navigation' },
      { id: 'reports', type: 'page', title: 'Reports', description: 'Daily output and performance reports', url: '/admin/reports', category: 'Navigation' },
      { id: 'audit-log', type: 'page', title: 'Audit Log', description: 'System actions and security log', url: '/admin/audit', category: 'Navigation' },
      
      // Projects
      { id: 'holiday-campaign', type: 'project', title: 'Holiday Campaign 2024', description: 'Q4 marketing campaign across all platforms', url: '/admin/projects', category: 'Projects', status: 'In Progress' },
      { id: 'brand-guidelines', type: 'project', title: 'Acme Corp Brand Guidelines', description: 'Complete brand identity overhaul', url: '/admin/projects', category: 'Projects', status: 'QC Review' },
      { id: 'video-series', type: 'project', title: 'Educational Video Series', description: '12-part product tutorial series', url: '/admin/projects', category: 'Projects', status: 'Planning' },
      
      // Users
      { id: 'sarah-wilson', type: 'user', title: 'Sarah Wilson', description: 'Senior Editor - Video Content Team', url: '/admin/users', category: 'Team' },
      { id: 'david-rodriguez', type: 'user', title: 'David Rodriguez', description: 'QC Specialist - Quality Control', url: '/admin/users', category: 'Team' },
      { id: 'michael-chen', type: 'user', title: 'Michael Chen', description: 'Project Manager - Operations', url: '/admin/users', category: 'Team' },
      
      // System items
      { id: 'server-performance', type: 'report', title: 'Server Performance Report', description: 'Monthly system performance metrics', url: '/admin/reports', category: 'System', date: '2024-01-15' },
      { id: 'user-activity-log', type: 'report', title: 'User Activity Log', description: 'Recent user actions and login history', url: '/admin/audit', category: 'System', date: '2024-01-16' }
    ],

    editor: [
      // Tasks
      { id: 'vid-2024-003', type: 'task', title: 'Video Campaign #VID-2024-003', description: 'Holiday promotional video for social media', url: '/editor/my-tasks', category: 'My Tasks', priority: 'high', status: 'In Progress' },
      { id: 'sm-2024-089', type: 'task', title: 'Social Media Asset #SM-2024-089', description: 'Instagram story templates for fashion brand', url: '/editor/my-tasks', category: 'My Tasks', priority: 'medium', status: 'Ready for QC' },
      { id: 'bg-2024-012', type: 'task', title: 'Brand Guidelines #BG-2024-012', description: 'Logo variations and color palette for Acme Corp', url: '/editor/my-tasks', category: 'My Tasks', priority: 'medium', status: 'In Review' },
      { id: 'web-2024-005', type: 'task', title: 'Website Redesign #WEB-2024-005', description: 'Homepage mockup and wireframes', url: '/editor/my-tasks', category: 'My Tasks', priority: 'high', status: 'Due Tomorrow' },
      
      // Projects
      { id: 'holiday-campaign-editor', type: 'project', title: 'Holiday Campaign Assets', description: 'Create social media content for Q4 campaign', url: '/editor/projects', category: 'Projects', status: 'Active' },
      { id: 'brand-refresh', type: 'project', title: 'Brand Refresh Project', description: 'Update visual identity across all materials', url: '/editor/projects', category: 'Projects', status: 'Planning' },
      
      // Templates
      { id: 'instagram-template', type: 'task', title: 'Instagram Post Template', description: 'Standard template for product announcements', url: '/editor/templates', category: 'Templates' },
      { id: 'video-intro-template', type: 'task', title: 'Video Intro Template', description: 'Branded intro animation for video content', url: '/editor/templates', category: 'Templates' }
    ],

    qc: [
      // Review Queue
      { id: 'review-sm-089', type: 'task', title: 'Social Media Asset #SM-2024-089', description: 'Instagram story templates - needs color correction', url: '/qc/review-queue', category: 'Review Queue', priority: 'high', status: 'Pending Review' },
      { id: 'review-vid-003', type: 'task', title: 'Video Campaign #VID-2024-003', description: 'Holiday promo video - check audio levels', url: '/qc/review-queue', category: 'Review Queue', priority: 'medium', status: 'In Review' },
      { id: 'review-bg-012', type: 'task', title: 'Brand Guidelines #BG-2024-012', description: 'Logo variations - verify brand compliance', url: '/qc/review-queue', category: 'Review Queue', priority: 'medium', status: 'Needs Revision' },
      { id: 'review-web-005', type: 'task', title: 'Website Mockup #WEB-2024-005', description: 'Homepage design - final approval needed', url: '/qc/review-queue', category: 'Review Queue', priority: 'high', status: 'Ready for Approval' },
      
      // Completed
      { id: 'completed-email-template', type: 'task', title: 'Email Template #EM-2024-001', description: 'Newsletter template - approved and finalized', url: '/qc/completed', category: 'Completed', status: 'Approved', date: '2024-01-15' },
      { id: 'completed-banner-ad', type: 'task', title: 'Banner Ad #BA-2024-045', description: 'Display ad for partner site - approved', url: '/qc/completed', category: 'Completed', status: 'Approved', date: '2024-01-14' },
      
      // Guidelines
      { id: 'qc-brand-standards', type: 'page', title: 'Brand Standards Checklist', description: 'Quality control guidelines for brand compliance', url: '/qc/guidelines', category: 'Guidelines' },
      { id: 'qc-video-guidelines', type: 'page', title: 'Video QC Guidelines', description: 'Technical requirements for video content', url: '/qc/guidelines', category: 'Guidelines' }
    ],

    scheduler: [
      // Calendar items
      { id: 'instagram-post-jan16', type: 'task', title: 'Instagram Post - Product Launch', description: 'Scheduled for Jan 16, 2:00 PM', url: '/scheduler/calendar', category: 'Scheduled Content', date: '2024-01-16', status: 'Scheduled' },
      { id: 'facebook-campaign-jan17', type: 'task', title: 'Facebook Ad Campaign Start', description: 'Holiday campaign launch', url: '/scheduler/calendar', category: 'Scheduled Content', date: '2024-01-17', status: 'Ready to Launch' },
      { id: 'twitter-thread-jan18', type: 'task', title: 'Twitter Thread - Behind the Scenes', description: 'Weekly company update thread', url: '/scheduler/calendar', category: 'Scheduled Content', date: '2024-01-18', status: 'Draft Ready' },
      
      // Approved Queue
      { id: 'approved-fashion-assets', type: 'task', title: 'Fashion Forward Campaign Assets', description: '15 approved social media posts ready for scheduling', url: '/scheduler/approved-queue', category: 'Approved Content', priority: 'medium' },
      { id: 'approved-video-series', type: 'task', title: 'Educational Video Series', description: '3 videos approved and ready for YouTube scheduling', url: '/scheduler/approved-queue', category: 'Approved Content', priority: 'high' },
      
      // Resource Planning
      { id: 'resource-jan-schedule', type: 'report', title: 'January Content Calendar', description: 'Full month scheduling overview and resource allocation', url: '/scheduler/resources', category: 'Planning' },
      { id: 'platform-analytics', type: 'report', title: 'Platform Performance Report', description: 'Best performing time slots by platform', url: '/scheduler/reports', category: 'Analytics' }
    ],

    manager: [
      // Team Dashboard
      { id: 'team-performance', type: 'report', title: 'Team Performance Overview', description: 'Monthly productivity and task completion rates', url: '/manager/dashboard', category: 'Team Management' },
      { id: 'project-timeline', type: 'report', title: 'Project Timeline Dashboard', description: 'All active projects and their current status', url: '/manager/projects', category: 'Project Management' },
      
      // Team Members
      { id: 'team-sarah', type: 'user', title: 'Sarah Wilson - Performance Review', description: 'Senior Editor - 95% completion rate this month', url: '/manager/team', category: 'Team' },
      { id: 'team-david', type: 'user', title: 'David Rodriguez - Workload', description: 'QC Specialist - 12 items in review queue', url: '/manager/team', category: 'Team' },
      { id: 'team-emma', type: 'user', title: 'Emma Wilson - Availability', description: 'Designer - Available for new projects', url: '/manager/team', category: 'Team' },
      
      // Projects
      { id: 'project-holiday-mgmt', type: 'project', title: 'Holiday Campaign Management', description: 'Overall project status and team allocation', url: '/manager/projects', category: 'Projects', status: '75% Complete' },
      { id: 'project-brand-refresh-mgmt', type: 'project', title: 'Brand Refresh Timeline', description: 'Project milestones and deliverable tracking', url: '/manager/projects', category: 'Projects', status: 'On Track' }
    ],

    client: [
      // Pending Approvals
      { id: 'approval-video-campaign', type: 'task', title: 'Video Campaign #VID-2024-003', description: 'Holiday promotional video awaiting your approval', url: '/client/approvals', category: 'Pending Approvals', priority: 'high', status: 'Awaiting Approval' },
      { id: 'approval-social-assets', type: 'task', title: 'Social Media Asset Package', description: '5 Instagram posts and 3 stories for review', url: '/client/approvals', category: 'Pending Approvals', priority: 'medium', status: 'Ready for Review' },
      { id: 'approval-brand-guidelines', type: 'task', title: 'Updated Brand Guidelines', description: 'Logo variations and color palette updates', url: '/client/approvals', category: 'Pending Approvals', priority: 'medium', status: 'Final Review' },
      
      // Projects
      { id: 'client-holiday-campaign', type: 'project', title: 'Holiday Campaign 2024', description: 'Your Q4 marketing campaign progress', url: '/client/projects', category: 'My Projects', status: '60% Complete' },
      { id: 'client-brand-refresh', type: 'project', title: 'Brand Refresh Project', description: 'Visual identity update project status', url: '/client/projects', category: 'My Projects', status: 'In Progress' },
      
      // Monthly Overview
      { id: 'monthly-performance', type: 'report', title: 'Monthly Performance Report', description: 'Social media metrics and campaign results', url: '/client/monthly-overview', category: 'Reports', date: '2024-01-01' },
      { id: 'content-calendar', type: 'report', title: 'Content Calendar Overview', description: 'Upcoming content schedule and key dates', url: '/client/monthly-overview', category: 'Planning' }
    ]
  };

  return baseData[role as keyof typeof baseData] || [];
};

interface SearchProviderProps {
  children: ReactNode;
}

export function SearchProvider({ children }: SearchProviderProps) {
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const search = useCallback(async (query: string, role: string): Promise<SearchResult[]> => {
    if (!query.trim()) {
      setSearchResults([]);
      return [];
    }

    setIsLoading(true);

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 200));

    const searchData = getSearchData(role);
    const lowercaseQuery = query.toLowerCase();

    const filtered = searchData.filter(item =>
      item.title.toLowerCase().includes(lowercaseQuery) ||
      item.description.toLowerCase().includes(lowercaseQuery) ||
      item.category.toLowerCase().includes(lowercaseQuery) ||
      (item.status && item.status.toLowerCase().includes(lowercaseQuery))
    );

    // Sort by relevance (exact title matches first, then description matches)
    const sorted = filtered.sort((a, b) => {
      const aTitle = a.title.toLowerCase();
      const bTitle = b.title.toLowerCase();
      const aDesc = a.description.toLowerCase();
      const bDesc = b.description.toLowerCase();

      if (aTitle.includes(lowercaseQuery) && !bTitle.includes(lowercaseQuery)) return -1;
      if (!aTitle.includes(lowercaseQuery) && bTitle.includes(lowercaseQuery)) return 1;
      if (aTitle.startsWith(lowercaseQuery) && !bTitle.startsWith(lowercaseQuery)) return -1;
      if (!aTitle.startsWith(lowercaseQuery) && bTitle.startsWith(lowercaseQuery)) return 1;

      return 0;
    });

    setSearchResults(sorted.slice(0, 8)); // Limit to 8 results
    setIsLoading(false);
    return sorted.slice(0, 8);
  }, []);

  const navigateToResult = useCallback((result: SearchResult, onPageChange: (page: string) => void) => {
    // Parse the URL to determine the page to navigate to
    const urlParts = result.url.split('/');
    let page = '';

    switch (urlParts[1]) {
      case 'admin':
        page = urlParts[2] || 'dashboard';
        break;
      case 'editor':
        page = urlParts[2] === 'my-tasks' ? 'my-tasks' : urlParts[2] || 'my-tasks';
        break;
      case 'qc_specialist':
        page = urlParts[2] === 'review-queue' ? 'review-queue' : 
              urlParts[2] === 'completed' ? 'completed' :
              urlParts[2] === 'guidelines' ? 'guidelines' : 'review-queue';
        break;
      case 'qc':
        page = urlParts[2] === 'review-queue' ? 'review-queue' : 
              urlParts[2] === 'completed' ? 'completed' :
              urlParts[2] === 'guidelines' ? 'guidelines' : 'review-queue';
        break;
      case 'scheduler':
        page = urlParts[2] === 'calendar' ? 'calendar' :
              urlParts[2] === 'approved-queue' ? 'approved-queue' :
              urlParts[2] === 'resources' ? 'resources' :
              urlParts[2] === 'reports' ? 'reports' : 'calendar';
        break;
      case 'manager':
        page = urlParts[2] === 'dashboard' ? 'dashboard' :
              urlParts[2] === 'projects' ? 'projects' :
              urlParts[2] === 'team' ? 'team' :
              urlParts[2] === 'performance' ? 'performance' :
              urlParts[2] === 'reports' ? 'reports' : 'dashboard';
        break;
      case 'client':
        page = urlParts[2] === 'monthly-overview' ? 'monthly-overview' :
              urlParts[2] === 'approvals' ? 'approvals' :
              urlParts[2] === 'projects' ? 'projects' :
              urlParts[2] === 'feedback' ? 'feedback' :
              urlParts[2] === 'archive' ? 'archive' : 'monthly-overview';
        break;
      default:
        return;
    }

    onPageChange(page);
  }, []);

  const value = {
    searchResults,
    isLoading,
    search,
    navigateToResult
  };

  return (
    <SearchContext.Provider value={value}>
      {children}
    </SearchContext.Provider>
  );
}