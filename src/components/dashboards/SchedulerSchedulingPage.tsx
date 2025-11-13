import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Calendar, Clock, Plus, Video, Image as ImageIcon, FileText, AlertCircle, Instagram, Facebook, Twitter, Youtube, CheckCircle, ExternalLink, Building } from 'lucide-react';
import { toast } from 'sonner';
import { useGlobalTasks } from '../workflow/GlobalTaskManager';
import { getPostingScheduleForClient, getClients } from '../utils/clientData';

interface ScheduledPost {
  id: string;
  taskId?: string;
  contentTitle: string;
  platform: 'instagram' | 'facebook' | 'twitter' | 'tiktok' | 'youtube' | 'linkedin';
  contentType: 'video' | 'image' | 'carousel' | 'reel' | 'story';
  scheduledDate: string;
  scheduledTime: string;
  caption: string;
  hashtags?: string;
  status: 'scheduled' | 'published' | 'failed';
  projectId?: string;
  driveUrl?: string;
}

export function SchedulerSchedulingPage() {
  const { tasks: allTasks, updateTask } = useGlobalTasks();
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [newPost, setNewPost] = useState({
    platform: 'instagram' as ScheduledPost['platform'],
    contentType: 'video' as ScheduledPost['contentType'],
    scheduledDate: '',
    scheduledTime: '',
    caption: '',
    hashtags: ''
  });

  // Load scheduled posts from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('pm_scheduled_posts');
    if (stored) {
      try {
        setScheduledPosts(JSON.parse(stored));
      } catch (error) {
        console.error('Error loading scheduled posts:', error);
      }
    }
  }, []);

  // Load clients from localStorage
  useEffect(() => {
    const loadedClients = getClients();
    setClients(loadedClients);
    
    // Set default client if available
    if (loadedClients.length > 0 && !selectedClientId) {
      setSelectedClientId(loadedClients[0].id);
    }
  }, []);

  // Get posting schedule for selected client
  const postingSchedule = getPostingScheduleForClient(selectedClientId || undefined);

  // Save scheduled posts to localStorage
  const saveScheduledPosts = (posts: ScheduledPost[]) => {
    setScheduledPosts(posts);
    localStorage.setItem('pm_scheduled_posts', JSON.stringify(posts));
  };

  // Get tasks ready for scheduling (approved by QC)
  const schedulingTasks = allTasks.filter(
    task => task.assignedToRole === 'scheduler' && 
           task.workflowStep === 'scheduling' && 
           task.status === 'pending'
  );

  const handleOpenScheduleDialog = (task: any) => {
    setSelectedTask(task);
    setNewPost({
      platform: 'instagram',
      contentType: task.type === 'video' ? 'video' : 'image',
      scheduledDate: '',
      scheduledTime: '',
      caption: '',
      hashtags: ''
    });
    setShowScheduleDialog(true);
  };

  const handleSchedulePost = () => {
    if (!selectedTask || !newPost.scheduledDate || !newPost.scheduledTime) {
      toast('⚠️ Missing Information', { description: 'Please fill in all required fields' });
      return;
    }

    if (!newPost.caption.trim()) {
      toast('⚠️ Missing Caption', { description: 'Please add a caption for the post' });
      return;
    }

    const post: ScheduledPost = {
      id: `post-${Date.now()}`,
      taskId: selectedTask.id,
      contentTitle: selectedTask.title,
      ...newPost,
      status: 'scheduled',
      projectId: selectedTask.projectId,
      driveUrl: selectedTask.files?.[0]?.url
    };

    const updatedPosts = [...scheduledPosts, post];
    saveScheduledPosts(updatedPosts);

    // Mark the task as completed
    updateTask(selectedTask.id, {
      status: 'completed',
      workflowStep: 'completed',
      completedAt: new Date().toISOString()
    });

    setShowScheduleDialog(false);
    setSelectedTask(null);
    setNewPost({
      platform: 'instagram',
      contentType: 'video',
      scheduledDate: '',
      scheduledTime: '',
      caption: '',
      hashtags: ''
    });

    toast('✅ Post Scheduled', { 
      description: `Scheduled for ${newPost.platform} on ${new Date(newPost.scheduledDate).toLocaleDateString()} at ${newPost.scheduledTime}` 
    });
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'instagram': return <Instagram className="h-5 w-5 text-pink-600" />;
      case 'facebook': return <Facebook className="h-5 w-5 text-blue-600" />;
      case 'twitter': return <Twitter className="h-5 w-5 text-sky-500" />;
      case 'tiktok': return <Video className="h-5 w-5 text-black" />;
      case 'youtube': return <Youtube className="h-5 w-5 text-red-600" />;
      case 'linkedin': return <FileText className="h-5 w-5 text-blue-700" />;
      default: return <FileText className="h-5 w-5" />;
    }
  };

  const getContentTypeIcon = (type: string) => {
    switch (type) {
      case 'video': return <Video className="h-4 w-4" />;
      case 'image': return <ImageIcon className="h-4 w-4" />;
      case 'reel': return <Video className="h-4 w-4" />;
      case 'story': return <ImageIcon className="h-4 w-4" />;
      case 'carousel': return <ImageIcon className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published': return 'default';
      case 'scheduled': return 'secondary';
      case 'failed': return 'destructive';
      default: return 'outline';
    }
  };

  const upcomingPosts = scheduledPosts
    .filter(p => p.status === 'scheduled')
    .sort((a, b) => 
      new Date(a.scheduledDate + ' ' + a.scheduledTime).getTime() - 
      new Date(b.scheduledDate + ' ' + b.scheduledTime).getTime()
    );

  const platformCounts = {
    instagram: scheduledPosts.filter(p => p.platform === 'instagram').length,
    facebook: scheduledPosts.filter(p => p.platform === 'facebook').length,
    twitter: scheduledPosts.filter(p => p.platform === 'twitter').length,
    tiktok: scheduledPosts.filter(p => p.platform === 'tiktok').length,
    youtube: scheduledPosts.filter(p => p.platform === 'youtube').length,
    linkedin: scheduledPosts.filter(p => p.platform === 'linkedin').length,
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1>Social Media Scheduling</h1>
          <p className="text-muted-foreground mt-2">
            Schedule approved content across social media platforms
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Instagram</p>
                <h3>{platformCounts.instagram}</h3>
              </div>
              <Instagram className="h-8 w-8 text-pink-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">TikTok</p>
                <h3>{platformCounts.tiktok}</h3>
              </div>
              <Video className="h-8 w-8 text-black" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Facebook</p>
                <h3>{platformCounts.facebook}</h3>
              </div>
              <Facebook className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">YouTube</p>
                <h3>{platformCounts.youtube}</h3>
              </div>
              <Youtube className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Twitter</p>
                <h3>{platformCounts.twitter}</h3>
              </div>
              <Twitter className="h-8 w-8 text-sky-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">LinkedIn</p>
                <h3>{platformCounts.linkedin}</h3>
              </div>
              <FileText className="h-8 w-8 text-blue-700" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Content Ready to Schedule */}
      {schedulingTasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Content Ready to Schedule</span>
              <Badge variant="default">{schedulingTasks.length}</Badge>
            </CardTitle>
            <CardDescription>
              QC-approved content ready for social media scheduling
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {schedulingTasks.map((task) => (
                <div key={task.id} className="p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium">{task.title}</h4>
                        {task.projectId && (
                          <Badge variant="outline" className="text-xs">
                            {task.projectId}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{task.description}</p>
                      
                      {task.files && task.files.length > 0 && (
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="text-muted-foreground">
                            {task.files.length} file{task.files.length > 1 ? 's' : ''} approved by QC
                          </span>
                          {task.files[0]?.url && (
                            <a 
                              href={task.files[0].url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline flex items-center gap-1"
                            >
                              View <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                    <Button onClick={() => handleOpenScheduleDialog(task)}>
                      <Calendar className="h-4 w-4 mr-2" />
                      Schedule
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Schedule Post Dialog */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent className="max-w-2xl" aria-describedby="schedule-post-description">
          <DialogHeader>
            <DialogTitle>Schedule Social Media Post</DialogTitle>
            <DialogDescription id="schedule-post-description">
              {selectedTask ? `Schedule "${selectedTask.title}" for social media publishing` : 'Schedule approved content to be posted across social platforms'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="platform">Platform *</Label>
                <Select value={newPost.platform} onValueChange={(value: any) => setNewPost({ ...newPost, platform: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="tiktok">TikTok</SelectItem>
                    <SelectItem value="facebook">Facebook</SelectItem>
                    <SelectItem value="youtube">YouTube</SelectItem>
                    <SelectItem value="twitter">Twitter</SelectItem>
                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contentType">Content Type *</Label>
                <Select value={newPost.contentType} onValueChange={(value: any) => setNewPost({ ...newPost, contentType: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="video">Video</SelectItem>
                    <SelectItem value="image">Image</SelectItem>
                    <SelectItem value="reel">Reel/Short</SelectItem>
                    <SelectItem value="story">Story</SelectItem>
                    <SelectItem value="carousel">Carousel</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Scheduled Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={newPost.scheduledDate}
                  onChange={(e) => setNewPost({ ...newPost, scheduledDate: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="time">Scheduled Time *</Label>
                <Input
                  id="time"
                  type="time"
                  value={newPost.scheduledTime}
                  onChange={(e) => setNewPost({ ...newPost, scheduledTime: e.target.value })}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="hashtags">Hashtags</Label>
                <Input
                  id="hashtags"
                  placeholder="#example #hashtags #content"
                  value={newPost.hashtags}
                  onChange={(e) => setNewPost({ ...newPost, hashtags: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="caption">Caption *</Label>
              <Textarea
                id="caption"
                placeholder="Write your post caption here..."
                value={newPost.caption}
                onChange={(e) => setNewPost({ ...newPost, caption: e.target.value })}
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                {newPost.caption.length} characters
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowScheduleDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSchedulePost}>
                <Calendar className="h-4 w-4 mr-2" />
                Schedule Post
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Best Times to Post */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <CardTitle>Recommended Posting Times</CardTitle>
              <CardDescription>
                {selectedClientId 
                  ? `Optimal times for ${clients.find(c => c.id === selectedClientId)?.company || 'selected client'}'s audience`
                  : 'Select a client to see custom posting times'}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="client-select" className="text-sm text-muted-foreground whitespace-nowrap">
                Client:
              </Label>
              <Select value={selectedClientId || ''} onValueChange={setSelectedClientId}>
                <SelectTrigger id="client-select" className="w-64">
                  <SelectValue placeholder="Select client..." />
                </SelectTrigger>
                <SelectContent>
                  {clients.length > 0 ? (
                    clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4" />
                          {client.company}
                        </div>
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-clients" disabled>
                      No clients available
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {postingSchedule.instagram && (
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Instagram className="h-5 w-5 text-pink-600" />
                  <span className="font-medium">Instagram</span>
                </div>
                <p className="text-sm text-muted-foreground">Weekdays: {postingSchedule.instagram.weekdays}</p>
                <p className="text-sm text-muted-foreground">Weekends: {postingSchedule.instagram.weekends}</p>
                <p className="text-sm text-blue-600 mt-1">Best: {postingSchedule.instagram.bestTimes}</p>
              </div>
            )}
            {postingSchedule.tiktok && (
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Video className="h-5 w-5 text-black" />
                  <span className="font-medium">TikTok</span>
                </div>
                <p className="text-sm text-muted-foreground">Weekdays: {postingSchedule.tiktok.weekdays}</p>
                <p className="text-sm text-muted-foreground">Weekends: {postingSchedule.tiktok.weekends}</p>
                <p className="text-sm text-blue-600 mt-1">Best: {postingSchedule.tiktok.bestTimes}</p>
              </div>
            )}
            {postingSchedule.youtube && (
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Youtube className="h-5 w-5 text-red-600" />
                  <span className="font-medium">YouTube</span>
                </div>
                <p className="text-sm text-muted-foreground">Weekdays: {postingSchedule.youtube.weekdays}</p>
                <p className="text-sm text-muted-foreground">Weekends: {postingSchedule.youtube.weekends}</p>
                <p className="text-sm text-blue-600 mt-1">Best: {postingSchedule.youtube.bestTimes}</p>
              </div>
            )}
            {postingSchedule.facebook && (
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Facebook className="h-5 w-5 text-blue-600" />
                  <span className="font-medium">Facebook</span>
                </div>
                <p className="text-sm text-muted-foreground">Weekdays: {postingSchedule.facebook.weekdays}</p>
                <p className="text-sm text-muted-foreground">Weekends: {postingSchedule.facebook.weekends}</p>
                <p className="text-sm text-blue-600 mt-1">Best: {postingSchedule.facebook.bestTimes}</p>
              </div>
            )}
            {postingSchedule.twitter && (
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Twitter className="h-5 w-5 text-sky-500" />
                  <span className="font-medium">Twitter</span>
                </div>
                <p className="text-sm text-muted-foreground">Weekdays: {postingSchedule.twitter.weekdays}</p>
                <p className="text-sm text-muted-foreground">Weekends: {postingSchedule.twitter.weekends}</p>
                <p className="text-sm text-blue-600 mt-1">Best: {postingSchedule.twitter.bestTimes}</p>
              </div>
            )}
            {postingSchedule.linkedin && (
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-5 w-5 text-blue-700" />
                  <span className="font-medium">LinkedIn</span>
                </div>
                <p className="text-sm text-muted-foreground">Weekdays: {postingSchedule.linkedin.weekdays}</p>
                <p className="text-sm text-muted-foreground">Weekends: {postingSchedule.linkedin.weekends}</p>
                <p className="text-sm text-blue-600 mt-1">Best: {postingSchedule.linkedin.bestTimes}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Scheduled Posts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Upcoming Scheduled Posts
            <Badge variant="secondary">{upcomingPosts.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingPosts.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-40" />
              <p>No upcoming posts</p>
              <p className="text-xs">Schedule approved content from the queue above</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingPosts.map((post) => (
                <div key={post.id} className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-accent rounded-lg">
                      {getPlatformIcon(post.platform)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium">{post.contentTitle}</h4>
                            <Badge variant="outline" className="text-xs">
                              {getContentTypeIcon(post.contentType)}
                              <span className="ml-1">{post.contentType}</span>
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              <span>{new Date(post.scheduledDate).toLocaleDateString()}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>{post.scheduledTime}</span>
                            </div>
                          </div>
                        </div>
                        <Badge variant={getStatusColor(post.status)} className="text-xs">
                          {post.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{post.caption}</p>
                      {post.hashtags && (
                        <p className="text-xs text-blue-600">{post.hashtags}</p>
                      )}
                      <div className="mt-3 flex items-center gap-2">
                        {post.projectId && (
                          <Badge variant="outline" className="text-xs">
                            {post.projectId}
                          </Badge>
                        )}
                        {post.driveUrl && (
                          <a 
                            href={post.driveUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                          >
                            View Content <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scheduling Tips */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <AlertCircle className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h4 className="font-medium">Social Media Scheduling Best Practices</h4>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                <li>• Schedule posts during peak engagement times for each platform</li>
                <li>• Maintain consistent posting frequency (at least 3-5 posts per week)</li>
                <li>• Include relevant hashtags to increase discoverability (10-15 for Instagram)</li>
                <li>• Preview content on each platform before scheduling to ensure proper formatting</li>
                <li>• Monitor performance metrics and adjust timing based on audience engagement</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
