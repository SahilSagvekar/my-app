// import { useState } from 'react';
// import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
// import { Badge } from '../ui/badge';
// import { Button } from '../ui/button';
// import { Progress } from '../ui/progress';
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
// import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
// import { Input } from '../ui/input';
// import { Textarea } from '../ui/textarea';
// import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
// import { Calendar } from '../ui/calendar';
// import { 
//   Camera, 
//   Upload, 
//   Calendar as CalendarIcon, 
//   MapPin, 
//   Clock, 
//   User, 
//   CheckCircle2, 
//   Download,
//   Eye,
//   Settings,
//   Briefcase,
//   MoreHorizontal
// } from 'lucide-react';
// import { toast } from 'sonner';
// import { 
//   mockShootingTasks, 
//   mockUploadTasks, 
//   mockEquipment,
//   statusColors,
//   uploadStatusColors,
//   equipmentStatusColors
// } from '../data/videographerMockData';



// export function VideographerDashboard() {
//   const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
//   const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
//   const [newUpload, setNewUpload] = useState({
//     projectId: '',
//     title: '',
//     notes: ''
//   });

//   const handleStartUpload = () => {
//     if (!newUpload.projectId || !newUpload.title) {
//       toast('❌ Missing Information', { 
//         description: 'Please select a project and enter upload title.' 
//       });
//       return;
//     }

//     toast('📁 Upload Started', { 
//       description: 'Files are being uploaded to Google Drive.' 
//     });
//     setIsUploadDialogOpen(false);
//     setNewUpload({ projectId: '', title: '', notes: '' });
//   };

//   const handleMarkAsCompleted = (taskId: string) => {
//     toast('✅ Shoot Completed', { 
//       description: 'Task marked as completed. Upload footage when ready.' 
//     });
//   };

//   const upcomingTasks = mockShootingTasks.filter(task => task.status === 'upcoming');
//   const inProgressTasks = mockShootingTasks.filter(task => task.status === 'in-progress');
//   const completedTasks = mockShootingTasks.filter(task => task.status === 'completed');

//   return (
//     <div className="space-y-6">
//       {/* Header */}
//       <div className="flex items-center justify-between">
//         <div>
//           <h1>Videographer Portal</h1>
//           <p className="text-muted-foreground mt-2">
//             Manage your shooting schedule, upload footage, and track equipment
//           </p>
//         </div>

//         {/* <div className="flex items-center gap-3">
//           <Button
//             className="w-full"
//             onClick={() => router.push("/leave-request")}
//           >
//             Request Leave
//           </Button>
//         </div> */}
//         {/* <div className="flex items-center justify-between">
//         <div>
//           <h1>Videographer Portal</h1>
//           <p className="text-muted-foreground mt-2">
//             Manage your shooting schedule, upload footage, and track equipment
//           </p>
//         </div>

//       </div> */}

//         <div className="flex items-center gap-3">
//           <Dialog
//             open={isUploadDialogOpen}
//             onOpenChange={setIsUploadDialogOpen}
//           >
//             <DialogTrigger asChild>
//               {/* <Button>
//                 <Upload className="h-4 w-4 mr-2" />
//                 Upload Footage
//               </Button> */}
//             </DialogTrigger>
//             <DialogContent>
//               <DialogHeader>
//                 <DialogTitle>Upload Footage</DialogTitle>
//                 <DialogDescription>
//                   Select the project and upload your recorded footage to Google
//                   Drive.
//                 </DialogDescription>
//               </DialogHeader>
//               <div className="space-y-4">
//                 <div>
//                   <label className="text-sm">Project</label>
//                   <Select
//                     value={newUpload.projectId}
//                     onValueChange={(value) =>
//                       setNewUpload({ ...newUpload, projectId: value })
//                     }
//                   >
//                     <SelectTrigger>
//                       <SelectValue placeholder="Select project" />
//                     </SelectTrigger>
//                     <SelectContent>
//                       {mockShootingTasks.map((task) => (
//                         <SelectItem key={task.id} value={task.id}>
//                           {task.title} - {task.client}
//                         </SelectItem>
//                       ))}
//                     </SelectContent>
//                   </Select>
//                 </div>
//                 <div>
//                   <label className="text-sm">Upload Title</label>
//                   <Input
//                     value={newUpload.title}
//                     onChange={(e) =>
//                       setNewUpload({ ...newUpload, title: e.target.value })
//                     }
//                     placeholder="e.g., Raw Footage - Batch 1"
//                   />
//                 </div>
//                 <div>
//                   <label className="text-sm">Notes (Optional)</label>
//                   <Textarea
//                     value={newUpload.notes}
//                     onChange={(e) =>
//                       setNewUpload({ ...newUpload, notes: e.target.value })
//                     }
//                     placeholder="Any additional notes about the footage..."
//                     rows={3}
//                   />
//                 </div>
//                 <div className="flex justify-end gap-3">
//                   <Button
//                     variant="outline"
//                     onClick={() => setIsUploadDialogOpen(false)}
//                   >
//                     Cancel
//                   </Button>
//                   <Button onClick={handleStartUpload}>Start Upload</Button>
//                 </div>
//               </div>
//             </DialogContent>
//           </Dialog>
//         </div>
//       </div>

