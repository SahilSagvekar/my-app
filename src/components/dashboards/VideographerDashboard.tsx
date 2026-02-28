'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Calendar } from '../ui/calendar';
import {
  Camera,
  Upload,
  Calendar as CalendarIcon,
  MapPin,
  Clock,
  User,
  CheckCircle2,
  Download,
  Eye,
  Settings,
  Briefcase,
  Loader,
  DollarSign,
  FileText,
  Link,
  Video,
  Image as ImageIcon,
  File as FileIcon,
} from 'lucide-react';
import { toast } from 'sonner';

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────

interface Bid {
  id: string;
  amount: number;
  note?: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
}

interface Job {
  id: string;
  title: string;
  description: string;
  location?: string;
  startDate: string;
  endDate?: string;
  equipment?: string;
  camera?: string;
  quality?: string;
  frameRate?: string;
  lighting?: string;
  exclusions?: string;
  referenceLinks?: string[];
  budget?: number;
  status: 'OPEN' | 'ASSIGNED' | 'COMPLETED' | 'CANCELLED';
  bids?: Bid[];
  _count?: { bids: number };
}

interface TaskFile {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  folderType?: string;
}

// ─────────────────────────────────────────
// Loading Fallback
// ─────────────────────────────────────────

function DashboardLoadingFallback({ componentName = "Component" }) {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center space-y-4">
        <Loader className="h-12 w-12 animate-spin mx-auto text-muted-foreground" />
        <p className="text-muted-foreground">Loading {componentName}...</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getFileIcon(mimeType: string) {
  if (mimeType?.startsWith('video/')) return <Video className="h-4 w-4 text-blue-500" />;
  if (mimeType?.startsWith('image/')) return <ImageIcon className="h-4 w-4 text-green-500" />;
  return <FileIcon className="h-4 w-4 text-gray-500" />;
}

// ─────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────

interface VideographerDashboardProps {
  initialTab?: string;
}

export function VideographerDashboard({ initialTab }: VideographerDashboardProps = {}) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab || 'jobs');

  // Sync activeTab with initialTab prop
  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/tasks');
      if (res.ok) {
        const data = await res.json();
        const taskList = Array.isArray(data) ? data : (data.tasks || []);
        setTasks(taskList);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsCompleted = async (taskId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'COMPLETED' })
      });

      if (res.ok) {
        toast.success('Shoot marked as completed');
        fetchTasks();
      }
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleSaveShootNotes = async (taskId: string, notes: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/shoot-notes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes })
      });

      if (res.ok) {
        toast.success('Notes saved successfully');
        fetchTasks();
      }
    } catch (error) {
      toast.error('Failed to save notes');
    }
  };

  const upcomingTasks = tasks.filter(task => task.status === 'VIDEOGRAPHER_ASSIGNED' || task.status === 'PENDING');
  const inProgressTasks = tasks.filter(task => task.status === 'IN_PROGRESS' || task.status === 'SHOOTING');
  const completedTasks = tasks.filter(task => task.status === 'COMPLETED');

  // Get all files across all tasks
  const allFiles = tasks.flatMap(task =>
    (task.files || []).map((f: any) => ({ ...f, taskTitle: task.title, taskId: task.id }))
  );

  // ─────────────────────────────────────────
  // Job Board Tab
  // ─────────────────────────────────────────

  const JobBoardTab = () => {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [jobsLoading, setJobsLoading] = useState(true);
    const [selectedJob, setSelectedJob] = useState<Job | null>(null);
    const [bidAmount, setBidAmount] = useState('');
    const [bidNote, setBidNote] = useState('');
    const [isBidDialogOpen, setIsBidDialogOpen] = useState(false);

    useEffect(() => {
      fetchJobs();
    }, []);

    const fetchJobs = async () => {
      try {
        setJobsLoading(true);
        const res = await fetch('/api/jobs?status=OPEN');
        if (res.ok) {
          const data = await res.json();
          setJobs(data);
        } else {
          const errorData = await res.json().catch(() => ({}));
          toast.error('Could not load jobs', { description: errorData.error || 'Check server logs' });
        }
      } catch (error) {
        toast.error('Network error', { description: 'Failed to connect to API' });
      } finally {
        setJobsLoading(false);
      }
    };

    const handleBidClick = (job: Job) => {
      setSelectedJob(job);
      const myBid = job.bids && job.bids.length > 0 ? job.bids[0] : null;
      if (myBid) {
        setBidAmount(myBid.amount.toString());
        setBidNote(myBid.note || '');
      } else {
        setBidAmount('');
        setBidNote('');
      }
      setIsBidDialogOpen(true);
    };

    const submitBid = async () => {
      if (!selectedJob || !bidAmount) return;

      try {
        const res = await fetch(`/api/jobs/${selectedJob.id}/bids`, {
          method: 'POST',
          body: JSON.stringify({
            amount: parseFloat(bidAmount),
            note: bidNote
          }),
        });

        if (res.ok) {
          toast.success(`Bid of $${bidAmount} submitted for ${selectedJob.title}`);
          setIsBidDialogOpen(false);
          fetchJobs();
        } else {
          const err = await res.json();
          toast.error('Bid Failed', { description: err.error });
        }
      } catch (error) {
        toast.error('Something went wrong');
      }
    };

    if (jobsLoading) return <DashboardLoadingFallback componentName="Job Board" />;

    return (
      <>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {jobs.length === 0 ? (
            <div className="col-span-full text-center py-10 text-muted-foreground">
              <Briefcase className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No open jobs available at the moment.</p>
              <p className="text-sm mt-1">Check back later for new opportunities</p>
            </div>
          ) : (
            jobs.map((job) => {
              const myBid = job.bids && job.bids.length > 0 ? job.bids[0] : null;
              const hasBid = !!myBid;

              return (
                <Card key={job.id} className="flex flex-col">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg">{job.title}</CardTitle>
                      {hasBid && (
                        <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                          Bid Placed: ${myBid.amount}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{job.description}</p>
                  </CardHeader>
                  <CardContent className="flex-1 space-y-4">
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {new Date(job.startDate).toLocaleDateString()}
                          {job.endDate && ` - ${new Date(job.endDate).toLocaleDateString()}`}
                        </span>
                      </div>
                      {job.equipment && (
                        <div className="flex items-center gap-2">
                          <Settings className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs">{job.equipment}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>{job.location || 'Location TBD'}</span>
                      </div>
                      {job.budget && (
                        <div className="flex items-center gap-2 font-medium text-green-700">
                          <DollarSign className="h-4 w-4" />
                          <span>Budget: ${job.budget}</span>
                        </div>
                      )}

                      {(job.camera || job.quality) && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {job.camera && <Badge variant="secondary" className="text-[10px] bg-slate-100">{job.camera}</Badge>}
                          {job.quality && <Badge variant="secondary" className="text-[10px] bg-slate-100">{job.quality}</Badge>}
                        </div>
                      )}
                    </div>

                    <div className="pt-4 mt-auto">
                      <Button
                        className="w-full"
                        variant={hasBid ? "outline" : "default"}
                        onClick={() => handleBidClick(job)}
                      >
                        {hasBid ? 'Update Bid' : 'Submit Bid'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        <Dialog open={isBidDialogOpen} onOpenChange={setIsBidDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-xl">Bid for {selectedJob?.title}</DialogTitle>
              <DialogDescription>
                Detailed technical requirements are listed below.
              </DialogDescription>
            </DialogHeader>

            {selectedJob && (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3 my-2 text-sm">
                <div className="flex items-center gap-2 font-bold text-slate-700 uppercase text-xs tracking-wider">
                  <Settings className="h-4 w-4" /> Technical Requirements
                </div>
                <div className="grid grid-cols-2 gap-y-2">
                  <div className="text-muted-foreground text-xs">Preferred Camera:</div>
                  <div className="font-medium">{selectedJob.camera || 'Not specified'}</div>

                  <div className="text-muted-foreground text-xs">Quality Specs:</div>
                  <div className="font-medium flex gap-1 items-center">
                    <Badge variant="outline" className="px-1 text-[10px]">{selectedJob.quality || 'Standard'}</Badge>
                    <Badge variant="outline" className="px-1 text-[10px]">{selectedJob.frameRate || '30fps'}</Badge>
                  </div>

                  <div className="text-muted-foreground text-xs">Lighting Setup:</div>
                  <div className="font-medium">{selectedJob.lighting || 'TBD'}</div>
                </div>

                {selectedJob.exclusions && (
                  <div className="pt-2 border-t border-slate-200">
                    <p className="text-xs font-bold text-red-600 mb-1">DON'T CAPTURE:</p>
                    <p className="text-xs text-red-700 italic">{selectedJob.exclusions}</p>
                  </div>
                )}

                {selectedJob.referenceLinks && selectedJob.referenceLinks.length > 0 && (
                  <div className="pt-2 border-t border-slate-200 flex flex-wrap gap-2">
                    {selectedJob.referenceLinks.map((link, i) => (
                      <a key={i} href={link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] text-blue-600 hover:underline">
                        <Link className="h-3 w-3" /> Reference {i + 1}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Your Rate ($)</label>
                <Input
                  type="number"
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                  placeholder="e.g. 500"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Notes / Cover Letter</label>
                <Textarea
                  value={bidNote}
                  onChange={(e) => setBidNote(e.target.value)}
                  placeholder="I have experience with this type of shoot..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsBidDialogOpen(false)}>Cancel</Button>
              <Button onClick={submitBid}>Submit Bid</Button>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  };

  // ─────────────────────────────────────────
  // Shooting Schedule Tab
  // ─────────────────────────────────────────

  const ShootingScheduleTab = () => {
    return (
      <div className="space-y-6">
        <div className="grid gap-6">
          <Card>
            <CardHeader className="bg-orange-50/30 border-b border-orange-100/50">
              <CardTitle className="flex items-center gap-2 text-orange-900">
                <Camera className="h-5 w-5" />
                Active & Upcoming Shoots
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {tasks.filter(t => t.status !== 'COMPLETED').map((task) => (
                  <div key={task.id} className="border border-gray-100 rounded-xl p-5 hover:shadow-md transition-shadow bg-white">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div className="space-y-3 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-bold text-lg">{task.title || "Untitled Shoot"}</h4>
                          <Badge className="bg-blue-100 text-blue-800">
                            {task.status.replace(/_/g, " ")}
                          </Badge>
                          {task.priority && (
                            <Badge variant="outline" className={task.priority === "high" ? "border-red-200 text-red-700 bg-red-50" : "border-slate-200 text-slate-600 bg-slate-50"}>
                              {task.priority} priority
                            </Badge>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                            <User className="h-4 w-4 text-primary" />
                            <span className="font-medium text-slate-900">{task.client?.companyName || task.client?.name || 'No Client'}</span>
                          </div>
                          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                            <CalendarIcon className="h-4 w-4 text-primary" />
                            <span className="font-medium text-slate-900">
                              {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No date'}
                            </span>
                          </div>
                          {task.shootDetail?.location && (
                            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                              <MapPin className="h-4 w-4 text-primary" />
                              <span className="font-medium truncate text-slate-900" title={task.shootDetail.location}>
                                {task.shootDetail.location}
                              </span>
                            </div>
                          )}
                        </div>

                        {task.description && (
                          <div className="text-sm text-muted-foreground bg-gray-50/50 p-3 rounded-lg italic line-clamp-2">
                            {task.description}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-row md:flex-col gap-2 shrink-0">
                        <Button
                          variant="default"
                          className="bg-primary hover:bg-primary/90 shadow-sm shadow-primary/20"
                          onClick={() => {
                            setSelectedTask(task);
                            setIsDetailsOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Brief
                        </Button>
                        <Button
                          variant="outline"
                          className="border-green-200 hover:bg-green-50 text-green-700 hover:text-green-800"
                          onClick={() => handleMarkAsCompleted(task.id)}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Mark Finished
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}

                {tasks.filter(t => t.status !== 'COMPLETED').length === 0 && (
                  <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <Camera className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 font-medium">No active shoots found in your schedule.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Shoot Details Modal */}
        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="max-w-2xl bg-white p-0 overflow-hidden rounded-2xl border-none shadow-2xl">
            {selectedTask && (
              <div className="flex flex-col h-full">
                <div className="bg-primary p-6 text-primary-foreground">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-bold flex items-center gap-3">
                      <Camera className="h-6 w-6" /> Shoot Briefing
                    </DialogTitle>
                    <DialogDescription className="text-primary-foreground/80 font-medium">
                      {selectedTask.title || "Untitled Task"}
                    </DialogDescription>
                  </DialogHeader>
                </div>

                <div className="p-8 space-y-8 overflow-y-auto max-h-[70vh]">
                  {/* Location & Time */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="uppercase tracking-wider text-xs font-bold text-muted-foreground">Location</Label>
                      <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <MapPin className="h-5 w-5 text-primary" />
                        <span className="font-semibold text-slate-900">{selectedTask.shootDetail?.location || "TBD"}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="uppercase tracking-wider text-xs font-bold text-muted-foreground">Date</Label>
                      <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <CalendarIcon className="h-5 w-5 text-primary" />
                        <span className="font-semibold text-slate-900">
                          {selectedTask.dueDate ? new Date(selectedTask.dueDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : "Not Set"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Technical Specs */}
                  {selectedTask.shootDetail && (
                    <div className="space-y-3">
                      <Label className="uppercase tracking-wider text-xs font-bold text-muted-foreground">Technical Specs</Label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {selectedTask.shootDetail.camera && (
                          <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 text-center">
                            <p className="text-[10px] uppercase tracking-wider text-blue-500 font-bold">Camera</p>
                            <p className="font-semibold text-sm mt-1">{selectedTask.shootDetail.camera}</p>
                          </div>
                        )}
                        {selectedTask.shootDetail.quality && (
                          <div className="p-3 bg-purple-50 rounded-xl border border-purple-100 text-center">
                            <p className="text-[10px] uppercase tracking-wider text-purple-500 font-bold">Quality</p>
                            <p className="font-semibold text-sm mt-1">{selectedTask.shootDetail.quality}</p>
                          </div>
                        )}
                        {selectedTask.shootDetail.frameRate && (
                          <div className="p-3 bg-green-50 rounded-xl border border-green-100 text-center">
                            <p className="text-[10px] uppercase tracking-wider text-green-500 font-bold">Frame Rate</p>
                            <p className="font-semibold text-sm mt-1">{selectedTask.shootDetail.frameRate}</p>
                          </div>
                        )}
                        {selectedTask.shootDetail.lighting && (
                          <div className="p-3 bg-orange-50 rounded-xl border border-orange-100 text-center">
                            <p className="text-[10px] uppercase tracking-wider text-orange-500 font-bold">Lighting</p>
                            <p className="font-semibold text-sm mt-1">{selectedTask.shootDetail.lighting}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  {selectedTask.description && (
                    <div className="space-y-2">
                      <Label className="uppercase tracking-wider text-xs font-bold text-muted-foreground">Description</Label>
                      <p className="text-sm text-slate-700 bg-gray-50 p-4 rounded-xl border border-gray-100">{selectedTask.description}</p>
                    </div>
                  )}

                  {/* Exclusions */}
                  {selectedTask.shootDetail?.exclusions && (
                    <div className="space-y-2">
                      <Label className="uppercase tracking-wider text-xs font-bold text-red-500">DON'T CAPTURE</Label>
                      <p className="text-sm text-red-700 bg-red-50 p-4 rounded-xl border border-red-100 italic">{selectedTask.shootDetail.exclusions}</p>
                    </div>
                  )}

                  {/* Notes */}
                  {selectedTask.shootDetail?.videographerNotes && (
                    <div className="space-y-2">
                      <Label className="uppercase tracking-wider text-xs font-bold text-muted-foreground">Shoot Notes</Label>
                      <p className="text-sm text-slate-600 bg-amber-50 p-4 rounded-xl border border-amber-100">{selectedTask.shootDetail.videographerNotes}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  };

  // ─────────────────────────────────────────
  // File Uploads Tab — now uses REAL task files
  // ─────────────────────────────────────────

  const FileUploadsTab = () => {
    // Group files by task
    const tasksWithFiles = tasks.filter(t => t.files && t.files.length > 0);

    return (
      <div className="space-y-6">
        {tasksWithFiles.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <Upload className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No files uploaded yet</p>
            <p className="text-sm text-slate-400 mt-1">Files will appear here once uploaded to your tasks</p>
          </div>
        ) : (
          tasksWithFiles.map((task) => (
            <Card key={task.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{task.title}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      {task.files.length} file{task.files.length !== 1 ? 's' : ''} •
                      {task.client?.companyName || task.client?.name || 'Unknown Client'}
                    </p>
                  </div>
                  <Badge className={
                    task.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                      task.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                        'bg-blue-100 text-blue-800'
                  }>
                    {task.status.replace(/_/g, ' ')}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {task.files.map((file: any) => (
                    <div key={file.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100 hover:bg-slate-100/50 transition-colors">
                      {getFileIcon(file.mimeType)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(file.size)} • {new Date(file.uploadedAt).toLocaleDateString()}
                          {file.folderType && ` • ${file.folderType}`}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => window.open(file.url, '_blank')}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    );
  };

  // ─────────────────────────────────────────
  // Equipment Tab — placeholder (no DB model yet)
  // ─────────────────────────────────────────

  const EquipmentTab = () => {
    return (
      <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
        <Settings className="h-10 w-10 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500 font-medium">Equipment Management</p>
        <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
          Equipment tracking is coming soon. This will allow you to check out cameras, lights, and other gear for your shoots.
        </p>
      </div>
    );
  };

  // ─────────────────────────────────────────
  // Calendar Tab — now uses REAL tasks
  // ─────────────────────────────────────────

  const CalendarTab = () => {
    const selectedDateStr = selectedDate?.toISOString().split("T")[0];

    // Match tasks by dueDate or shootDetail.shootDate
    const tasksForDate = tasks.filter(task => {
      const dueDate = task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : null;
      const shootDate = task.shootDetail?.shootDate ? new Date(task.shootDetail.shootDate).toISOString().split("T")[0] : null;
      return dueDate === selectedDateStr || shootDate === selectedDateStr;
    });

    // Highlight dates that have tasks
    const taskDates = tasks.reduce((acc: Date[], task) => {
      if (task.dueDate) acc.push(new Date(task.dueDate));
      if (task.shootDetail?.shootDate) acc.push(new Date(task.shootDetail.shootDate));
      return acc;
    }, []);

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Shooting Calendar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="rounded-md border"
              modifiers={{
                hasTask: taskDates,
              }}
              modifiersStyles={{
                hasTask: {
                  fontWeight: 'bold',
                  textDecoration: 'underline',
                  color: 'var(--primary)',
                },
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {selectedDate
                ? selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
                : "Select a date"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {tasksForDate.map((task) => (
                <div key={task.id} className="border rounded-xl p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-sm">{task.title}</h4>
                    <Badge className={
                      task.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                        task.status === 'VIDEOGRAPHER_ASSIGNED' ? 'bg-blue-100 text-blue-800' :
                          'bg-orange-100 text-orange-800'
                    }>
                      {task.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {task.shootDetail?.location && (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {task.shootDetail.location}
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {task.client?.companyName || task.client?.name || 'Unknown'}
                    </div>
                  </div>
                </div>
              ))}

              {tasksForDate.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  <CalendarIcon className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No shoots scheduled for this date</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  // ─────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-gray-200">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Videographer Portal</h1>
          <p className="text-muted-foreground mt-1 text-lg">
            Manage your shooting schedule, browse jobs, and track your work
          </p>
        </div>
      </div>

      {/* KPI Cards — all real data */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center gap-2">
              <Camera className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Active Shoots</p>
                <h3 className="text-2xl font-bold">{inProgressTasks.length}</h3>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center gap-2">
              <CalendarIcon className="h-8 w-8 text-orange-600" />
              <div>
                <p className="text-sm text-muted-foreground">Upcoming Shoots</p>
                <h3 className="text-2xl font-bold">{upcomingTasks.length}</h3>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center gap-2">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <h3 className="text-2xl font-bold">{completedTasks.length}</h3>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center gap-2">
              <Upload className="h-8 w-8 text-purple-600" />
              <div>
                <p className="text-sm text-muted-foreground">Total Files</p>
                <h3 className="text-2xl font-bold">{allFiles.length}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="jobs">Available Jobs</TabsTrigger>
          <TabsTrigger value="shoots">Shooting Schedule</TabsTrigger>
          <TabsTrigger value="uploads">File Uploads</TabsTrigger>
          <TabsTrigger value="equipment">Equipment</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
        </TabsList>

        <TabsContent value="jobs">
          <JobBoardTab />
        </TabsContent>

        <TabsContent value="shoots">
          <ShootingScheduleTab />
        </TabsContent>

        <TabsContent value="uploads">
          <FileUploadsTab />
        </TabsContent>

        <TabsContent value="equipment">
          <EquipmentTab />
        </TabsContent>

        <TabsContent value="calendar">
          <CalendarTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}