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
                    <CardTitle className="text-base">{task.client?.companyName || task.client?.name || "Unknown Client"} · Shoot</CardTitle>
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
                    <h4 className="font-semibold text-sm">{(task.client?.companyName || task.client?.name || "Unknown Client") + " · Shoot"}</h4>
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
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="jobs">Available Jobs</TabsTrigger>
          <TabsTrigger value="uploads">File Uploads</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
        </TabsList>

        <TabsContent value="jobs">
          <JobBoardTab />
        </TabsContent>

        <TabsContent value="uploads">
          <FileUploadsTab />
        </TabsContent>

        <TabsContent value="calendar">
          <CalendarTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}