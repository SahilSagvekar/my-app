import { useState } from 'react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { ChevronLeft, ChevronRight, Play, FileText } from 'lucide-react';

interface Post {
  id: string;
  title: string;
  thumbnail: string;
  publishDate: string;
  platform: string;
  type: string;
  status: string;
  views: number;
  engagement: number;
  reach: number;
}

interface ClientCalendarViewProps {
  posts: Post[];
  selectedMonth: string;
}

export function ClientCalendarView({ posts, selectedMonth }: ClientCalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const [year, month] = selectedMonth.split('-');
    return new Date(parseInt(year), parseInt(month) - 1, 1);
  });

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const getPlatformColor = (platform: string) => {
    const colors = {
      'Instagram': 'bg-pink-500',
      'YouTube': 'bg-red-500',
      'Facebook': 'bg-blue-500',
      'LinkedIn': 'bg-blue-700'
    };
    return colors[platform as keyof typeof colors] || 'bg-gray-500';
  };

  const getContentTypeIcon = (type: string) => {
    switch (type) {
      case 'video': return <Play className="h-3 w-3" />;
      case 'image': return <FileText className="h-3 w-3" />;
      default: return <FileText className="h-3 w-3" />;
    }
  };

  const getPostsForDate = (day: number) => {
    const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return posts.filter(post => post.publishDate === dateStr);
  };

  const daysInMonth = getDaysInMonth(currentMonth);
  const firstDay = getFirstDayOfMonth(currentMonth);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const emptyDays = Array.from({ length: firstDay }, (_, i) => null);

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(currentMonth);
    if (direction === 'prev') {
      newMonth.setMonth(newMonth.getMonth() - 1);
    } else {
      newMonth.setMonth(newMonth.getMonth() + 1);
    }
    setCurrentMonth(newMonth);
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      day === today.getDate() &&
      currentMonth.getMonth() === today.getMonth() &&
      currentMonth.getFullYear() === today.getFullYear()
    );
  };

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">
          {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h3>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateMonth('prev')}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateMonth('next')}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="border rounded-lg overflow-hidden">
        {/* Day Headers */}
        <div className="grid grid-cols-7 border-b">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="p-3 bg-muted/50 text-center text-sm font-medium text-muted-foreground">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7">
          {/* Empty cells for days before month starts */}
          {emptyDays.map((_, index) => (
            <div key={`empty-${index}`} className="h-24 border-b border-r border-border/50"></div>
          ))}

          {/* Days of the month */}
          {days.map(day => {
            const dayPosts = getPostsForDate(day);
            const hasEvents = dayPosts.length > 0;
            
            return (
              <div
                key={day}
                className={`h-24 border-b border-r border-border/50 p-2 ${
                  isToday(day) ? 'bg-primary/5 border-primary/20' : ''
                }`}
              >
                <div className={`text-sm mb-1 ${isToday(day) ? 'font-medium text-primary' : ''}`}>
                  {day}
                </div>
                
                {hasEvents && (
                  <div className="space-y-1">
                    {dayPosts.slice(0, 2).map((post) => (
                      <div
                        key={post.id}
                        className="flex items-center gap-1 p-1 bg-background rounded text-xs border group hover:bg-accent/50 cursor-pointer"
                        title={`${post.title} - ${post.platform}`}
                      >
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getPlatformColor(post.platform)}`} />
                        <div className="flex items-center gap-1 flex-1 min-w-0">
                          {getContentTypeIcon(post.type)}
                          <span className="truncate">{post.title}</span>
                        </div>
                      </div>
                    ))}
                    
                    {dayPosts.length > 2 && (
                      <div className="text-xs text-muted-foreground text-center">
                        +{dayPosts.length - 2} more
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Calendar Legend */}
      <div className="flex items-center justify-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-pink-500 rounded-full"></div>
          <span>Instagram</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
          <span>YouTube</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
          <span>Facebook</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-blue-700 rounded-full"></div>
          <span>LinkedIn</span>
        </div>
      </div>
    </div>
  );
}