//       {/* KPI Cards */}
//       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
//         <Card>
//           <CardContent className="p-6">
//             <div className="flex items-center justify-between">
//               <div>
//                 <p className="text-sm text-muted-foreground">Today's Shoots</p>
//                 <h3 className="mt-2">{inProgressTasks.length}</h3>
//               </div>
//               <Camera className="h-8 w-8 text-blue-600" />
//             </div>
//           </CardContent>
//         </Card>

//         <Card>
//           <CardContent className="p-6">
//             <div className="flex items-center justify-between">
//               <div>
//                 <p className="text-sm text-muted-foreground">Upcoming Shoots</p>
//                 <h3 className="mt-2">{upcomingTasks.length}</h3>
//               </div>
//               <CalendarIcon className="h-8 w-8 text-orange-600" />
//             </div>
//           </CardContent>
//         </Card>

//         <Card>
//           <CardContent className="p-6">
//             <div className="flex items-center justify-between">
//               <div>
//                 <p className="text-sm text-muted-foreground">Pending Uploads</p>
//                 <h3 className="mt-2">
//                   {mockUploadTasks.filter((u) => u.status === "pending").length}
//                 </h3>
//               </div>
//               <Upload className="h-8 w-8 text-green-600" />
//             </div>
//           </CardContent>
//         </Card>

//         <Card>
//           <CardContent className="p-6">
//             <div className="flex items-center justify-between">
//               <div>
//                 <p className="text-sm text-muted-foreground">
//                   Equipment Available
//                 </p>
//                 <h3 className="mt-2">
//                   {mockEquipment.filter((e) => e.status === "available").length}
//                 </h3>
//               </div>
//               <Settings className="h-8 w-8 text-purple-600" />
//             </div>
//           </CardContent>
//         </Card>
//       </div>

//       {/* Main Content Tabs */}
//       <Tabs defaultValue="shoots" className="space-y-6">
//         <TabsList className="grid w-full grid-cols-4">
//           <TabsTrigger value="shoots">Shooting Schedule</TabsTrigger>
//           <TabsTrigger value="uploads">File Uploads</TabsTrigger>
//           <TabsTrigger value="equipment">Equipment</TabsTrigger>
//           <TabsTrigger value="calendar">Calendar</TabsTrigger>
//         </TabsList>

