import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/alert-dialog';
import { VisuallyHidden } from '../ui/visually-hidden';
import { Users, UserPlus, Search, MoreHorizontal, Mail, Phone, Calendar, Edit, Trash2, UserCheck, UserX, Filter, Clock } from 'lucide-react';

const roles = [
  { id: 'admin', name: 'Admin', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
  { id: 'manager', name: 'Manager', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
  { id: 'editor', name: 'Editor', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  { id: 'qc', name: 'QC Specialist', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  { id: 'scheduler', name: 'Scheduler', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
  { id: 'videographer', name: 'Videographer', color: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200' },
  { id: 'client', name: 'Client', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200' },
  { id: 'sales', name: 'Sales', color: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200' }
];

const statusOptions = [
  { id: 'active', name: 'Active', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  { id: 'inactive', name: 'Inactive', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200' },
  { id: 'on-leave', name: 'On Leave', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' }
];

interface User {
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

const formatDateMDY = (value: string | Date | null | undefined) => {
  if (!value) return '-';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '-';

  // Use UTC methods
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const year = date.getUTCFullYear();

  return `${month}-${day}-${year}`;
};

const formatLastActive = (value: string | null | undefined): string => {
  if (!value) return "Never";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "Never";
  
  // Use UTC time for comparison
  const now = new Date();
  const nowUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 
                          now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds());
  const valueUtc = d.getTime(); // Already in UTC if ISO string
  
  const diffMs = nowUtc - valueUtc;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffMins < 0) return "Active now"; // Future session
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  
  // For older dates, show the actual date in UTC
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  return `${mm}-${dd}-${yyyy}`;
};

const getLastActiveColor = (value: string | null | undefined): string => {
  if (!value) return "text-gray-400";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "text-gray-400";
  
  // Use UTC time for comparison
  const now = new Date();
  const nowUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 
                          now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds());
  const valueUtc = d.getTime();
  
  const diffMs = nowUtc - valueUtc;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffHours < 1) return "text-green-600"; // Active within the hour
  if (diffHours < 24) return "text-green-500"; // Active today
  if (diffDays < 7) return "text-yellow-600"; // Active this week
  return "text-gray-500"; // Inactive for over a week
};

export function ComprehensiveUserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    phone: '',
    role: '',
    status: 'active'
  });

  // Fetch real user data from API
  useEffect(() => {
    async function fetchUsers() {
      try {
        setLoading(true);
        const res = await fetch('/api/employee/list');
        const data = await res.json();
        
        if (data.ok && data.employees) {
          const formattedUsers: User[] = data.employees.map((emp: any) => ({
            id: emp.id,
            name: emp.name || 'No Name',
            email: emp.email,
            phone: emp.phone || 'N/A',
            role: emp.role || 'editor',
            status: emp.employeeStatus === 'ACTIVE' ? 'active' : 
                   emp.employeeStatus === 'INACTIVE' ? 'inactive' : 'active',
            joinDate: emp.joinedAt || emp.createdAt,
            lastActive: emp.lastActive,
            tasksCompleted: 0,
            avatar: emp.name ? emp.name.split(' ').map((n: string) => n[0]).join('').toUpperCase() : 'U'
          }));
          setUsers(formattedUsers);
        }
      } catch (error) {
        console.error('Failed to fetch users:', error);
      } finally {
        setLoading(false);
      }
    }
    
    fetchUsers();
  }, []);

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  const getRoleBadge = (roleId: string) => {
    const role = roles.find(r => r.id === roleId);
    return role ? (
      <Badge className={role.color}>
        {role.name}
      </Badge>
    ) : null;
  };

  const getStatusBadge = (statusId: string) => {
    const status = statusOptions.find(s => s.id === statusId);
    return status ? (
      <Badge className={status.color}>
        {status.name}
      </Badge>
    ) : null;
  };

  const handleAddUser = () => {
    const newUserData = {
      id: Math.max(...users.map(u => u.id)) + 1,
      ...newUser,
      joinDate: new Date().toISOString().split('T')[0],
      lastActive: new Date().toISOString(),
      tasksCompleted: 0,
      avatar: newUser.name.split(' ').map(n => n.charAt(0)).join('').toUpperCase()
    };

    setUsers([...users, newUserData]);
    setIsAddUserDialogOpen(false);
    setNewUser({ name: '', email: '', phone: '', role: '', status: 'active' });
  };

  const handleDeleteUser = (userId: number) => {
    setUsers(users.filter(user => user.id !== userId));
  };

  const handleUpdateUserStatus = (userId: number, newStatus: string) => {
    setUsers(users.map(user =>
      user.id === userId ? { ...user, status: newStatus } : user
    ));
  };

  const roleStats = roles.map(role => ({
    ...role,
    count: users.filter(user => user.role === role.id).length
  }));

  const statusStats = statusOptions.map(status => ({
    ...status,
    count: users.filter(user => user.status === status.id).length
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">User Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage user accounts, roles, and permissions
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          <span className="ml-3 text-muted-foreground">Loading users...</span>
        </div>
      ) : (
      <>
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Users</p>
                <h3 className="mt-2">{users.length}</h3>
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
                <h3 className="mt-2">{users.filter(user => user.status === 'active').length}</h3>
              </div>
              <UserCheck className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">On Leave</p>
                <h3 className="mt-2">{users.filter(user => user.status === 'on-leave').length}</h3>
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
                <h3 className="mt-2">{users.filter(user => user.status === 'inactive').length}</h3>
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
                <div key={role.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge className={role.color}>{role.name}</Badge>
                  </div>
                  <span className="font-medium">{role.count}</span>
                </div>
              ))}
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
                <div key={status.id} className="flex items-center justify-between">
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

      {/* User Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              User Management
            </CardTitle>

            <Dialog open={isAddUserDialogOpen} onOpenChange={setIsAddUserDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add User
                </Button>
              </DialogTrigger>
              <DialogContent aria-describedby="add-user-description">
                <DialogHeader>
                  <DialogTitle>Add New User</DialogTitle>
                  <DialogDescription id="add-user-description">
                    Fill in the details below to add a new user to the system.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm">Full Name</label>
                    <Input
                      value={newUser.name}
                      onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                      placeholder="Enter full name"
                    />
                  </div>
                  <div>
                    <label className="text-sm">Email</label>
                    <Input
                      type="email"
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                      placeholder="Enter email address"
                    />
                  </div>
                  <div>
                    <label className="text-sm">Phone</label>
                    <Input
                      value={newUser.phone}
                      onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                      placeholder="Enter phone number"
                    />
                  </div>
                  <div>
                    <label className="text-sm">Role</label>
                    <Select value={newUser.role} onValueChange={(value) => setNewUser({ ...newUser, role: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((role) => (
                          <SelectItem key={role.id} value={role.id}>
                            {role.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end gap-3">
                    <Button variant="outline" onClick={() => setIsAddUserDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddUser}>
                      Add User
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64"
              />
            </div>

            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {statusOptions.map((status) => (
                  <SelectItem key={status.id} value={status.id}>
                    {status.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* User Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">User</th>
                  <th className="text-left py-3 px-4">Role</th>
                  <th className="text-left py-3 px-4">Status</th>
                  <th className="text-left py-3 px-4">Contact</th>
                  <th className="text-left py-3 px-4">Join Date</th>
                  <th className="text-left py-3 px-4">Last Active</th>
                  <th className="text-left py-3 px-4">Tasks</th>
                  <th className="text-right py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                          {user.avatar}
                        </div>
                        <div>
                          <div className="font-medium">{user.name}</div>
                          <div className="text-sm text-muted-foreground">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {getRoleBadge(user.role)}
                    </td>
                    <td className="py-3 px-4">
                      {getStatusBadge(user.status)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="h-3 w-3" />
                          {user.email}
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="h-3 w-3" />
                          {user.phone}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm">
                       {formatDateMDY(user.joinDate)}
                    </td>
                    <td className="py-3 px-4 text-sm">
                      <div className={`flex items-center gap-1.5 ${getLastActiveColor(user.lastActive)}`}>
                        <Clock className="h-3 w-3" />
                        {formatLastActive(user.lastActive)}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="outline">
                        {user.tasksCompleted}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleUpdateUserStatus(user.id, user.status === 'active' ? 'inactive' : 'active')}>
                            {user.status === 'active' ? (
                              <>
                                <UserX className="h-4 w-4 mr-2" />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <UserCheck className="h-4 w-4 mr-2" />
                                Activate
                              </>
                            )}
                          </DropdownMenuItem>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-red-600">
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete User</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete {user.name}? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteUser(user.id)} className="bg-red-600 hover:bg-red-700">
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      </>
      )}
    </div>
  );
}