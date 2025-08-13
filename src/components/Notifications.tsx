import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from './ui/sheet';
import { useNotifications } from './NotificationContext';
import { 
  Bell, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  FileText, 
  User, 
  MessageCircle, 
  Calendar, 
  Trash2, 
  MarkAsRead,
  X,
  Shield,
  Eye
} from 'lucide-react';

interface NotificationsProps {
  currentRole: string;
}

export function Notifications({ currentRole }: NotificationsProps) {
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, clearAll } = useNotifications();
  const [filter, setFilter] = useState('all'); // all, unread

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'task_deadline':
      case 'deadline_reminder':
        return <Clock className="h-4 w-4 text-orange-500" />;
      case 'qc_approval':
      case 'review_queue':
      case 'priority_review':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'client_feedback':
      case 'mention':
        return <MessageCircle className="h-4 w-4 text-blue-500" />;
      case 'system':
      case 'system_alert':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'team_update':
      case 'user_management':
        return <User className="h-4 w-4 text-purple-500" />;
      case 'task_assigned':
      case 'content_ready':
      case 'approved_content':
        return <FileText className="h-4 w-4 text-blue-500" />;
      case 'security':
        return <Shield className="h-4 w-4 text-red-500" />;
      case 'schedule_conflict':
        return <Calendar className="h-4 w-4 text-orange-500" />;
      case 'approval_request':
        return <Eye className="h-4 w-4 text-blue-500" />;
      default:
        return <Bell className="h-4 w-4 text-gray-500" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-l-red-500';
      case 'medium': return 'border-l-yellow-500';
      case 'low': return 'border-l-green-500';
      default: return 'border-l-gray-500';
    }
  };

  const filteredNotifications = notifications.filter(notification => {
    switch (filter) {
      case 'unread':
        return !notification.read;
      default:
        return true;
    }
  });

  const NotificationItem = ({ notification, inSheet = false }: { notification: any, inSheet?: boolean }) => (
    <div
      className={`
        p-4 border-l-2 transition-colors
        ${getPriorityColor(notification.priority)}
        ${notification.read ? 'bg-background' : 'bg-muted/20'}
        ${inSheet ? 'hover:bg-muted/40' : ''}
      `}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          <div className="flex-shrink-0 mt-1">
            {getNotificationIcon(notification.type)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className={`text-sm ${notification.read ? 'text-muted-foreground' : 'font-medium'}`}>
                {notification.title}
              </h4>
              {!notification.read && (
                <div className="w-2 h-2 bg-blue-500 rounded-full" />
              )}
              {notification.actionRequired && (
                <Badge variant="outline" className="text-xs">
                  Action Required
                </Badge>
              )}
            </div>
            <p className={`text-sm ${notification.read ? 'text-muted-foreground' : 'text-foreground'}`}>
              {notification.message}
            </p>
            <div className="flex items-center gap-2 mt-2">
              {notification.user && (
                <div className="flex items-center gap-1">
                  <Avatar className="w-4 h-4">
                    <AvatarFallback className="text-xs">{notification.user.avatar}</AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-muted-foreground">{notification.user.name}</span>
                </div>
              )}
              <span className="text-xs text-muted-foreground">
                {notification.timestamp}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {!notification.read && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAsRead(notification.id)}
              className="h-8 w-8 p-0"
            >
              <CheckCircle className="h-3 w-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => deleteNotification(notification.id)}
            className="h-8 w-8 p-0"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 min-w-5 text-xs">
              {unreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-96 p-0">
        <SheetHeader className="p-6 pb-4 pr-12">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
            </SheetTitle>
            <Badge variant="outline">{unreadCount} unread</Badge>
          </div>
          <SheetDescription>
            View and manage your notifications and alerts
          </SheetDescription>
          
          <div className="flex items-center gap-2 mt-4">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              All
            </Button>
            <Button
              variant={filter === 'unread' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('unread')}
            >
              Unread
            </Button>
          </div>

          {unreadCount > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <Button variant="outline" size="sm" onClick={markAllAsRead}>
                Mark All Read
              </Button>
              <Button variant="outline" size="sm" onClick={clearAll}>
                Clear All
              </Button>
            </div>
          )}
        </SheetHeader>

        <ScrollArea className="flex-1 px-0">
          <div className="space-y-0">
            {filteredNotifications.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">No notifications</h3>
                <p className="text-sm">
                  {filter === 'all' 
                    ? "You're all caught up!" 
                    : "No unread notifications"}
                </p>
              </div>
            ) : (
              filteredNotifications.map((notification, index) => (
                <div key={notification.id}>
                  <NotificationItem notification={notification} inSheet={true} />
                  {index < filteredNotifications.length - 1 && <Separator />}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}