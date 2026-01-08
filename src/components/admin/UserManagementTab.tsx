// import { useState,useEffect } from 'react';
// import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
// import { Badge } from '../ui/badge';
// import { Button } from '../ui/button';
// import { Input } from '../ui/input';
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
// import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
// import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
// import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/alert-dialog';
// import { VisuallyHidden } from '../ui/visually-hidden';
// import { Users, UserPlus, Search, MoreHorizontal, Mail, Phone, Calendar, Edit, Trash2, UserCheck, UserX, Filter } from 'lucide-react';

// const roles = [
//   { id: 'admin', name: 'Admin', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
//   { id: 'manager', name: 'Manager', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
//   { id: 'editor', name: 'Editor', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
//   { id: 'qc', name: 'QC Specialist', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
//   { id: 'scheduler', name: 'Scheduler', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
//   { id: 'videographer', name: 'Videographer', color: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200' },
//   // { id: 'account-manager', name: 'Account Manager', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200' }
// ];

// const statusOptions = [
//   { id: 'active', name: 'Active', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
//   { id: 'inactive', name: 'Inactive', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200' },
//   { id: 'on-leave', name: 'On Leave', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' }
// ];

// const employees = [
//   {
//     id: 1,
//     name: 'Sarah Johnson',
//     email: 'sarah.johnson@company.com',
//     phone: '+1 (555) 123-4567',
//     role: 'admin',
//     status: 'active',
//     joinDate: '2023-01-15',
//     lastActive: '2024-08-10 14:30',
//     tasksCompleted: 45,
//     avatar: 'SJ'
//   },
//   {
//     id: 2,
//     name: 'Michael Chen',
//     email: 'michael.chen@company.com',
//     phone: '+1 (555) 234-5678',
//     role: 'manager',
//     status: 'active',
//     joinDate: '2023-03-20',
//     lastActive: '2024-08-10 16:15',
//     tasksCompleted: 32,
//     avatar: 'MC'
//   },
//   {
//     id: 3,
//     name: 'Emma Wilson',
//     email: 'emma.wilson@company.com',
//     phone: '+1 (555) 345-6789',
//     role: 'editor',
//     status: 'active',
//     joinDate: '2023-05-10',
//     lastActive: '2024-08-10 15:45',
//     tasksCompleted: 87,
//     avatar: 'EW'
//   },
//   {
//     id: 4,
//     name: 'David Rodriguez',
//     email: 'david.rodriguez@company.com',
//     phone: '+1 (555) 456-7890',
//     role: 'qc',
//     status: 'active',
//     joinDate: '2023-07-22',
//     lastActive: '2024-08-10 13:20',
//     tasksCompleted: 63,
//     avatar: 'DR'
//   },
//   {
//     id: 5,
//     name: 'Lisa Park',
//     email: 'lisa.park@company.com',
//     phone: '+1 (555) 567-8901',
//     role: 'scheduler',
//     status: 'on-leave',
//     joinDate: '2023-09-05',
//     lastActive: '2024-08-07 17:00',
//     tasksCompleted: 28,
//     avatar: 'LP'
//   },
//   {
//     id: 6,
//     name: 'James Thompson',
//     email: 'james.thompson@company.com',
//     phone: '+1 (555) 678-9012',
//     role: 'account-manager',
//     status: 'active',
//     joinDate: '2023-11-18',
//     lastActive: '2024-08-10 12:10',
//     tasksCompleted: 19,
//     avatar: 'JT'
//   },
//   {
//     id: 7,
//     name: 'Maria Garcia',
//     email: 'maria.garcia@company.com',
//     phone: '+1 (555) 789-0123',
//     role: 'editor',
//     status: 'inactive',
//     joinDate: '2024-01-08',
//     lastActive: '2024-08-02 09:30',
//     tasksCompleted: 12,
//     avatar: 'MG'
//   },
//   {
//     id: 8,
//     name: 'Alex Rodriguez',
//     email: 'alex.rodriguez@company.com',
//     phone: '+1 (555) 890-1234',
//     role: 'videographer',
//     status: 'active',
//     joinDate: '2024-02-15',
//     lastActive: '2024-08-10 18:20',
//     tasksCompleted: 34,
//     avatar: 'AR'
//   }
// ];