//         {/* Shooting Schedule Tab */}
//         <TabsContent value="shoots" className="space-y-6">
//           <div className="grid gap-6">
//             {/* In Progress Shoots */}
//             {inProgressTasks.length > 0 && (
//               <Card>
//                 <CardHeader>
//                   <CardTitle className="flex items-center gap-2">
//                     <Camera className="h-5 w-5" />
//                     Active Shoots
//                   </CardTitle>
//                 </CardHeader>
//                 <CardContent>
//                   <div className="space-y-4">
//                     {inProgressTasks.map((task) => (
//                       <div key={task.id} className="border rounded-lg p-4">
//                         <div className="flex items-start justify-between">
//                           <div className="space-y-2">
//                             <div className="flex items-center gap-3">
//                               <h4 className="font-medium">{task.title}</h4>
//                               <Badge className={statusColors[task.status]}>
//                                 {task.status.replace("-", " ")}
//                               </Badge>
//                               <Badge
//                                 variant="outline"
//                                 className={
//                                   task.priority === "high"
//                                     ? "border-red-500 text-red-700"
//                                     : "border-orange-500 text-orange-700"
//                                 }
//                               >
//                                 {task.priority} priority
//                               </Badge>
//                             </div>
//                             <div className="flex items-center gap-4 text-sm text-muted-foreground">
//                               <div className="flex items-center gap-1">
//                                 <User className="h-4 w-4" />
//                                 {task.client}
//                               </div>
//                               <div className="flex items-center gap-1">
//                                 <MapPin className="h-4 w-4" />
//                                 {task.location}
//                               </div>
//                               <div className="flex items-center gap-1">
//                                 <Clock className="h-4 w-4" />
//                                 {task.duration}
//                               </div>
//                             </div>
//                             <div className="text-sm">
//                               <strong>Shot List:</strong>{" "}
//                               {task.shotList.join(", ")}
//                             </div>
//                             <div className="text-sm">
//                               <strong>Equipment:</strong>{" "}
//                               {task.equipment.join(", ")}
//                             </div>
//                             {task.notes && (
//                               <div className="text-sm text-muted-foreground">
//                                 <strong>Notes:</strong> {task.notes}
//                               </div>
//                             )}
//                           </div>
//                           <Button
//                             onClick={() => handleMarkAsCompleted(task.id)}
//                           >
//                             <CheckCircle2 className="h-4 w-4 mr-2" />
//                             Complete Shoot
//                           </Button>
//                         </div>
//                       </div>
//                     ))}
//                   </div>
//                 </CardContent>
//               </Card>
//             )}

//             {/* Upcoming Shoots */}
//             <Card>
//               <CardHeader>
//                 <CardTitle className="flex items-center gap-2">
//                   <CalendarIcon className="h-5 w-5" />
//                   Upcoming Shoots
//                 </CardTitle>
//               </CardHeader>
//               <CardContent>
//                 <div className="space-y-4">
//                   {upcomingTasks.map((task) => (
//                     <div key={task.id} className="border rounded-lg p-4">
//                       <div className="flex items-start justify-between">
//                         <div className="space-y-2">
//                           <div className="flex items-center gap-3">
//                             <h4 className="font-medium">{task.title}</h4>
//                             <Badge className={statusColors[task.status]}>
//                               {task.status.replace("-", " ")}
//                             </Badge>
//                             <Badge
//                               variant="outline"
//                               className={
//                                 task.priority === "high"
//                                   ? "border-red-500 text-red-700"
//                                   : "border-blue-500 text-blue-700"
//                               }
//                             >
//                               {task.priority} priority
//                             </Badge>
//                           </div>
//                           <div className="flex items-center gap-4 text-sm text-muted-foreground">
//                             <div className="flex items-center gap-1">
//                               <User className="h-4 w-4" />
//                               {task.client}
//                             </div>
//                             <div className="flex items-center gap-1">
//                               <CalendarIcon className="h-4 w-4" />
//                               {task.scheduledDate} at {task.scheduledTime}
//                             </div>
//                             <div className="flex items-center gap-1">
//                               <MapPin className="h-4 w-4" />
//                               {task.location}
//                             </div>
//                           </div>
//                           <div className="text-sm">
//                             <strong>Shot List:</strong>{" "}
//                             {task.shotList.join(", ")}
//                           </div>
//                           <div className="text-sm">
//                             <strong>Required Equipment:</strong>{" "}
//                             {task.equipment.join(", ")}
//                           </div>
//                           {task.notes && (
//                             <div className="text-sm text-muted-foreground">
//                               <strong>Notes:</strong> {task.notes}
//                             </div>
//                           )}
//                         </div>
//                         <div className="flex gap-2">
//                           <Button variant="outline" size="sm">
//                             <Eye className="h-4 w-4 mr-2" />
//                             View Details
//                           </Button>
//                         </div>
//                       </div>
//                     </div>
//                   ))}
//                 </div>
//               </CardContent>
//             </Card>
//           </div>
//         </TabsContent>

