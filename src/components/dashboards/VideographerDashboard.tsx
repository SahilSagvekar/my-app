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
  Loader
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

  useEffect(() => {
    console.log(`📄 [VIDEOGRAPHER DASHBOARD] Mounted`);
    return () => {
      console.log(`📄 [VIDEOGRAPHER DASHBOARD] Unmounted`);
    };
  }, []);

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

  const handleMarkAsCompleted = (taskId: string) => {
    console.log(`✅ [VIDEOGRAPHER] Marking task ${taskId} as completed`);
    toast('✅ Shoot Completed', { 
      description: 'Task marked as completed. Upload footage when ready.' 
    });
  };

  const upcomingTasks = mockShootingTasks.filter(task => task.status === 'upcoming');
  const inProgressTasks = mockShootingTasks.filter(task => task.status === 'in-progress');
  const completedTasks = mockShootingTasks.filter(task => task.status === 'completed');

  console.log(`📊 [VIDEOGRAPHER] Dashboard state - Upcoming: ${upcomingTasks.length}, In Progress: ${inProgressTasks.length}, Completed: ${completedTasks.length}`);

  const ShootingScheduleTab = () => {
    useEffect(() => {
      console.log('📹 [VIDEOGRAPHER] Shooting Schedule tab mounted');
      return () => console.log('📹 [VIDEOGRAPHER] Shooting Schedule tab unmounted');
    }, []);

    return (
      <div className="space-y-6">
        <div className="grid gap-6">
          {/* In Progress Shoots */}
          {inProgressTasks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Camera className="h-5 w-5" />
                  Active Shoots
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {inProgressTasks.map((task) => (
                    <div key={task.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <h4 className="font-medium">{task.title}</h4>
                            <Badge className={statusColors[task.status]}>
                              {task.status.replace("-", " ")}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={
                                task.priority === "high"
                                  ? "border-red-500 text-red-700"
                                  : "border-orange-500 text-orange-700"
                              }
                            >
                              {task.priority} priority
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <User className="h-4 w-4" />
                              {task.client}
                            </div>
                            <div className="flex items-center gap-1">
                              <MapPin className="h-4 w-4" />
                              {task.location}
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {task.duration}
                            </div>
                          </div>
                          <div className="text-sm">
                            <strong>Shot List:</strong>{" "}
                            {task.shotList.join(", ")}
                          </div>
                          <div className="text-sm">
                            <strong>Equipment:</strong>{" "}
                            {task.equipment.join(", ")}
                          </div>
                          {task.notes && (
                            <div className="text-sm text-muted-foreground">
                              <strong>Notes:</strong> {task.notes}
                            </div>
                          )}
                        </div>
                        <Button
                          onClick={() => handleMarkAsCompleted(task.id)}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Complete Shoot
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Upcoming Shoots */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                Upcoming Shoots
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {upcomingTasks.map((task) => (
                  <div key={task.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <h4 className="font-medium">{task.title}</h4>
                          <Badge className={statusColors[task.status]}>
                            {task.status.replace("-", " ")}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={
                              task.priority === "high"
                                ? "border-red-500 text-red-700"
                                : "border-blue-500 text-blue-700"
                            }
                          >
                            {task.priority} priority
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <User className="h-4 w-4" />
                            {task.client}
                          </div>
                          <div className="flex items-center gap-1">
                            <CalendarIcon className="h-4 w-4" />
                            {task.scheduledDate} at {task.scheduledTime}
                          </div>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            {task.location}
                          </div>
                        </div>
                        <div className="text-sm">
                          <strong>Shot List:</strong>{" "}
                          {task.shotList.join(", ")}
                        </div>
                        <div className="text-sm">
                          <strong>Required Equipment:</strong>{" "}
                          {task.equipment.join(", ")}
                        </div>
                        {task.notes && (
                          <div className="text-sm text-muted-foreground">
                            <strong>Notes:</strong> {task.notes}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
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
      <Tabs defaultValue="shoots" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
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