// export function UserManagementTab() {
//   const [searchTerm, setSearchTerm] = useState('');
//   const [roleFilter, setRoleFilter] = useState('all');
//   const [statusFilter, setStatusFilter] = useState('all');
//   const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
//   const [newUser, setNewUser] = useState({
//     name: '',
//     email: '',
//     phone: '',
//     role: '',
//     status: 'active'
//   });
//   const [employees, setEmployees] = useState<any[]>([]);
//   const [loading, setLoading] = useState(true);
// // FETCH EMPLOYEES FROM YOUR API
//   // ------------------------------
//   useEffect(() => {

//     async function loadEmployees() {
//       try {
//         const res = await fetch("api/employee/list");
//         const data = await res.json();

//         if (data.ok) {
//           const formatted = data.employees.map((u: any) => {
//             const initials =
//               u.name && u.name.trim() !== ""
//                 ? u.name
//                     .split(" ")
//                     .map((n: string) => n[0])
//                     .join("")
//                 : "U";

//             return {
//               id: u.id,
//               name: u.name || "No Name",
//               email: u.email,
//               phone: "N/A", // because User model has no phone field
//               role: u.role,
//               status:
//                 u.employeeStatus === "ACTIVE"
//                   ? "active"
//                   : u.employeeStatus === "INACTIVE"
//                   ? "inactive"
//                   : "active",
//               joinDate: u.joinedAt || null,
//               lastActive: "N/A", // field not in DB
//               tasksCompleted: 0, // field not in DB
//               avatar: initials
//             };
//           });

//           setEmployees(formatted);

//         }
//       } catch (error) {
//         console.error("Failed to fetch employees →", error);
//       } finally {
//         setLoading(false);
//       }
//     }

//     loadEmployees();
//   }, []);

//   const filteredEmployees = employees.filter(employee => {
//     const matchesSearch = employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
//                          employee.email.toLowerCase().includes(searchTerm.toLowerCase());
//     const matchesRole = roleFilter === 'all' || employee.role === roleFilter;
//     const matchesStatus = statusFilter === 'all' || employee.status === statusFilter;

//     return matchesSearch && matchesRole && matchesStatus;
//   });

//   const getRoleBadge = (roleId: string) => {
//     const role = roles.find(r => r.id === roleId);
//     return role ? (
//       <Badge className={role.color}>
//         {role.name}
//       </Badge>
//     ) : null;
//   };

//   const getStatusBadge = (statusId: string) => {
//     const status = statusOptions.find(s => s.id === statusId);
//     return status ? (
//       <Badge className={status.color}>
//         {status.name}
//       </Badge>
//     ) : null;
//   };

//   const handleAddUser = () => {
//     setIsAddUserDialogOpen(false);
//     setNewUser({ name: '', email: '', phone: '', role: '', status: 'active' });
//   };

//   const handleDeleteUser = (userId: number) => {
//     console.log('Deleting user:', userId);
//   };

//   const handleUpdateUserStatus = (userId: number, newStatus: string) => {
//     console.log('Updating user status:', userId, newStatus);
//   };

//   const roleStats = roles.map(role => ({
//     ...role,
//     count: employees.filter(emp => emp.role === role.id).length
//   }));

//   const statusStats = statusOptions.map(status => ({
//     ...status,
//     count: employees.filter(emp => emp.status === status.id).length
//   }));

//   return (
//     <div className="space-y-6">
//       {/* Stats Cards */}
//       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
//         <Card>
//           <CardContent className="p-6">
//             <div className="flex items-center justify-between">
//               <div>
//                 <p className="text-sm text-muted-foreground">Total Employees</p>
//                 <h3 className="mt-2">{employees.length}</h3>
//               </div>
//               <Users className="h-8 w-8 text-blue-600" />
//             </div>
//           </CardContent>
//         </Card>