//         {/* File Uploads Tab */}
//         <TabsContent value="uploads" className="space-y-6">
//           <Card>
//             <CardHeader>
//               <CardTitle className="flex items-center gap-2">
//                 <Upload className="h-5 w-5" />
//                 File Upload Status
//               </CardTitle>
//             </CardHeader>
//             <CardContent>
//               <div className="space-y-4">
//                 {mockUploadTasks.map((upload) => (
//                   <div key={upload.id} className="border rounded-lg p-4">
//                     <div className="flex items-start justify-between">
//                       <div className="space-y-2 flex-1">
//                         <div className="flex items-center gap-3">
//                           <h4 className="font-medium">{upload.title}</h4>
//                           <Badge className={uploadStatusColors[upload.status]}>
//                             {upload.status}
//                           </Badge>
//                         </div>
//                         <div className="flex items-center gap-4 text-sm text-muted-foreground">
//                           <span>{upload.filesCount} files</span>
//                           <span>{upload.totalSize}</span>
//                           {upload.uploadDate && (
//                             <span>Uploaded: {upload.uploadDate}</span>
//                           )}
//                         </div>

//                         {upload.status === "uploading" && upload.progress && (
//                           <div className="space-y-1">
//                             <div className="flex justify-between text-sm">
//                               <span>Uploading...</span>
//                               <span>{upload.progress}%</span>
//                             </div>
//                             <Progress
//                               value={upload.progress}
//                               className="w-full"
//                             />
//                             <div className="text-xs text-muted-foreground">
//                               {upload.uploadedSize} of {upload.totalSize}{" "}
//                               uploaded
//                             </div>
//                           </div>
//                         )}

//                         {upload.status === "completed" && upload.driveLink && (
//                           <div className="flex items-center gap-2">
//                             <Button variant="outline" size="sm" asChild>
//                               <a
//                                 href={upload.driveLink}
//                                 target="_blank"
//                                 rel="noopener noreferrer"
//                               >
//                                 <Download className="h-4 w-4 mr-2" />
//                                 View in Drive
//                               </a>
//                             </Button>
//                           </div>
//                         )}
//                       </div>

//                       {upload.status === "pending" && (
//                         <Button
//                           size="sm"
//                           onClick={() => setIsUploadDialogOpen(true)}
//                         >
//                           <Upload className="h-4 w-4 mr-2" />
//                           Start Upload
//                         </Button>
//                       )}
//                     </div>
//                   </div>
//                 ))}
//               </div>
//             </CardContent>
//           </Card>
//         </TabsContent>

//         {/* Equipment Tab */}
//         <TabsContent value="equipment" className="space-y-6">
//           <Card>
//             <CardHeader>
//               <CardTitle className="flex items-center gap-2">
//                 <Briefcase className="h-5 w-5" />
//                 Equipment Management
//               </CardTitle>
//             </CardHeader>
//             <CardContent>
//               <div className="overflow-x-auto">
//                 <table className="w-full">
//                   <thead>
//                     <tr className="border-b">
//                       <th className="text-left py-3 px-4">Equipment</th>
//                       <th className="text-left py-3 px-4">Type</th>
//                       <th className="text-left py-3 px-4">Status</th>
//                       <th className="text-left py-3 px-4">Location</th>
//                       <th className="text-left py-3 px-4">Last Maintenance</th>
//                       <th className="text-right py-3 px-4">Actions</th>
//                     </tr>
//                   </thead>
//                   <tbody>
//                     {mockEquipment.map((item) => (
//                       <tr key={item.id} className="border-b hover:bg-muted/50">
//                         <td className="py-3 px-4">
//                           <div className="font-medium">{item.name}</div>
//                           <div className="text-sm text-muted-foreground">
//                             {item.id}
//                           </div>
//                         </td>
//                         <td className="py-3 px-4">{item.type}</td>
//                         <td className="py-3 px-4">
//                           <Badge className={equipmentStatusColors[item.status]}>
//                             {item.status.replace("-", " ")}
//                           </Badge>
//                         </td>
//                         <td className="py-3 px-4">
//                           <div>{item.location}</div>
//                           {item.assignedTo && (
//                             <div className="text-sm text-muted-foreground">
//                               {item.assignedTo}
//                             </div>
//                           )}
//                         </td>
//                         <td className="py-3 px-4 text-sm">
//                           {item.lastMaintenance}
//                         </td>
//                         <td className="py-3 px-4 text-right">
//                           <Button variant="ghost" size="sm">
//                             <MoreHorizontal className="h-4 w-4" />
//                           </Button>
//                         </td>
//                       </tr>
//                     ))}
//                   </tbody>
//                 </table>
//               </div>
//             </CardContent>
//           </Card>
//         </TabsContent>

