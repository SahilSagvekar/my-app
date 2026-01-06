"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Calendar, Clock, FileText, Eye, Search, Filter, CheckCircle, MapPin, Link as LinkIcon, Download, ChevronDown, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Toaster } from '../ui/sonner';
import { env } from 'process';

type SchedulerTask = {
  id: string;
  title: string;
  description?: string;
  priority: string;
  status: string;
  dueDate?: string;
  driveLinks?: [{ url: string }];
  files: { id: string | number; name: string; url: string; size: number; key?: string; folderType?: string }[];
  createdAt: string;
  projectId: string;
  deliverable?: any;
  socialMediaLinks?: Array<{ platform: string; url: string; postedAt: string }>;
};

// Folder type labels and icons
const folderTypes = {
  'script': { label: 'Script', icon: '📝', color: 'bg-blue-100 text-blue-800' },
  'voiceover': { label: 'Voice Over', icon: '🎤', color: 'bg-purple-100 text-purple-800' },
  'broll': { label: 'B-Roll', icon: '🎬', color: 'bg-green-100 text-green-800' },
  'music': { label: 'Music', icon: '🎵', color: 'bg-pink-100 text-pink-800' },
  'graphics': { label: 'Graphics', icon: '🎨', color: 'bg-yellow-100 text-yellow-800' },
  'thumbnail': { label: 'Thumbnail', icon: '🖼️', color: 'bg-indigo-100 text-indigo-800' },
  'outputs': { label: 'Final Output', icon: '✅', color: 'bg-emerald-100 text-emerald-800' },
  'other': { label: 'Other', icon: '📁', color: 'bg-gray-100 text-gray-800' },
};