//         <Card>
//           <CardContent className="p-6">
//             <div className="flex items-center justify-between">
//               <div>
//                 <p className="text-sm text-muted-foreground">Active Users</p>
//                 <h3 className="mt-2">{employees.filter(emp => emp.status === 'active').length}</h3>
//               </div>
//               <UserCheck className="h-8 w-8 text-green-600" />
//             </div>
//           </CardContent>
//         </Card>

//         <Card>
//           <CardContent className="p-6">
//             <div className="flex items-center justify-between">
//               <div>
//                 <p className="text-sm text-muted-foreground">On Leave</p>
//                 <h3 className="mt-2">{employees.filter(emp => emp.status === 'on-leave').length}</h3>
//               </div>
//               <Calendar className="h-8 w-8 text-yellow-600" />
//             </div>
//           </CardContent>
//         </Card>

//         <Card>
//           <CardContent className="p-6">
//             <div className="flex items-center justify-between">
//               <div>
//                 <p className="text-sm text-muted-foreground">Inactive</p>
//                 <h3 className="mt-2">{employees.filter(emp => emp.status === 'inactive').length}</h3>
//               </div>
//               <UserX className="h-8 w-8 text-red-600" />
//             </div>
//           </CardContent>
//         </Card>
//       </div>

//       {/* Role Distribution */}
//       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
//         <Card>
//           <CardHeader>
//             <CardTitle>Role Distribution</CardTitle>
//           </CardHeader>
//           <CardContent>
//             <div className="space-y-3">
//               {roleStats.map((role) => (
//                 <div key={role.id} className="flex items-center justify-between">
//                   <div className="flex items-center gap-3">
//                     <Badge className={role.color}>{role.name}</Badge>
//                   </div>
//                   <span className="font-medium">{role.count}</span>
//                 </div>
//               ))}
//             </div>
//           </CardContent>
//         </Card>

//         <Card>
//           <CardHeader>
//             <CardTitle>Status Overview</CardTitle>
//           </CardHeader>
//           <CardContent>
//             <div className="space-y-3">
//               {statusStats.map((status) => (
//                 <div key={status.id} className="flex items-center justify-between">
//                   <div className="flex items-center gap-3">
//                     <Badge className={status.color}>{status.name}</Badge>
//                   </div>
//                   <span className="font-medium">{status.count}</span>
//                 </div>
//               ))}
//             </div>
//           </CardContent>
//         </Card>
//       </div>

//       {/* Filters and Search */}
//       {/* <Card>
//         <CardHeader>
//           <div className="flex items-center justify-between">
//             <CardTitle className="flex items-center gap-2">
//               <Users className="h-5 w-5" />
//               Employee Management
//             </CardTitle>