//         {/* Calendar Tab */}
//         <TabsContent value="calendar" className="space-y-6">
//           <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
//             <Card>
//               <CardHeader>
//                 <CardTitle>Shooting Calendar</CardTitle>
//               </CardHeader>
//               <CardContent>
//                 <Calendar
//                   mode="single"
//                   selected={selectedDate}
//                   onSelect={setSelectedDate}
//                   className="rounded-md border"
//                 />
//               </CardContent>
//             </Card>

//             <Card>
//               <CardHeader>
//                 <CardTitle>Today's Schedule</CardTitle>
//               </CardHeader>
//               <CardContent>
//                 <div className="space-y-4">
//                   {mockShootingTasks
//                     .filter(
//                       (task) =>
//                         task.scheduledDate ===
//                         selectedDate?.toISOString().split("T")[0]
//                     )
//                     .map((task) => (
//                       <div key={task.id} className="border rounded-lg p-3">
//                         <div className="flex items-center justify-between">
//                           <div>
//                             <h4 className="font-medium">{task.title}</h4>
//                             <div className="text-sm text-muted-foreground">
//                               {task.scheduledTime} • {task.location}
//                             </div>
//                           </div>
//                           <Badge className={statusColors[task.status]}>
//                             {task.status.replace("-", " ")}
//                           </Badge>
//                         </div>
//                       </div>
//                     ))}

//                   {(!selectedDate ||
//                     mockShootingTasks.filter(
//                       (task) =>
//                         task.scheduledDate ===
//                         selectedDate?.toISOString().split("T")[0]
//                     ).length === 0) && (
//                     <div className="text-center text-muted-foreground py-8">
//                       No shoots scheduled for this date
//                     </div>
//                   )}
//                 </div>
//               </CardContent>
//             </Card>
//           </div>
//         </TabsContent>
//       </Tabs>
//     </div>
//   );
// }


// components/videographer/VideographerDashboard.tsx
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
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
  MoreHorizontal,
  Loader,
  DollarSign,
  FileText,
  XCircle,
  Plus
} from 'lucide-react';
import { toast } from 'sonner';
import {
  mockShootingTasks,
  mockUploadTasks,
  mockEquipment,
  statusColors,
  uploadStatusColors,
  equipmentStatusColors
} from '../data/videographerMockData';

// Types for Remote Data
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
  budget?: number; // Decimal in DB, number in JSON
  status: 'OPEN' | 'ASSIGNED' | 'COMPLETED' | 'CANCELLED';
  bids?: Bid[]; // Current user's bid (if videographer)
  _count?: { bids: number };
}

// ============================================
// LOADING FALLBACK COMPONENT WITH LOGGING
// ============================================
function DashboardLoadingFallback({ componentName = "Component" }) {
  useEffect(() => {
    console.log(`⏳ [LAZY LOADING] ${componentName} is loading...`);
    return () => {
      console.log(`✅ [LAZY LOADING] ${componentName} loaded successfully`);
    };
  }, [componentName]);

  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center space-y-4">
        <Loader className="h-12 w-12 animate-spin mx-auto text-muted-foreground" />
        <p className="text-muted-foreground">Loading {componentName}...</p>
      </div>
    </div>
  );
}