export function SchedulerApprovedQueuePage() {
  const [tasks, setTasks] = useState<SchedulerTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<SchedulerTask | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  
  // Social media link dialog state
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [socialMediaPlatform, setSocialMediaPlatform] = useState('');
  const [socialMediaUrl, setSocialMediaUrl] = useState('');
  const [submittingLink, setSubmittingLink] = useState(false);

  // Folder expansion state
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadTasks();
  }, []);

  async function loadTasks() {
  try {
    setLoading(true);
    const res = await fetch("/api/schedular/tasks", { cache: "no-store" });
    const data = await res.json();

    const mapped = data.tasks.map((t: any) => {
      // Map driveLinks to files format
      const filesFromDriveLinks = (t.driveLinks || []).map((url: string, index: number) => {
        // Extract filename from URL
        const urlParts = url.split('/');
        const filename = urlParts[urlParts.length - 1];
        
        // Extract folder type from URL path
        let folderType = 'other';
        if (url.includes('/outputs/')) {
          // Check if it's in a subfolder within outputs
          if (url.includes('/music-license/')) {
            folderType = 'music';
          } else if (url.includes('/thumbnails/')) {
            folderType = 'thumbnail';
          } else if (url.includes('/broll/')) {
            folderType = 'broll';
          } else if (url.includes('/script/')) {
            folderType = 'script';
          } else if (url.includes('/voiceover/')) {
            folderType = 'voiceover';
          } else if (url.includes('/graphics/')) {
            folderType = 'graphics';
          } else {
            folderType = 'outputs'; // Main output file
          }
        }

        // Extract S3 key (everything after the bucket URL)
        const bucketUrl = "https://" + process.env.AWS_S3_BUCKET + ".s3.us-east-1.amazonaws.com/";
        const key = url.replace(bucketUrl, "");

        return {
          id: `${t.id}-file-${index}`,
          name: decodeURIComponent(filename),
          url: url,
          key: key,
          size: 0, // Size not available from driveLinks
          folderType: folderType,
        };
      });

      // Combine with existing files if any
      const allFiles = [
        ...filesFromDriveLinks,
        ...(t.files || []).map((file: any) => ({
          id: file.id,
          name: file.name,
          url: file.url,
          key: file.url.replace("https://" + process.env.AWS_S3_BUCKET + ".s3.us-east-1.amazonaws.com/", ""),
          size: file.size || 0,
          folderType: file.subfolder || 'other',
        }))
      ];

      return {
        id: t.id,
        title: t.title,
        description: t.description,
        priority: t.priority || "medium",
        status: t.status === "COMPLETED" ? "SCHEDULED" : "PENDING",
        dueDate: t.dueDate,
        files: allFiles,
        createdAt: t.createdAt,
        projectId: t.clientId,
        deliverable: t.monthlyDeliverable,
        socialMediaLinks: t.socialMediaLinks || [],
      };
    });

    setTasks(mapped);

    if (!selectedTask && mapped.length > 0) {
      setSelectedTask(mapped.find((t: SchedulerTask) => t.status === "PENDING") || mapped[0]);
    }
  } catch (error) {
    console.error("Error loading tasks:", error);
    toast.error('Error', {
      description: 'Failed to load tasks',
    });
  } finally {
    setLoading(false);
  }
}

  async function scheduleTask(task: SchedulerTask) {
    try {
      setBusyId(task.id);

      const res = await fetch(`/api/tasks/${task.id}/mark-scheduled`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postedAt: new Date().toISOString() })
      });

      if (!res.ok) throw new Error("Failed to schedule");

      setTasks(prev =>
        prev.map(t => t.id === task.id ? { ...t, status: "SCHEDULED" } : t)
      );

      setSelectedTask(null);
      toast.success('Task Scheduled', {
        description: 'Content has been marked as scheduled.',
      });

    } catch (err) {
      console.error(err);
      toast.error('Error', {
        description: 'Failed to schedule task.',
      });
    } finally {
      setBusyId(null);
    }
  }

  async function submitSocialMediaLink() {
    if (!selectedTask || !socialMediaPlatform || !socialMediaUrl) {
      toast.error('Error', {
        description: 'Please fill in all fields.',
      });
      return;
    }

    try {
      setSubmittingLink(true);

      const res = await fetch(`/api/tasks/${selectedTask.id}/social-media-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: socialMediaPlatform,
          url: socialMediaUrl,
        }),
      });

      if (!res.ok) throw new Error('Failed to submit link');

      const data = await res.json();

      // Update task with new social media link
      const updatedLink = {
        platform: socialMediaPlatform,
        url: socialMediaUrl,
        postedAt: new Date().toISOString(),
      };

      setTasks(prev =>
        prev.map(t =>
          t.id === selectedTask.id
            ? { ...t, socialMediaLinks: [...(t.socialMediaLinks || []), updatedLink] }
            : t
        )
      );

      setSelectedTask(prev =>
        prev ? { ...prev, socialMediaLinks: [...(prev.socialMediaLinks || []), updatedLink] } : null
      );

      // Reset form
      setSocialMediaPlatform('');
      setSocialMediaUrl('');
      setShowLinkDialog(false);

      toast.success('Link Added', {
        description: 'Social media post link has been saved.',
      });

    } catch (err) {
      console.error(err);
      toast.error('Error', {
        description: 'Failed to submit social media link.',
      });
    } finally {
      setSubmittingLink(false);
    }
  }

  const toggleFolder = (folderType: string) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folderType]: !prev[folderType],
    }));
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "destructive";
      case "high": return "default";
      case "medium": return "secondary";
      default: return "outline";
    }
  };

  const filtered = tasks.filter(t => {
    const matchText = t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchPriority = priorityFilter === "all" || t.priority === priorityFilter;
    return matchText && matchPriority;
  });

  const pendingTasks = filtered.filter(t => t.status === "PENDING");
  const completedTasks = filtered.filter(t => t.status === "COMPLETED");

  // Group files by folder type
  const filesByFolder = selectedTask?.files.reduce((acc, file) => {
    const folder = file.folderType || 'other';
    if (!acc[folder]) acc[folder] = [];
    acc[folder].push(file);
    return acc;
  }, {} as Record<string, typeof selectedTask.files>) || {};

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1>Approved Queue</h1>
          <p className="text-muted-foreground mt-2">
            QC-approved content ready for scheduling
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm">Pending</p>
              <h3>{pendingTasks.length}</h3>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <p className="text-sm">Scheduled Today</p>
              <h3>
                {completedTasks.filter(
                  (t) =>
                    new Date(t.createdAt).toDateString() ===
                    new Date().toDateString()
                ).length}
              </h3>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <p className="text-sm">Urgent</p>
              <h3>{pendingTasks.filter((t) => t.priority === "urgent").length}</h3>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4 flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by title or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* MAIN LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT: Tasks */}
          <Card>
            <CardHeader>
              <CardTitle>Pending Tasks</CardTitle>
            </CardHeader>

            <CardContent className="p-0 max-h-[600px] overflow-y-auto">
              {pendingTasks.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <p>No pending tasks</p>
                </div>
              ) : (
                pendingTasks.map((task) => (
                  <div
                    key={task.id}
                    className={`p-4 border-b cursor-pointer hover:bg-muted/50 transition-colors ${
                      selectedTask?.id === task.id ? "bg-muted" : ""
                    }`}
                    onClick={() => setSelectedTask(task)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-medium">{task.title}</h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          Due: {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "N/A"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Files: {task.files.length}
                        </p>
                      </div>
                      <Badge variant={getPriorityColor(task.priority)}>
                        {task.priority}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* RIGHT: Details */}
          <Card>
            <CardHeader>
              <CardTitle>Task Details</CardTitle>
            </CardHeader>

            <CardContent>
              {!selectedTask ? (
                <p className="text-muted-foreground">Select a task to view details</p>
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="font-medium text-lg">{selectedTask.title}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {selectedTask.description || 'No description provided'}
                    </p>
                  </div>

                  {/* Deliverable */}
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Deliverable Info
                    </h4>
                    {selectedTask.deliverable ? (
                      <div className="text-sm space-y-1">
                        <p><strong>Type:</strong> {selectedTask.deliverable.type}</p>
                        <p><strong>Schedule:</strong> {selectedTask.deliverable.postingSchedule}</p>
                        <p><strong>Days:</strong> {selectedTask.deliverable.postingDays?.join(", ") || 'N/A'}</p>
                        <p><strong>Times:</strong> {selectedTask.deliverable.postingTimes?.join(", ") || 'N/A'}</p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No deliverable linked</p>
                    )}
                  </div>

                  {/* Files organized by folder */}
                  <div className="space-y-2">
                    <h4 className="font-medium flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Task Files ({selectedTask.files.length})
                    </h4>

                    {Object.keys(filesByFolder).length === 0 ? (
                      <p className="text-sm text-muted-foreground">No files uploaded yet</p>
                    ) : (
                      Object.entries(filesByFolder).map(([folderType, files]) => {
                        const folderInfo = folderTypes[folderType as keyof typeof folderTypes] || folderTypes.other;
                        const isExpanded = expandedFolders[folderType] !== false; // Default to expanded

                        return (
                          <div
                            key={folderType}
                            className="border rounded-lg overflow-hidden"
                          >
                            {/* Folder Header */}
                            <button
                              className="w-full p-3 flex items-center justify-between hover:bg-muted/50 transition-colors"
                              onClick={() => toggleFolder(folderType)}
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-lg">
                                  {folderInfo.icon}
                                </span>
                                <span className="font-medium text-sm">
                                  {folderInfo.label}
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  {files.length} file
                                  {files.length !== 1 ? "s" : ""}
                                </Badge>
                              </div>
                              <ChevronDown
                                className={`h-4 w-4 transition-transform ${
                                  isExpanded ? "rotate-180" : ""
                                }`}
                              />
                            </button>

                            {/* Files List */}
                            {isExpanded && (
                              <div className="border-t bg-muted/20">
                                {files.map((file) => (
                                  <div
                                    key={file.id}
                                    className="p-3 border-b last:border-b-0 flex items-center justify-between gap-2"
                                  >
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium truncate">
                                        {file.name}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {(file.size / 1024 / 1024).toFixed(2)}{" "}
                                        MB
                                      </p>
                                    </div>

                                    <div className="flex gap-2 flex-shrink-0">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => window.open(file.url, "_blank")}
                                      >
                                        <Eye className="h-3 w-3 mr-1" />
                                        View
                                      </Button>

                                      {/* <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={async () => {
                                          if (!file.key) {
                                            toast.error("Error", {
                                              description: "File key missing",
                                            });
                                            return;
                                          }

                                          try {
                                            const res = await fetch(
                                              "/api/download",
                                              {
                                                method: "POST",
                                                headers: {
                                                  "Content-Type":
                                                    "application/json",
                                                },
                                                body: JSON.stringify({
                                                  key: file.key,
                                                  filename: file.name,
                                                  action: "view", // Add this to tell API to inline instead of download
                                                }),
                                              }
                                            );

                                            if (!res.ok)
                                              throw new Error(
                                                "Failed to get file URL"
                                              );

                                            const { url } = await res.json();
                                            window.open(url, "_blank");
                                          } catch (err) {
                                            console.error(err);
                                            toast.error("Error", {
                                              description:
                                                "Failed to view file",
                                            });
                                          }
                                        }}
                                      >
                                        <Eye className="h-3 w-3 mr-1" />
                                        View
                                      </Button> */}

                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={async () => {
                                          if (!file.key) {
                                            toast.error("Error", {
                                              description: "File key missing",
                                            });
                                            return;
                                          }

                                          try {
                                            const res = await fetch(
                                              "/api/download",
                                              {
                                                method: "POST",
                                                headers: {
                                                  "Content-Type":
                                                    "application/json",
                                                },
                                                body: JSON.stringify({
                                                  key: file.key,
                                                  filename: file.name,
                                                }),
                                              }
                                            );

                                            const { url } = await res.json();

                                            const a =
                                              document.createElement("a");
                                            a.href = url;
                                            a.download = file.name;
                                            document.body.appendChild(a);
                                            a.click();
                                            a.remove();
                                          } catch (err) {
                                            toast.error("Error", {
                                              description:
                                                "Failed to download file",
                                            });
                                          }
                                        }}
                                      >
                                        <Download className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Social Media Links */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium flex items-center gap-2">
                        <LinkIcon className="h-4 w-4" />
                        Social Media Posts
                      </h4>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowLinkDialog(true)}
                      >
                        <LinkIcon className="h-3 w-3 mr-1" />
                        Add Link
                      </Button>
                    </div>

                    {selectedTask.socialMediaLinks && selectedTask.socialMediaLinks.length > 0 ? (
                      <div className="space-y-2">
                        {selectedTask.socialMediaLinks.map((link, index) => (
                          <div
                            key={index}
                            className="border rounded-lg p-3 flex items-center justify-between"
                          >
                            <div className="flex-1">
                              <p className="text-sm font-medium capitalize">{link.platform}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {link.url}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Posted: {new Date(link.postedAt).toLocaleString()}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => window.open(link.url, '_blank')}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No social media posts added yet
                      </p>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-4">
                    <Button
                      className="flex-1"
                      onClick={() => scheduleTask(selectedTask)}
                      disabled={busyId === selectedTask.id}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Mark as Scheduled
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Social Media Link Dialog */}
      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Social Media Post Link</DialogTitle>
            <DialogDescription>
              Add the link where this content was posted on social media.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Platform</label>
              <Select value={socialMediaPlatform} onValueChange={setSocialMediaPlatform}>
                <SelectTrigger>
                  <SelectValue placeholder="Select platform" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="facebook">Facebook</SelectItem>
                  <SelectItem value="twitter">Twitter/X</SelectItem>
                  <SelectItem value="youtube">YouTube</SelectItem>
                  <SelectItem value="tiktok">TikTok</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Post URL</label>
              <Input
                placeholder="https://..."
                value={socialMediaUrl}
                onChange={(e) => setSocialMediaUrl(e.target.value)}
                disabled={submittingLink}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowLinkDialog(false);
                  setSocialMediaPlatform('');
                  setSocialMediaUrl('');
                }}
                disabled={submittingLink}
              >
                Cancel
              </Button>
              <Button
                onClick={submitSocialMediaLink}
                disabled={!socialMediaPlatform || !socialMediaUrl || submittingLink}
              >
                {submittingLink ? 'Saving...' : 'Add Link'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Toaster />
    </>
  );
}