//             <Dialog open={isAddUserDialogOpen} onOpenChange={setIsAddUserDialogOpen}>
//               <DialogTrigger asChild>
//                 <Button>
//                   <UserPlus className="h-4 w-4 mr-2" />
//                   Add Employee
//                 </Button>
//               </DialogTrigger>
//               <DialogContent aria-describedby="add-employee-description">
//                 <DialogHeader>
//                   <DialogTitle id="add-employee-title">Add New Employee</DialogTitle>
//                   <DialogDescription id="add-employee-description">
//                     Fill in the details below to add a new employee to the system.
//                   </DialogDescription>
//                 </DialogHeader>
//                 <div className="space-y-4">
//                   <div>
//                     <label className="text-sm">Full Name</label>
//                     <Input
//                       value={newUser.name}
//                       onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
//                       placeholder="Enter full name"
//                     />
//                   </div>
//                   <div>
//                     <label className="text-sm">Email</label>
//                     <Input
//                       type="email"
//                       value={newUser.email}
//                       onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
//                       placeholder="Enter email address"
//                     />
//                   </div>
//                   <div>
//                     <label className="text-sm">Phone</label>
//                     <Input
//                       value={newUser.phone}
//                       onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
//                       placeholder="Enter phone number"
//                     />
//                   </div>
//                   <div>
//                     <label className="text-sm">Role</label>
//                     <Select value={newUser.role} onValueChange={(value) => setNewUser({ ...newUser, role: value })}>
//                       <SelectTrigger>
//                         <SelectValue placeholder="Select role" />
//                       </SelectTrigger>
//                       <SelectContent>
//                         {roles.map((role) => (
//                           <SelectItem key={role.id} value={role.id}>
//                             {role.name}
//                           </SelectItem>
//                         ))}
//                       </SelectContent>
//                     </Select>
//                   </div>
//                   <div className="flex justify-end gap-3">
//                     <Button variant="outline" onClick={() => setIsAddUserDialogOpen(false)}>
//                       Cancel
//                     </Button>
//                     <Button onClick={handleAddUser}>
//                       Add Employee
//                     </Button>
//                   </div>
//                 </div>
//               </DialogContent>
//             </Dialog>
//           </div>
//         </CardHeader>
//         <CardContent>
//           <div className="flex flex-wrap items-center gap-4 mb-6">
//             <div className="flex items-center gap-2">
//               <Search className="h-4 w-4 text-muted-foreground" />
//               <Input
//                 placeholder="Search employees..."
//                 value={searchTerm}
//                 onChange={(e) => setSearchTerm(e.target.value)}
//                 className="w-64"
//               />
//             </div>

//             <Select value={roleFilter} onValueChange={setRoleFilter}>
//               <SelectTrigger className="w-48">
//                 <SelectValue placeholder="Filter by role" />
//               </SelectTrigger>
//               <SelectContent>
//                 <SelectItem value="all">All Roles</SelectItem>
//                 {roles.map((role) => (
//                   <SelectItem key={role.id} value={role.id}>
//                     {role.name}
//                   </SelectItem>
//                 ))}
//               </SelectContent>
//             </Select>

//             <Select value={statusFilter} onValueChange={setStatusFilter}>
//               <SelectTrigger className="w-48">
//                 <SelectValue placeholder="Filter by status" />
//               </SelectTrigger>
//               <SelectContent>
//                 <SelectItem value="all">All Statuses</SelectItem>
//                 {statusOptions.map((status) => (
//                   <SelectItem key={status.id} value={status.id}>
//                     {status.name}
//                   </SelectItem>
//                 ))}
//               </SelectContent>
//             </Select>
//           </div>