export function VideographerDashboard() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [newUpload, setNewUpload] = useState({
    projectId: '',
    title: '',
    notes: ''
  });
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

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

  const handleStartUpload = () => {
    console.log('📁 [VIDEOGRAPHER] Starting upload:', newUpload);
    if (!newUpload.projectId || !newUpload.title) {
      console.warn('⚠️ [VIDEOGRAPHER] Missing upload information');
      toast('❌ Missing Information', {
        description: 'Please select a project and enter upload title.'
      });
      return;
    }

    console.log('✅ [VIDEOGRAPHER] Upload validated and started');
    toast('📁 Upload Started', {
      description: 'Files are being uploaded to Google Drive.'
    });
    setIsUploadDialogOpen(false);
    setNewUpload({ projectId: '', title: '', notes: '' });
  };

  const handleMarkAsCompleted = async (taskId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'COMPLETED' })
      });

      if (res.ok) {
        toast('✅ Shoot Completed', {
          description: 'Task marked as completed. Upload footage when ready.'
        });
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

  console.log(`📊 [VIDEOGRAPHER] Dashboard state - Upcoming: ${upcomingTasks.length}, In Progress: ${inProgressTasks.length}, Completed: ${completedTasks.length}`);

  const JobBoardTab = () => {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedJob, setSelectedJob] = useState<Job | null>(null);
    const [bidAmount, setBidAmount] = useState('');
    const [bidNote, setBidNote] = useState('');
    const [isBidDialogOpen, setIsBidDialogOpen] = useState(false);

    useEffect(() => {
      fetchJobs();
      console.log('💼 [VIDEOGRAPHER] Job Board tab mounted');
      return () => console.log('💼 [VIDEOGRAPHER] Job Board tab unmounted');
    }, []);

    const fetchJobs = async () => {
      try {
        setLoading(true);
        // Fetch OPEN jobs. 
        const res = await fetch('/api/jobs?status=OPEN');
        if (res.ok) {
          const data = await res.json();
          setJobs(data);
        } else {
          const errorData = await res.json().catch(() => ({}));
          console.error(`Failed to fetch jobs: ${res.status} ${res.statusText}`, errorData);
          toast.error('Could not load jobs', { description: errorData.error || 'Check server logs' });
        }
      } catch (error) {
        console.error('Error fetching jobs:', error);
        toast.error('Network error', { description: 'Failed to connect to API' });
      } finally {
        setLoading(false);
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
          toast('✅ Bid Submitted', {
            description: `You placed a bid of $${bidAmount} for ${selectedJob.title}`
          });
          setIsBidDialogOpen(false);
          fetchJobs();
        } else {
          const err = await res.json();
          toast('❌ Bid Failed', { description: err.error });
        }
      } catch (error) {
        toast('❌ Error', { description: 'Something went wrong.' });
      }
    };

    if (loading) return <DashboardLoadingFallback componentName="Job Board" />;

    return (
      <>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {jobs.length === 0 ? (
            <div className="col-span-full text-center py-10 text-muted-foreground">
              <p>No open jobs available at the moment.</p>
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
                <div className="flex items-center gap-2 font-bold text-slate-700 uppercase font-xs tracking-wider">
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
                    <p className="text-xs font-bold text-red-600 mb-1">DONT CAPTURE:</p>
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
                      {selectedTask.title || "Untitled Task"} — ID: {selectedTask.id}
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

                  {/* Criteria Grid */}
                  <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
                    <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-200 pb-2">
                      <Settings className="h-4 w-4" /> Technical Specifications
                    </h4>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-70">Camera</p>
                        <p className="font-bold text-slate-900">{selectedTask.shootDetail?.camera || "-"}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-70">Quality</p>
                        <p className="font-bold text-slate-900">{selectedTask.shootDetail?.quality || "-"}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-70">Frame Rate</p>
                        <p className="font-bold text-slate-900">{selectedTask.shootDetail?.frameRate || "-"}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-70">Lighting</p>
                        <p className="font-bold text-slate-900">{selectedTask.shootDetail?.lighting || "-"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Exclusions */}
                  {selectedTask.shootDetail?.exclusions && (
                    <div className="bg-red-50/50 p-6 rounded-2xl border border-red-100">
                      <h4 className="font-extrabold text-red-800 mb-2 flex items-center gap-2">
                        <XCircle className="h-4 w-4" /> EXCLUSIONS (Do NOT Film)
                      </h4>
                      <p className="text-sm text-red-900 font-medium leading-relaxed">
                        {selectedTask.shootDetail.exclusions}
                      </p>
                    </div>
                  )}

                  {/* Reference Videos */}
                  {((selectedTask.shootDetail?.referenceLinks && selectedTask.shootDetail.referenceLinks.length > 0) || (selectedTask.driveLinks && selectedTask.driveLinks.length > 0)) && (
                    <div className="space-y-4">
                      <h4 className="font-bold text-slate-800 flex items-center gap-2">
                        <Eye className="h-4 w-4" /> Examples & References
                      </h4>
                      <div className="space-y-2">
                        {selectedTask.shootDetail?.referenceLinks?.map((link: string, i: number) => (
                          <a key={i} href={link} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 bg-blue-50 text-blue-700 rounded-xl hover:bg-blue-100 transition-colors group">
                            <Eye className="h-4 w-4 group-hover:scale-110 transition-transform" />
                            <span className="text-xs font-bold truncate underline decoration-2 underline-offset-4">{link}</span>
                          </a>
                        ))}
                        {selectedTask.driveLinks?.map((link: string, i: number) => (
                          <a key={i} href={link} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 bg-indigo-50 text-indigo-700 rounded-xl hover:bg-indigo-100 transition-colors group">
                            <Download className="h-4 w-4 group-hover:scale-110 transition-transform" />
                            <span className="text-xs font-bold truncate underline decoration-2 underline-offset-4">Reference File #{i + 1}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Videographer Post-Shoot Notes */}
                  <div className="pt-6 border-t border-slate-100">
                    <Label className="text-sm font-bold text-slate-800 mb-3 block">Post-Shoot Report & Notes</Label>
                    <Textarea
                      placeholder="Briefly describe how the shoot went, any issues faced, or specific details for the editor..."
                      className="bg-gray-50 border-gray-200 focus:bg-white min-h-[120px] rounded-xl font-medium"
                      defaultValue={selectedTask.shootDetail?.videographerNotes || ""}
                      onBlur={(e) => handleSaveShootNotes(selectedTask.id, e.target.value)}
                    />
                    <p className="text-[10px] text-muted-foreground mt-2 font-medium italic">* Changes are auto-saved when you click away</p>
                  </div>
                </div>

                <div className="p-6 bg-slate-50 border-t flex justify-end">
                  <Button onClick={() => setIsDetailsOpen(false)} className="px-8 rounded-xl font-bold">
                    Got it, thanks!
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  };

  const FileUploadsTab = () => {
    useEffect(() => {
      console.log('📤 [VIDEOGRAPHER] File Uploads tab mounted');
      return () => console.log('📤 [VIDEOGRAPHER] File Uploads tab unmounted');
    }, []);

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            File Upload Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mockUploadTasks.map((upload) => (
              <div key={upload.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-3">
                      <h4 className="font-medium">{upload.title}</h4>
                      <Badge className={uploadStatusColors[upload.status]}>
                        {upload.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{upload.filesCount} files</span>
                      <span>{upload.totalSize}</span>
                      {upload.uploadDate && (
                        <span>Uploaded: {upload.uploadDate}</span>
                      )}
                    </div>

                    {upload.status === "uploading" && upload.progress && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>Uploading...</span>
                          <span>{upload.progress}%</span>
                        </div>
                        <Progress
                          value={upload.progress}
                          className="w-full"
                        />
                        <div className="text-xs text-muted-foreground">
                          {upload.uploadedSize} of {upload.totalSize}{" "}
                          uploaded
                        </div>
                      </div>
                    )}

                    {upload.status === "completed" && upload.driveLink && (
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <a
                            href={upload.driveLink}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            View in Drive
                          </a>
                        </Button>
                      </div>
                    )}
                  </div>

                  {upload.status === "pending" && (
                    <Button
                      size="sm"
                      onClick={() => setIsUploadDialogOpen(true)}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Start Upload
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  const EquipmentTab = () => {
    useEffect(() => {
      console.log('⚙️ [VIDEOGRAPHER] Equipment tab mounted');
      return () => console.log('⚙️ [VIDEOGRAPHER] Equipment tab unmounted');
    }, []);

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Equipment Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Equipment</th>
                  <th className="text-left py-3 px-4">Type</th>
                  <th className="text-left py-3 px-4">Status</th>
                  <th className="text-left py-3 px-4">Location</th>
                  <th className="text-left py-3 px-4">Last Maintenance</th>
                  <th className="text-right py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {mockEquipment.map((item) => (
                  <tr key={item.id} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-4">
                      <div className="font-medium">{item.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {item.id}
                      </div>
                    </td>
                    <td className="py-3 px-4">{item.type}</td>
                    <td className="py-3 px-4">
                      <Badge className={equipmentStatusColors[item.status]}>
                        {item.status.replace("-", " ")}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <div>{item.location}</div>
                      {item.assignedTo && (
                        <div className="text-sm text-muted-foreground">
                          {item.assignedTo}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {item.lastMaintenance}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    );
  };

  const CalendarTab = () => {
    useEffect(() => {
      console.log('📅 [VIDEOGRAPHER] Calendar tab mounted');
      return () => console.log('📅 [VIDEOGRAPHER] Calendar tab unmounted');
    }, []);

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Shooting Calendar</CardTitle>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="rounded-md border"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Today's Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockShootingTasks
                .filter(
                  (task) =>
                    task.scheduledDate ===
                    selectedDate?.toISOString().split("T")[0]
                )
                .map((task) => (
                  <div key={task.id} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{task.title}</h4>
                        <div className="text-sm text-muted-foreground">
                          {task.scheduledTime} • {task.location}
                        </div>
                      </div>
                      <Badge className={statusColors[task.status]}>
                        {task.status.replace("-", " ")}
                      </Badge>
                    </div>
                  </div>
                ))}

              {(!selectedDate ||
                mockShootingTasks.filter(
                  (task) =>
                    task.scheduledDate ===
                    selectedDate?.toISOString().split("T")[0]
                ).length === 0) && (
                  <div className="text-center text-muted-foreground py-8">
                    No shoots scheduled for this date
                  </div>
                )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1>Videographer Portal</h1>
          <p className="text-muted-foreground mt-2">
            Manage your shooting schedule, upload footage, and track equipment
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Dialog
            open={isUploadDialogOpen}
            onOpenChange={setIsUploadDialogOpen}
          >
            <DialogTrigger asChild>
              <Button>
                <Upload className="h-4 w-4 mr-2" />
                Upload Footage
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Footage</DialogTitle>
                <DialogDescription>
                  Select the project and upload your recorded footage to Google
                  Drive.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm">Project</label>
                  <Select
                    value={newUpload.projectId}
                    onValueChange={(value) =>
                      setNewUpload({ ...newUpload, projectId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select project" />
                    </SelectTrigger>
                    <SelectContent>
                      {mockShootingTasks.map((task) => (
                        <SelectItem key={task.id} value={task.id}>
                          {task.title} - {task.client}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm">Upload Title</label>
                  <Input
                    value={newUpload.title}
                    onChange={(e) =>
                      setNewUpload({ ...newUpload, title: e.target.value })
                    }
                    placeholder="e.g., Raw Footage - Batch 1"
                  />
                </div>
                <div>
                  <label className="text-sm">Notes (Optional)</label>
                  <Textarea
                    value={newUpload.notes}
                    onChange={(e) =>
                      setNewUpload({ ...newUpload, notes: e.target.value })
                    }
                    placeholder="Any additional notes about the footage..."
                    rows={3}
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setIsUploadDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleStartUpload}>Start Upload</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Today's Shoots</p>
                <h3 className="mt-2">{inProgressTasks.length}</h3>
              </div>
              <Camera className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Upcoming Shoots</p>
                <h3 className="mt-2">{upcomingTasks.length}</h3>
              </div>
              <CalendarIcon className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Uploads</p>
                <h3 className="mt-2">
                  {mockUploadTasks.filter((u) => u.status === "pending").length}
                </h3>
              </div>
              <Upload className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Equipment Available
                </p>
                <h3 className="mt-2">
                  {mockEquipment.filter((e) => e.status === "available").length}
                </h3>
              </div>
              <Settings className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="jobs" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="jobs" onClick={() => console.log('💼 [VIDEOGRAPHER] Switched to Job Board')}>
            Available Jobs
          </TabsTrigger>
          <TabsTrigger value="shoots" onClick={() => console.log('📹 [VIDEOGRAPHER] Switched to Shoots tab')}>
            Shooting Schedule
          </TabsTrigger>
          <TabsTrigger value="uploads" onClick={() => console.log('📤 [VIDEOGRAPHER] Switched to Uploads tab')}>
            File Uploads
          </TabsTrigger>
          <TabsTrigger value="equipment" onClick={() => console.log('⚙️ [VIDEOGRAPHER] Switched to Equipment tab')}>
            Equipment
          </TabsTrigger>
          <TabsTrigger value="calendar" onClick={() => console.log('📅 [VIDEOGRAPHER] Switched to Calendar tab')}>
            Calendar
          </TabsTrigger>
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