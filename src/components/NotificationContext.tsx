import { createContext, useContext, useState, ReactNode, useEffect } from 'react';

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  priority: 'high' | 'medium' | 'low';
  actionRequired: boolean;
  user?: { name: string; avatar: string };
  link?: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (id: number) => void;
  markAllAsRead: () => void;
  deleteNotification: (id: number) => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}

const getRoleSpecificNotifications = (role: string): Notification[] => {
  const baseTime = Date.now();
  const formatTime = (minutesAgo: number) => {
    if (minutesAgo < 60) return `${minutesAgo} minutes ago`;
    const hoursAgo = Math.floor(minutesAgo / 60);
    if (hoursAgo < 24) return `${hoursAgo} hours ago`;
    const daysAgo = Math.floor(hoursAgo / 24);
    return `${daysAgo} days ago`;
  };

  switch (role) {
    case 'admin':
      return [
        {
          id: 1,
          type: 'system_alert',
          title: 'System Performance Alert',
          message: 'Server response time increased by 15% - monitoring required',
          timestamp: formatTime(30),
          read: false,
          priority: 'high',
          actionRequired: true,
          link: '/admin/system-status'
        },
        {
          id: 2,
          type: 'user_management',
          title: 'New User Registration',
          message: 'James Thompson completed account setup and awaits role assignment',
          timestamp: formatTime(45),
          read: false,
          priority: 'medium',
          actionRequired: true,
          user: { name: 'System', avatar: 'SY' },
          link: '/admin/users'
        },
        {
          id: 3,
          type: 'finance',
          title: 'Monthly Report Ready',
          message: 'Financial reports for July 2024 are ready for review',
          timestamp: formatTime(120),
          read: true,
          priority: 'medium',
          actionRequired: false,
          link: '/admin/finance'
        },
        {
          id: 4,
          type: 'security',
          title: 'Security Audit Log',
          message: '3 failed login attempts detected from IP 45.67.123.89',
          timestamp: formatTime(180),
          read: false,
          priority: 'high',
          actionRequired: true,
          link: '/admin/audit'
        }
      ];

    case 'editor':
      return [
        {
          id: 5,
          type: 'client_feedback',
          title: 'Client Change Request',
          message: 'Holiday Campaign Video requires urgent revisions - high priority client feedback received',
          timestamp: formatTime(5),
          read: false,
          priority: 'high',
          actionRequired: true,
          user: { name: 'Client Portal', avatar: 'CP' },
          link: '/editor/my-tasks'
        },
        {
          id: 6,
          type: 'task_assigned',
          title: 'New Task Assigned',
          message: 'Holiday Campaign 2024 - Social Media Pack needs immediate attention',
          timestamp: formatTime(15),
          read: false,
          priority: 'high',
          actionRequired: true,
          user: { name: 'Michael Chen', avatar: 'MC' },
          link: '/editor/my-tasks'
        },
        {
          id: 7,
          type: 'deadline_reminder',
          title: 'Deadline Approaching',
          message: 'Brand Guidelines #BG-2024-012 due in 3 hours',
          timestamp: formatTime(45),
          read: false,
          priority: 'high',
          actionRequired: true,
          link: '/editor/my-tasks'
        },
        {
          id: 8,
          type: 'revision_request',
          title: 'Revision Requested',
          message: 'QC team requested revisions on Video Campaign #VID-2024-003',
          timestamp: formatTime(90),
          read: true,
          priority: 'medium',
          actionRequired: true,
          user: { name: 'David Rodriguez', avatar: 'DR' },
          link: '/editor/my-tasks'
        }
      ];

    case 'qc':
      return [
        {
          id: 9,
          type: 'review_queue',
          title: 'New Items in Review Queue',
          message: '5 new items added to your review queue',
          timestamp: formatTime(10),
          read: false,
          priority: 'medium',
          actionRequired: true,
          link: '/qc/review-queue'
        },
        {
          id: 10,
          type: 'priority_review',
          title: 'Priority Review Required',
          message: 'Acme Corp campaign marked as urgent - requires immediate review',
          timestamp: formatTime(25),
          read: false,
          priority: 'high',
          actionRequired: true,
          user: { name: 'Sarah Johnson', avatar: 'SJ' },
          link: '/qc/review-queue'
        },
        {
          id: 11,
          type: 'guideline_update',
          title: 'QC Guidelines Updated',
          message: 'New brand standards added for video content review',
          timestamp: formatTime(240),
          read: true,
          priority: 'low',
          actionRequired: false,
          link: '/qc/guidelines'
        }
      ];

    case 'scheduler':
      return [
        {
          id: 12,
          type: 'approved_content',
          title: 'Content Ready for Scheduling',
          message: 'Fashion Forward campaign assets approved and ready',
          timestamp: formatTime(20),
          read: false,
          priority: 'medium',
          actionRequired: true,
          user: { name: 'David Rodriguez', avatar: 'DR' },
          link: '/scheduler/approved-queue'
        },
        {
          id: 13,
          type: 'schedule_conflict',
          title: 'Scheduling Conflict',
          message: 'Two posts scheduled for same time slot on Instagram',
          timestamp: formatTime(60),
          read: false,
          priority: 'high',
          actionRequired: true,
          link: '/scheduler/calendar'
        },
        {
          id: 14,
          type: 'resource_update',
          title: 'Resource Planning Update',
          message: 'Weekly resource allocation report available',
          timestamp: formatTime(180),
          read: true,
          priority: 'low',
          actionRequired: false,
          link: '/scheduler/resources'
        }
      ];

    case 'manager':
      return [
        {
          id: 15,
          type: 'team_performance',
          title: 'Team Performance Alert',
          message: 'Editorial team 15% behind on monthly targets',
          timestamp: formatTime(40),
          read: false,
          priority: 'high',
          actionRequired: true,
          link: '/manager/performance'
        },
        {
          id: 16,
          type: 'project_milestone',
          title: 'Project Milestone Reached',
          message: 'Q3 Marketing Campaign reached 75% completion',
          timestamp: formatTime(120),
          read: true,
          priority: 'medium',
          actionRequired: false,
          link: '/manager/projects'
        },
        {
          id: 17,
          type: 'resource_request',
          title: 'Resource Request',
          message: 'Additional designer requested for upcoming holiday campaign',
          timestamp: formatTime(200),
          read: false,
          priority: 'medium',
          actionRequired: true,
          user: { name: 'Lisa Park', avatar: 'LP' },
          link: '/manager/team'
        }
      ];

    case 'client':
      return [
        {
          id: 18,
          type: 'approval_request',
          title: 'Approval Required',
          message: 'Video Campaign #VID-2024-003 awaiting your approval',
          timestamp: formatTime(30),
          read: false,
          priority: 'high',
          actionRequired: true,
          user: { name: 'Emma Wilson', avatar: 'EW' },
          link: '/client/approvals'
        },
        {
          id: 19,
          type: 'content_ready',
          title: 'Content Ready for Review',
          message: '3 new social media assets ready for your feedback',
          timestamp: formatTime(90),
          read: false,
          priority: 'medium',
          actionRequired: true,
          link: '/client/approvals'
        },
        {
          id: 20,
          type: 'project_update',
          title: 'Project Status Update',
          message: 'Holiday Campaign 2024 moved to production phase',
          timestamp: formatTime(240),
          read: true,
          priority: 'low',
          actionRequired: false,
          user: { name: 'Michael Chen', avatar: 'MC' },
          link: '/client/projects'
        }
      ];

    default:
      return [];
  }
};

interface NotificationProviderProps {
  children: ReactNode;
  currentRole: string;
}

export function NotificationProvider({ children, currentRole }: NotificationProviderProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Update notifications when role changes
  useEffect(() => {
    setNotifications(getRoleSpecificNotifications(currentRole));
  }, [currentRole]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const addNotification = (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: Date.now(),
      timestamp: 'Just now',
      read: false
    };
    setNotifications(prev => [newNotification, ...prev]);
  };

  const markAsRead = (id: number) => {
    setNotifications(prev =>
      prev.map(notification =>
        notification.id === id
          ? { ...notification, read: true }
          : notification
      )
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev =>
      prev.map(notification => ({ ...notification, read: true }))
    );
  };

  const deleteNotification = (id: number) => {
    setNotifications(prev =>
      prev.filter(notification => notification.id !== id)
    );
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const value = {
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}