//           <div className="overflow-x-auto">
//             <table className="w-full">
//               <thead>
//                 <tr className="border-b">
//                   <th className="text-left py-3 px-4">Employee</th>
//                   <th className="text-left py-3 px-4">Role</th>
//                   <th className="text-left py-3 px-4">Status</th>
//                   <th className="text-left py-3 px-4">Contact</th>
//                   <th className="text-left py-3 px-4">Join Date</th>
//                   <th className="text-left py-3 px-4">Last Active</th>
//                   <th className="text-left py-3 px-4">Tasks</th>
//                   <th className="text-right py-3 px-4">Actions</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {filteredEmployees.map((employee) => (
//                   <tr key={employee.id} className="border-b hover:bg-muted/50">
//                     <td className="py-3 px-4">
//                       <div className="flex items-center gap-3">
//                         <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
//                           {employee.avatar}
//                         </div>
//                         <div>
//                           <div className="font-medium">{employee.name}</div>
//                           <div className="text-sm text-muted-foreground">{employee.email}</div>
//                         </div>
//                       </div>
//                     </td>
//                     <td className="py-3 px-4">
//                       {getRoleBadge(employee.role)}
//                     </td>
//                     <td className="py-3 px-4">
//                       {getStatusBadge(employee.status)}
//                     </td>
//                     <td className="py-3 px-4">
//                       <div className="space-y-1">
//                         <div className="flex items-center gap-2 text-sm">
//                           <Mail className="h-3 w-3" />
//                           {employee.email}
//                         </div>
//                         <div className="flex items-center gap-2 text-sm">
//                           <Phone className="h-3 w-3" />
//                           {employee.phone}
//                         </div>
//                       </div>
//                     </td>
//                     <td className="py-3 px-4 text-sm">
//                       {new Date(employee.joinDate).toLocaleDateString()}
//                     </td>
//                     <td className="py-3 px-4 text-sm">
//                       {employee.lastActive}
//                     </td>
//                     <td className="py-3 px-4">
//                       <Badge variant="outline">
//                         {employee.tasksCompleted}
//                       </Badge>
//                     </td>
//                     <td className="py-3 px-4 text-right">
//                       <DropdownMenu>
//                         <DropdownMenuTrigger asChild>
//                           <Button variant="ghost" size="sm">
//                             <MoreHorizontal className="h-4 w-4" />
//                           </Button>
//                         </DropdownMenuTrigger>
//                         <DropdownMenuContent align="end">
//                           <DropdownMenuItem>
//                             <Edit className="h-4 w-4 mr-2" />
//                             Edit Details
//                           </DropdownMenuItem>
//                           <DropdownMenuItem onClick={() => handleUpdateUserStatus(employee.id, employee.status === 'active' ? 'inactive' : 'active')}>
//                             {employee.status === 'active' ? (
//                               <>
//                                 <UserX className="h-4 w-4 mr-2" />
//                                 Deactivate
//                               </>
//                             ) : (
//                               <>
//                                 <UserCheck className="h-4 w-4 mr-2" />
//                                 Activate
//                               </>
//                             )}
//                           </DropdownMenuItem>
//                           <AlertDialog>
//                             <AlertDialogTrigger asChild>
//                               <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-red-600">
//                                 <Trash2 className="h-4 w-4 mr-2" />
//                                 Delete
//                               </DropdownMenuItem>
//                             </AlertDialogTrigger>
//                             <AlertDialogContent>
//                               <AlertDialogHeader>
//                                 <AlertDialogTitle>Delete Employee</AlertDialogTitle>
//                                 <AlertDialogDescription>
//                                   Are you sure you want to delete {employee.name}? This action cannot be undone.
//                                 </AlertDialogDescription>
//                               </AlertDialogHeader>
//                               <AlertDialogFooter>
//                                 <AlertDialogCancel>Cancel</AlertDialogCancel>
//                                 <AlertDialogAction onClick={() => handleDeleteUser(employee.id)} className="bg-red-600 hover:bg-red-700">
//                                   Delete
//                                 </AlertDialogAction>
//                               </AlertDialogFooter>
//                             </AlertDialogContent>
//                           </AlertDialog>
//                         </DropdownMenuContent>
//                       </DropdownMenu>
//                     </td>
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//           </div>
//         </CardContent>
//       </Card> */}
//     </div>
//   );
// }

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Users, UserCheck, UserX, Calendar } from "lucide-react";

const roles = [
  {
    id: "admin",
    name: "Admin",
    color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  },
  {
    id: "manager",
    name: "Manager",
    color:
      "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  },
  {
    id: "editor",
    name: "Editor",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  },
  {
    id: "qc",
    name: "QC Specialist",
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  },
  {
    id: "scheduler",
    name: "Scheduler",
    color:
      "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  },
  {
    id: "videographer",
    name: "Videographer",
    color: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
  },
];

const statusOptions = [
  {
    id: "active",
    name: "Active",
    color: "bg-green-500 text-white dark:bg-green-600 dark:text-white",
  },
  {
    id: "inactive",
    name: "Inactive",
    color: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  },
  {
    id: "on-leave",
    name: "On Leave",
    color:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  },
];

interface Employee {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: string;
  status: string;
  joinDate: string;
  lastActive: string;
  tasksCompleted: number;
  avatar: string;
}

interface EmployeeApiResponse {
  ok: boolean;
  employees: Array<{
    id: number;
    name: string;
    email: string;
    role: string;
    employeeStatus: string;
    joinedAt: string;
  }>;
}

export function UserManagementTab() {
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [employeesList, setEmployeesList] = useState<Employee[]>([]);
  const [clientsCount, setClientsCount] = useState(0);

  useEffect(() => {
    async function loadEmployees() {
      try {
        const res = await fetch("api/employee/list");
        const data: EmployeeApiResponse = await res.json();

        if (data.ok) {
          const formatted: Employee[] = data.employees.map((u) => {
            const initials =
              u.name && u.name.trim() !== ""
                ? u.name
                    .split(" ")
                    .map((n: string) => n[0])
                    .join("")
                : "U";

            return {
              id: u.id,
              name: u.name || "No Name",
              email: u.email,
              phone: "N/A",
              role: u.role,
              status:
                u.employeeStatus === "ACTIVE"
                  ? "active"
                  : u.employeeStatus === "INACTIVE"
                  ? "inactive"
                  : "active",
              joinDate: u.joinedAt || "",
              lastActive: "N/A",
              tasksCompleted: 0,
              avatar: initials,
            };
          });

          setEmployeesList(formatted);
        }
      } catch (error) {
        console.error("Failed to fetch employees →", error);
      }
    }

    async function loadClientsCount() {
      try {
        const res = await fetch("/api/clients");
        const data = await res.json();
        if (data.clients && Array.isArray(data.clients)) {
          setClientsCount(data.clients.length);
        }
      } catch (error) {
        console.error("Failed to fetch clients count →", error);
      }
    }

    loadEmployees();
    loadClientsCount();
  }, []);

  const filteredEmployees = employeesList.filter((employee) => {
    const matchesSearch =
      employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === "all" || employee.role === roleFilter;
    const matchesStatus =
      statusFilter === "all" || employee.status === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  const getRoleBadge = (roleId: string) => {
    const role = roles.find((r) => r.id === roleId);
    return role ? <Badge className={role.color}>{role.name}</Badge> : null;
  };

  const getStatusBadge = (statusId: string) => {
    const status = statusOptions.find((s) => s.id === statusId);
    return status ? (
      <Badge className={status.color}>{status.name}</Badge>
    ) : null;
  };

  const roleStats = roles.map((role) => ({
    ...role,
    count: employeesList.filter((emp) => emp.role === role.id).length,
  }));

  const statusStats = statusOptions.map((status) => ({
    ...status,
    count: employeesList.filter((emp) => emp.status === status.id).length,
  }));

  // Use filteredEmployees, getRoleBadge, getStatusBadge to prevent unused variable warnings
  console.log({ filteredEmployees, getRoleBadge, getStatusBadge });

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Employees</p>
                <h3 className="mt-2">{employeesList.length}</h3>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Users</p>
                <h3 className="mt-2">
                  {
                    employeesList.filter((emp) => emp.status === "active")
                      .length
                  }
                </h3>
              </div>
              <UserCheck className="h-8 w-8 text-black" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">On Leave</p>
                <h3 className="mt-2">
                  {
                    employeesList.filter((emp) => emp.status === "on-leave")
                      .length
                  }
                </h3>
              </div>
              <Calendar className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Inactive</p>
                <h3 className="mt-2">
                  {
                    employeesList.filter((emp) => emp.status === "inactive")
                      .length
                  }
                </h3>
              </div>
              <UserX className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Role Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Role Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {roleStats.map((role) => (
                <div
                  key={role.id}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <Badge className={role.color}>{role.name}</Badge>
                  </div>
                  <span className="font-medium">{role.count}</span>
                </div>
              ))}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge className="bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200">
                    Clients
                  </Badge>
                </div>
                <span className="font-medium">{clientsCount}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {statusStats.map((status) => (
                <div
                  key={status.id}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <Badge className={status.color}>{status.name}</Badge>
                  </div>
                  <span className="font-medium">{status.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
